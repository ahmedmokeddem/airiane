import asyncio
import os
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from test_slice import headers, start

from app.config import Settings
from app.contracts import validate
from app.generative.provider import FeatherlessNemotronProvider, GenerationFailure
from app.generative.schema import Definition, GenerationRequest
from app.main import create_app

FIXTURE = {
    "schema_version": "1.0",
    "title": "A small pattern",
    "purpose": "Enjoy a playful pause",
    "format": "mini_game",
    "duration_seconds": 60,
    "introduction": "Try at your own pace. Skip any step.",
    "components": [
        {
            "id": "pattern",
            "type": "visual_pattern",
            "prompt": "Repeat these shapes",
            "sequence": ["circle", "square"],
        },
        {"id": "finish", "type": "guided_focus", "prompt": "Take a comfortable pause."},
    ],
    "feedback_prompt": "Was this enjoyable?",
}


class Fake:
    calls = 0
    fail = False

    async def generate(self, request):
        self.calls += 1
        if self.fail:
            raise GenerationFailure("provider_timeout")
        return Definition.model_validate(FIXTURE)


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr("app.auth.DEMO_SUBJECT", str(uuid4()))
    app = create_app(
        Settings(
            _env_file=None,
            database_url=os.environ.get(
                "TEST_DATABASE_URL", f"sqlite+aiosqlite:///{tmp_path}/generated.db"
            ),
            demo_auth=True,
            GENERATIVE_ACTIVITIES_ENABLED=True,
            FEATHERLESS_API_KEY="fictional",
            FEATHERLESS_MODEL="fictional/Nemotron",
        )
    )
    app.state.activity_generator = Fake()
    with TestClient(app) as c:
        yield c


def generate(c, sid, key=None):
    return c.post(
        f"/v1/conversation-sessions/{sid}/generated-activities",
        json={"goal": "I want a playful pause", "format": "mini_game", "duration_seconds": 60},
        headers=headers(key=key),
    )


def consent(c, sid):
    assert (
        c.post(
            f"/v1/conversation-sessions/{sid}/activity-generation-consent",
            json={"allowed": True},
            headers=headers(),
        ).status_code
        == 200
    )


