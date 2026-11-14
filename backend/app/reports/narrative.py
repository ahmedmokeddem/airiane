"""Provider-independent narrative port with a deterministic, reviewable implementation only."""

from collections import Counter, defaultdict
from typing import Protocol
from zoneinfo import ZoneInfo

from ..domain import DomainError
from ..services import utc
from .evidence import digest

SECTIONS = [
    ("overview", "Your journey at a glance", "Executive overview"),
    ("experiences", "What you shared", "Patient-confirmed experiences"),
    ("themes", "Recurring confirmed themes", "Confirmed recurring themes"),
    ("changes", "Changes worth noticing", "Longitudinal observations"),
    ("activities", "Activities and your feedback", "Activity engagement and explicit feedback"),
    ("reflections", "Reflections and goals", "Patient reflections and goals"),
    ("topics", "Questions for your clinician", "Patient-selected discussion topics"),
    ("assessments", "Questionnaire records", "Assessment availability"),
    ("limitations", "Coverage and what remains unknown", "Methodology and limitations"),
]
LIMITATIONS = [
    "Missing records are not evidence that an experience or symptom was absent.",
    "Frequency describes saved reports, not symptom frequency, severity or improvement.",
    "Feedback describes the patient's experience; participation and ratings do not establish recovery or a treatment effect.",
    "Only patient-confirmed structured notes are used. No raw conversation history or recording is included.",
    "Questionnaire records do not identify a validated clinical scoring method; no clinical score or diagnosis is generated.",
    "This is a supplementary patient-shared wellbeing record, not a medical evaluation or proof of clinician review or monitoring.",
]


def quantity(count: int, noun: str, plural: str | None = None) -> str:
    return f"{count} {noun if count == 1 else plural or noun + 's'}"


class ReportNarrativeGenerator(Protocol):
    """Future implementations receive this snapshot and must pass the same evidence validator."""

    version: str

    def generate(self, snapshot: dict) -> list[dict]: ...


