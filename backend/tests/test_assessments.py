from datetime import timedelta
from uuid import uuid4

import pytest
from test_guidance import doctor_patient
from test_reports import report, report_client, sharing  # noqa: F401
from test_slice import client, headers, start  # noqa: F401
from test_wellbeing import DOCTOR, confirm, observe

from app.assessments import BDI_DOMAINS, BDI_ID, PHQ9_ID, VERSION, score
from app.contracts import validate
from app.domain import now, stamp


def answers(values: dict) -> list[dict]:
    return [{"question_id": q, "value": v} for q, v in values.items()]


# The example answers marked "x" in assets/Book1.ods, Sheet1 (Q4 and Q5 left blank -> 0).
SHEET_EXAMPLE = {
    "q1": 2,
    "q2": 3,
    "q3": 2,
    "q4": 0,
    "q5": 0,
    "q6": 1,
    "q7": 1,
    "q8": 0,
    "q9": 1,
    "q10": 1,  # the sheet's "extra question", asked because Q9 > 0
}


def phq(total: int, q9: int = 0) -> dict:
    """Answers giving `total` across q1-q9; when Q9 > 0, Q10 = 3 proves it is not counted."""
    values, left = {}, total - q9
    for i in range(1, 9):
        values[f"q{i}"] = min(3, left)
        left -= values[f"q{i}"]
    values["q9"] = q9
    if q9:
        values["q10"] = 3
    return values


def submit(c, assessment_id, values, key=None, at=None, share=False):
    return c.post(
        f"/v1/assessments/{assessment_id}/responses",
        json={
            "session_id": None,
            "assessment_version": VERSION,
            "answers": answers(values),
            "observed_at": at or stamp(),
            "share_if_safety_concern": share,
        },
        headers=headers(key=key),
    )


def test_definitions_match_the_spreadsheet(client):  # noqa: F811
    start(client)
    listed = client.get("/v1/assessments", headers=headers())
    assert listed.status_code == 200, listed.text
    validate("AssessmentDefinitionPage", listed.json())
    phq9, extended = listed.json()["items"]
    assert phq9["assessment_id"] == PHQ9_ID and extended["assessment_id"] == BDI_ID
    assert [q["question_id"] for q in phq9["questions"]] == [f"q{i}" for i in range(1, 11)]
    assert [o["label"] for o in phq9["questions"][0]["options"]] == [
        "Not at all",
        "Several days",
        "More than half the days",
        "Nearly every day",
    ]
    q10 = phq9["questions"][9]
    assert (q10["follow_up_of"], q10["scored"]) == ("q9", False)
    assert q10["options"][0]["label"] == "Not difficult at all"
    assert len([q for q in extended["questions"] if q["scored"]]) == 21
    assert extended["validated"] is False and "not the licensed BDI-II" in extended["note"]
    assert len(phq9["citations"]) == 4


@pytest.mark.parametrize(
    ("total", "severity", "level"),
    [
        (0, "Minimal to mild depressive symptoms", "low"),
        (9, "Minimal to mild depressive symptoms", "low"),
        (10, "Moderate depressive symptoms", "moderate"),
        (14, "Moderate depressive symptoms", "moderate"),
        (15, "Moderately severe to severe depressive symptoms", "high"),
        (27, "Moderately severe to severe depressive symptoms", "high"),
    ],
)
def test_phq9_bands_actions_and_interpretation(total, severity, level):
    result = score(PHQ9_ID, answers(phq(total, q9=min(3, total))))
    assert result["total"] == total  # q10 = 3 is never added
    assert (result["severity"], result["level"]) == (severity, level)
    assert result["suggested_action"] and result["interpretation"]
    assert result["functional_impairment"] == (None if total == 0 else "Extremely difficult")


@pytest.mark.parametrize(
    ("total", "severity"),
    [(0, "Minimal"), (13, "Minimal"), (14, "Mild"), (19, "Mild"), (20, "Moderate")]
    + [(28, "Moderate"), (29, "Severe"), (63, "Severe")],
)
def test_extended_bands_and_symptom_groups(total, severity):
    values, left = {}, total
    for i in range(1, 22):
        values[f"q{i}"] = min(3, left)
        left -= values[f"q{i}"]
    result = score(BDI_ID, answers(values))
    assert (result["total"], result["severity"]) == (total, severity)
    assert result["validated"] is False
    groups = {d["name"]: d for d in result["domains"]}
    assert len(groups) == len(BDI_DOMAINS) == 8
    assert sum(d["score"] for d in groups.values()) == total
    assert sorted(q for d in groups.values() for q in d["questions"]) == sorted(
        f"Q{i}" for i in range(1, 22)
    )
    assert groups["Safety"]["questions"] == ["Q9"]
    assert result["safety"]["item_positive"] == (values["q9"] > 0)


