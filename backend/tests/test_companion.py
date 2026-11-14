import asyncio
from datetime import timedelta
from uuid import uuid4

from test_slice import client, headers, onboard, start  # noqa: F401

from app.companion import CompanionService
from app.domain import ConversationController, now
from app.storage import SqlStore, engine_for


def activate(c):
    c.app.state.settings.companion_v2_enabled = True
    return start(c)


def test_daily_checkin_requires_explicit_confirmation_and_only_one_completion(client):  # noqa: F811
    c = client
    sid = activate(c)
    state = c.get("/v1/companion", headers=headers()).json()
    assert state["relationship_status"] == "new" and not state["memory_enabled"]
    day = state["daily_checkin"]
    body = {
        "local_day": day["local_day"],
        "expected_version": day["version"],
        "decision": "confirm",
        "values": {"mood": 6, "energy": 4, "sleep_hours": 7.5},
        "session_id": sid,
    }
    assert c.post("/v1/companion/daily-checkin", json=body, headers=headers()).status_code == 422
    body["confirmation"] = True
    assert (
        c.post(
            "/v1/companion/daily-checkin",
            json={**body, "values": {**body["values"], "mood": 11}},
            headers=headers(),
        ).status_code
        == 422
    )
    key = str(uuid4())
    response = c.post("/v1/companion/daily-checkin", json=body, headers=headers(key=key))
    assert response.status_code == 200, response.text
    assert response.json()["daily_checkin"]["state"] == "completed"
    assert (
        c.post("/v1/companion/daily-checkin", json=body, headers=headers(key=key)).status_code
        == 200
    )
    assert c.post("/v1/companion/daily-checkin", json=body, headers=headers()).status_code == 409

    async def inspect():
        engine = engine_for(c.app.state.settings.database_url)
        async with engine.begin() as connection:
            store = SqlStore(connection)
            user = await store.get(
                "users", auth_subject=__import__("app.auth", fromlist=["DEMO_SUBJECT"]).DEMO_SUBJECT
            )
            rows = await store.all("observations", patient_id=user["id"])
            assert len(rows) == 3 and all(x["state"] == "confirmed" for x in rows)
            assert len(await store.all("observation_sources", patient_id=user["id"])) == 3
        await engine.dispose()

    asyncio.run(inspect())
    end = now()
    begin = end - timedelta(days=1)
    report = c.post(
        "/v1/reports",
        json={"period_start": begin.isoformat(), "period_end": end.isoformat()},
        headers=headers(),
    )
    assert report.status_code == 202, report.text
    document = c.get("/v1/reports/" + report.json()["report_id"], headers=headers()).json()
    assert len(document["observations"]) == 3


def test_skip_and_local_day_are_backend_controlled(client):  # noqa: F811
    c = client
    activate(c)
    day = c.get("/v1/companion", headers=headers()).json()["daily_checkin"]
    body = {
        "local_day": day["local_day"],
        "expected_version": day["version"],
        "decision": "decline",
    }
    assert (
        c.post(
            "/v1/companion/daily-checkin",
            json={**body, "local_day": "2000-01-01"},
            headers=headers(),
        ).status_code
        == 409
    )
    assert (
        c.post("/v1/companion/daily-checkin", json=body, headers=headers()).json()["daily_checkin"][
            "state"
        ]
        == "declined"
    )
    assert c.post("/v1/companion/daily-checkin", json=body, headers=headers()).status_code == 409


