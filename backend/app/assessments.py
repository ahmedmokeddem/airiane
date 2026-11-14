"""Full-assessment questionnaires from assets/Book1.ods, with deterministic scoring.

Sheet1 gives the questions and score bands, Sheet2 the interpretation text and the symptom
groups, Sheet3 the sources. Scoring is plain arithmetic over answers the patient tapped; no model
output is ever scored. Results are screening information for the patient's clinician, never a
diagnosis, and the patient sees only their totals.

Decisions (agreed with the product owner, also in docs/ASSESSMENTS.md):
- PHQ-9 answer labels use the standard wording ("More than half the days", "Nearly every day").
- "If Q9 > 0: extra question" is PHQ-9 Q10 (functional impairment), asked only when Q9 > 0 and
  never added to the total; it uses the official PHQ-9 difficulty labels.
- When Q9 > 0 and the patient has a connected doctor, all answers are sent to that doctor
  automatically. The patient is told this before starting. Crisis support is shown at once.
- The second set rewords BDI-II themes; it is not the licensed BDI-II, so its result is labelled
  indicative. Severity uses the standard BDI-II cut-offs (Sheet2: 0-13/14-19/20-28/29-63);
  Sheet1's 0-9/10-27/28-63 are not the published BDI-II bands and are not used.
"""

from datetime import timedelta

from .domain import DomainError, RecordStore, now, stamp
from .services import SessionService, uid, utc

# The schema keeps one row per questionnaire id, so a changed questionnaire gets a new id.
# These ids replace ...331/...332, whose separate Q9 follow-up was replaced by Q10.
PHQ9_ID = "33333333-3333-4333-8333-333333333341"
BDI_ID = "33333333-3333-4333-8333-333333333342"
VERSION = 1

PHQ_OPTIONS = ["Not at all", "Several days", "More than half the days", "Nearly every day"]
DIFFICULTY_OPTIONS = [
    "Not difficult at all",
    "Somewhat difficult",
    "Very difficult",
    "Extremely difficult",
]
INTENSITY_OPTIONS = ["Not at all", "A little", "Quite a lot", "Very much"]
CITATIONS = [
    "https://www.hiv.uw.edu/page/mental-health-screening/phq-9",
    "https://www.healthquality.va.gov/guidelines/MH/mdd/VADoDMDDCPGFinal508.pdf",
    "https://www.apa.org/depression-guideline/assessment",
    "https://pmc.ncbi.nlm.nih.gov/articles/PMC3782729/",
]


def _options(labels: list[str]) -> list[dict]:
    return [{"value": i, "label": label} for i, label in enumerate(labels)]


def _question(qid, wording, labels=PHQ_OPTIONS, scored=True, follow_up_of=None) -> dict:
    return {
        "question_id": qid,
        "wording": wording,
        "minimum": 0,
        "maximum": len(labels) - 1,
        "options": _options(labels),
        "scored": scored,
        "follow_up_of": follow_up_of,
    }


PHQ9_QUESTIONS = [
    _question("q1", "Little interest or pleasure in doing things?"),
    _question("q2", "Feeling down, depressed, or hopeless?"),
    _question("q3", "Trouble falling or staying asleep, or sleeping too much?"),
    _question("q4", "Feeling tired or having little energy?"),
    _question("q5", "Poor appetite or overeating?"),
    _question(
        "q6",
        "Feeling bad about yourself — or that you are a failure or have let yourself or your "
        "family down?",
    ),
    _question(
        "q7",
        "Trouble concentrating on things, such as reading the newspaper or watching television?",
    ),
    _question(
        "q8",
        "Moving or speaking so slowly that other people could have noticed? Or the opposite — "
        "being so fidgety or restless that you have been moving around much more than usual?",
    ),
    _question(
        "q9", "Thoughts that you would be better off dead or of hurting yourself in some way?"
    ),
    # The sheet's "extra question": asked only when Q9 > 0, never counted in the total.
    _question(
        "q10",
        "If you checked off any problems, how difficult have these problems made it for you to "
        "do your work, take care of things at home, or get along with other people?",
        DIFFICULTY_OPTIONS,
        scored=False,
        follow_up_of="q9",
    ),
]

