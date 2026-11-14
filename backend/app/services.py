import os
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from .domain import DomainError, RecordStore, now, stamp
from .good_news import FALLBACK_STORIES, GOOD_NEWS_ACTIVITY_ID, get_uplifting_news_instructions

ACTIVITY_ID = "22222222-2222-4222-8222-222222222222"

# Immutable catalog seed rows, in recommendation rank order. Calm Breathing stays first.
CATALOG = [
    {
        "id": ACTIVITY_ID,
        "slug": "calm-breathing",
        "version": 1,
        "kind": "breathing",
        "title": "Calm Breathing",
        "description": "Take an optional gentle pause. Stop whenever you want.",
        "duration_seconds": 60,
        "config": {
            "renderer": "breathing_v1",
            "asset_id": "harmonic-breath-v1",
            "instructions": ["Breathe comfortably. Stop if uncomfortable."],
            "inhale_seconds": 4,
            "exhale_seconds": 4,
        },
        "active": True,
    },
    {
        "id": "22222222-2222-4222-8222-222222222223",
        "slug": "acoustic-resonance",
        "version": 1,
        "kind": "nature",
        "title": "40 Hz Acoustic Resonance",
        "description": "Gentle rhythmic soundscape pause to support calm focus.",
        "duration_seconds": 60,
        "config": {
            "renderer": "nature_v1",
            "asset_id": "soundscape-40hz-v1",
            "instructions": [
                "Settle into a comfortable position.",
                "Let the steady rhythm sit in the background.",
                "Lower the volume or stop whenever you like.",
            ],
            "inhale_seconds": None,
            "exhale_seconds": None,
        },
        "active": True,
    },
    {
        "id": GOOD_NEWS_ACTIVITY_ID,
        "slug": "daily-good-news",
        "version": 1,
        "kind": "social_reconnection",
        "title": "Daily Good News Digest",
        "description": "Only uplifting, hopeful local and community stories from around you.",
        "duration_seconds": 60,
        "config": {
            "renderer": "social_v1",
            "asset_id": "good-news-ambient-v1",
            "instructions": list(FALLBACK_STORIES),
            "inhale_seconds": None,
            "exhale_seconds": None,
        },
        "active": True,
    },
    {
        "id": "22222222-2222-4222-8222-222222222224",
        "slug": "gentle-grounding",
        "version": 1,
        "kind": "behavioral_activation",
        "title": "5-Sense Room Grounding",
        "description": "Notice three calm details in your space at your own pace.",
        "duration_seconds": 60,
        "config": {
            "renderer": "step_v1",
            "asset_id": "grounding-chime-v1",
            "instructions": [
                "Notice one thing you can see.",
                "Notice one thing you can hear.",
                "Notice one thing you can feel.",
            ],
            "inhale_seconds": None,
            "exhale_seconds": None,
        },
        "active": True,
    },
]
CATALOG_ORDER = {row["id"]: rank for rank, row in enumerate(CATALOG)}
REASONS = {
    "breathing": "An optional gentle pause for relaxation.",
    "nature": "A low-effort listening pause; no reading or typing needed.",
    "social_reconnection": "Warm, uplifting stories from around you to gently reconnect with the world.",
    "behavioral_activation": "A small, doable step to reconnect with your surroundings.",
    "reflection": "A quiet moment to notice one gentle thought.",
}


def uid() -> str:
    return str(uuid4())


def utc(value: str) -> datetime:
    d = datetime.fromisoformat(value)
    return d.replace(tzinfo=UTC) if d.tzinfo is None else d


