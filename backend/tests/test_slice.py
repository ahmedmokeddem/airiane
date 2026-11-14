import os
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.contracts import validate
from app.main import create_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr("app.auth.DEMO_SUBJECT", str(uuid4()))
    url = os.environ.get("TEST_DATABASE_URL", f"sqlite+aiosqlite:///{tmp_path}/test.db")
    with TestClient(create_app(Settings(database_url=url, demo_auth=True, _env_file=None))) as c:
        yield c


def headers(token="demo-patient-token", key=None):
    return {"Authorization": "Bearer " + token, "Idempotency-Key": key or str(uuid4())}


def onboard(c, token="demo-patient-token"):
    r = c.post(
        "/v1/me/onboarding",
        json={"display_name": "Fictional Patient", "timezone": "Europe/Helsinki"},
        headers=headers(token),
    )
    assert r.status_code == 201, r.text
    validate("Me", r.json())


def start(c):
    onboard(c)
    r = c.post("/v1/conversation-sessions", json={"mode": "voice"}, headers=headers())
    assert r.status_code == 201, r.text
    sid = r.json()["session_id"]
    r = c.patch(
        f"/v1/conversation-sessions/{sid}",
        json={"state": "active", "expected_version": 1},
        headers=headers(),
    )
    assert r.status_code == 200, r.text
    return sid


def test_vertical_slice_persists_and_replays(client):
    sid = start(client)
    r = client.post(
        "/v1/activity-recommendations", json={"session_id": sid, "limit": 1}, headers=headers()
    )
    assert r.status_code == 201, r.text
    rec = r.json()
    validate("Recommendation", rec)
    a = rec["options"][0]["activity"]
    body = {
        "session_id": sid,
        "recommendation_id": rec["recommendation_id"],
        "activity_id": a["activity_id"],
        "activity_version": 1,
        "selection_channel": "touch",
    }
    r = client.post("/v1/activity-sessions", json=body, headers=headers())
    assert r.status_code == 201, r.text
    activity = r.json()
    aid = activity["activity_session_id"]
    from app.domain import stamp

    event = {
        "client_event_id": str(uuid4()),
        "expected_version": 1,
        "event_type": "complete",
        "elapsed_seconds": 60,
        "event_at": stamp(),
    }
    key = str(uuid4())
    h = headers(key=key)
    first = client.post(f"/v1/activity-sessions/{aid}/events", json=event, headers=h)
    assert first.status_code == 200, first.text
    repeat = client.post(f"/v1/activity-sessions/{aid}/events", json=event, headers=h)
    assert repeat.json() == first.json()
    validate("ActivitySession", first.json())
    assert first.json()["state"] == "completed"
    changed = dict(event, elapsed_seconds=61)
    assert (
        client.post(f"/v1/activity-sessions/{aid}/events", json=changed, headers=h).status_code
        == 409
    )
    r = client.post(
        f"/v1/activity-sessions/{aid}/feedback",
        json={"rating": 4, "comment": None},
        headers=headers(),
    )
    assert r.status_code == 201, r.text
    journey = client.get("/v1/my-journey", headers=headers())
    assert journey.status_code == 200, journey.text
    validate("MyJourneyItemPage", journey.json())
    item = next(
        x for x in journey.json()["items"] if x["activity_session"]["activity_session_id"] == aid
    )
    assert item["feedback"]["rating"] == 4
    onboard(client, "demo-other-patient-token")
    assert (
        client.get(
            f"/v1/activity-sessions/{aid}", headers=headers("demo-other-patient-token")
        ).status_code
        == 404
    )


def test_camera_rejected_and_privacy_fails_closed(client):
    sid = start(client)
    r = client.post(
        "/v1/conversation-sessions",
        json={"mode": "voice", "camera_enabled": True},
        headers=headers(),
    )
    assert r.status_code == 422
    r = client.post(
        f"/v1/conversation-sessions/{sid}/agent-connections",
        json={"mode": "voice", "expected_version": 2},
        headers=headers(),
    )
    assert r.status_code == 503, r.text
    assert r.json()["code"] == "PROVIDER_PRIVACY_UNVERIFIED"
    assert client.get("/v1/me").status_code == 401
    oversized = client.post("/v1/conversation-sessions", content=b"x" * 262145, headers=headers())
    assert oversized.status_code == 413
    exposed = client.get("/openapi.json").json()
    assert (
        exposed["paths"]["/v1/conversation-sessions"]["post"]["x-implementation-status"]
        == "implemented-first-slice"
    )


