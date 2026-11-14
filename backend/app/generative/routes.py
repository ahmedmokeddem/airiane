"""Optional routes; provider latency never holds a database transaction open."""

import asyncio
from datetime import timedelta
from uuid import UUID, uuid4

from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from ..domain import DomainError, now, stamp
from ..services import ActivityService, PatientService, utc
from ..storage import SqlStore
from .provider import FeatherlessNemotronProvider, GenerationFailure
from .schema import Consent, GenerationRequest, Transition
from .service import (
    active_session,
    definition_for,
    digest,
    progress_for,
    progress_view,
    publish,
    transition,
)

OPERATIONS = {
    "generationCapabilities",
    "generationConsent",
    "generateActivity",
    "generationJob",
    "cancelGeneration",
    "generatedDefinition",
    "declineGeneratedActivity",
    "generatedProgress",
    "generatedChoice",
    "generatedVoiceChoice",
}


async def body_as(request, model):
    raw = bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw) > 4096:
            raise DomainError("BODY_TOO_LARGE", 413)
    try:
        return model.model_validate_json(raw)
    except (ValidationError, ValueError):
        raise DomainError("VALIDATION_ERROR", 422) from None


def install(app, engine, auth, settings):
    app.state.activity_generator = FeatherlessNemotronProvider(settings)

    async def patient(store, identity, *, lock=False):
        user = await PatientService(store).user(identity.subject)
        if lock:
            await store.get_locked("users", id=user["id"])
        return user["id"]

    async def job_view(store, pid, job):
        result = {
            "job_id": job["id"],
            "state": job["state"],
            "reason": job["reason"],
            "recommendation": None,
        }
        if job["recommendation_id"]:
            result["recommendation"] = await ActivityService(store).recommendation(
                pid, job["recommendation_id"]
            )
        return result

    async def handle(request: Request):
        identity = await auth.verify(request.headers.get("authorization"))
        op = request.scope["route"].name
        if op == "generationCapabilities":
            async with engine.begin() as con:
                await patient(SqlStore(con), identity)
            return {"enabled": settings.generative_activities_enabled, "schema_version": "1.0"}
        if not settings.generative_activities_enabled:
            raise DomainError("FEATURE_UNAVAILABLE", 404)
        params = request.path_params
        try:
            for value in params.values():
                UUID(value)
            if request.method != "GET":
                UUID(request.headers.get("idempotency-key", ""))
        except ValueError:
            raise DomainError("VALIDATION_ERROR", 422) from None
        parsed = None
        if op in (
            "generateActivity",
            "generationConsent",
            "generatedChoice",
            "generatedVoiceChoice",
        ):
            parsed = await body_as(
                request,
                {
                    "generateActivity": GenerationRequest,
                    "generationConsent": Consent,
                    "generatedChoice": Transition,
                    "generatedVoiceChoice": Transition,
                }[op],
            )
        async with engine.begin() as con:
            store = SqlStore(con)
            pid = await patient(store, identity, lock=request.method != "GET")
            sid = params.get("session_id")
            if sid:
                await active_session(store, pid, sid)
            if op == "generationConsent":
                consent_key = request.headers["idempotency-key"]
                route = str(request.url.path)
                consent_hash = digest(parsed.model_dump())
                previous = await store.get(
                    "idempotency_keys", actor_id=pid, method="POST", route=route, key=consent_key
                )
                if previous:
                    if previous["request_hash"] != consent_hash:
                        raise DomainError("IDEMPOTENCY_CONFLICT")
                    return previous["response_body"]
                grant = await store.get("activity_generation_grants", id=sid, patient_id=pid)
                if grant and grant["allowed"] != parsed.allowed:
                    await store.update(
                        "activity_generation_grants",
                        {"id": sid, "patient_id": pid},
                        {"allowed": parsed.allowed, "updated_at": stamp()},
                    )
                elif not grant:
                    await store.add(
                        "activity_generation_grants",
                        id=sid,
                        patient_id=pid,
                        allowed=parsed.allowed,
                        reserved_calls=0,
                        updated_at=stamp(),
                    )
                result = {"allowed": parsed.allowed}
                await store.add(
                    "idempotency_keys",
                    actor_id=pid,
                    method="POST",
                    route=route,
                    key=consent_key,
                    request_hash=consent_hash,
                    response_status=200,
                    response_body=result,
                    expires_at=(now() + timedelta(hours=24)).isoformat(),
                    created_at=stamp(),
                )
                return result
            if op in ("generationJob", "cancelGeneration"):
                job = await store.get(
                    "activity_generation_jobs", id=params["job_id"], patient_id=pid, session_id=sid
                )
                if not job:
                    raise DomainError("RESOURCE_NOT_FOUND", 404)
                if op == "cancelGeneration" and job["state"] == "generating":
                    await store.update(
                        "activity_generation_jobs",
                        {"id": job["id"], "patient_id": pid},
                        {"state": "cancelled", "reason": "patient_cancelled"},
                    )
                    job.update(state="cancelled", reason="patient_cancelled")
                return await job_view(store, pid, job)
            if op in ("generatedDefinition", "declineGeneratedActivity"):
                row = await definition_for(store, pid, params["activity_id"])
                if op == "declineGeneratedActivity":
                    if row["state"] == "accepted":
                        raise DomainError("INVALID_TRANSITION")
                    await store.update(
                        "generated_activity_definitions",
                        {"id": row["id"], "patient_id": pid},
                        {"state": "declined"},
                    )
                    return {"state": "declined"}
                return {
                    "activity_id": row["id"],
                    "state": row["state"],
                    "definition": row["definition"],
                }
            if op == "generatedProgress":
                # Reads do not create progression state; start creates it atomically.
                activity, definition, progress = await progress_for(
                    store, pid, params["activity_session_id"]
                )
                return progress_view(activity, definition, progress)
            if op in ("generatedChoice", "generatedVoiceChoice"):
                return await transition(
                    store, pid, params["activity_session_id"], parsed, ui=op == "generatedChoice"
                )
            key = request.headers["idempotency-key"]
            hashed = digest(parsed.model_dump())
            prior = await store.get(
                "activity_generation_jobs", patient_id=pid, session_id=sid, request_key=key
            )
            if prior:
                if prior["request_hash"] != hashed:
                    raise DomainError("IDEMPOTENCY_CONFLICT")
                if prior["state"] == "generating" and utc(prior["created_at"]) < now() - timedelta(
                    minutes=2
                ):
                    await store.update(
                        "activity_generation_jobs",
                        {"id": prior["id"]},
                        {"state": "cancelled", "reason": "generation_expired"},
                    )
                    prior.update(state="cancelled", reason="generation_expired")
                return JSONResponse(
                    await job_view(store, pid, prior),
                    status_code=202 if prior["state"] == "generating" else 200,
                )
            grant = await store.get("activity_generation_grants", id=sid, patient_id=pid)
            if not grant or not grant["allowed"]:
                raise DomainError("GENERATION_CONSENT_REQUIRED", 403)
            if grant["reserved_calls"] >= 6:
                raise DomainError("GENERATION_LIMIT_REACHED", 429)
            await store.update(
                "activity_generation_grants",
                {"id": sid, "patient_id": pid},
                {"reserved_calls": grant["reserved_calls"] + 2},
            )
            job = await store.add(
                "activity_generation_jobs",
                id=str(uuid4()),
                patient_id=pid,
                session_id=sid,
                request_key=key,
                request_hash=hashed,
                state="generating",
                recommendation_id=None,
                reason=None,
                created_at=stamp(),
            )
        # No DB connection, user lock or clinical context crosses inference boundary.
        try:
            generation = asyncio.create_task(app.state.activity_generator.generate(parsed))
            try:
                while not generation.done():
                    await asyncio.wait({generation}, timeout=0.2)
                    if await request.is_disconnected():
                        generation.cancel()
                        raise asyncio.CancelledError
                definition = await generation
            finally:
                if not generation.done():
                    generation.cancel()
                    try:
                        await generation
                    except asyncio.CancelledError:
                        pass
            reason = None
        except GenerationFailure as error:
            definition = None
            reason = error.code
        except asyncio.CancelledError:
            async with engine.begin() as con:
                store = SqlStore(con)
                await store.get_locked("users", id=pid)
                await store.update(
                    "activity_generation_jobs",
                    {"id": job["id"], "patient_id": pid},
                    {"state": "cancelled", "reason": "request_cancelled"},
                )
            raise
        async with engine.begin() as con:
            store = SqlStore(con)
            await patient(store, identity, lock=True)
            await active_session(store, pid, sid)
            current = await store.get("activity_generation_jobs", id=job["id"], patient_id=pid)
            grant = await store.get("activity_generation_grants", id=sid, patient_id=pid)
            if current["state"] == "cancelled":
                return await job_view(store, pid, current)
            if (
                not settings.generative_activities_enabled
                or not grant["allowed"]
                or utc(grant["updated_at"]) > utc(job["created_at"])
            ):
                await store.update(
                    "activity_generation_jobs",
                    {"id": job["id"]},
                    {"state": "cancelled", "reason": "consent_revoked"},
                )
                current.update(state="cancelled", reason="consent_revoked")
                return await job_view(store, pid, current)
            rid = (
                (await publish(store, pid, sid, definition))
                if definition
                else (await ActivityService(store).recommend(pid, {"session_id": sid, "limit": 3}))[
                    "recommendation_id"
                ]
            )
            values = {
                "state": "ready" if definition else "fallback",
                "recommendation_id": rid,
                "reason": reason,
            }
            await store.update(
                "activity_generation_jobs", {"id": job["id"], "patient_id": pid}, values
            )
            current.update(values)
            return await job_view(store, pid, current)

    paths = [
        ("/activity-generation/capabilities", "GET", "generationCapabilities"),
        (
            "/conversation-sessions/{session_id}/activity-generation-consent",
            "POST",
            "generationConsent",
        ),
        ("/conversation-sessions/{session_id}/generated-activities", "POST", "generateActivity"),
        (
            "/conversation-sessions/{session_id}/activity-generation/{job_id}",
            "GET",
            "generationJob",
        ),
        (
            "/conversation-sessions/{session_id}/activity-generation/{job_id}",
            "DELETE",
            "cancelGeneration",
        ),
        ("/generated-activities/{activity_id}", "GET", "generatedDefinition"),
        ("/generated-activities/{activity_id}", "DELETE", "declineGeneratedActivity"),
        ("/activity-sessions/{activity_session_id}/generated-progress", "GET", "generatedProgress"),
        ("/activity-sessions/{activity_session_id}/generated-progress", "POST", "generatedChoice"),
        (
            "/activity-sessions/{activity_session_id}/generated-voice-choice",
            "POST",
            "generatedVoiceChoice",
        ),
    ]

    async def respond(request: Request):
        result = await handle(request)
        response = result if isinstance(result, JSONResponse) else JSONResponse(result)
        response.headers["Cache-Control"] = "no-store"
        return response

    for path, method, name in paths:
        app.add_api_route("/v1" + path, respond, methods=[method], name=name)