class PatientService:
    def __init__(self, store: RecordStore):
        self.store = store

    async def user(self, subject: str) -> dict:
        user = await self.store.get("users", auth_subject=subject)
        if not user or user["disabled_at"]:
            raise DomainError("RESOURCE_NOT_FOUND", 404)
        if user["role"] != "patient":
            raise DomainError("ROLE_REQUIRED", 403)
        return user

    async def onboard(self, subject: str, body: dict) -> dict:
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

        try:
            ZoneInfo(body["timezone"])
        except ZoneInfoNotFoundError:
            raise DomainError("VALIDATION_ERROR", 422) from None
        user = await self.store.get("users", auth_subject=subject)
        if not user:
            user = await self.store.add(
                "users",
                id=uid(),
                auth_subject=subject,
                role="patient",
                disabled_at=None,
                created_at=stamp(),
            )
            await self.store.add(
                "patient_profiles",
                patient_id=user["id"],
                display_name=body["display_name"],
                timezone=body["timezone"],
                preferences={},
                avatar={},
            )
        return await self.me(subject)

    async def me(self, subject: str) -> dict:
        user = await self.user(subject)
        profile = await self.store.get("patient_profiles", patient_id=user["id"])
        return {
            "user_id": user["id"],
            "role": "patient",
            "display_name": profile["display_name"],
            "timezone": profile["timezone"],
            "clinician_verified": False,
            "avatar": None,
        }


class SessionService:
    def __init__(self, store: RecordStore):
        self.store = store

    async def owned(self, patient: str, session_id: str) -> dict:
        row = await self.store.get("conversation_sessions", id=session_id, patient_id=patient)
        if not row:
            raise DomainError("RESOURCE_NOT_FOUND", 404)
        return row

    async def view(self, row: dict) -> dict:
        connections = await self.store.all(
            "provider_connections", session_id=row["id"], patient_id=row["patient_id"]
        )
        current = next((c["id"] for c in connections if c["state"] != "closed"), None)
        return {
            "session_id": row["id"],
            "state": row["state"],
            "mode": row["mode"],
            "version": row["version"],
            "created_at": row["created_at"],
            "ended_at": row["ended_at"],
            "history_enabled": False,
            "current_connection_id": current,
        }

    async def create(self, patient: str, body: dict) -> dict:
        row = await self.store.add(
            "conversation_sessions",
            id=uid(),
            patient_id=patient,
            state="created",
            mode=body["mode"],
            version=1,
            guided_state={},
            last_seen_at=stamp(),
            ended_at=None,
            created_at=stamp(),
        )
        return await self.view(row)

    async def patch(self, patient: str, sid: str, body: dict) -> dict:
        row = await self.owned(patient, sid)
        if row["version"] != body["expected_version"]:
            raise DomainError("VERSION_CONFLICT")
        allowed = {
            "created": {"active", "ended"},
            "active": {"interrupted", "ended", "active"},
            "interrupted": {"active", "ended"},
            "ended": set(),
        }
        target = body.get("state", row["state"])
        if target not in allowed[row["state"]] or len(body) == 1:
            raise DomainError("INVALID_TRANSITION")
        row.update(
            state=target,
            mode=body.get("mode", row["mode"]),
            version=row["version"] + 1,
            ended_at=stamp() if target == "ended" else None,
        )
        await self.store.update(
            "conversation_sessions",
            {"id": sid, "patient_id": patient, "version": body["expected_version"]},
            {k: row[k] for k in ["state", "mode", "version", "ended_at"]},
        )
        return await self.view(row)


