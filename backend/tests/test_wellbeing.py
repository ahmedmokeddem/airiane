import asyncio
from datetime import timedelta
from uuid import uuid4

from test_reports import report, report_client, sharing  # noqa: F401
from test_slice import client, headers, start  # noqa: F401

from app.contracts import validate
from app.domain import now, stamp
from app.storage import SqlStore, engine_for

DOCTOR = "demo-clinician-token"


def observe(c, kind, value, session_id=None, key=None, at=None):
    r = c.post(
        "/v1/observations",
        json={
            "session_id": session_id,
            "kind": kind,
            "value": value,
            "observed_at": at or stamp(),
            "sources": [],
        },
        headers=headers(key=key),
    )
    assert r.status_code == 201, r.text
    validate("Observation", r.json())
    assert r.json()["state"] == "proposed"
    return r.json()


def confirm(c, obs, decision="confirm", **extra):
    r = c.post(
        f"/v1/observations/{obs['observation_id']}/confirmation",
        json={"expected_version": obs["version"], "decision": decision, **extra},
        headers=headers(),
    )
    assert r.status_code == 200, r.text
    validate("Observation", r.json())
    return r.json()


def test_catalog_has_multimodal_activities_with_breathing_first(client):  # noqa: F811
    sid = start(client)
    items = client.get("/v1/activities", headers=headers()).json()["items"]
    assert items[0]["activity_id"] == "22222222-2222-4222-8222-222222222222"
    assert {a["kind"] for a in items} >= {"breathing", "nature", "behavioral_activation"}
    assert "40 Hz Acoustic Resonance" in {a["title"] for a in items}
    rec = client.post(
        "/v1/activity-recommendations", json={"session_id": sid, "limit": 3}, headers=headers()
    )
    assert rec.status_code == 201, rec.text
    options = rec.json()["options"]
    assert [o["rank"] for o in options] == [1, 2, 3]
    assert options[0]["activity"]["title"] == "Calm Breathing"
    assert len({o["reason"] for o in options}) == 3


def test_observations_need_explicit_confirmation_before_reports(report_client):  # noqa: F811
    c = report_client
    start(c)
    mood = observe(c, "mood", 6)
    sleep = observe(c, "sleep_hours", 7.5)
    energy = observe(c, "energy", 3)
    # Out-of-scale values and foreign sources are rejected.
    for kind, value in [("mood", 11), ("energy", 12)]:
        bad = {"session_id": None, "kind": kind, "value": value, "observed_at": stamp()}
        assert (
            c.post("/v1/observations", json={**bad, "sources": []}, headers=headers()).status_code
            == 422
        )
    foreign = {"source_id": str(uuid4()), "source_revision": 1}
    bad = {
        "session_id": None,
        "kind": "mood",
        "value": 5,
        "observed_at": stamp(),
        "sources": [foreign],
    }
    assert c.post("/v1/observations", json=bad, headers=headers()).status_code == 422

    _, payload = report(c)
    assert payload["observations"] == []

    confirmed = confirm(c, mood)
    assert confirmed["state"] == "confirmed" and confirmed["version"] == 2
    assert len(confirmed["sources"]) == 1
    confirm(c, sleep, value=8)
    assert confirm(c, energy, decision="reject")["state"] == "rejected"
    # Stale version and repeat decisions are conflicts.
    stale = c.post(
        f"/v1/observations/{mood['observation_id']}/confirmation",
        json={"expected_version": 1, "decision": "confirm"},
        headers=headers(),
    )
    assert stale.status_code == 409
    listed = c.get("/v1/observations?limit=2", headers=headers())
    assert listed.status_code == 200, listed.text
    validate("ObservationPage", listed.json())
    assert len(listed.json()["items"]) == 2 and listed.json()["next_cursor"]

    _, payload = report(c)
    trends = {t["metric"]: t for t in payload["trends"]}
    assert trends["mood"]["mean"] == 6 and trends["mood"]["count"] == 1
    assert trends["sleep_hours"]["mean"] == 8
    assert trends["energy"]["count"] == 0
    assert len(payload["observations"]) == 2


def test_idempotent_observation_replay(client):  # noqa: F811
    start(client)
    key = str(uuid4())
    at = stamp()
    first = observe(client, "energy", 4, key=key, at=at)
    assert observe(client, "energy", 4, key=key, at=at) == first