def test_versions_and_required_idempotency(client):
    sid = start(client)
    r = client.patch(
        f"/v1/conversation-sessions/{sid}",
        json={"state": "ended", "expected_version": 1},
        headers=headers(),
    )
    assert r.status_code == 409
    r = client.post(
        "/v1/activity-recommendations",
        json={"session_id": sid, "limit": 1},
        headers={"Authorization": "Bearer demo-patient-token"},
    )
    assert r.status_code == 422


def test_demo_auth_cannot_enable_in_production():
    with pytest.raises(ValueError):
        Settings(environment="production", demo_auth=True, _env_file=None)


def test_client_tool_recommendations_and_connection_ownership(client):
    sid = start(client)
    pid = client.get("/v1/me", headers=headers()).json()["user_id"]
    cid = str(uuid4())
    import asyncio
    from datetime import timedelta

    from app.domain import now, stamp
    from app.storage import SqlStore, engine_for

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
    body = {
        "tool_call_id": "test-invocation",
        "contract_version": "2.0.0",
        "connection_id": cid,
        "arguments": {"limit": 1},
    }
    path = f"/v1/conversation-sessions/{sid}/tools/present_activity_recommendations"
    first = client.post(path, json=body, headers=headers())
    assert first.status_code == 200, first.text
    validate("ToolResult", first.json())
    # A new HTTP retry key still deduplicates the bridge invocation.
    repeat = client.post(path, json=body, headers=headers())
    assert repeat.json() == first.json()
    bad = {**body, "connection_id": str(uuid4()), "tool_call_id": "different"}
    assert client.post(path, json=bad, headers=headers()).status_code == 409
    bad = {**body, "arguments": {"limit": 2}}
    assert client.post(path, json=bad, headers=headers()).status_code == 409


def test_private_bootstrap_replays_encrypted_and_keeps_sql_secret_free(client, monkeypatch):
    sid = start(client)
    settings = client.app.state.settings
    settings.provider_privacy_verified = True
    settings.provider_privacy_policy_version = "fictional-test-only"
    settings.elevenlabs_api_key = "fixture-server-only"
    settings.elevenlabs_agent_id = "fixture-agent"
    import httpx

    original = httpx.AsyncClient
    calls = []

    def provider_response(request):
        calls.append(request)
        return httpx.Response(
            200,
            json={
                "token": "fixture-not-a-real-provider-credential",
                "conversation_id": "fixture-native-id",
            },
        )

    monkeypatch.setattr(
        "app.provider.httpx.AsyncClient",
        lambda **kwargs: original(transport=httpx.MockTransport(provider_response), **kwargs),
    )
    key = str(uuid4())
    body = {"mode": "voice", "expected_version": 2}
    path = f"/v1/conversation-sessions/{sid}/agent-connections"
    first = client.post(path, json=body, headers=headers(key=key))
    assert first.status_code == 200, first.text
    validate("AgentConnectionBootstrap", first.json())
    repeat = client.post(path, json=body, headers=headers(key=key))
    assert repeat.json() == first.json()
    assert len(calls) == 1
    assert (
        client.post(path, json={**body, "mode": "text"}, headers=headers(key=key)).status_code
        == 409
    )
    import asyncio

    from app.storage import SqlStore, engine_for

    async def read_metadata():
        engine = engine_for(settings.database_url)
        async with engine.begin() as connection:
            row = await SqlStore(connection).get("idempotency_keys", key=key)
        await engine.dispose()
        return row

    row = asyncio.run(read_metadata())
    assert "fixture-not-a-real-provider-credential" not in str(row)
    assert set(row["response_body"]) == {"session_id", "connection_id"}


def test_voice_touch_selection_race_reuses_running_activity(client):
    sid = start(client)
    rec = client.post(
        "/v1/activity-recommendations", json={"session_id": sid, "limit": 1}, headers=headers()
    ).json()
    a = rec["options"][0]["activity"]
    body = {
        "session_id": sid,
        "recommendation_id": rec["recommendation_id"],
        "activity_id": a["activity_id"],
        "activity_version": a["activity_version"],
        "selection_channel": "touch",
    }
    first = client.post("/v1/activity-sessions", json=body, headers=headers())
    assert first.status_code == 201, first.text
    second = client.post(
        "/v1/activity-sessions", json={**body, "selection_channel": "voice"}, headers=headers()
    )
    assert second.status_code == 201, second.text
    assert second.json()["activity_session_id"] == first.json()["activity_session_id"]
    repeated = client.post(
        "/v1/activity-recommendations", json={"session_id": sid, "limit": 1}, headers=headers()
    )
    assert repeated.status_code == 201, repeated.text
    assert repeated.json()["recommendation_id"] == rec["recommendation_id"]