class ActivityService:
    def __init__(self, store: RecordStore):
        self.store = store
        self.sessions = SessionService(store)

    def activity(self, row: dict) -> dict:
        return {
            "activity_id": row["id"],
            "activity_version": row["version"],
            **{k: row[k] for k in ["kind", "title", "description", "duration_seconds", "config"]},
        }

    async def catalog(self) -> dict:
        rows = await self.store.all("activity_catalog", active=True)
        rows.sort(key=lambda r: (CATALOG_ORDER.get(r["id"], len(CATALOG)), r["slug"], r["version"]))
        exa_key = os.getenv("RE_EXA_API_KEY", "")
        gemini_key = os.getenv("RE_GEMINI_API_KEY", "")
        items = []
        for x in rows:
            item = self.activity(x)
            if x["id"] == GOOD_NEWS_ACTIVITY_ID and exa_key:
                stories = await get_uplifting_news_instructions(exa_key, gemini_key)
                item = {**item, "config": {**item["config"], "instructions": stories}}
            items.append(item)
        return {"items": items, "next_cursor": None}

    async def recommend(self, patient: str, body: dict) -> dict:
        session = await self.sessions.owned(patient, body["session_id"])
        if session["state"] != "active":
            raise DomainError("INVALID_TRANSITION")
        running = await self.store.get(
            "activity_sessions", patient_id=patient, session_id=session["id"], state="started"
        )
        if running:
            return await self.recommendation(patient, running["recommendation_id"])
        activities = (await self.catalog())["items"][: body["limit"]]
        rid, expiry = uid(), (now() + timedelta(minutes=10)).isoformat()
        await self.store.add(
            "recommendations",
            id=rid,
            patient_id=patient,
            session_id=session["id"],
            expires_at=expiry,
            created_at=stamp(),
        )
        options = []
        for rank, activity in enumerate(activities, 1):
            reason = REASONS.get(activity["kind"], "An optional gentle pause.")
            await self.store.add(
                "recommendation_items",
                recommendation_id=rid,
                patient_id=patient,
                activity_id=activity["activity_id"],
                activity_version=activity["activity_version"],
                rank=rank,
                reason=reason,
            )
            options.append({"activity": activity, "rank": rank, "reason": reason})
        return {
            "recommendation_id": rid,
            "session_id": session["id"],
            "expires_at": expiry,
            "options": options,
        }

    async def recommendation(self, patient: str, rid: str) -> dict:
        row = await self.store.get("recommendations", id=rid, patient_id=patient)
        if not row or utc(row["expires_at"]) <= now():
            raise DomainError("STALE_RECOMMENDATION")
        options = []
        for item in await self.store.all(
            "recommendation_items", recommendation_id=rid, patient_id=patient
        ):
            activity = await self.store.get("activity_catalog", id=item["activity_id"])
            options.append(
                {
                    "activity": self.activity(activity),
                    "rank": item["rank"],
                    "reason": item["reason"],
                }
            )
        return {
            "recommendation_id": rid,
            "session_id": row["session_id"],
            "expires_at": row["expires_at"],
            "options": sorted(options, key=lambda x: x["rank"]),
        }

    def view(self, row: dict) -> dict:
        return {
            "activity_session_id": row["id"],
            **{
                k: row[k]
                for k in [
                    "session_id",
                    "recommendation_id",
                    "activity_id",
                    "activity_version",
                    "state",
                    "version",
                    "started_at",
                    "ended_at",
                ]
            },
        }

    async def owned(self, patient: str, aid: str) -> dict:
        row = await self.store.get("activity_sessions", id=aid, patient_id=patient)
        if not row:
            raise DomainError("RESOURCE_NOT_FOUND", 404)
        return row

    async def start(self, patient: str, body: dict) -> dict:
        session = await self.sessions.owned(patient, body["session_id"])
        if session["state"] != "active":
            raise DomainError("INVALID_TRANSITION")
        rec = await self.store.get(
            "recommendations",
            id=body["recommendation_id"],
            patient_id=patient,
            session_id=session["id"],
        )
        item = await self.store.get(
            "recommendation_items",
            recommendation_id=body["recommendation_id"],
            patient_id=patient,
            activity_id=body["activity_id"],
            activity_version=body["activity_version"],
        )
        if not rec or not item or utc(rec["expires_at"]) <= now():
            raise DomainError("STALE_RECOMMENDATION")
        existing = await self.store.get(
            "activity_sessions", patient_id=patient, session_id=session["id"], state="started"
        )
        if existing:
            if all(
                existing[k] == body[k]
                for k in ["recommendation_id", "activity_id", "activity_version"]
            ):
                return self.view(existing)
            raise DomainError("INVALID_TRANSITION")
        row = await self.store.add(
            "activity_sessions",
            id=uid(),
            patient_id=patient,
            **body,
            state="started",
            version=1,
            started_at=stamp(),
            ended_at=None,
        )
        return self.view(row)

    async def source(self, patient: str, session: str, kind: str, at: str) -> str:
        sid = uid()
        await self.store.add(
            "source_records",
            id=sid,
            patient_id=patient,
            session_id=session,
            kind=kind,
            revision=1,
            occurred_at=at,
            unavailable_at=None,
            created_at=stamp(),
        )
        return sid

    async def event(self, patient: str, aid: str, body: dict) -> dict:
        row = await self.owned(patient, aid)
        existing = await self.store.get(
            "activity_events",
            patient_id=patient,
            activity_session_id=aid,
            client_event_id=body["client_event_id"],
        )
        if existing:
            if any(existing[k] != body[k] for k in ["event_type", "elapsed_seconds"]):
                raise DomainError("IDEMPOTENCY_CONFLICT")
            return self.view(row)
        if row["version"] != body["expected_version"]:
            raise DomainError("VERSION_CONFLICT")
        if row["state"] != "started":
            raise DomainError("INVALID_TRANSITION")
        at = utc(body["event_at"])
        if at > now() + timedelta(seconds=30) or at < utc(row["started_at"]):
            raise DomainError("VALIDATION_ERROR", 422)
        source = await self.source(patient, row["session_id"], "activity_event", body["event_at"])
        await self.store.add(
            "activity_events",
            id=uid(),
            patient_id=patient,
            activity_session_id=aid,
            source_id=source,
            **{k: v for k, v in body.items() if k != "expected_version"},
            created_at=stamp(),
        )
        row.update(version=row["version"] + 1)
        if body["event_type"] != "progress":
            row.update(
                state="completed" if body["event_type"] == "complete" else "abandoned",
                ended_at=body["event_at"],
            )
        await self.store.update(
            "activity_sessions",
            {"id": aid, "patient_id": patient, "version": body["expected_version"]},
            {k: row[k] for k in ["version", "state", "ended_at"]},
        )
        return self.view(row)

    async def feedback(self, patient: str, aid: str, body: dict) -> dict:
        row = await self.owned(patient, aid)
        if row["state"] != "completed":
            raise DomainError("INVALID_TRANSITION")
        if await self.store.get("activity_feedback", activity_session_id=aid, patient_id=patient):
            raise DomainError("ANSWER_EXISTS")
        source = await self.source(patient, row["session_id"], "feedback", stamp())
        result = dict(feedback_id=uid(), activity_session_id=aid, source_id=source, **body)
        await self.store.add(
            "activity_feedback",
            id=result["feedback_id"],
            patient_id=patient,
            activity_session_id=aid,
            source_id=source,
            **body,
            created_at=stamp(),
        )
        return result

    async def journey(self, patient: str, limit: int = 20) -> dict:
        rows = await self.store.all("activity_sessions", patient_id=patient)
        rows.sort(key=lambda r: (r["started_at"], r["id"]), reverse=True)
        if len(rows) > limit:
            raise DomainError("PAGINATION_NOT_IMPLEMENTED", 422)
        items = []
        for row in rows:
            activity = await self.store.get("activity_catalog", id=row["activity_id"])
            feedback = await self.store.get(
                "activity_feedback", activity_session_id=row["id"], patient_id=patient
            )
            fb = (
                None
                if not feedback
                else {
                    "feedback_id": feedback["id"],
                    **{
                        k: feedback[k]
                        for k in ["activity_session_id", "source_id", "rating", "comment"]
                    },
                }
            )
            items.append(
                {
                    "activity_session": self.view(row),
                    "activity": self.activity(activity),
                    "feedback": fb,
                }
            )
        return {"items": items, "next_cursor": None}
