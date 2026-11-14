"""Small allowlisted instruction language; model output is never executable."""

import json
import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Format = Literal[
    "mini_game",
    "creative_activity",
    "guided_experience",
    "interactive_reflection",
    "practical_activity",
]
# Conservative content gate supplements (and does not replace) bounded UI capabilities.
UNSAFE = re.compile(
    r"(?:https?://|<[^>]+>|```|\b(?:eval|exec)\s*\(|\b(?:suicid|self.harm|diagnos|medication|treatment|tms|phq.?9|breath.hold|hold your breath|clinical score|depress|symptom score|recovery score|therap|efficacy|cognitive test|screening|punish|gambl|weapon|overdose))",
    re.IGNORECASE,
)
IDENTIFIERS = re.compile(
    r"(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b[0-9a-f]{8}-[0-9a-f-]{27,}\b|https?://|(?:\+?\d[\d ()-]{8,}\d))",
    re.IGNORECASE,
)


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Choice(Strict):
    id: str = Field(pattern=r"^[a-z][a-z0-9_]{0,23}$")
    label: str = Field(min_length=1, max_length=80)
    next_step: int | None = Field(default=None, ge=0, le=7)


class Component(Strict):
    id: str = Field(pattern=r"^[a-z][a-z0-9_]{0,23}$")
    type: Literal[
        "visual_pattern",
        "creative_canvas",
        "guided_focus",
        "thought_sort",
        "practical_step",
        "choice",
    ]
    prompt: str = Field(min_length=1, max_length=300)
    choices: list[Choice] = Field(default_factory=list, max_length=4)
    sequence: list[Literal["circle", "square", "triangle"]] = Field(
        default_factory=list, max_length=6
    )
    categories: list[str] = Field(default_factory=list, max_length=3)
    pace_seconds: int = Field(
        default=4,
        ge=2,
        le=8,
        description="Optional comfortable rhythm only, NOT step duration. Use 4 or omit; never above 8.",
    )


class Definition(Strict):
    schema_version: Literal["1.0"]
    title: str = Field(min_length=1, max_length=100)
    purpose: str = Field(min_length=1, max_length=240)
    format: Format
    duration_seconds: int = Field(ge=30, le=600)
    introduction: str = Field(min_length=1, max_length=300)
    components: list[Component] = Field(min_length=1, max_length=8)
    feedback_prompt: str = Field(min_length=1, max_length=120)

    @model_validator(mode="after")
    def bounded(self):
        required = {
            "mini_game": "visual_pattern",
            "creative_activity": "creative_canvas",
            "guided_experience": "guided_focus",
            "interactive_reflection": "thought_sort",
            "practical_activity": "practical_step",
        }
        if required[self.format] not in [c.type for c in self.components]:
            raise ValueError("Format requires an interactive component")
        if len({c.id for c in self.components}) != len(self.components):
            raise ValueError("Duplicate step")
        for i, c in enumerate(self.components):
            if c.choices and c.type != "choice":
                raise ValueError("Only choice components may branch")
            if len({x.id for x in c.choices}) != len(c.choices):
                raise ValueError("Duplicate choice")
            if c.type == "visual_pattern" and not c.sequence:
                raise ValueError("Pattern required")
            if c.type == "thought_sort" and (
                len(c.categories) < 2 or any(not x.strip() or len(x) > 60 for x in c.categories)
            ):
                raise ValueError("Two bounded categories required")
            if c.type == "choice" and len(c.choices) < 2:
                raise ValueError("Choices required")
            if any(
                x.next_step is not None and not i < x.next_step < len(self.components)
                for x in c.choices
            ):
                raise ValueError("Only forward bounded branches permitted")
        if UNSAFE.search(json.dumps(self.model_dump(), ensure_ascii=False)):
            raise ValueError("Unsafe instruction")
        return self


class GenerationRequest(Strict):
    goal: str = Field(min_length=3, max_length=240)
    format: Format
    duration_seconds: int = Field(default=180, ge=30, le=600)

    @model_validator(mode="after")
    def safe_goal(self):
        if len(self.goal.strip()) < 3 or IDENTIFIERS.search(self.goal) or UNSAFE.search(self.goal):
            raise ValueError("Use a brief non-identifying everyday goal")
        return self


class Consent(Strict):
    allowed: bool


class Transition(Strict):
    expected_revision: int = Field(ge=1)
    step_id: str = Field(max_length=24)
    action: Literal["next", "skip", "pause", "resume", "confirm_completion"]
    choice_id: str | None = Field(default=None, max_length=24)
    sequence: list[Literal["circle", "square", "triangle"]] = Field(
        default_factory=list, max_length=6
    )


class GeneratedDefinition(Strict):
    activity_id: str
    state: Literal["proposed", "declined", "accepted"]
    definition: Definition


class GeneratedProgress(Strict):
    activity_session_id: str
    revision: int
    step: int
    current: Component | None
    paused: bool
    finished: bool
    confirmed: bool