def test_generated_lifecycle_races_privacy_feedback_and_journey(client):
    sid = start(client)
    assert generate(client, sid).status_code == 403
    consent(client, sid)
    key = str(uuid4())
    r = generate(client, sid, key)
    assert r.status_code == 200, r.text
    rec = r.json()["recommendation"]
    validate("Recommendation", rec)
    assert generate(client, sid, key).json() == r.json()
    assert client.app.state.activity_generator.calls == 1
    a = rec["options"][0]["activity"]
    aid = a["activity_id"]
    assert aid not in [
        x["activity_id"] for x in client.get("/v1/activities", headers=headers()).json()["items"]
    ]
    assert (
        client.get(
            "/v1/generated-activities/" + aid, headers=headers("demo-other-patient-token")
        ).status_code
        == 404
    )
    body = {
        "session_id": sid,
        "recommendation_id": rec["recommendation_id"],
        "activity_id": aid,
        "activity_version": 1,
        "selection_channel": "touch",
    }
    r = client.post("/v1/activity-sessions", json=body, headers=headers())
    assert r.status_code == 201, r.text
    activity_id = r.json()["activity_session_id"]
    path = f"/v1/activity-sessions/{activity_id}/generated-progress"
    p = client.get(path, headers=headers()).json()
    validate("GeneratedProgress", p)
    from app.domain import stamp

    event = {
        "client_event_id": str(uuid4()),
        "expected_version": 1,
        "event_type": "complete",
        "elapsed_seconds": 60,
        "event_at": stamp(),
    }
    assert (
        client.post(
            f"/v1/activity-sessions/{activity_id}/events", json=event, headers=headers()
        ).status_code
        == 409
    )
    action = {
        "expected_revision": 1,
        "step_id": "pattern",
        "action": "next",
        "sequence": ["circle", "square"],
    }
    invalid = client.post(path, json={**action, "choice_id": "invented"}, headers=headers())
    assert invalid.status_code == 422
    r = client.post(path, json=action, headers=headers())
    assert r.status_code == 200, r.text
    assert client.post(path, json=action, headers=headers()).json() == r.json()
    assert (
        client.post(path, json={**action, "action": "skip"}, headers=headers()).status_code == 409
    )
    p = r.json()
    p = client.post(
        path,
        json={"expected_revision": p["revision"], "step_id": "finish", "action": "skip"},
        headers=headers(),
    ).json()
    confirm = {
        "expected_revision": p["revision"],
        "step_id": "completion",
        "action": "confirm_completion",
    }
    assert (
        client.post(
            path.replace("generated-progress", "generated-voice-choice"),
            json=confirm,
            headers=headers(),
        ).status_code
        == 409
    )
    assert client.post(path, json=confirm, headers=headers()).status_code == 200
    r = client.post(f"/v1/activity-sessions/{activity_id}/events", json=event, headers=headers())
    assert r.status_code == 200, r.text
    assert (
        client.post(
            f"/v1/activity-sessions/{activity_id}/feedback",
            json={"rating": 4, "comment": None},
            headers=headers(),
        ).status_code
        == 201
    )
    item = client.get("/v1/my-journey", headers=headers()).json()["items"][0]
    assert item["activity_session"]["state"] == "completed" and item["feedback"]["rating"] == 4
    assert item["activity"]["activity_id"] == aid
    from datetime import timedelta

    from app.domain import now

    receipt = client.post(
        "/v1/reports",
        json={"period_start": (now() - timedelta(days=1)).isoformat(), "period_end": stamp()},
        headers=headers(),
    )
    assert receipt.status_code == 202, receipt.text
    report = client.get("/v1/reports/" + receipt.json()["report_id"], headers=headers()).json()
    validate("Report", report)
    assert any(x["activity_session_id"] == activity_id for x in report["completed_activities"])


def test_fallback_and_budget(client):
    sid = start(client)
    consent(client, sid)
    client.app.state.activity_generator.fail = True
    for _ in range(3):
        r = generate(client, sid)
        assert r.status_code == 200, r.text
        assert r.json()["state"] == "fallback" and r.json()["recommendation"]["options"]
    assert generate(client, sid).status_code == 429
    assert client.app.state.activity_generator.calls == 3


@pytest.mark.parametrize(
    "change",
    [
        {"components": [{"id": "x", "type": "html", "prompt": "hello"}]},
        {"introduction": "Hold your breath for a minute"},
        {"format": "practical_activity"},
    ],
)
def test_schema_rejects_unsupported_and_unsafe(change):
    with pytest.raises(ValidationError):
        Definition.model_validate({**FIXTURE, **change})


@pytest.mark.parametrize(
    "kind,component",
    [
        ("mini_game", {"type": "visual_pattern", "sequence": ["circle"]}),
        ("creative_activity", {"type": "creative_canvas"}),
        ("guided_experience", {"type": "guided_focus"}),
        ("interactive_reflection", {"type": "thought_sort", "categories": ["Keep", "Set aside"]}),
        ("practical_activity", {"type": "practical_step"}),
    ],
)
def test_five_formats(kind, component):
    d = Definition.model_validate(
        {
            **FIXTURE,
            "format": kind,
            "components": [{"id": "one", "prompt": "Try at your pace", **component}],
        }
    )
    validate("GeneratedActivityDefinition", d.model_dump())


@pytest.mark.parametrize(
    "status,content,code",
    [
        (402, {}, "provider_quota"),
        (200, {"choices": [{"message": {"content": "not json"}}]}, "invalid_provider_response"),
        (503, {}, "provider_unavailable"),
    ],
)
def test_http_adapter_failure_modes(status, content, code):
    calls = []

    def response(request):
        calls.append(request)
        if request.method == "GET":
            return httpx.Response(200, json={"id": "fictional/Nemotron"})
        assert "patient_id" not in request.content.decode()
        return httpx.Response(status, json=content)

    p = FeatherlessNemotronProvider(
        Settings(
            _env_file=None, FEATHERLESS_API_KEY="fictional", FEATHERLESS_MODEL="fictional/Nemotron"
        ),
        httpx.MockTransport(response),
    )
    with pytest.raises(GenerationFailure, match=code):
        asyncio.run(p.generate(GenerationRequest(goal="A short pause", format="mini_game")))
    assert len(calls) <= 3