BDI_WORDING = [
    (
        "How frequently have you experienced feelings of sadness or emotional distress during the "
        "past two weeks?"
    ),
    (
        "How pessimistic have you felt about your future and the possibility of positive things "
        "happening in your life?"
    ),
    (
        "To what extent have you felt unsuccessful or believed that you have failed in important "
        "areas of your life?"
    ),
    (
        "How much enjoyment or satisfaction have you experienced from activities that previously "
        "made you happy?"
    ),
    (
        "How frequently have you experienced feelings of guilt or blamed yourself for things that "
        "happened?"
    ),
    (
        "Have you experienced feelings that you deserve to be punished or that something negative "
        "is happening to you as a form of punishment?"
    ),
    (
        "How negatively have you felt about yourself, including feelings of disappointment or "
        "dissatisfaction with who you are?"
    ),
    "How frequently have you criticized yourself or blamed yourself for mistakes and shortcomings?",
    "Have you experienced thoughts about death, not wanting to live, or ending your own life?",
    "How frequently have you experienced episodes of crying or felt an increased urge to cry?",
    (
        "How much has your interest in other people, social activities, hobbies, or everyday "
        "experiences decreased?"
    ),
    (
        "How difficult has it been for you to make decisions, including relatively simple "
        "decisions in everyday life?"
    ),
    "To what extent have you felt worthless, inadequate, or less valuable as a person?",
    (
        "How much has your overall energy level decreased, making everyday activities more "
        "difficult to complete?"
    ),
    (
        "Have you experienced noticeable changes in your sleeping patterns, including sleeping less "
        "or more than usual?"
    ),
    (
        "How easily have you become irritated, frustrated, or emotionally upset by situations that "
        "normally would not bother you?"
    ),
    (
        "Have you experienced significant changes in your appetite, including eating less or more "
        "than your usual amount?"
    ),
    (
        "How difficult has it been for you to maintain concentration, focus on tasks, or follow "
        "conversations?"
    ),
    (
        "How frequently have you felt physically or mentally exhausted, even when you have not "
        "engaged in particularly demanding activities?"
    ),
    (
        "To what extent has your interest in sexual activity or intimacy decreased compared with "
        "your usual level?"
    ),
    (
        "How frequently have you experienced restlessness, difficulty remaining still, or an "
        "increased need to move around?"
    ),
]
# Q4 asks about enjoyment, so more enjoyment must score lower: its answers run the other way.
BDI_Q4_OPTIONS = ["As much as usual", "A little less", "Much less", "None at all"]
BDI_QUESTIONS = [
    _question(f"q{i}", text, BDI_Q4_OPTIONS if i == 4 else INTENSITY_OPTIONS)
    for i, text in enumerate(BDI_WORDING, 1)
]

# Sheet2's "Suggested action", rewritten for the patient. Supportive, never a label.
NEXT_STEPS = {
    "low": (
        "Keep going with small daily steps. Your check-ins help you notice how you are doing, "
        "and a calming activity is a good next step."
    ),
    "mild": (
        "Keep going with small daily steps, and keep an eye on how you feel. A calming activity "
        "is a good next step."
    ),
    "moderate": (
        "It could really help to talk this through with a qualified professional. If you have a "
        "doctor connected, you can ask them to check in with you."
    ),
    "high": (
        "Please arrange to talk with a mental health professional soon. You can ask your care "
        "team to check in now; you do not have to wait for things to get harder."
    ),
}