def test_context_reservation_once_and_notes_opt_in_owned_by_patient(client):  # noqa: F811
    c = client
    sid = activate(c)
    note = {
        "session_id": sid,
        "theme": "reflection",
        "text": "Fictional approved note",
        "observed_at": now().isoformat(),
        "statement_kind": "direct_statement",
        "confirmation": True,
    }
    assert c.post("/v1/confirmed-insights", json=note, headers=headers()).status_code == 201
    before = c.get("/v1/companion", headers=headers()).json()
    assert before["confirmed_notes"] == []
    enabled = c.patch(
        "/v1/companion",
        json={"expected_version": before["version"], "memory_enabled": True},
        headers=headers(),
    )
    assert enabled.status_code == 200, enabled.text
    assert enabled.json()["confirmed_notes"][0]["text"] == note["text"]
    onboard(c, "demo-other-patient-token")
    assert (
        c.get("/v1/companion", headers=headers("demo-other-patient-token")).json()[
            "confirmed_notes"
        ]
        == []
    )

    async def inspect():
        from app.auth import DEMO_SUBJECT

        engine = engine_for(c.app.state.settings.database_url)
        async with engine.begin() as connection:
            store = SqlStore(connection)
            user = await store.get("users", auth_subject=DEMO_SUBJECT)
            service = CompanionService(store)
            one = await service.enrich(user["id"], ConversationController().context(1))
            two = await service.enrich(user["id"], ConversationController().context(1))
            assert one["companion_context"]["relationship_status"] == "new"
            assert two["companion_context"]["relationship_status"] == "returning"
            assert one["companion_context"]["daily_checkin"]["invitation_allowed"]
            assert not two["companion_context"]["daily_checkin"]["invitation_allowed"]
        await engine.dispose()

    asyncio.run(inspect())
    fresh = c.get("/v1/companion", headers=headers()).json()
    disabled = c.patch(
        "/v1/companion",
        json={"expected_version": fresh["version"], "memory_enabled": False},
        headers=headers(),
    )
    assert disabled.status_code == 200 and disabled.json()["confirmed_notes"] == []


def test_legacy_relationship_unknown_and_day_uses_patient_timezone(client, monkeypatch):  # noqa: F811
    from datetime import UTC, datetime

    c = client
    onboard(c)
    c.app.state.settings.companion_v2_enabled = True
    monkeypatch.setattr("app.companion.now", lambda: datetime(2026, 11, 14, 22, 30, tzinfo=UTC))
    response = c.get("/v1/companion", headers=headers())
    assert response.status_code == 200
    assert response.json()["relationship_status"] == "unknown"
    assert response.json()["daily_checkin"]["local_day"] == "2026-11-15"


def test_postgres_concurrent_checkins_do_not_duplicate_observations(client):  # noqa: F811
    from concurrent.futures import ThreadPoolExecutor

    import pytest

    c = client
    if not c.app.state.settings.database_url.startswith("postgres"):
        pytest.skip("Real PostgreSQL row-lock regression")
    activate(c)
    state = c.get("/v1/companion", headers=headers()).json()["daily_checkin"]
    body = {
        "local_day": state["local_day"],
        "expected_version": state["version"],
        "decision": "confirm",
        "confirmation": True,
        "values": {"mood": 5, "energy": 5, "sleep_hours": 7},
    }

    def submit(_):
        return c.post("/v1/companion/daily-checkin", json=body, headers=headers()).status_code

    with ThreadPoolExecutor(2) as pool:
        assert sorted(pool.map(submit, [1, 2])) == [200, 409]


def test_feature_disable_applies_before_idempotency_replay(client):  # noqa: F811
    c = client
    activate(c)
    state = c.get("/v1/companion", headers=headers()).json()
    key = str(uuid4())
    body = {"memory_enabled": True, "expected_version": state["version"]}
    assert c.patch("/v1/companion", json=body, headers=headers(key=key)).status_code == 200
    c.app.state.settings.companion_v2_enabled = False
    assert c.get("/v1/companion", headers=headers()).status_code == 404
    assert c.patch("/v1/companion", json=body, headers=headers(key=key)).status_code == 404


def test_two_decimal_indicators_follow_exact_contract_precision():
    import pytest

    from app.contracts import validate
    from app.domain import DomainError

    validate("DailyCheckinValues", {"mood": 0.29, "energy": 6.1, "sleep_hours": 7.5})
    with pytest.raises(DomainError):
        validate("DailyCheckinValues", {"mood": 0.291, "energy": 6.1, "sleep_hours": 7.5})
