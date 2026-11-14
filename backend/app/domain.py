from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, ClassVar, Protocol


class DomainError(Exception):
    def __init__(self, code: str, status: int = 409):
        self.code, self.status = code, status


def now() -> datetime:
    return datetime.now(UTC)


def stamp() -> str:
    return now().isoformat()


@dataclass(frozen=True)
class Identity:
    subject: str


class RecordStore(Protocol):
    async def get(self, table: str, **filters: Any) -> dict | None: ...
    async def all(self, table: str, **filters: Any) -> list[dict]: ...
    async def get_locked(self, table: str, **filters: Any) -> dict | None: ...
    async def recent(self, table: str, *, limit: int, **filters: Any) -> list[dict]: ...

    async def add(self, table: str, **values: Any) -> dict: ...
    async def update(self, table: str, filters: dict, values: dict) -> None: ...


class ConversationController:
    """Provider-independent guided context. Never infers vision or confirmed facts."""

    def context(self, version: int, recommendation: dict | None = None) -> dict:
        return {
            "context_version": version,
            "summary": (
                "Warmly greet the patient and gently guide them through the 3 daily check-in "
                "questions (mood 0-10, energy 0-10, sleep_hours 0-24) via speech or text, "
                "calling propose_observation for each answer so they can confirm it. "
                "Recommend calming activities with brief scientific rationale. "
                "You cannot see images or surroundings."
            ),
            "guided_question": self.question(version),
            "preferences": {},
            "current_recommendation": recommendation,
            "active_activity_session": None,
            "vision_access": "none",
        }

    WORDING: ClassVar[dict[str, str]] = {
        "mood": "How is your mood today, from zero to ten? There is no right answer.",
        "energy": "And how is your energy right now, from zero to ten?",
        "sleep_hours": "Roughly how many hours did you sleep last night?",
    }

    def question(self, version: int, missing: list[str] | None = None) -> dict:
        """Next daily check-in question. `missing` is what today still lacks a confirmed value for."""
        missing = list(self.WORDING) if missing is None else missing
        field = missing[0] if missing else None
        return {
            "question_id": field,
            "flow_version": "daily-checkin-v1",
            "wording": self.WORDING[field] if field else None,
            "missing_fields": missing,
            "session_version": version,
        }