def test_sheet_example_is_scored_and_reported_to_the_doctor(report_client):  # noqa: F811
    c = report_client
    start(c)
    key = str(uuid4())
    at = stamp()
    saved = submit(c, PHQ9_ID, SHEET_EXAMPLE, key, at)
    assert saved.status_code == 201, saved.text
    validate("AssessmentResponse", saved.json())
    result = saved.json()["result"]
    assert result["total"] == 10
    assert result["severity"] == "Moderate depressive symptoms"
    assert result["suggested_action"].startswith("Recommend further assessment")
    assert result["safety"] == {"item_positive": True, "follow_up": None}
    assert saved.json()["shared_with_doctor"] is False  # no connected doctor yet
    assert saved.json()["answer_details"][8]["label"] == "Several days"
    assert result["functional_impairment"] == "Somewhat difficult"
    assert submit(c, PHQ9_ID, SHEET_EXAMPLE, key, at).json() == saved.json()

    _, payload = report(c)
    assert payload["assessments"][0]["result"]["total"] == 10
    claims = payload["document"]["claims"]
    clinician = next(x for x in claims if x["section"] == "assessments")["clinician_text"]
    patient = next(x for x in claims if x["section"] == "assessments")["patient_text"]
    assert "total 10/27 — Moderate depressive symptoms" in clinician
    assert "Item 9" in clinician and "not a diagnosis" in clinician
    assert "Functional difficulty (Q10): Somewhat difficult" in clinician
    assert "10 out of 27" in patient and "Moderate" not in patient

    sharing(c)
    flagged = doctor_patient(c)["attention"]
    assert flagged["flagged"]
    assert flagged["reasons"][:2] == [
        "Self-harm question answered above 0 in a recent questionnaire",
        "PHQ-9 10/27: moderate depressive symptoms",
    ]


@pytest.mark.parametrize(
    "change",
    [
        {"drop": "q5"},  # unanswered question
        {"q9": 0},  # Q10 answered although Q9 was 0
        {"drop": "q10"},  # positive Q9 without the extra question
        {"set": {"q3": 4}},  # outside the answer options
        {"set": {"q99": 1}},  # unknown question
    ],
)
def test_incomplete_or_invalid_answers_are_rejected(client, change):  # noqa: F811
    start(client)
    values = dict(SHEET_EXAMPLE)
    if "q9" in change:
        values["q9"] = change["q9"]
    values.update(change.get("set", {}))
    values.pop(change.get("drop"), None)
    assert submit(client, PHQ9_ID, values).status_code == 422
    future = (now() + timedelta(hours=1)).isoformat()
    assert submit(client, PHQ9_ID, SHEET_EXAMPLE, at=future).status_code == 422
    assert submit(client, str(uuid4()), SHEET_EXAMPLE).status_code == 404


def test_check_in_update_replaces_todays_earlier_value(report_client):  # noqa: F811
    c = report_client
    start(c)
    first = confirm(c, observe(c, "mood", 4))
    second = confirm(c, observe(c, "mood", 7))
    assert second["supersedes_observation_id"] == first["observation_id"]
    listed = {
        o["observation_id"]: o for o in c.get("/v1/observations", headers=headers()).json()["items"]
    }
    assert listed[first["observation_id"]]["state"] == "superseded"
    assert listed[second["observation_id"]]["state"] == "confirmed"
    _, payload = report(c)
    mood = next(t for t in payload["trends"] if t["metric"] == "mood")
    assert (mood["count"], mood["mean"]) == (1, 7)


def test_positive_q9_sends_every_answer_to_the_connected_doctor(report_client):  # noqa: F811
    c = report_client
    start(c)
    pid = c.get("/v1/me", headers=headers()).json()["user_id"]
    link = c.post("/v1/care-links", json={"clinician_id": c.clinician_id}, headers=headers())
    c.patch(
        "/v1/care-links/" + link.json()["care_link_id"],
        json={"action": "accept"},
        headers=headers(DOCTOR),
    )
    # No report or alerts sharing granted: only the connection the patient agreed to.
    assert c.get("/v1/doctor/patients", headers=headers(DOCTOR)).json()["items"] == []
    calm = dict(SHEET_EXAMPLE, q9=0)
    calm.pop("q10")
    assert submit(c, PHQ9_ID, calm, share=True).json()["shared_with_doctor"] is False
    assert submit(c, PHQ9_ID, SHEET_EXAMPLE, share=False).json()["shared_with_doctor"] is False
    assert c.get("/v1/doctor/patients", headers=headers(DOCTOR)).json()["items"] == []

    sent = submit(c, PHQ9_ID, SHEET_EXAMPLE, share=True)
    assert sent.status_code == 201, sent.text
    assert sent.json()["shared_with_doctor"] is True
    patient = doctor_patient(c)
    assert patient["scopes"] == []
    assert patient["attention"]["reasons"][0] == (
        "Self-harm question answered above 0 · all answers sent to you"
    )
    listed = c.get(f"/v1/doctor/patients/{pid}/alerts", headers=headers(DOCTOR))
    assert listed.status_code == 200, listed.text
    alert = listed.json()["items"][0]
    assert alert["rule_key"] == "questionnaire_safety_item"
    shared = c.get(
        f"/v1/doctor/patients/{pid}/alerts/{alert['alert_id']}/assessment", headers=headers(DOCTOR)
    )
    assert shared.status_code == 200, shared.text
    validate("AssessmentResponse", shared.json())
    details = shared.json()["answer_details"]
    assert [d["question_id"] for d in details] == [f"q{i}" for i in range(1, 11)]
    assert details[1] == {
        "question_id": "q2",
        "wording": "Feeling down, depressed, or hopeless?",
        "value": 3,
        "label": "Nearly every day",
        "scored": True,
    }
    # The patient cannot use the doctor endpoint, and ending the connection stops access.
    path = f"/v1/doctor/patients/{pid}/alerts/{alert['alert_id']}/assessment"
    assert c.get(path, headers=headers()).status_code == 403
    c.patch(
        "/v1/care-links/" + link.json()["care_link_id"],
        json={"action": "revoke"},
        headers=headers(),
    )
    assert c.get(path, headers=headers(DOCTOR)).status_code == 403
