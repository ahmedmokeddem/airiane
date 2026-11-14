import asyncio
from datetime import timedelta
from uuid import uuid4

from test_reports import report, report_client, sharing  # noqa: F401
from test_slice import headers, onboard, start

from app.domain import now, stamp
from app.storage import SqlStore, engine_for


def proposal(sid):
    return {
        "session_id": sid,
        "theme": "fatigue",
        "text": "I felt tired this afternoon.",
        "observed_at": stamp(),
        "statement_kind": "direct_statement",
        "confirmation": True,
    }


def test_confirmation_validation_duplicate_and_no_unconfirmed_persistence(report_client):  # noqa: F811
    c = report_client
    sid = start(c)
    body = proposal(sid)
    assert (
        c.post(
            "/v1/confirmed-insights", json={**body, "confirmation": False}, headers=headers()
        ).status_code
        == 422
    )
    assert (
        c.post("/v1/confirmed-insights", json={**body, "text": "  "}, headers=headers()).status_code
        == 422
    )
    assert (
        c.post(
            "/v1/confirmed-insights",
            json={**body, "observed_at": (now() + timedelta(hours=1)).isoformat()},
            headers=headers(),
        ).status_code
        == 422
    )
    assert c.get("/v1/confirmed-insights", headers=headers()).json()["items"] == []
    key = str(uuid4())
    first = c.post("/v1/confirmed-insights", json=body, headers=headers(key=key))
    assert first.status_code == 201, first.text
    row = first.json()
    assert row["state"] == "confirmed" and len(row["sources"]) == 1
    assert c.post("/v1/confirmed-insights", json=body, headers=headers(key=key)).json() == row
    assert (
        c.post("/v1/confirmed-insights", json=body, headers=headers()).json()["insight_id"]
        == row["insight_id"]
    )
    assert len(c.get("/v1/confirmed-insights", headers=headers()).json()["items"]) == 1
    onboard(c, "demo-other-patient-token")
    assert (
        c.get("/v1/confirmed-insights", headers=headers("demo-other-patient-token")).json()["items"]
        == []
    )
    assert (
        c.post(
            "/v1/confirmed-insights", json=body, headers=headers("demo-other-patient-token")
        ).status_code
        == 404
    )

    async def inspect():
        engine = engine_for(c.app.state.settings.database_url)
        async with engine.begin() as connection:
            store = SqlStore(connection)
            source = await store.get("source_records", id=row["sources"][0]["source_id"])
            assert source["kind"] == "structured_input"
            assert "text" not in source
            outcomes = await store.all("idempotency_keys", actor_id=row["patient_id"])
            assert all(body["text"] not in str(r["response_body"]) for r in outcomes)
        await engine.dispose()

    asyncio.run(inspect())


def test_correction_deletion_scrubs_reports_and_enforces_owner(report_client):  # noqa: F811
    c = report_client
    sid = start(c)
    body = proposal(sid)
    old = c.post("/v1/confirmed-insights", json=body, headers=headers()).json()
    rid, payload = report(c)
    assert payload["confirmed_insights"][0]["text"] == body["text"]
    assert payload["factual_overview"]["confirmed_insight_count"] == 1
    _, grant = sharing(c)
    path = f"/v1/doctor/patients/{old['patient_id']}/reports/{rid}"
    assert c.get(path, headers=headers("demo-clinician-token")).status_code == 200
    correction = {
        **body,
        "text": "I felt tired yesterday afternoon.",
        "expected_version": 1,
        "reason": "Corrected the time",
    }
    url = f"/v1/confirmed-insights/{old['insight_id']}/corrections"
    denied = c.post(url, json=correction, headers=headers("demo-clinician-token"))
    assert denied.status_code == 403
    corrected = c.post(url, json=correction, headers=headers())
    assert corrected.status_code == 201, corrected.text
    row = corrected.json()
    assert row["supersedes_insight_id"] == old["insight_id"]
    assert c.post(url, json=correction, headers=headers()).status_code == 409
    stale = c.get("/v1/reports/" + rid, headers=headers()).json()
    assert stale["state"] == "stale" and stale["confirmed_insights"] == []
    rid2, payload2 = report(c)
    assert payload2["confirmed_insights"] == [row]
    key = str(uuid4())
    delete_url = "/v1/confirmed-insights/" + row["insight_id"]
    assert c.delete(delete_url, headers=headers(key=key)).status_code == 204
    assert c.delete(delete_url, headers=headers(key=key)).status_code == 204
    assert c.get("/v1/confirmed-insights", headers=headers()).json()["items"] == []
    assert c.get("/v1/reports/" + rid2, headers=headers()).json()["confirmed_insights"] == []
    assert c.delete("/v1/consents/" + grant, headers=headers()).status_code == 204
    assert c.get(path, headers=headers("demo-clinician-token")).status_code == 403

    async def inspect():
        engine = engine_for(c.app.state.settings.database_url)
        async with engine.begin() as connection:
            store = SqlStore(connection)
            rows = await store.all("confirmed_insights", patient_id=row["patient_id"])
            assert all(r["state"] == "deleted" and r["text"] == "[deleted]" for r in rows)
            reports = await store.all("reports", patient_id=row["patient_id"])
            assert all(
                body["text"] not in str(r["payload"])
                and correction["text"] not in str(r["payload"])
                for r in reports
            )
        await engine.dispose()

    asyncio.run(inspect())


def test_profile_and_preferences_are_owned_validated_and_replayable(report_client):  # noqa: F811
    c = report_client
    start(c)
    key = str(uuid4())
    body = {
        "display_name": "Fictional A",
        "timezone": "Europe/Helsinki",
        "avatar": {"color": "teal", "accessory": "leaf"},
    }
    response = c.patch("/v1/me", json=body, headers=headers(key=key))
    assert response.status_code == 200, response.text
    assert response.json()["avatar"] == body["avatar"]
    assert c.patch("/v1/me", json=body, headers=headers(key=key)).json() == response.json()
    assert c.patch("/v1/me", json={"timezone": "not/a/zone"}, headers=headers()).status_code == 422
    preferences = {
        "preferences": {"preferred_activity_kind": "breathing", "preferred_duration_seconds": 60}
    }
    key2 = str(uuid4())
    context = c.patch("/v1/patient-context", json=preferences, headers=headers(key=key2))
    assert context.status_code == 200, context.text
    assert (
        c.get("/v1/patient-context", headers=headers()).json()["preferences"]
        == preferences["preferences"]
    )
    assert (
        c.patch("/v1/patient-context", json=preferences, headers=headers(key=key2)).json()
        == context.json()
    )
    assert c.get("/v1/activities", headers=headers()).status_code == 200
