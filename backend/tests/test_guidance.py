from datetime import timedelta
from uuid import uuid4

from test_reports import complete, report_client, sharing  # noqa: F401
from test_slice import client, headers, start  # noqa: F401
from test_wellbeing import DOCTOR, confirm, observe

from app import guidance
from app.contracts import validate
from app.domain import now, stamp


def test_guided_question_follows_todays_confirmed_checkin(client):  # noqa: F811
    sid = start(client)
    path = f"/v1/conversation-sessions/{sid}/guided-question"
    first = client.get(path, headers=headers()).json()
    validate("GuidedQuestion", first)
    assert first["question_id"] == "mood"
    assert first["missing_fields"] == ["mood", "energy", "sleep_hours"]
    # A proposal alone does not count; only the patient's confirmation does.
    mood = observe(client, "mood", 6)
    assert client.get(path, headers=headers()).json()["question_id"] == "mood"
    confirm(client, mood)
    assert client.get(path, headers=headers()).json()["question_id"] == "energy"
    confirm(client, observe(client, "energy", 5))
    confirm(client, observe(client, "sleep_hours", 7))
    done = client.get(path, headers=headers()).json()
    validate("GuidedQuestion", done)
    assert done["question_id"] is None and done["wording"] is None
    assert done["missing_fields"] == []
    context = client.get("/v1/patient-context", headers=headers())
    assert context.status_code == 200, context.text
    validate("PatientContext", context.json())
    assert len(context.json()["recent_observations"]) == 3


def recommend(c, sid, **extra):
    r = c.post(
        "/v1/activity-recommendations",
        json={"session_id": sid, "limit": 3, **extra},
        headers=headers(),
    )
    assert r.status_code == 201, r.text
    validate("Recommendation", r.json())
    return r.json()["options"]


def test_suggestions_adapt_to_confirmed_checkin_with_reasons(client):  # noqa: F811
    sid = start(client)
    titles = {a["title"] for a in client.get("/v1/activities", headers=headers()).json()["items"]}
    assert {"Go for a 5-Minute Walk", "Pour a Glass of Water", "Send One Short Message"} <= titles
    # No check-in: calm default order.
    assert recommend(client, sid)[0]["activity"]["activity_id"] == guidance.BREATHING
    # A catalog choice by the patient is always offered first.
    chosen = recommend(client, sid, preferred_activity_id=guidance.TIDY)
    assert chosen[0]["activity"]["activity_id"] == guidance.TIDY
    # Low mood moves gentle activation forward and says why.
    confirm(client, observe(client, "mood", 3))
    low_mood = recommend(client, sid)
    assert low_mood[0]["activity"]["activity_id"] == guidance.WALK
    assert low_mood[0]["reason"].startswith("Since your mood is on the lower side today")
    # Low energy wins over low mood: the least demanding options come first.
    confirm(client, observe(client, "energy", 2))
    low_energy = recommend(client, sid)
    assert low_energy[0]["activity"]["activity_id"] == guidance.BREATHING
    assert "asks very little" in low_energy[0]["reason"]
    assert all(len(o["reason"]) <= 300 for o in low_energy)


def test_streak_counts_days_with_a_completed_activity(report_client):  # noqa: F811
    c = report_client
    start(c)
    empty = c.get("/v1/me/recovery-streak", headers=headers())
    assert empty.status_code == 200, empty.text
    validate("RecoveryStreak", empty.json())
    assert empty.json() == {"streak_days": 0, "active_today": False}
    complete(c)
    assert c.get("/v1/me/recovery-streak", headers=headers()).json() == {
        "streak_days": 1,
        "active_today": True,
    }
    # Yesterday + the day before keep a streak alive until today is done; a gap ends it.
    day = now() - timedelta(days=1)
    rows = [
        {"state": "completed", "ended_at": (day - timedelta(days=i)).isoformat()} for i in (0, 1)
    ]
    assert guidance.streak(rows, "UTC") == (2, False)
    old = [{"state": "completed", "ended_at": (now() - timedelta(days=3)).isoformat()}]
    assert guidance.streak(old, "UTC") == (0, False)


