"""Isolated conversation insight extraction and therapist-report JSON.

This module is deliberately deterministic and auditable. It does not call an LLM, does not
modify conversation history, and never treats retrieved text as instructions. Retrieved
messages are untrusted data used only for explicit pattern extraction and evidence snippets.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

EvidenceType = Literal[
    "user_reported",
    "observed_pattern",
    "insufficient_information",
    "not_assessed",
]


class ConversationTurn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message_id: str = Field(min_length=1, max_length=100)
    session_id: str = Field(min_length=1, max_length=100)
    speaker: Literal["patient", "assistant"]
    text: str = Field(min_length=1, max_length=4000)
    event_at: datetime
    channel: Literal["typed_text", "voice_transcription"] = "typed_text"

    @field_validator("event_at")
    @classmethod
    def aware_time(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("event_at must include a timezone")
        return value


class InsightReportCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_id: str = Field(min_length=1, max_length=100)
    messages: list[ConversationTurn] = Field(min_length=1, max_length=100)
    consent_to_analyze: bool = False

    @field_validator("messages")
    @classmethod
    def same_session(cls, messages: list[ConversationTurn]) -> list[ConversationTurn]:
        if len({message.session_id for message in messages}) != 1:
            raise ValueError("all messages must belong to one session")
        return messages


class InsightReportShare(BaseModel):
    model_config = ConfigDict(extra="forbid")

    care_link_id: str = Field(min_length=1, max_length=100)
    consent: bool = False


class EvidenceReference(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message_id: str
    session_id: str
    event_at: datetime
    speaker: Literal["patient"]
    quote: str = Field(min_length=1, max_length=300)


class Coverage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_id: str
    message_count: int = Field(ge=1)
    patient_message_count: int = Field(ge=0)
    assistant_message_count: int = Field(ge=0)
    period_start: datetime
    period_end: datetime


class AssessmentSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    instrument: Literal["phq9", "bdi_themes"]
    title: str
    version: int
    observed_at: datetime
    total: int = Field(ge=0)
    max_total: int = Field(ge=1)
    severity: str
    validated: bool
    safety_item_positive: bool


class AssessmentSection(BaseModel):
    model_config = ConfigDict(extra="forbid")

    phq9: AssessmentSummary | None
    bdi_ii: AssessmentSummary | None
    note: str


class ReportDimension(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str
    label: str
    status: EvidenceType
    count: int = Field(ge=0)
    first_seen: datetime | None
    last_seen: datetime | None
    evidence: list[EvidenceReference]
    note: str


class SafetySection(BaseModel):
    model_config = ConfigDict(extra="forbid")

    present: bool
    evidence_type: EvidenceType
    evidence: list[EvidenceReference]
    message: str


class ConsentSection(BaseModel):
    model_config = ConfigDict(extra="forbid")

    analysis_consent: Literal[True]
    sharing_status: Literal["private_draft", "shared"]
    recipient_care_link_id: str | None
    shared_at: datetime | None


class InsightReportPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["conversation-insight/v1"]
    report_id: str
    generated_at: datetime
    patient_id: str
    coverage: Coverage
    assessments: AssessmentSection
    dimensions: list[ReportDimension]
    functional_impact: ReportDimension
    positive_experiences: ReportDimension
    safety: SafetySection
    information_gaps: list[str]
    follow_up_suggestions: list[str]
    limitations: list[str]
    consent: ConsentSection


class _Rule:
    __slots__ = ("key", "label", "pattern")

    def __init__(self, key: str, label: str, pattern: str) -> None:
        self.key = key
        self.label = label
        self.pattern = re.compile(pattern, re.IGNORECASE)


SYMPTOM_RULES = (
    _Rule(
        "emotional",
        "Emotional experiences",
        r"\b(sad|sadness|down|depressed|depression|hopeless|cry|crying|upset|"
        r"frustrated|overwhelmed|empty|miserable)\b",
    ),
    _Rule(
        "interest",
        "Interest and motivation",
        r"\b(no interest|lost interest|don't enjoy|do not enjoy|no motivation|"
        r"unmotivated|can't be bothered|cannot be bothered|stopped doing|nothing interests)\b",
    ),
    _Rule(
        "energy",
        "Energy and physical experiences",
        r"\b(tired|exhausted|no energy|low energy|fatigue|drained|worn out)\b",
    ),
    _Rule(
        "sleep_appetite",
        "Sleep and appetite",
        r"\b(sleep|sleeping|insomnia|wake up|waking|oversleep|appetite|eating|"
        r"overeating|not hungry|no appetite)\b",
    ),
    _Rule(
        "cognitive",
        "Cognitive experiences",
        r"\b(concentrate|concentration|focus|decision|decisions|indecisive|"
        r"remember|memory|forgetful)\b",
    ),
    _Rule(
        "self_perception",
        "Self-perception",
        r"\b(failure|worthless|guilt|guilty|blame myself|self-criticism|"
        r"hate myself|ashamed|not good enough)\b",
    ),
    _Rule(
        "social",
        "Social interaction",
        r"\b(isolated|lonely|alone|avoid people|withdrew|withdrawn|friends|"
        r"family|social)\b",
    ),
    _Rule(
        "anxiety",
        "Anxiety-related experiences",
        r"\b(anxious|anxiety|worry|worried|nervous|panic|restless|on edge|"
        r"racing thoughts)\b",
    ),
)

FUNCTIONING_RULE = _Rule(
    "functioning",
    "Daily functioning",
    r"\b(work|job|school|studies|study|chores|responsibilities|daily tasks|"
    r"can't function|cannot function|getting through the day)\b",
)

POSITIVE_RULE = _Rule(
    "positive",
    "Positive experiences and support",
    r"\b(better|helped|helpful|support|supported|friend|walk|walking|breathing|"
    r"calm|hope|hopeful|enjoyed|good day|proud|manageable|relieved|coped|coping)\b",
)

SAFETY_RULE = _Rule(
    "safety",
    "Safety-related information",
    r"\b(kill myself|killing myself|suicide|suicidal|better off dead|hurt myself|"
    r"self[- ]?harm|end my life|don't want to live|do not want to live|want to die)\b",
)


def _quote(text: str) -> str:
    clean = " ".join(text.split())
    return clean[:300]


def _evidence(
    messages: list[ConversationTurn],
    rule: _Rule,
    limit: int = 4,
) -> list[EvidenceReference]:
    patient_messages = [message for message in messages if message.speaker == "patient"]
    hits = [message for message in patient_messages if rule.pattern.search(message.text)]
    return [
        EvidenceReference(
            message_id=message.message_id,
            session_id=message.session_id,
            event_at=message.event_at,
            speaker="patient",
            quote=_quote(message.text),
        )
        for message in hits[:limit]
    ]


def _dimension(
    messages: list[ConversationTurn],
    rule: _Rule,
    *,
    insufficient_note: str,
    missing_note: str,
) -> ReportDimension:
    patient_messages = [message for message in messages if message.speaker == "patient"]
    hits = [message for message in patient_messages if rule.pattern.search(message.text)]
    if not patient_messages:
        status: EvidenceType = "insufficient_information"
        note = insufficient_note
    elif not hits:
        status = "not_assessed"
        note = missing_note
    elif len(hits) >= 2:
        status = "observed_pattern"
        note = "Two or more patient messages explicitly referenced this area."
    else:
        status = "user_reported"
        note = "One patient message explicitly referenced this area."
    return ReportDimension(
        key=rule.key,
        label=rule.label,
        status=status,
        count=len(hits),
        first_seen=hits[0].event_at if hits else None,
        last_seen=hits[-1].event_at if hits else None,
        evidence=_evidence(messages, rule) if hits else [],
        note=note,
    )


def _safety(messages: list[ConversationTurn]) -> SafetySection:
    patient_messages = [message for message in messages if message.speaker == "patient"]
    hits = [message for message in patient_messages if SAFETY_RULE.pattern.search(message.text)]
    if not patient_messages:
        return SafetySection(
            present=False,
            evidence_type="insufficient_information",
            evidence=[],
            message="No patient messages were available to review for safety-related language.",
        )
    if not hits:
        return SafetySection(
            present=False,
            evidence_type="not_assessed",
            evidence=[],
            message="No explicit safety-related language was found in the submitted patient messages.",
        )
    return SafetySection(
        present=True,
        evidence_type="observed_pattern" if len(hits) >= 2 else "user_reported",
        evidence=_evidence(messages, SAFETY_RULE),
        message=(
            "The submitted messages contain explicit safety-related language. This report does "
            "not classify risk or replace the existing safety workflow; a clinician should review "
            "the source messages and follow the established safety process."
        ),
    )


def _follow_up(
    dimensions: list[ReportDimension],
    functional: ReportDimension,
    positive: ReportDimension,
    safety: SafetySection,
) -> list[str]:
    suggestions: list[str] = []
    if safety.present:
        suggestions.append(
            "Review the existing safety workflow with the patient and ask directly about current safety."
        )
    for dimension in [*dimensions, functional]:
        if dimension.status in ("not_assessed", "insufficient_information"):
            suggestions.append(
                f"Ask whether the patient has noticed changes related to {dimension.label.lower()}."
            )
    if positive.status in ("not_assessed", "insufficient_information"):
        suggestions.append(
            "Ask what has helped, who supports the patient, and what still feels manageable."
        )
    return suggestions[:8]


def build_insight_report(
    *,
    report_id: str,
    patient_id: str,
    messages: list[ConversationTurn],
    assessments: AssessmentSection,
    generated_at: datetime,
) -> InsightReportPayload:
    ordered = sorted(messages, key=lambda message: message.event_at)
    patient_messages = [message for message in ordered if message.speaker == "patient"]
    if not patient_messages:
        coverage_note = (
            "Only assistant messages were submitted; no patient-reported evidence is available."
        )
    else:
        coverage_note = "Report generated from the explicitly submitted conversation excerpt."

    dimensions = [
        _dimension(
            ordered,
            rule,
            insufficient_note="No patient messages were available to assess this area.",
            missing_note="The patient did not explicitly mention this area in the submitted messages.",
        )
        for rule in SYMPTOM_RULES
    ]
    functional = _dimension(
        ordered,
        FUNCTIONING_RULE,
        insufficient_note="No patient messages were available to assess daily functioning.",
        missing_note="The patient did not explicitly mention work, studies, chores or daily responsibilities.",
    )
    positive = _dimension(
        ordered,
        POSITIVE_RULE,
        insufficient_note="No patient messages were available to assess positive experiences or support.",
        missing_note="No explicit positive experience, support resource or coping activity was reported.",
    )
    safety = _safety(ordered)
    gaps = [
        dimension.label
        for dimension in [*dimensions, functional]
        if dimension.status in ("not_assessed", "insufficient_information")
    ]
    if positive.status in ("not_assessed", "insufficient_information"):
        gaps.append(positive.label)
    if assessments.phq9 is None:
        gaps.append("PHQ-9 result not available to this report.")
    if assessments.bdi_ii is None:
        gaps.append("BDI-II result not available to this report.")

    limitations = [
        coverage_note,
        "Assistant messages are used for coverage only and are never treated as patient-reported evidence.",
        "This report is not a diagnosis, a risk classification, or a treatment recommendation.",
        "Absence of a statement is not evidence of absence, and no symptom is inferred from silence.",
        "Only questionnaire records persisted by the existing backend are included; device-only standalone results are unavailable.",
        "The report does not combine, average or convert PHQ-9 and BDI-II scores.",
    ]

    return InsightReportPayload(
        schema_version="conversation-insight/v1",
        report_id=report_id,
        generated_at=generated_at,
        patient_id=patient_id,
        coverage=Coverage(
            session_id=ordered[0].session_id,
            message_count=len(ordered),
            patient_message_count=len(patient_messages),
            assistant_message_count=len(ordered) - len(patient_messages),
            period_start=ordered[0].event_at,
            period_end=ordered[-1].event_at,
        ),
        assessments=assessments,
        dimensions=dimensions,
        functional_impact=functional,
        positive_experiences=positive,
        safety=safety,
        information_gaps=gaps,
        follow_up_suggestions=_follow_up(dimensions, functional, positive, safety),
        limitations=limitations,
        consent=ConsentSection(
            analysis_consent=True,
            sharing_status="private_draft",
            recipient_care_link_id=None,
            shared_at=None,
        ),
    )