class DeterministicNarrativeGenerator:
    version = "deterministic-v3.1"

    def generate(self, snapshot: dict) -> list[dict]:
        rows = snapshot["evidence"]
        current = [r for r in rows if r["phase"] == "current"]
        prior = [r for r in rows if r["phase"] == "previous"]
        stats = snapshot["aggregates"]["current"]
        claims = []

        def claim(section, key, patient, clinician, evidence=()):
            ids = sorted({r["id"] for r in evidence})
            claims.append(
                {
                    "id": section + "-" + key,
                    "section": section,
                    "patient_text": patient,
                    "clinician_text": clinician,
                    "evidence_ids": ids,
                }
            )

        counts = stats["counts"]
        notes = [r for r in current if r["kind"] == "insight"]
        activities = [r for r in current if r["kind"] == "activity"]
        feedback = [r for r in current if r["kind"] == "feedback"]
        active = stats["active_days"]
        claim(
            "overview",
            "coverage",
            f"You saved {quantity(len(notes), 'confirmed note')}, {quantity(len(activities), 'completed activity', 'completed activities')} and {quantity(len(feedback), 'rating')}, plus {quantity(counts.get('observation', 0), 'confirmed check-in value')} across {quantity(active, 'recorded day')}. This is a view of the moments you chose to keep, not a grade.",
            f"The period contains {quantity(len(notes), 'patient-confirmed note')}, {quantity(len(activities), 'activity completion')} and {quantity(len(feedback), 'explicit rating')}, plus {quantity(counts.get('observation', 0), 'confirmed check-in value')} across {quantity(active, 'recorded day')}. Coverage is opportunistic, not scheduled.",
            current,
        )
        for kind in ["mood", "energy", "sleep_hours"]:
            values = [r for r in current if r["kind"] == "observation" and r["category"] == kind]
            if values:
                avg = round(sum(r["value"] for r in values) / len(values), 2)
                unit = "hours" if kind == "sleep_hours" else "on the self-reported 0–10 scale"
                claim(
                    "experiences",
                    "value-" + kind,
                    f"Your recorded {kind.replace('_', ' ')} sample contains {quantity(len(values), 'confirmed value')}; its mean is {avg} {unit}. This describes this recorded sample only; unrecorded days remain unknown.",
                    f"{kind.replace('_', ' ').capitalize()}: mean {avg} {unit}, n={len(values)} confirmed values. This is a descriptive sample statistic, not a validated clinical score.",
                    values,
                )
        if not notes:
            claim(
                "experiences",
                "missing",
                "There are no confirmed conversation notes in this period. Your conversations have not been treated as a permanent record; no themes or feelings have been inferred.",
                "No confirmed conversational observations are available for the period. Themes, emotions and absence of symptoms cannot be inferred from activity records.",
            )
        groups = defaultdict(list)
        for r in notes:
            groups[r["category"]].append(r)
        for theme, items in sorted(groups.items()):
            days = len(
                {utc(r["date"]).astimezone(ZoneInfo(snapshot["timezone"])).date() for r in items}
            )
            label = theme.replace("_", " ")
            if len(items) > 1:
                claim(
                    "themes",
                    theme,
                    f"You chose to keep {len(items)} notes about {label} on {days} recorded days. Their recurrence reflects what you recorded; it does not measure how often you experienced it.",
                    f"{label.capitalize()} appears in {len(items)} confirmed notes across {days} recorded days. These are reporting counts, not symptom rates.",
                    items,
                )
            else:
                claim(
                    "themes",
                    theme,
                    f"One note concerns {label}. A single note is worth keeping, but does not establish a recurring pattern.",
                    f"One confirmed note is categorized as {label}; recurrence is not established.",
                    items,
                )
            for r in items:
                section = (
                    "topics"
                    if theme == "clinician_question"
                    else "reflections"
                    if theme in ["goal", "reflection"]
                    else "experiences"
                )
                origin = (
                    "your direct self-report"
                    if r["origin"] == "direct_statement"
                    else "an interpretation you explicitly approved"
                )
                claim(
                    section,
                    r["id"],
                    f"You confirmed: “{r['text']}” This is {origin}.",
                    f"Patient-confirmed {'direct statement' if r['origin'] == 'direct_statement' else 'interpretation'}: “{r['text']}”",
                    [r],
                )
        if not groups:
            claim(
                "themes",
                "missing",
                "There is not yet enough confirmed conversation material to describe recurring themes.",
                "Recurring conversational themes are unavailable without confirmed observations.",
            )
        if not any(r["category"] in ["goal", "reflection"] for r in notes):
            claim(
                "reflections",
                "missing",
                "No personal reflection or goal was explicitly saved in this period. We have not supplied one on your behalf.",
                "No patient-selected reflection or goal is recorded.",
            )
        if not any(r["category"] == "clinician_question" for r in notes):
            claim(
                "topics",
                "missing",
                "No discussion question was saved. If you choose, you can bring a confirmed note or an activity experience to your next conversation with your clinician.",
                "No patient-selected clinician question is recorded. No automated medical advice or follow-up instruction is generated.",
            )
        # Equal time windows, with enough observations on multiple recorded days. Never symptom deltas.
        zone = ZoneInfo(snapshot["timezone"])
        old_notes = [r for r in prior if r["kind"] == "insight"]
        enough = lambda rr: (
            len(rr) >= 3 and len({utc(r["date"]).astimezone(zone).date() for r in rr}) >= 2
        )
        if snapshot["previous_start"] and enough(notes) and enough(old_notes):
            old_counts = Counter(r["category"] for r in old_notes)
            for theme in sorted(set(groups) | set(old_counts)):
                new = groups.get(theme, [])
                old = [r for r in old_notes if r["category"] == theme]
                claim(
                    "changes",
                    theme,
                    f"You saved {len(new)} {theme.replace('_', ' ')} notes this period and {len(old)} in the preceding equal-length period. The difference concerns reporting, not a measured change in your wellbeing.",
                    f"Confirmed {theme.replace('_', ' ')} reporting counts: current {len(new)}, preceding equal-length period {len(old)}. Coverage differs and there is no symptom-frequency denominator; no clinical change is inferred.",
                    new + old,
                )
        else:
            claim(
                "changes",
                "insufficient",
                "An equal-period comparison is not supported by enough confirmed notes on multiple days in both periods. Missing information remains missing.",
                "Insufficient comparable observations: each equal-length period needs at least three confirmed notes across two dates. No symptom or treatment-change conclusion is produced.",
            )
        kinds = defaultdict(list)
        for r in activities:
            kinds[r["category"]].append(r)
        if not activities:
            claim(
                "activities",
                "missing",
                "No completed activities were saved this period. This does not describe what you did outside the app.",
                "No app activity completions are available; activity outside the application is unknown.",
            )
        for kind, items in sorted(kinds.items()):
            ratings = [r for r in feedback if r["category"] == kind]
            positive = [r for r in ratings if r["value"] >= 4]
            title = kind.replace("_", " ")
            claim(
                "activities",
                kind,
                f"You completed {quantity(len(items), title + ' activity', title + ' activities')}. You rated {len(ratings)} of them; {len(positive)} ratings were 4 or 5 out of 5. These ratings describe what seemed helpful to you, without showing what caused a change.",
                f"{quantity(len(items), title + ' completion')}; {quantity(len(ratings), 'explicit helpfulness rating')}, including {len(positive)} at 4–5/5. No causal or treatment inference is warranted.",
                items + ratings,
            )
            if len(ratings) >= 2:
                average = round(sum(r["value"] for r in ratings) / len(ratings), 2)
                claim(
                    "activities",
                    kind + "-preference",
                    f"Your average helpfulness rating for {title} was {average}/5 across {len(ratings)} ratings. This is a reported experience, not a permanent preference or recommendation.",
                    f"Mean explicit {title} helpfulness rating {average}/5, n={len(ratings)}. It does not establish a stable preference or clinical benefit.",
                    ratings,
                )
        for r in feedback:
            if r["text"]:
                claim(
                    "activities",
                    "comment-" + r["id"],
                    f"After {r['label']}, you wrote: “{r['text']}”",
                    f"Explicit feedback for {r['label']}: “{r['text']}”",
                    [r],
                )
        questionnaires = [r for r in current if r["kind"] == "questionnaire"]
        if not questionnaires:
            claim(
                "assessments",
                "missing",
                "No completed questionnaire records are available. No score or screening result has been inferred.",
                "No completed assessment records are available. Validated instrument results are unavailable.",
            )
        for r in questionnaires:
            claim(
                "assessments",
                r["id"],
                f"{r['label']}: {r['value']} recorded answers. This record has no validated scoring method in the available schema.",
                f"{r['label']}: {r['value']} stored answers; validated clinical score not available.",
                [r],
            )
        for i, text in enumerate(LIMITATIONS):
            claim("limitations", str(i), text, text)
        claim(
            "limitations",
            "method",
            "Dates use your saved timezone. Only traceable, confirmed records available at the snapshot cutoff contribute to findings. Later corrections or withdrawals require a new report.",
            "Dates use the stored patient timezone. Aggregation uses traceable accepted records at cutoff. Evidence withdrawal invalidates export; downloaded copies remain independent.",
        )
        return claims