def grant(c, link, scope):
    r = c.post(
        "/v1/consents",
        json={
            "scope": scope,
            "care_link_id": link,
            "expires_at": (now() + timedelta(days=7)).isoformat(),
            "data_from": None,
        },
        headers=headers(),
    )
    assert r.status_code == 201, r.text
    return r.json()["consent_grant_id"]


def doctor_patient(c):
    listed = c.get("/v1/doctor/patients", headers=headers(DOCTOR))
    assert listed.status_code == 200, listed.text
    validate("DoctorPatientPage", listed.json())
    return listed.json()["items"][0]


def test_doctor_attention_and_streak_use_only_shared_data(report_client):  # noqa: F811
    c = report_client
    complete(c)
    confirm(c, observe(c, "mood", 2))
    confirm(c, observe(c, "sleep_hours", 4))
    link, reports_grant = sharing(c)
    shared = doctor_patient(c)
    assert shared["streak_days"] == 1
    assert shared["attention"]["flagged"]
    assert shared["attention"]["reasons"] == [
        "Low mood reported (2/10)",
        "Short sleep reported (4 h)",
    ]
    # With only check-in-request sharing, check-in values and streak are not exposed.
    alerts_grant = grant(c, link, "alerts")
    c.delete("/v1/consents/" + reports_grant, headers=headers())
    limited = doctor_patient(c)
    assert "streak_days" not in limited
    assert limited["attention"] == {"flagged": False, "reasons": []}
    c.post(
        "/v1/review-requests",
        json={"session_id": None, "reason": "patient_requested_review"},
        headers=headers(),
    )
    assert doctor_patient(c)["attention"]["reasons"] == ["Patient asked for a check-in"]
    c.delete("/v1/consents/" + alerts_grant, headers=headers())
    assert c.get("/v1/doctor/patients", headers=headers(DOCTOR)).json()["items"] == []


def test_attention_rules_are_quiet_for_steady_patients():
    at = stamp()
    steady = [
        {"kind": "mood", "value": 7, "observed_at": at},
        {"kind": "energy", "value": 6, "observed_at": at},
        {"kind": "sleep_hours", "value": 7.5, "observed_at": at},
    ]
    assert guidance.attention(steady, False) == {"flagged": False, "reasons": []}
    assert guidance.attention(None, False) == {"flagged": False, "reasons": []}
    lapsed = [{"kind": "mood", "value": 7, "observed_at": (now() - timedelta(days=9)).isoformat()}]
    assert guidance.attention(lapsed, False)["reasons"] == ["No check-in for 9 days"]


def test_medication_reminder_needs_an_active_connection(report_client):  # noqa: F811
    c = report_client
    start(c)
    pid = c.get("/v1/me", headers=headers()).json()["user_id"]
    path = f"/v1/doctor/patients/{pid}/medication-reminder"
    body = {"message": "Take your morning medication", "schedule_time": "09:00", "active": True}
    assert c.get("/v1/me/medication-reminder", headers=headers()).json() == {"reminder": None}
    # No connection: the doctor cannot set anything; patients cannot set one for themselves.
    assert c.post(path, json=body, headers=headers(DOCTOR)).status_code == 404
    assert c.post(path, json=body, headers=headers()).status_code == 403
    link, _ = sharing(c)
    key = str(uuid4())
    saved = c.post(path, json=body, headers=headers(DOCTOR, key))
    assert saved.status_code == 200, saved.text
    validate("MedicationReminder", saved.json())
    assert c.post(path, json=body, headers=headers(DOCTOR, key)).json() == saved.json()
    mine = c.get("/v1/me/medication-reminder", headers=headers()).json()
    validate("MedicationReminderResponse", mine)
    assert mine["reminder"]["message"] == "Take your morning medication"
    assert mine["reminder"]["schedule_time"] == "09:00"
    # Ending the connection hides the reminder from the patient's Home.
    c.patch("/v1/care-links/" + link, json={"action": "revoke"}, headers=headers())
    assert c.get("/v1/me/medication-reminder", headers=headers()).json() == {"reminder": None}