def test_review_request_visible_only_with_alerts_consent(report_client):  # noqa: F811
    c = report_client
    sid = start(c)
    pid = c.get("/v1/me", headers=headers()).json()["user_id"]
    # Recorded without any authorized recipient.
    r = c.post(
        "/v1/review-requests",
        json={"session_id": sid, "reason": "patient_requested_review"},
        headers=headers(),
    )
    assert r.status_code == 201, r.text
    validate("Alert", r.json())
    alert = r.json()
    assert alert["state"] == "open" and len(alert["sources"]) == 1
    path = f"/v1/doctor/patients/{pid}/alerts"
    lid, _ = sharing(c)
    # A reports grant alone does not expose alerts.
    assert c.get(path, headers=headers(DOCTOR)).status_code == 403
    grant = c.post(
        "/v1/consents",
        json={
            "scope": "alerts",
            "care_link_id": lid,
            "expires_at": (now() + timedelta(days=7)).isoformat(),
            "data_from": None,
        },
        headers=headers(),
    )
    assert grant.status_code == 201, grant.text
    # Request was recorded before delivery was allowed: not visible yet.
    assert c.get(path, headers=headers(DOCTOR)).json()["items"] == []
    # Repeating the request re-checks delivery instead of duplicating it.
    again = c.post(
        "/v1/review-requests",
        json={"session_id": None, "reason": "patient_requested_review"},
        headers=headers(),
    )
    assert again.json()["alert_id"] == alert["alert_id"]
    listed = c.get(path, headers=headers(DOCTOR))
    assert listed.status_code == 200, listed.text
    validate("AlertPage", listed.json())
    assert [a["alert_id"] for a in listed.json()["items"]] == [alert["alert_id"]]
    patients = c.get("/v1/doctor/patients", headers=headers(DOCTOR)).json()["items"]
    assert patients[0]["scopes"] == ["alerts", "reports"]

    target = f"{path}/{alert['alert_id']}"
    # Patients cannot acknowledge on the clinician's behalf.
    body = {"expected_version": 1, "state": "acknowledged"}
    assert c.patch(target, json=body, headers=headers()).status_code == 403
    key = str(uuid4())
    acked = c.patch(target, json=body, headers=headers(DOCTOR, key))
    assert acked.status_code == 200, acked.text
    validate("Alert", acked.json())
    assert acked.json()["state"] == "acknowledged" and acked.json()["version"] == 2
    assert c.patch(target, json=body, headers=headers(DOCTOR, key)).json() == acked.json()
    assert c.patch(target, json=body, headers=headers(DOCTOR)).status_code == 409
    mine = c.get("/v1/alerts", headers=headers()).json()
    validate("AlertPage", mine)
    assert mine["items"][0]["state"] == "acknowledged"
    # Revoking alerts consent hides alerts again.
    c.delete("/v1/consents/" + grant.json()["consent_grant_id"], headers=headers())
    assert c.get(path, headers=headers(DOCTOR)).status_code == 403


def test_voice_tools_propose_observation_and_request_review(client):  # noqa: F811
    sid = start(client)
    pid = client.get("/v1/me", headers=headers()).json()["user_id"]
    cid = str(uuid4())

    async def insert_connection():
        engine = engine_for(client.app.state.settings.database_url)
        async with engine.begin() as connection:
            await SqlStore(connection).add(
                "provider_connections",
                id=cid,
                patient_id=pid,
                session_id=sid,
                provider="elevenlabs",
                mode="voice",
                transport="webrtc",
                state="active",
                connection_epoch=1,
                context_version=2,
                version=1,
                provider_conversation_id=None,
                connect_before=(now() + timedelta(seconds=60)).isoformat(),
                closed_at=None,
                created_at=stamp(),
            )
        await engine.dispose()

    asyncio.run(insert_connection())
    base = f"/v1/conversation-sessions/{sid}/tools/"
    body = {
        "tool_call_id": "obs-1",
        "contract_version": "2.0.0",
        "connection_id": cid,
        "arguments": {"kind": "mood", "value": 5, "observed_at": stamp()},
    }
    first = client.post(base + "propose_observation", json=body, headers=headers())
    assert first.status_code == 200, first.text
    validate("ToolResult", first.json())
    obs = first.json()["result"]
    assert obs["state"] == "proposed" and obs["session_id"] == sid and obs["sources"] == []
    assert (
        client.post(base + "propose_observation", json=body, headers=headers()).json()
        == first.json()
    )
    review = client.post(
        base + "request_clinician_review",
        json={**body, "tool_call_id": "review-1", "arguments": {}},
        headers=headers(),
    )
    assert review.status_code == 200, review.text
    validate("ToolResult", review.json())
    assert review.json()["result"]["rule_key"] == "patient_requested_review"


def test_daily_good_news_digest_curates_strictly_uplifting_stories(client):  # noqa: F811
    from app.good_news import (
        GOOD_NEWS_ACTIVITY_ID,
        _clean_story,
        _is_strictly_uplifting,
        get_uplifting_news_instructions,
    )

    start(client)
    items = client.get("/v1/activities", headers=headers()).json()["items"]
    good_news = next(a for a in items if a["activity_id"] == GOOD_NEWS_ACTIVITY_ID)
    assert good_news["title"] == "Daily Good News Digest"
    assert good_news["kind"] == "social_reconnection"
    assert good_news["config"]["renderer"] == "social_v1"
    assert good_news["config"]["asset_id"] == "good-news-ambient-v1"
    assert len(good_news["config"]["instructions"]) >= 3

    assert _is_strictly_uplifting(
        "Espoo volunteers plant 500 native birch trees in community park."
    )
    assert not _is_strictly_uplifting("Breaking: market crash and political crisis spark protests.")
    assert not _is_strictly_uplifting("Severe accident causes death on highway.")
    assert len(_clean_story("A" * 600)) <= 420
    fallback = asyncio.run(get_uplifting_news_instructions("", ""))
    assert len(fallback) == 4 and all(_is_strictly_uplifting(s) for s in fallback)
