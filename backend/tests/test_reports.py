import asyncio
import os
from datetime import timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from test_slice import headers, start

from app.config import Settings
from app.contracts import validate
from app.domain import now, stamp
from app.main import create_app
from app.storage import SqlStore, engine_for


@pytest.fixture
def report_client(tmp_path, monkeypatch):
    monkeypatch.setattr("app.auth.DEMO_SUBJECT", str(uuid4()))
    subject = str(uuid4())
    monkeypatch.setattr("app.auth.DEMO_CLINICIAN_SUBJECT", subject)
    url = os.environ.get("TEST_DATABASE_URL", f"sqlite+aiosqlite:///{tmp_path}/reports.db")
    with TestClient(create_app(Settings(database_url=url, demo_auth=True, _env_file=None))) as c:

        async def seed():
            engine = engine_for(url)
            async with engine.begin() as connection:
                store = SqlStore(connection)
                uid = str(uuid4())
                await store.add(
                    "users",
                    id=uid,
                    auth_subject=subject,
                    role="clinician",
                    disabled_at=None,
                    created_at=stamp(),
                )
                await store.add(
                    "clinician_profiles",
                    clinician_id=uid,
                    display_name="Fictional clinician",
                    verified_at=stamp(),
                    verified_by=uid,
                )
            await engine.dispose()
            return uid

        c.clinician_id = asyncio.run(seed())
        yield c


def complete(c):
    sid = start(c)
    rec = c.post(
        "/v1/activity-recommendations", json={"session_id": sid, "limit": 1}, headers=headers()
    ).json()
    option = rec["options"][0]["activity"]
    a = c.post(
        "/v1/activity-sessions",
        json={
            "session_id": sid,
            "recommendation_id": rec["recommendation_id"],
            "activity_id": option["activity_id"],
            "activity_version": option["activity_version"],
            "selection_channel": "touch",
        },
        headers=headers(),
    )
    assert a.status_code == 201, a.text
    aid = a.json()["activity_session_id"]
    r = c.post(
        f"/v1/activity-sessions/{aid}/events",
        json={
            "client_event_id": str(uuid4()),
            "expected_version": 1,
            "event_type": "complete",
            "elapsed_seconds": 60,
            "event_at": stamp(),
        },
        headers=headers(),
    )
    assert r.status_code == 200, r.text
    r = c.post(
        f"/v1/activity-sessions/{aid}/feedback",
        json={"rating": 4, "comment": None},
        headers=headers(),
    )
    assert r.status_code == 201, r.text
    return aid


def report(c):
    r = c.post(
        "/v1/reports",
        json={"period_start": (now() - timedelta(days=1)).isoformat(), "period_end": stamp()},
        headers=headers(),
    )
    assert r.status_code == 202, r.text
    validate("ReportReceipt", r.json())
    rid = r.json()["report_id"]
    r = c.get("/v1/reports/" + rid, headers=headers())
    assert r.status_code == 200, r.text
    validate("Report", r.json())
    return rid, r.json()


def sharing(c):
    link = c.post("/v1/care-links", json={"clinician_id": c.clinician_id}, headers=headers())
    assert link.status_code == 201, link.text
    lid = link.json()["care_link_id"]
    # Patient cannot accept on the clinician's behalf.
    assert (
        c.patch("/v1/care-links/" + lid, json={"action": "accept"}, headers=headers()).status_code
        == 403
    )
    accepted = c.patch(
        "/v1/care-links/" + lid, json={"action": "accept"}, headers=headers("demo-clinician-token")
    )
    assert accepted.status_code == 200, accepted.text
    grant = c.post(
        "/v1/consents",
        json={
            "scope": "reports",
            "care_link_id": lid,
            "expires_at": (now() + timedelta(days=1)).isoformat(),
            "data_from": None,
        },
        headers=headers(),
    )
    assert grant.status_code == 201, grant.text
    return lid, grant.json()["consent_grant_id"]


def test_stored_report_and_current_doctor_authorization(report_client):
    c = report_client
    aid = complete(c)
    rid, payload = report(c)
    pid = payload["patient_id"]
    assert payload["completed_activities"][0]["activity_session_id"] == aid
    assert payload["feedback"][0]["rating"] == 4
    assert next(t for t in payload["trends"] if t["metric"] == "activity_rating")["mean"] == 4
    assert len(payload["sources"]) == 2
    path = f"/v1/doctor/patients/{pid}/reports/{rid}"
    assert c.get(path, headers=headers("demo-clinician-token")).status_code == 403
    _lid, grant = sharing(c)
    me = c.get("/v1/me", headers=headers("demo-clinician-token"))
    assert me.status_code == 200, me.text
    assert me.json()["clinician_verified"]
    listed = c.get("/v1/doctor/patients", headers=headers("demo-clinician-token"))
    assert listed.status_code == 200, listed.text
    validate("DoctorPatientPage", listed.json())
    shared = c.get(path, headers=headers("demo-clinician-token"))
    assert shared.status_code == 200, shared.text
    assert shared.json() == payload
    # Wrong patient path and ordinary patient identity cannot access clinician records.
    assert (
        c.get(
            f"/v1/doctor/patients/{uuid4()}/reports/{rid}", headers=headers("demo-clinician-token")
        ).status_code
        == 404
    )
    assert c.get(path, headers=headers()).status_code == 403
    key = str(uuid4())
    assert c.delete("/v1/consents/" + grant, headers=headers(key=key)).status_code == 204
    assert c.delete("/v1/consents/" + grant, headers=headers(key=key)).status_code == 204
    assert c.get(path, headers=headers("demo-clinician-token")).status_code == 403
    assert (
        c.get("/v1/doctor/patients", headers=headers("demo-clinician-token")).json()["items"] == []
    )


