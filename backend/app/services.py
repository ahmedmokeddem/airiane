import os
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from . import guidance
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
        "id": "22222222-2222-4222-8222-222222222226",
        "slug": "five-minute-walk",
        "version": 1,
        "kind": "behavioral_activation",
        "title": "Go for a 5-Minute Walk",
        "description": "A gentle five-minute walk indoors or outside to reset your pace.",
        "duration_seconds": 300,
        "config": {
            "renderer": "step_v1",
            "asset_id": "grounding-chime-v1",
            "instructions": [
                "Put on comfortable shoes or walk slowly in your space.",
                "Notice your footsteps and let your arms swing naturally.",
                "Take in one detail around you before returning.",
            ],
            "inhale_seconds": None,
            "exhale_seconds": None,
        },
        "active": True,
    },
    {
        "id": "22222222-2222-4222-8222-222222222227",
        "slug": "warm-cup-pause",
        "version": 1,
        "kind": "behavioral_activation",
        "title": "Make a Warm Cup of Coffee or Tea",
        "description": "Turn a familiar daily ritual into three calm, unhurried minutes.",
        "duration_seconds": 180,
        "config": {
            "renderer": "step_v1",
            "asset_id": "grounding-chime-v1",
            "instructions": [
                "Fill the kettle or mug and listen to the water.",
                "Notice the warmth in your hands and the aroma rising.",
                "Take your first unhurried sip without checking a screen.",
            ],
            "inhale_seconds": None,
            "exhale_seconds": None,
        },
        "active": True,
    },
    {
        "id": "22222222-2222-4222-8222-222222222228",
        "slug": "window-daylight-pause",
        "version": 1,
        "kind": "nature",
        "title": "Window Daylight & Fresh Air",
        "description": "Step by a window or open door for two minutes of natural light.",
        "duration_seconds": 120,
        "config": {
            "renderer": "step_v1",
            "asset_id": "grounding-chime-v1",
            "instructions": [
                "Look out toward the sky, trees, or distant horizon.",
                "Notice the temperature of the air on your face.",
                "Let your gaze rest softly before stepping back inside.",
            ],
            "inhale_seconds": None,
            "exhale_seconds": None,
        },
        "active": True,
    },
    {
        "id": "22222222-2222-4222-8222-222222222229",
        "slug": "shoulder-jaw-release",
        "version": 1,
        "kind": "behavioral_activation",
        "title": "Shoulder & Jaw Release",
        "description": "A 90-second posture and muscle unclenching reset.",
        "duration_seconds": 90,
        "config": {
            "renderer": "step_v1",
            "asset_id": "grounding-chime-v1",
            "instructions": [
                "Let your jaw unclench and your tongue rest softly.",
                "Roll your shoulders back once, then let them drop.",
                "Unfold your hands and rest them comfortably.",
            ],
            "inhale_seconds": None,
            "exhale_seconds": None,
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
    *guidance.SMALL_ACTIVITIES,
]
CATALOG_ORDER = {row["id"]: rank for rank, row in enumerate(CATALOG)}
REASONS = {
    "breathing": "Slow 4s/4s paced breathing engages parasympathetic vagal tone and steadies heart-rate variability.",
    "nature": "Gentle sensory and auditory pacing lowers cognitive load and supports calm autonomic focus.",
    "social_reconnection": "Uplifting, low-stress community stories gently counter rumination and social isolation.",
    "behavioral_activation": "Small, achievable everyday actions support behavioral activation and reward-circuit momentum.",
    "reflection": "A quiet moment to notice one gentle thought.",
}


def compute_streak_days(sessions: list[dict], timezone_name: str = "UTC") -> int:
    """Consecutive local days (ending today or yesterday) with a completed activity."""
    return guidance.streak(sessions, timezone_name)[0]


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
            "avatar": profile["avatar"] or None,
        }

    async def patch(self, subject: str, body: dict) -> dict:
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

        user = await self.user(subject)
        if "timezone" in body:
            try:
                ZoneInfo(body["timezone"])
            except (ZoneInfoNotFoundError, ValueError):
                raise DomainError("VALIDATION_ERROR", 422) from None
        if "display_name" in body and not body["display_name"].strip():
            raise DomainError("VALIDATION_ERROR", 422)
        if body:
            await self.store.update("patient_profiles", {"patient_id": user["id"]}, body)
        return await self.me(subject)

    async def context(self, patient: str) -> dict:
        profile = await self.store.get("patient_profiles", patient_id=patient)
        return {
            "patient_id": patient,
            "preferences": profile["preferences"],
            "recovery_plan": None,
            "memories": [],
            "recent_observations": await self.recent_observations(patient),
        }

    async def recent_observations(self, patient: str) -> list[dict]:
        """Confirmed check-in values from the last week, newest first, for tailoring."""
        from .wellbeing import ObservationService

        rows = [
            row
            for row in await self.store.all("observations", patient_id=patient, state="confirmed")
            if utc(row["observed_at"]) >= now() - timedelta(days=7)
        ]
        rows.sort(key=lambda r: (r["observed_at"], r["id"]), reverse=True)
        views = ObservationService(self.store)
        return [await views.view(row) for row in rows[:30]]

    async def patch_context(self, patient: str, body: dict) -> dict:
        await self.store.update(
            "patient_profiles", {"patient_id": patient}, {"preferences": body["preferences"]}
        )
        return await self.context(patient)


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
            try:
                return await self.recommendation(patient, running["recommendation_id"])
            except DomainError:
                pass
        # Tailor to today's confirmed check-in; a catalog choice by the patient goes first.
        ranked = guidance.tailor(
            (await self.catalog())["items"],
            await guidance.todays_checkin(self.store, patient),
            await self.questionnaire_signals(patient),
        )
        chosen = body.get("preferred_activity_id")
        ranked.sort(key=lambda pair: pair[0]["activity_id"] != chosen)
        ranked = ranked[: body["limit"]]
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
        for rank, (activity, reason) in enumerate(ranked, 1):
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

    async def questionnaire_signals(self, patient: str) -> list[tuple]:
        """Rules from the most recent complete questionnaire in the last 14 days."""
        from .assessments import score

        recent = [
            r
            for r in await self.store.all("assessment_responses", patient_id=patient, complete=True)
            if utc(r["observed_at"]) >= now() - timedelta(days=14)
        ]
        if not recent:
            return []
        latest = max(recent, key=lambda r: r["observed_at"])
        return guidance.questionnaire_signals(
            score(latest["assessment_id"], latest["answers"]), latest["answers"]
        )

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
        if not item:
            catalog_item = await self.store.get(
                "activity_catalog",
                id=body["activity_id"],
                version=body["activity_version"],
                active=True,
            )
            if catalog_item:
                item = catalog_item
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
        if at > now() + timedelta(seconds=30) or at < utc(row["started_at"]) - timedelta(
            seconds=30
        ):
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
        rows = rows[:limit]
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
