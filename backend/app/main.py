import hashlib
import json
from contextlib import asynccontextmanager
from datetime import timedelta
from uuid import UUID, uuid4

from cryptography.fernet import Fernet
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from sqlalchemy.exc import IntegrityError

from . import care_routes, replay
from .auth import Authenticator
from .care import CareService, current_user
from .companion import CompanionService
from .config import Settings
from .contracts import SPEC, validate
from .domain import ConversationController, DomainError, now, stamp
from .pagination import Pages
from .provider import ElevenLabsBootstrap
from .reports import routes as pdf_routes
from .services import ActivityService, PatientService, SessionService, utc
from .storage import SqlStore, engine_for, metadata


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    engine = engine_for(settings.database_url, settings)
    auth = Authenticator(settings)
    cipher = Fernet(Fernet.generate_key())
    credential_cache: dict[tuple, tuple] = {}
    pages = Pages()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if settings.database_url.startswith("sqlite"):
            if settings.environment != "development":
                raise RuntimeError("SQLite is development-only; use migrated PostgreSQL")
            async with engine.begin() as connection:
                await connection.run_sync(metadata.create_all)
        if settings.environment == "development":
            async with engine.begin() as connection:
                store = SqlStore(connection)
                from .seed_catalog import ensure_catalog

                await ensure_catalog(store)
        yield
        await engine.dispose()

    app = FastAPI(title="RE vertical slice", version="0.1.0", lifespan=lifespan)
    app.state.settings = settings
    import copy

    exposed_contract = copy.deepcopy(SPEC)
    for operations in exposed_contract["paths"].values():
        for operation in operations.values():
            operation["x-implementation-status"] = (
                "implemented-first-slice"
                if operation["operationId"] in IMPLEMENTED
                or operation["operationId"] in pdf_routes.OPERATIONS
                else "planned-not-routed"
            )
    app.openapi = lambda: exposed_contract
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
    )

    @app.middleware("http")
    async def security_headers(request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Frame-Options"] = "DENY"
        if settings.environment == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000"
        return response

    @app.exception_handler(DomainError)
    async def domain_error(request: Request, exc: DomainError):
        return JSONResponse(
            status_code=exc.status,
            content={
                "code": exc.code,
                "message": exc.code.replace("_", " ").capitalize(),
                "request_id": str(uuid4()),
                "retryable": exc.status == 503,
            },
            headers={"Cache-Control": "no-store"},
        )

    @app.exception_handler(IntegrityError)
    async def integrity_error(request: Request, exc: IntegrityError):
        return await domain_error(request, DomainError("VERSION_CONFLICT"))

    @app.get("/health")
    async def health():
        if settings.environment == "production":
            return {"status": "alive"}
        return {
            "status": "ok",
            "scope": "first-vertical-slice",
            "auth": "fictional-demo" if settings.demo_auth else "supabase-jwks",
            "database": "sqlite-development"
            if settings.database_url.startswith("sqlite")
            else "postgresql",
        }

    async def handler(request: Request):
        identity = await auth.verify(request.headers.get("authorization"))
        operation = request.scope["route"].name
        if (
            operation in {"getCompanionContext", "updateCompanionMemory", "submitDailyCheckin"}
            and not settings.companion_v2_enabled
        ):
            raise DomainError("FEATURE_UNAVAILABLE", 404)
        schema_request, schema_response, status = IMPLEMENTED[operation]
        body = None
        if schema_request:
            try:
                raw = bytearray()
                async for chunk in request.stream():
                    if len(raw) + len(chunk) > 262144:
                        raise DomainError("BODY_TOO_LARGE", 413)
                    raw.extend(chunk)
                body = json.loads(raw)
            except ValueError:
                raise DomainError("VALIDATION_ERROR", 422) from None
            validate(schema_request, body)
        key = request.headers.get("idempotency-key")
        if request.method != "GET":
            try:
                UUID(key or "")
            except ValueError:
                raise DomainError("VALIDATION_ERROR", 422) from None
        params = request.path_params
        for param_name, value in params.items():
            if param_name == "tool_name":
                continue
            if value in [
                "present_activity_recommendations",
                "select_activity",
                "get_patient_context",
                "get_next_guided_question",
            ]:
                continue
            try:
                UUID(value)
            except ValueError:
                raise DomainError("VALIDATION_ERROR", 422) from None
        async with engine.begin() as connection:
            store = SqlStore(connection)
            patients = PatientService(store)
            if operation == "onboardPatient":
                result = await patients.onboard(
                    identity.subject, body, companion_v2=settings.companion_v2_enabled
                )
            else:
                user = (
                    await current_user(store, identity.subject)
                    if operation in care_routes.SHARED_OPERATIONS
                    else await patients.user(identity.subject)
                )
                # Serialize actor mutations across workers before reading idempotency/state.
                if request.method != "GET":
                    from sqlalchemy import select

                    from .storage import TABLES

                    await connection.execute(
                        select(TABLES["users"].c.id)
                        .where(TABLES["users"].c.id == UUID(user["id"]))
                        .with_for_update()
                    )
                pid = user["id"]
                sessions, activities = SessionService(store), ActivityService(store)
                digest = hashlib.sha256(
                    json.dumps(body, sort_keys=True, separators=(",", ":")).encode()
                ).hexdigest()
                prior = None
                if key:
                    prior = await store.get(
                        "idempotency_keys",
                        actor_id=pid,
                        method=request.method,
                        route=request.url.path,
                        key=key,
                    )
                    if prior and utc(prior["expires_at"]) <= now():
                        raise DomainError("IDEMPOTENCY_EXPIRED")
                    if prior and prior["request_hash"] != digest:
                        raise DomainError("IDEMPOTENCY_CONFLICT")
                    if prior and operation == "createAgentConnection":
                        owned_session = await sessions.owned(pid, params["session_id"])
                        owned_connection = await store.get(
                            "provider_connections",
                            id=prior["response_body"]["connection_id"],
                            patient_id=pid,
                            session_id=params["session_id"],
                        )
                        if (
                            owned_session["state"] == "ended"
                            or not owned_connection
                            or owned_connection["state"] == "closed"
                        ):
                            raise DomainError("CREDENTIAL_EXPIRED")
                        cached = credential_cache.get((pid, request.url.path, key))
                        if not cached or cached[0] <= now():
                            raise DomainError("CREDENTIAL_EXPIRED")
                        return JSONResponse(
                            json.loads(cipher.decrypt(cached[1])),
                            status_code=status,
                            headers={"Cache-Control": "no-store"},
                        )
                    if prior:
                        # Owned resource is checked again before returning accepted metadata.
                        if "session_id" in params:
                            await sessions.owned(pid, params["session_id"])
                        if "activity_session_id" in params:
                            await activities.owned(pid, params["activity_session_id"])
                        restored = await replay.restore(
                            operation,
                            prior["response_body"],
                            store,
                            pid,
                            companion_v2=settings.companion_v2_enabled,
                        )
                        if status == 204:
                            return Response(status_code=204, headers={"Cache-Control": "no-store"})
                        return JSONResponse(
                            restored,
                            status_code=prior["response_status"],
                            headers={"Cache-Control": "no-store"},
                        )
                result = (
                    await care_routes.dispatch(
                        operation, store, pid, params, body, request.query_params, pages
                    )
                    if operation in care_routes.OPERATIONS
                    else await dispatch(
                        operation,
                        store,
                        settings,
                        identity.subject,
                        pid,
                        params,
                        body,
                        request,
                        sessions,
                        activities,
                    )
                )
                if schema_response:
                    validate(schema_response, result)
                if operation == "createAgentConnection":
                    for cache_key, cached in list(credential_cache.items()):
                        if cached[0] <= now():
                            del credential_cache[cache_key]
                    if len(credential_cache) >= 128:
                        credential_cache.pop(next(iter(credential_cache)))
                    expiry = utc(result["connect_before"])
                    if result["credential_expires_at"]:
                        expiry = min(expiry, utc(result["credential_expires_at"]))
                    credential_cache[(pid, request.url.path, key)] = (
                        expiry,
                        cipher.encrypt(json.dumps(result).encode()),
                    )
                if key:
                    await store.add(
                        "idempotency_keys",
                        actor_id=pid,
                        method=request.method,
                        route=request.url.path,
                        key=key,
                        request_hash=digest,
                        response_status=status,
                        response_body={
                            **(
                                replay.metadata(operation, result)
                                if result is not None
                                else {
                                    (
                                        "insight_id"
                                        if operation == "deleteInsight"
                                        else "consent_grant_id"
                                    ): params[
                                        "insight_id"
                                        if operation == "deleteInsight"
                                        else "consent_grant_id"
                                    ],
                                    "deleted": True,
                                }
                            ),
                            **(
                                {"application_session_id": params["session_id"]}
                                if operation == "dispatchTool"
                                else {}
                            ),
                        },
                        expires_at=(now() + timedelta(hours=24)).isoformat(),
                        created_at=stamp(),
                    )
            if schema_response:
                validate(schema_response, result)
            if status == 204:
                return Response(status_code=204, headers={"Cache-Control": "no-store"})
            return JSONResponse(result, status_code=status, headers={"Cache-Control": "no-store"})

    for path, methods in SPEC["paths"].items():
        for method, operation in methods.items():
            if operation["operationId"] in IMPLEMENTED:
                app.add_api_route(
                    path,
                    handler,
                    methods=[method.upper()],
                    name=operation["operationId"],
                    status_code=IMPLEMENTED[operation["operationId"]][2],
                )
    from .health import install_health

    install_health(app, engine, settings)
    pdf_routes.install(app, engine, auth, settings)
    return app


IMPLEMENTED = {
    **care_routes.OPERATIONS,
    "onboardPatient": ("OnboardingRequest", "Me", 201),
    "getCompanionContext": (None, "CompanionContext", 200),
    "updateCompanionMemory": ("CompanionMemoryUpdate", "CompanionContext", 200),
    "submitDailyCheckin": ("DailyCheckinSubmit", "CompanionContext", 200),
    "getMe": (None, "Me", 200),
    "getPatientContext": (None, "PatientContext", 200),
    "updateProfile": ("ProfilePatch", "Me", 200),
    "updatePatientContext": ("ContextPatch", "PatientContext", 200),
    "createConversation": ("SessionCreate", "ConversationSession", 201),
    "getConversation": (None, "ConversationSession", 200),
    "updateConversation": ("SessionPatch", "ConversationSession", 200),
    "listActivities": (None, "ActivityPage", 200),
    "createRecommendation": ("RecommendationRequest", "Recommendation", 201),
    "startActivity": ("ActivityStart", "ActivitySession", 201),
    "getActivitySession": (None, "ActivitySession", 200),
    "recordActivityEvent": ("ActivityEventRequest", "ActivitySession", 200),
    "submitFeedback": ("FeedbackRequest", "Feedback", 201),
    "getMyJourney": (None, "MyJourneyItemPage", 200),
    "createAgentConnection": ("AgentConnectionRequest", "AgentConnectionBootstrap", 200),
    "updateAgentConnection": ("ProviderConnectionPatch", "ProviderConnection", 200),
    "dispatchTool": ("ToolDispatch", "ToolResult", 200),
    "getGuidedQuestion": (None, "GuidedQuestion", 200),
}


async def dispatch(op, store, settings, subject, pid, p, body, request, sessions, activities):
    sid = p.get("session_id")
    aid = p.get("activity_session_id")
    if op in {"getCompanionContext", "updateCompanionMemory", "submitDailyCheckin"}:
        if not settings.companion_v2_enabled:
            raise DomainError("FEATURE_UNAVAILABLE", 404)

        companion = CompanionService(store)
        if op == "getCompanionContext":
            return await companion.context(pid)
        if op == "updateCompanionMemory":
            return await companion.update_memory(pid, body)
        return await companion.checkin(pid, body)
    match op:
        case "getMe":
            user = await current_user(store, subject)
            if user["role"] == "clinician":
                profile = await CareService(store).clinician(pid)
                return {
                    "user_id": pid,
                    "role": "clinician",
                    "display_name": profile["display_name"],
                    "timezone": "UTC",
                    "clinician_verified": True,
                    "avatar": None,
                }
            return await PatientService(store).me(subject)
        case "getPatientContext":
            return await PatientService(store).context(
                pid, companion_v2=settings.companion_v2_enabled
            )
        case "updateProfile":
            return await PatientService(store).patch(subject, body)
        case "updatePatientContext":
            return await PatientService(store).patch_context(pid, body)
        case "createConversation":
            return await sessions.create(pid, body)
        case "getConversation":
            return await sessions.view(await sessions.owned(pid, sid))
        case "updateConversation":
            return await sessions.patch(pid, sid, body)
        case "listActivities":
            return await activities.catalog()
        case "createRecommendation":
            return await activities.recommend(pid, body)
        case "startActivity":
            return await activities.start(pid, body)
        case "getActivitySession":
            return activities.view(await activities.owned(pid, aid))
        case "recordActivityEvent":
            return await activities.event(pid, aid, body)
        case "submitFeedback":
            return await activities.feedback(pid, aid, body)
        case "getMyJourney":
            if request.query_params.get("cursor"):
                raise DomainError("VALIDATION_ERROR", 422)
            try:
                limit = int(request.query_params.get("limit", "20"))
            except ValueError:
                raise DomainError("VALIDATION_ERROR", 422) from None
            if not 1 <= limit <= 100:
                raise DomainError("VALIDATION_ERROR", 422)
            return await activities.journey(pid, limit)
        case "createAgentConnection":
            return await ElevenLabsBootstrap(settings, store).create(pid, sid, body)
        case "updateAgentConnection":
            return await ElevenLabsBootstrap(settings, store).patch(
                pid, sid, p["connection_id"], body
            )
        case "getGuidedQuestion":
            row = await sessions.owned(pid, sid)
            if settings.companion_v2_enabled:
                return await CompanionService(store).question(pid, row["version"])
            return ConversationController().question(row["version"])
        case "dispatchTool":
            row = await sessions.owned(pid, sid)
            conn = await store.get(
                "provider_connections", id=body["connection_id"], session_id=sid, patient_id=pid
            )
            if not conn or conn["state"] != "active" or row["state"] != "active":
                raise DomainError("INVALID_TRANSITION")
            name = p["tool_name"]
            if name not in [
                "present_activity_recommendations",
                "select_activity",
                "get_patient_context",
                "get_next_guided_question",
            ]:
                raise DomainError("VALIDATION_ERROR", 422)
            validate("ToolArgs_" + name, body["arguments"])
            call_hash = hashlib.sha256(
                json.dumps({"name": name, "arguments": body["arguments"]}, sort_keys=True).encode()
            ).hexdigest()
            prior = await store.get(
                "tool_calls",
                provider_connection_id=body["connection_id"],
                tool_call_id=body["tool_call_id"],
                patient_id=pid,
                session_id=sid,
            )
            if prior:
                if prior["request_hash"] != call_hash:
                    raise DomainError("IDEMPOTENCY_CONFLICT")
                if name == "present_activity_recommendations":
                    result = await activities.recommendation(pid, prior["result_resource_id"])
                elif name == "select_activity":
                    result = activities.view(
                        await activities.owned(pid, prior["result_resource_id"])
                    )
                elif name == "get_patient_context":
                    result = await PatientService(store).context(
                        pid, companion_v2=settings.companion_v2_enabled
                    )
                else:
                    if settings.companion_v2_enabled:
                        result = await CompanionService(store).question(pid, row["version"])
                    else:
                        result = ConversationController().question(row["version"])
                return {
                    "tool_call_id": body["tool_call_id"],
                    "contract_version": "2.0.0",
                    "result": result,
                }

            if name == "present_activity_recommendations":
                result = await activities.recommend(pid, dict(session_id=sid, **body["arguments"]))
            elif name == "select_activity":
                result = await activities.start(
                    pid, dict(session_id=sid, selection_channel="voice", **body["arguments"])
                )
            elif name == "get_patient_context":
                result = await PatientService(store).context(
                    pid, companion_v2=settings.companion_v2_enabled
                )
            else:
                result = (
                    (await CompanionService(store).question(pid, row["version"]))
                    if settings.companion_v2_enabled
                    else ConversationController().question(row["version"])
                )
            resource = (
                result.get("recommendation_id")
                if name == "present_activity_recommendations"
                else result.get("activity_session_id")
            )
            await store.add(
                "tool_calls",
                id=str(uuid4()),
                patient_id=pid,
                provider_connection_id=body["connection_id"],
                session_id=sid,
                tool_call_id=body["tool_call_id"],
                tool_name=name,
                contract_version="2.0.0",
                request_hash=call_hash,
                result_resource_id=resource,
                outcome_code="accepted",
                created_at=stamp(),
            )
            return {
                "tool_call_id": body["tool_call_id"],
                "contract_version": "2.0.0",
                "result": result,
            }
    raise DomainError("RESOURCE_NOT_FOUND", 404)


app = create_app()
