from datetime import timedelta

import httpx

from .config import Settings
from .domain import ConversationController, DomainError, now, stamp
from .services import ActivityService, SessionService, uid


class ElevenLabsBootstrap:
    def __init__(self, settings: Settings, store):
        self.settings, self.store = settings, store

    async def create(self, patient: str, sid: str, body: dict) -> dict:
        row = await SessionService(self.store).owned(patient, sid)
        if row["state"] == "ended":
            raise DomainError("INVALID_TRANSITION")
        if row["version"] != body["expected_version"]:
            raise DomainError("VERSION_CONFLICT")
        if (
            not self.settings.provider_privacy_verified
            or not self.settings.provider_privacy_policy_version
        ):
            raise DomainError("PROVIDER_PRIVACY_UNVERIFIED", 503)
        if not self.settings.elevenlabs_api_key or not self.settings.elevenlabs_agent_id:
            raise DomainError("PROVIDER_UNAVAILABLE", 503)
        connections = await self.store.all(
            "provider_connections", session_id=sid, patient_id=patient
        )
        if any(c["state"] != "closed" for c in connections):
            raise DomainError("CONNECTION_ACTIVE")
        mode = body["mode"]
        endpoint = "token" if mode == "voice" else "get-signed-url"
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.get(
                    f"https://api.elevenlabs.io/v1/convai/conversation/{endpoint}",
                    params={"agent_id": self.settings.elevenlabs_agent_id},
                    headers={"xi-api-key": self.settings.elevenlabs_api_key},
                )
                response.raise_for_status()
                result = response.json()
                secret = result["token" if mode == "voice" else "signed_url"]
        except (httpx.HTTPError, ValueError, KeyError):
            raise DomainError("PROVIDER_UNAVAILABLE", 503) from None
        cid = uid()
        epoch = max((c["connection_epoch"] for c in connections), default=0) + 1
        deadline = (now() + timedelta(seconds=60)).isoformat()
        native_id = result.get("conversation_id") if mode == "voice" else None
        await self.store.add(
            "provider_connections",
            id=cid,
            patient_id=patient,
            session_id=sid,
            provider="elevenlabs",
            mode=mode,
            transport="webrtc" if mode == "voice" else "websocket",
            state="created",
            connection_epoch=epoch,
            context_version=row["version"],
            version=1,
            provider_conversation_id=native_id,
            connect_before=deadline,
            closed_at=None,
            created_at=stamp(),
        )
        context = ConversationController().context(row["version"])
        recommendations = await self.store.all(
            "recommendations", patient_id=patient, session_id=sid
        )
        recommendations.sort(key=lambda x: x["created_at"], reverse=True)
        for recommendation in recommendations:
            try:
                context["current_recommendation"] = await ActivityService(
                    self.store
                ).recommendation(patient, recommendation["id"])
                break
            except DomainError:
                continue
        active = await self.store.get(
            "activity_sessions", patient_id=patient, session_id=sid, state="started"
        )
        if active:
            context["active_activity_session"] = ActivityService(self.store).view(active)
        profile = await self.store.get("patient_profiles", patient_id=patient)
        context["preferences"] = profile["preferences"]
        if self.settings.companion_v2_enabled:
            from .companion import CompanionService

            context = await CompanionService(self.store).enrich(patient, context)
        response = {
            "session_id": sid,
            "connection_id": cid,
            "connection_epoch": epoch,
            "provider": "elevenlabs",
            "agent_id": self.settings.elevenlabs_agent_id,
            "agent_context": context,
            "connect_before": deadline,
            "credential_expires_at": None,
            "privacy_policy_version": self.settings.provider_privacy_policy_version,
            "camera_policy": "local_preview_only_no_transmission",
            "tool_contract_version": "2.0.0",
            "mode": mode,
            "transport": "webrtc" if mode == "voice" else "websocket",
        }
        response.update(
            {"conversation_token": secret, "provider_conversation_id": native_id}
            if mode == "voice"
            else {"signed_url": secret, "text_only": True}
        )
        return response

    async def patch(self, patient: str, sid: str, cid: str, body: dict) -> dict:
        await SessionService(self.store).owned(patient, sid)
        row = await self.store.get(
            "provider_connections", id=cid, session_id=sid, patient_id=patient
        )
        if not row:
            raise DomainError("RESOURCE_NOT_FOUND", 404)
        if row["version"] != body["expected_version"]:
            raise DomainError("VERSION_CONFLICT")
        legal = {
            "created": {"connecting", "active", "closed"},
            "connecting": {"active", "interrupted", "closed"},
            "active": {"interrupted", "closed"},
            "interrupted": {"active", "closed"},
            "closed": set(),
        }
        if body["state"] not in legal[row["state"]]:
            raise DomainError("INVALID_TRANSITION")
        native = body.get("provider_conversation_id", row["provider_conversation_id"])
        if row["provider_conversation_id"] and native != row["provider_conversation_id"]:
            raise DomainError("VALIDATION_ERROR", 422)
        row.update(
            state=body["state"],
            version=row["version"] + 1,
            provider_conversation_id=native,
            closed_at=stamp() if body["state"] == "closed" else None,
        )
        await self.store.update(
            "provider_connections",
            {"id": cid, "patient_id": patient, "version": body["expected_version"]},
            {k: row[k] for k in ["state", "version", "provider_conversation_id", "closed_at"]},
        )
        return {
            "connection_id": cid,
            **{
                k: row[k]
                for k in [
                    "session_id",
                    "connection_epoch",
                    "provider",
                    "mode",
                    "transport",
                    "state",
                    "provider_conversation_id",
                    "context_version",
                    "version",
                ]
            },
        }