def test_disabled_preserves_curated_flow(tmp_path):
    app = create_app(
        Settings(
            _env_file=None,
            demo_auth=True,
            database_url=f"sqlite+aiosqlite:///{tmp_path}/disabled.db",
        )
    )
    with TestClient(app) as c:
        sid = start(c)
        assert (
            c.get("/v1/activity-generation/capabilities", headers=headers()).json()["enabled"]
            is False
        )
        assert generate(c, sid).status_code == 404
        r = c.post(
            "/v1/activity-recommendations", json={"session_id": sid, "limit": 1}, headers=headers()
        )
        assert r.status_code == 201
        validate("Recommendation", r.json())


def test_consent_replay_cannot_resurrect_revoked_permission(client):
    sid = start(client)
    key = str(uuid4())
    path = f"/v1/conversation-sessions/{sid}/activity-generation-consent"
    assert client.post(path, json={"allowed": True}, headers=headers(key=key)).status_code == 200
    assert client.post(path, json={"allowed": False}, headers=headers()).status_code == 200
    assert client.post(path, json={"allowed": True}, headers=headers(key=key)).status_code == 200
    assert generate(client, sid).status_code == 403
    assert client.app.state.activity_generator.calls == 0


def test_pause_resume_skip_and_forward_branch(client):
    from app.generative.schema import Definition

    async def branch(request):
        return Definition.model_validate(
            {
                **FIXTURE,
                "components": [
                    {
                        "id": "choose",
                        "type": "choice",
                        "prompt": "Choose your pace",
                        "choices": [
                            {"id": "short", "label": "Short", "next_step": 2},
                            {"id": "long", "label": "Long"},
                        ],
                    },
                    {"id": "extra", "type": "guided_focus", "prompt": "Optional pause"},
                    {
                        "id": "pattern",
                        "type": "visual_pattern",
                        "prompt": "Repeat",
                        "sequence": ["circle"],
                    },
                ],
            }
        )

    client.app.state.activity_generator.generate = branch
    sid = start(client)
    consent(client, sid)
    rec = generate(client, sid).json()["recommendation"]
    a = rec["options"][0]["activity"]
    r = client.post(
        "/v1/activity-sessions",
        json={
            "session_id": sid,
            "recommendation_id": rec["recommendation_id"],
            "activity_id": a["activity_id"],
            "activity_version": 1,
            "selection_channel": "touch",
        },
        headers=headers(),
    )
    assert r.status_code == 201, r.text
    path = f"/v1/activity-sessions/{r.json()['activity_session_id']}/generated-progress"

    def act(revision, step, action, **extra):
        return client.post(
            path,
            json={"expected_revision": revision, "step_id": step, "action": action, **extra},
            headers=headers(),
        )

    assert act(1, "choose", "pause").json()["paused"] is True
    assert act(2, "choose", "next", choice_id="short").status_code == 409
    assert act(2, "choose", "resume").json()["paused"] is False
    p = act(3, "choose", "next", choice_id="short").json()
    assert p["step"] == 2
    assert act(p["revision"], "pattern", "skip").json()["finished"] is True