def build_charts(snapshot: dict) -> list[dict]:
    current = [r for r in snapshot["evidence"] if r["phase"] == "current"]
    charts = []
    for kind in ["mood", "energy", "sleep_hours"]:
        rows = [r for r in current if r["kind"] == "observation" and r["category"] == kind]
        if (
            len(rows) >= 3
            and len(
                {utc(r["date"]).astimezone(ZoneInfo(snapshot["timezone"])).date() for r in rows}
            )
            >= 2
        ):
            charts.append(
                {
                    "id": "values-" + kind,
                    "title": kind.replace("_", " ").capitalize(),
                    "unit": "hours" if kind == "sleep_hours" else "self-reported 0–10",
                    "caption": f"{len(rows)} confirmed values. Latest 16 entries shown; spacing is by entry, not elapsed time. No missing dates are interpolated.",
                    "points": [
                        {
                            "label": utc(r["date"])
                            .astimezone(ZoneInfo(snapshot["timezone"]))
                            .date()
                            .isoformat(),
                            "value": r["value"],
                            "evidence_ids": [r["id"]],
                        }
                        for r in rows[-16:]
                    ],
                }
            )
    notes = [r for r in current if r["kind"] == "insight"]
    if (
        len(notes) >= 3
        and len({utc(r["date"]).astimezone(ZoneInfo(snapshot["timezone"])).date() for r in notes})
        >= 2
    ):
        groups = defaultdict(list)
        for r in notes:
            groups[r["category"]].append(r)
        charts.append(
            {
                "id": "themes",
                "title": "Themes you chose to record",
                "unit": "confirmed notes",
                "caption": "Counts of patient-confirmed summaries, not symptom frequency or severity.",
                "points": [
                    {
                        "label": k.replace("_", " "),
                        "value": len(v),
                        "evidence_ids": [r["id"] for r in v],
                    }
                    for k, v in sorted(groups.items())
                ],
            }
        )
    return charts


def validate_narrative(snapshot: dict, claims: list[dict], charts: list[dict]) -> None:
    # Valid source IDs alone never establish truth. Every accepted sentence/chart must match
    # a deterministic fact/quote catalogue computed independently from the snapshot.
    expected = DeterministicNarrativeGenerator().generate(snapshot)
    by_id = {c["id"]: c for c in expected}
    if len(claims) != len(expected) or len({c.get("id") for c in claims}) != len(claims):
        raise DomainError("UNSUPPORTED_REPORT_NARRATIVE", 422)
    if any(c != by_id.get(c.get("id")) for c in claims) or charts != build_charts(snapshot):
        raise DomainError("UNSUPPORTED_REPORT_NARRATIVE", 422)


def document(
    snapshot: dict, generator: ReportNarrativeGenerator | None = None, regeneration_of=None
) -> dict:
    generator = generator or DeterministicNarrativeGenerator()
    claims = generator.generate(snapshot)
    charts = build_charts(snapshot)
    validate_narrative(snapshot, claims, charts)
    result = {
        "schema_version": "1.0.0",
        "report_type": "dual_perspective_wellbeing",
        "generator_version": generator.version,
        "template_version": "editorial-v1",
        "evidence_snapshot_version": 1,
        "evidence_snapshot_id": digest(snapshot),
        "snapshot": snapshot,
        "claims": claims,
        "charts": charts,
        "sections": [{"id": k, "patient_title": p, "clinician_title": c} for k, p, c in SECTIONS],
        "regeneration_of": regeneration_of,
    }
    result["content_hash"] = digest(result)
    return result


def validate_document(doc: dict):
    if doc.get("generator_version") != DeterministicNarrativeGenerator.version:
        raise DomainError("REPORT_REGENERATION_REQUIRED", 409)
    value = {k: v for k, v in doc.items() if k != "content_hash"}
    if (
        digest(value) != doc["content_hash"]
        or digest(doc["snapshot"]) != doc["evidence_snapshot_id"]
    ):
        raise DomainError("REPORT_INVALIDATED", 409)
    validate_narrative(doc["snapshot"], doc["claims"], doc["charts"])