PHQ9_BANDS = [
    {
        "min": 0,
        "max": 9,
        "level": "low",
        "label": "Minimal to mild depressive symptoms",
        "action": "General emotional well-being support and routine monitoring",
        "interpretation": "The respondent reports minimal or mild depressive symptoms. There may "
        "be occasional emotional difficulties, but the questionnaire score alone does not "
        "indicate a high symptom burden.",
    },
    {
        "min": 10,
        "max": 14,
        "level": "moderate",
        "label": "Moderate depressive symptoms",
        "action": "Recommend further assessment by a qualified therapist or mental health "
        "professional",
        "interpretation": "The respondent reports a noticeable level of depressive symptoms that "
        "may affect daily activities, emotional well-being, or social functioning. A "
        "professional assessment is recommended to better understand the symptoms and "
        "determine appropriate support.",
    },
    {
        "min": 15,
        "max": 27,
        "level": "high",
        "label": "Moderately severe to severe depressive symptoms",
        "action": "Prioritize professional mental health assessment",
        "interpretation": "The respondent reports a relatively high level of depressive "
        "symptoms. These symptoms may significantly interfere with daily functioning and quality "
        "of life. A timely assessment by a qualified mental health professional is recommended.",
    },
]
BDI_BANDS = [
    {
        "min": 0,
        "max": 13,
        "level": "low",
        "label": "Minimal",
        "action": None,
        "interpretation": "Minimal or no significant depressive symptoms reported",
    },
    {
        "min": 14,
        "max": 19,
        "level": "mild",
        "label": "Mild",
        "action": None,
        "interpretation": "Mild depressive symptoms are reported",
    },
    {
        "min": 20,
        "max": 28,
        "level": "moderate",
        "label": "Moderate",
        "action": None,
        "interpretation": "Noticeable depressive symptoms that may affect daily functioning",
    },
    {
        "min": 29,
        "max": 63,
        "level": "high",
        "label": "Severe",
        "action": None,
        "interpretation": "Substantial depressive symptoms that may significantly interfere "
        "with daily functioning",
    },
]
BDI_DOMAINS = [
    ("Emotional state", "Emotional distress, guilt and loss of pleasure", [1, 4, 5, 6, 10]),
    ("Self-perception", "Self-worth, self-criticism and negative self-perception", [3, 7, 8, 13]),
    ("Future outlook", "Pessimism and hopelessness", [2]),
    ("Social engagement", "Reduced interest in social activities and intimacy", [11, 20]),
    ("Cognitive functioning", "Decision-making and concentration difficulties", [12, 18]),
    ("Energy and physical state", "Energy, sleep, appetite and fatigue", [14, 15, 17, 19]),
    ("Behavioral state", "Irritability and agitation", [16, 21]),
    ("Safety", "Thoughts related to death or suicide", [9]),
]

DEFINITIONS = {
    PHQ9_ID: {
        "instrument": "phq9",
        "title": "PHQ-9 · Patient Health Questionnaire-9",
        "clinical_instrument": True,
        "instructions": "Over the last 2 weeks, how often have you been bothered by any of the "
        "following problems?",
        "estimated_minutes": 3,
        "validated": True,
        "note": "PHQ-9 is a validated screening questionnaire. A score supports, but does not "
        "replace, a clinical assessment.",
        "questions": PHQ9_QUESTIONS,
        "bands": PHQ9_BANDS,
        "max_total": 27,
    },
    BDI_ID: {
        "instrument": "bdi_themes",
        "title": "Extended depression questions (BDI-II themes)",
        "clinical_instrument": True,
        "instructions": "Thinking about the past two weeks, choose the answer that fits best.",
        "estimated_minutes": 8,
        "validated": False,
        "note": "These 21 questions are reworded from BDI-II themes; they are not the licensed "
        "BDI-II and have not been validated. Severity bands follow BDI-II cut-offs and are "
        "indicative only.",
        "questions": BDI_QUESTIONS,
        "bands": BDI_BANDS,
        "max_total": 63,
    },
}


async def seed(store: RecordStore) -> None:
    for assessment_id, d in DEFINITIONS.items():
        if not await store.get("assessment_definitions", id=assessment_id, version=VERSION):
            await store.add(
                "assessment_definitions",
                id=assessment_id,
                version=VERSION,
                title=d["title"],
                clinical_instrument=d["clinical_instrument"],
                questions=d["questions"],
            )