def test_grant_period_expiry_and_care_link_revocation(report_client):
    c = report_client
    complete(c)
    rid, payload = report(c)
    pid = payload["patient_id"]
    lid, _ = sharing(c)
    path = f"/v1/doctor/patients/{pid}/reports/{rid}"
    limited = c.post(
        "/v1/consents",
        json={
            "scope": "reports",
            "care_link_id": lid,
            "expires_at": (now() + timedelta(days=1)).isoformat(),
            "data_from": stamp(),
        },
        headers=headers(),
    )
    assert limited.status_code == 201, limited.text
    assert c.get(path, headers=headers("demo-clinician-token")).status_code == 403
    assert (
        c.get(f"/v1/doctor/patients/{pid}/reports", headers=headers("demo-clinician-token")).json()[
            "items"
        ]
        == []
    )
    revoked = c.patch("/v1/care-links/" + lid, json={"action": "revoke"}, headers=headers())
    assert revoked.status_code == 200, revoked.text
    assert c.get(path, headers=headers("demo-clinician-token")).status_code == 403
    # Re-linking must not revive earlier consent.
    invited = c.post("/v1/care-links", json={"clinician_id": c.clinician_id}, headers=headers())
    assert invited.json()["state"] == "pending"
    assert c.get(path, headers=headers("demo-clinician-token")).status_code == 403


def test_report_replay_and_bound_cursor(report_client):
    c = report_client
    start(c)
    body = {"period_start": (now() - timedelta(days=1)).isoformat(), "period_end": stamp()}
    key = str(uuid4())
    first = c.post("/v1/reports", json=body, headers=headers(key=key))
    assert first.status_code == 202, first.text
    assert c.post("/v1/reports", json=body, headers=headers(key=key)).json() == first.json()
    report(c)
    page = c.get("/v1/reports?limit=1", headers=headers())
    assert page.status_code == 200, page.text
    cursor = page.json()["next_cursor"]
    assert cursor
    next_page = c.get("/v1/reports", params={"limit": 1, "cursor": cursor}, headers=headers())
    assert next_page.status_code == 200, next_page.text
    assert next_page.json()["items"][0]["report_id"] != page.json()["items"][0]["report_id"]
    assert c.get("/v1/care-links", params={"cursor": cursor}, headers=headers()).status_code == 422


def test_expired_scope_and_unverified_clinician_cannot_read(report_client, monkeypatch):
    c = report_client
    complete(c)
    rid, payload = report(c)
    pid = payload["patient_id"]
    _lid, _grant = sharing(c)
    path = f"/v1/doctor/patients/{pid}/reports/{rid}"
    assert c.get(path, headers=headers("demo-clinician-token")).status_code == 200
    future = now() + timedelta(days=2)
    monkeypatch.setattr("app.care.now", lambda: future)
    assert c.get(path, headers=headers("demo-clinician-token")).status_code == 403
    assert (
        c.get("/v1/doctor/patients", headers=headers("demo-clinician-token")).json()["items"] == []
    )


def test_unverified_clinician_loses_existing_report_access(report_client):
    c = report_client
    complete(c)
    rid, payload = report(c)
    sharing(c)
    path = f"/v1/doctor/patients/{payload['patient_id']}/reports/{rid}"
    assert c.get(path, headers=headers("demo-clinician-token")).status_code == 200

    async def unverify():
        engine = engine_for(c.app.state.settings.database_url)
        async with engine.begin() as connection:
            await SqlStore(connection).update(
                "clinician_profiles", {"clinician_id": c.clinician_id}, {"verified_at": None}
            )
        await engine.dispose()

    asyncio.run(unverify())
    assert c.get(path, headers=headers("demo-clinician-token")).status_code == 403
    assert c.get("/v1/me", headers=headers("demo-clinician-token")).status_code == 403


def test_report_lists_include_authorized_date_metadata_without_document_reads(report_client):
    c = report_client
    complete(c)
    rid, document = report(c)
    own_list = c.get("/v1/reports", headers=headers()).json()["items"]
    receipt = next(row for row in own_list if row["report_id"] == rid)
    assert receipt["period_start"] == document["period_start"]
    assert receipt["period_end"] == document["period_end"]
    assert receipt["created_at"] == document["generated_at"]
    pid = c.get("/v1/me", headers=headers()).json()["user_id"]
    _link, grant = sharing(c)
    listed = c.get(f"/v1/doctor/patients/{pid}/reports", headers=headers("demo-clinician-token"))
    assert listed.status_code == 200
    item = next(row for row in listed.json()["items"] if row["report_id"] == receipt["report_id"])
    validate("ReportReceipt", item)
    assert {key: item[key] for key in ("period_start", "period_end", "created_at")} == {
        key: receipt[key] for key in ("period_start", "period_end", "created_at")
    }
    c.delete(f"/v1/consents/{grant}", headers=headers())
    denied = c.get(f"/v1/doctor/patients/{pid}/reports", headers=headers("demo-clinician-token"))
    assert denied.status_code == 403
    assert "period_start" not in denied.text
