from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Protocol


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
            "summary": "Offer optional wellbeing activities. You cannot see images or surroundings.",
            "guided_question": self.question(version),
            "preferences": {},
            "current_recommendation": recommendation,
            "active_activity_session": None,
            "vision_access": "none",
        }

    def question(self, version: int) -> dict:
        return {
            "question_id": "mood",
            "flow_version": "first-slice-v1",
            "wording": "How are you feeling today, from zero to ten?",
            "missing_fields": ["mood", "energy", "sleep_hours"],
            "session_version": version,
        }