def definition_view(assessment_id: str, version: int) -> dict:
    d = DEFINITIONS[assessment_id]
    return {
        "assessment_id": assessment_id,
        "version": version,
        "title": d["title"],
        "clinical_instrument": d["clinical_instrument"],
        "instructions": d["instructions"],
        "estimated_minutes": d["estimated_minutes"],
        "validated": d["validated"],
        "note": d["note"],
        "citations": CITATIONS,
        "questions": d["questions"],
    }


def score(assessment_id: str, answers: list[dict]) -> dict | None:
    """Deterministic result for a complete answer set, or None for an unknown definition."""
    d = DEFINITIONS.get(assessment_id)
    if not d:
        return None
    values = {a["question_id"]: a["value"] for a in answers}
    scored = [q["question_id"] for q in d["questions"] if q["scored"]]
    total = sum(values.get(q, 0) for q in scored)
    band = next(b for b in d["bands"] if b["min"] <= total <= b["max"])
    safety = {"item_positive": values.get("q9", 0) > 0, "follow_up": None}
    domains = []
    if d["instrument"] == "bdi_themes":
        for name, description, items in BDI_DOMAINS:
            domains.append(
                {
                    "name": name,
                    "description": description,
                    "questions": [f"Q{i}" for i in items],
                    "score": sum(values.get(f"q{i}", 0) for i in items),
                    "max": 3 * len(items),
                }
            )
    impairment = values.get("q10") if d["instrument"] == "phq9" else None
    return {
        "instrument": d["instrument"],
        "total": total,
        "max_total": d["max_total"],
        "level": band["level"],
        "severity": band["label"],
        "suggested_action": band["action"],
        "patient_next_step": NEXT_STEPS[band["level"]],
        "interpretation": band["interpretation"],
        "bands": [{k: b[k] for k in ["min", "max", "level", "label"]} for b in d["bands"]],
        "functional_impairment": None if impairment is None else DIFFICULTY_OPTIONS[impairment],
        "domains": domains,
        "safety": safety,
        "validated": d["validated"],
        "note": d["note"],
    }


def answer_details(assessment_id: str, answers: list[dict]) -> list[dict]:
    """Every answer with its full question and the option label the patient chose."""
    d = DEFINITIONS.get(assessment_id)
    if not d:
        return []
    questions = {q["question_id"]: q for q in d["questions"]}
    details = []
    for a in answers:
        q = questions.get(a["question_id"])
        if not q:
            continue
        label = next(o["label"] for o in q["options"] if o["value"] == a["value"])
        details.append(
            {
                "question_id": a["question_id"],
                "wording": q["wording"],
                "value": a["value"],
                "label": label,
                "scored": q["scored"],
            }
        )
    return details


def response_view(row: dict, title: str, shared: bool | None = None) -> dict:
    view = {
        "assessment_response_id": row["id"],
        **{
            k: row[k]
            for k in [
                "assessment_id",
                "assessment_version",
                "source_id",
                "complete",
                "answers",
                "observed_at",
            ]
        },
        "title": title,
        "result": score(row["assessment_id"], row["answers"]),
        "answer_details": answer_details(row["assessment_id"], row["answers"]),
    }
    if shared is not None:
        view["shared_with_doctor"] = shared
    return view