def test_http_timeout_and_valid_json_are_controlled():
    import json

    def success(request):
        return (
            httpx.Response(200, json={"id": "fictional/Nemotron"})
            if request.method == "GET"
            else httpx.Response(
                200, json={"choices": [{"message": {"content": json.dumps(FIXTURE)}}]}
            )
        )

    settings = Settings(
        _env_file=None, FEATHERLESS_API_KEY="fictional", FEATHERLESS_MODEL="fictional/Nemotron"
    )
    result = asyncio.run(
        FeatherlessNemotronProvider(settings, httpx.MockTransport(success)).generate(
            GenerationRequest(goal="A short pause", format="mini_game")
        )
    )
    assert result.format == "mini_game"

    def timeout(request):
        if request.method == "GET":
            return httpx.Response(200, json={"id": "fictional/Nemotron"})
        raise httpx.ReadTimeout("fixture")

    with pytest.raises(GenerationFailure, match="provider_timeout"):
        asyncio.run(
            FeatherlessNemotronProvider(settings, httpx.MockTransport(timeout)).generate(
                GenerationRequest(goal="A short pause", format="mini_game")
            )
        )


def test_revoke_during_inference_discards_result_without_holding_transaction(client):
    import threading
    from concurrent.futures import ThreadPoolExecutor

    entered = threading.Event()
    release = threading.Event()

    async def waiting(request):
        entered.set()
        while not release.is_set():
            await asyncio.sleep(0.01)
        return Definition.model_validate(FIXTURE)

    client.app.state.activity_generator.generate = waiting
    sid = start(client)
    consent(client, sid)
    with ThreadPoolExecutor(max_workers=1) as pool:
        pending = pool.submit(generate, client, sid)
        assert entered.wait(timeout=3)
        try:
            r = client.post(
                f"/v1/conversation-sessions/{sid}/activity-generation-consent",
                json={"allowed": False},
                headers=headers(),
            )
            assert r.status_code == 200
        finally:
            release.set()
        result = pending.result(timeout=5)
    assert result.json()["state"] == "cancelled"
    assert result.json()["recommendation"] is None


def test_bootstrap_restores_only_current_unconsumed_recommendation(client, monkeypatch):
    from app.domain import stamp

    original = httpx.AsyncClient

    def response(request):
        return httpx.Response(200, json={"token": "fictional-bootstrap-token"})

    monkeypatch.setattr(
        "app.provider.httpx.AsyncClient",
        lambda **kwargs: original(transport=httpx.MockTransport(response), **kwargs),
    )
    settings = client.app.state.settings
    settings.provider_privacy_verified = True
    settings.provider_privacy_policy_version = "fictional-test"
    settings.elevenlabs_api_key = "fictional"
    settings.elevenlabs_agent_id = "fictional-agent"
    sid = start(client)
    rec = client.post(
        "/v1/activity-recommendations", json={"session_id": sid, "limit": 1}, headers=headers()
    ).json()

    def boot():
        session = client.get("/v1/conversation-sessions/" + sid, headers=headers()).json()
        r = client.post(
            f"/v1/conversation-sessions/{sid}/agent-connections",
            json={"mode": "voice", "expected_version": session["version"]},
            headers=headers(),
        )
        assert r.status_code == 200, r.text
        return r.json()

    b = boot()
    assert (
        b["agent_context"]["current_recommendation"]["recommendation_id"]
        == rec["recommendation_id"]
    )
    closed = client.patch(
        f"/v1/conversation-sessions/{sid}/agent-connections/{b['connection_id']}",
        json={"state": "closed", "expected_version": 1},
        headers=headers(),
    )
    assert closed.status_code == 200, closed.text
    a = rec["options"][0]["activity"]
    started = client.post(
        "/v1/activity-sessions",
        json={
            "session_id": sid,
            "recommendation_id": rec["recommendation_id"],
            "activity_id": a["activity_id"],
            "activity_version": 1,
            "selection_channel": "touch",
        },
        headers=headers(),
    ).json()
    done = client.post(
        "/v1/activity-sessions/" + started["activity_session_id"] + "/events",
        json={
            "client_event_id": str(uuid4()),
            "expected_version": 1,
            "event_type": "complete",
            "elapsed_seconds": 60,
            "event_at": stamp(),
        },
        headers=headers(),
    )
    assert done.status_code == 200, done.text
    b = boot()
    assert b["agent_context"]["current_recommendation"] is None