class AssessmentService:
    def __init__(self, store: RecordStore):
        self.store = store

    async def list(self) -> dict:
        rows = await self.store.all("assessment_definitions")
        items = [
            definition_view(r["id"], r["version"])
            for r in rows
            if r["id"] in DEFINITIONS and r["version"] == VERSION
        ]
        items.sort(key=lambda d: list(DEFINITIONS).index(d["assessment_id"]))
        return {"items": items, "next_cursor": None}

    async def submit(self, patient: str, assessment_id: str, body: dict) -> dict:
        definition = await self.store.get(
            "assessment_definitions", id=assessment_id, version=body["assessment_version"]
        )
        if not definition or assessment_id not in DEFINITIONS:
            raise DomainError("RESOURCE_NOT_FOUND", 404)
        if utc(body["observed_at"]) > now() + timedelta(minutes=5):
            raise DomainError("VALIDATION_ERROR", 422)
        if body["session_id"] is not None:
            await SessionService(self.store).owned(patient, body["session_id"])
        questions = {q["question_id"]: q for q in definition["questions"]}
        values: dict[str, int] = {}
        for answer in body["answers"]:
            q = questions.get(answer["question_id"])
            if not q or answer["question_id"] in values:
                raise DomainError("VALIDATION_ERROR", 422)
            if not q["minimum"] <= answer["value"] <= q["maximum"]:
                raise DomainError("VALIDATION_ERROR", 422)
            values[answer["question_id"]] = answer["value"]
        # Complete means every question that applies was answered, and nothing else.
        expected = {
            qid
            for qid, q in questions.items()
            if not q.get("follow_up_of") or values.get(q["follow_up_of"], 0) > 0
        }
        if set(values) != expected:
            raise DomainError("VALIDATION_ERROR", 422)
        at = stamp()
        source = uid()
        await self.store.add(
            "source_records",
            id=source,
            patient_id=patient,
            kind="assessment",
            session_id=body["session_id"],
            revision=1,
            occurred_at=body["observed_at"],
            unavailable_at=None,
            created_at=at,
        )
        ordered = [{"question_id": q, "value": values[q]} for q in questions if q in values]
        shared = False
        row = await self.store.add(
            "assessment_responses",
            id=uid(),
            patient_id=patient,
            session_id=body["session_id"],
            assessment_id=assessment_id,
            assessment_version=body["assessment_version"],
            source_id=source,
            answers=ordered,
            complete=True,
            observed_at=body["observed_at"],
            created_at=at,
        )
        if values.get("q9", 0) > 0 and body.get("share_if_safety_concern"):
            # Agreed up front: a positive Q9 sends every answer to the connected doctor(s).
            from .wellbeing import AlertService

            shared = await AlertService(self.store).share_questionnaire(
                patient, source, body["session_id"]
            )
        return response_view(row, definition["title"], shared)

    async def shared(self, patient: str, source_id: str) -> bool:
        from .wellbeing import SAFETY_RULE

        return any(
            source_id in a["source_ids"]
            for a in await self.store.all("alerts", patient_id=patient, rule_key=SAFETY_RULE)
        )

    async def doctor_alert_assessment(self, clinician: str, patient: str, alert_id: str) -> dict:
        """The questionnaire a patient's positive Q9 sent to this doctor."""
        from .care import CareService
        from .wellbeing import SAFETY_RULE, AlertService

        _, rows = await AlertService(self.store).visible(clinician, patient)
        alert = next((r for r in rows if r["id"] == alert_id), None)
        if not alert or alert["rule_key"] != SAFETY_RULE:
            raise DomainError("RESOURCE_NOT_FOUND", 404)
        for row in await self.store.all("assessment_responses", patient_id=patient):
            if row["source_id"] in alert["source_ids"]:
                definition = await self.store.get(
                    "assessment_definitions",
                    id=row["assessment_id"],
                    version=row["assessment_version"],
                )
                await CareService(self.store).audit(
                    clinician, patient, "shared_questionnaire_read", "assessment", row["id"]
                )
                return response_view(row, definition["title"], True)
        raise DomainError("RESOURCE_NOT_FOUND", 404)

    async def owned(self, patient: str, response_id: str) -> dict:
        row = await self.store.get("assessment_responses", id=response_id, patient_id=patient)
        if not row:
            raise DomainError("RESOURCE_NOT_FOUND", 404)
        definition = await self.store.get(
            "assessment_definitions", id=row["assessment_id"], version=row["assessment_version"]
        )
        return response_view(row, definition["title"], await self.shared(patient, row["source_id"]))
