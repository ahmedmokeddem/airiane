"""Dispatch the existing report/care HTTP operations to application services."""

from uuid import uuid4

from . import guidance
from .assessments import AssessmentService, response_view
from .care import CareService
from .domain import DomainError, stamp
from .insights import InsightService
from .reporting import ReportService, authorization_start
from .services import utc
from .wellbeing import REVIEW_RULE, SAFETY_RULE, AlertService, ObservationService

SHARED_OPERATIONS = {
    "getMe",
    "listCareLinks",
    "updateCareLink",
    "listDoctorPatients",
    "listDoctorReports",
    "getDoctorReport",
    "listDoctorAlerts",
    "updateDoctorAlert",
    "getDoctorAlertAssessment",
    "setDoctorMedicationReminder",
}
OPERATIONS = {
    "confirmInsight": ("ConfirmedInsightCreate", "ConfirmedInsight", 201),
    "listConfirmedInsights": (None, "ConfirmedInsightPage", 200),
    "correctInsight": ("ConfirmedInsightCorrection", "ConfirmedInsight", 201),
    "deleteInsight": (None, None, 204),
    "requestReport": ("ReportRequest", "ReportReceipt", 202),
    "listReports": (None, "ReportReceiptPage", 200),
    "getReport": (None, "Report", 200),
    "inviteClinician": ("CareInviteRequest", "CareLink", 201),
    "listCareLinks": (None, "CareLinkPage", 200),
    "updateCareLink": ("CareLinkPatch", "CareLink", 200),
    "grantConsent": ("ConsentCreate", "ConsentGrant", 201),
    "listConsents": (None, "ConsentGrantPage", 200),
    "revokeConsent": (None, None, 204),
    "listDoctorPatients": (None, "DoctorPatientPage", 200),
    "listDoctorReports": (None, "ReportReceiptPage", 200),
    "getDoctorReport": (None, "Report", 200),
    "createObservation": ("ObservationCreate", "Observation", 201),
    "listObservations": (None, "ObservationPage", 200),
    "confirmObservation": ("ObservationConfirm", "Observation", 200),
    "requestReview": ("ReviewRequest", "Alert", 201),
    "listPatientAlerts": (None, "AlertPage", 200),
    "listDoctorAlerts": (None, "AlertPage", 200),
    "updateDoctorAlert": ("AlertPatch", "Alert", 200),
    "getDoctorAlertAssessment": (None, "AssessmentResponse", 200),
    "getMyMedicationReminder": (None, "MedicationReminderResponse", 200),
    "listAssessments": (None, "AssessmentDefinitionPage", 200),
    "submitAssessment": ("AssessmentSubmit", "AssessmentResponse", 201),
    "setDoctorMedicationReminder": ("MedicationReminderSet", "MedicationReminder", 200),
}


async def dispatch(op, store, actor, p, body, query, pages):
    care, reports = CareService(store), ReportService(store)
    observations, alerts = ObservationService(store), AlertService(store)
    scope = op + ":" + actor + ":" + p.get("patient_id", "")

    def page(rows, view=lambda r: r, key=lambda r: (r["created_at"], r["id"]), descending=True):
        return pages.build(rows, view, key, query, scope, descending)

    match op:
        case "confirmInsight":
            return await InsightService(store).confirm(actor, body)
        case "listConfirmedInsights":
            return page(
                await store.all("confirmed_insights", patient_id=actor, state="confirmed"),
                InsightService.view,
            )
        case "correctInsight":
            return await InsightService(store).correct(actor, p["insight_id"], body)
        case "deleteInsight":
            return await InsightService(store).delete(actor, p["insight_id"])
        case "requestReport":
            return await reports.create(actor, body)
        case "listReports":
            return page(await store.all("reports", patient_id=actor), reports.receipt)
        case "getReport":
            return await reports.read(actor, p["report_id"])
        case "inviteClinician":
            return await care.invite(actor, body)
        case "listCareLinks":
            user = await store.get("users", id=actor)
            if user["role"] == "clinician":
                await care.clinician(actor)
            return page(
                await store.all(
                    "care_links",
                    **(
                        {"patient_id": actor}
                        if user["role"] == "patient"
                        else {"clinician_id": actor}
                    ),
                ),
                care.link_view,
            )
        case "updateCareLink":
            return await care.update_link(actor, p["care_link_id"], body["action"])
        case "grantConsent":
            return await care.grant(actor, body)
        case "listConsents":
            return page(await store.all("consent_grants", patient_id=actor), care.consent_view)
        case "revokeConsent":
            return await care.revoke(actor, p["consent_grant_id"])
        case "listDoctorPatients":
            await care.clinician(actor)
            patients = []
            for link in await store.all("care_links", clinician_id=actor, state="active"):
                profile = await store.get("patient_profiles", patient_id=link["patient_id"])
                user = await store.get("users", id=link["patient_id"])
                if not profile or not user or user["disabled_at"]:
                    continue
                grants = {
                    g["scope"]: g
                    for g in await store.all(
                        "consent_grants", patient_id=link["patient_id"], care_link_id=link["id"]
                    )
                    if g["scope"] in ["reports", "alerts"] and care.active_grant(g)
                }
                try:
                    _, visible_alerts = await alerts.visible(actor, link["patient_id"])
                except DomainError:
                    visible_alerts = []
                safety_shared = any(
                    a["rule_key"] == SAFETY_RULE and a["state"] == "open" for a in visible_alerts
                )
                if not grants and not safety_shared:
                    continue
                entry = {
                    "patient_id": link["patient_id"],
                    "display_name": profile["display_name"],
                    "care_link_id": link["id"],
                    "scopes": sorted(grants),
                }
                # Derived signals use only what each active grant already lets this doctor read.
                shared = None
                if "reports" in grants:
                    start = grants["reports"]["data_from"]
                    shared = [
                        row
                        for row in await store.all(
                            "observations", patient_id=link["patient_id"], state="confirmed"
                        )
                        if start is None or utc(row["observed_at"]) >= utc(start)
                    ]
                    entry["streak_days"] = guidance.streak(
                        await store.all(
                            "activity_sessions", patient_id=link["patient_id"], state="completed"
                        ),
                        profile["timezone"],
                    )[0]
                open_request = "alerts" in grants and any(
                    a["rule_key"] == REVIEW_RULE and a["state"] == "open" for a in visible_alerts
                )
                scored = None
                if "reports" in grants:
                    start = grants["reports"]["data_from"]
                    scored = [
                        response_view(row, "")
                        for row in await store.all(
                            "assessment_responses", patient_id=link["patient_id"], complete=True
                        )
                        if start is None or utc(row["observed_at"]) >= utc(start)
                    ]
                entry["attention"] = guidance.attention(shared, open_request, scored, safety_shared)
                patients.append(entry)
            return page(patients, key=lambda r: (r["patient_id"],), descending=False)
        case "listDoctorReports":
            patient = p["patient_id"]
            _, grant = await care.authorize_report(actor, patient)
            rows = [
                r
                for r in await store.all("reports", patient_id=patient)
                if grant["data_from"] is None
                or utc(authorization_start(r)) >= utc(grant["data_from"])
            ]
            return page(rows, reports.receipt)
        case "getDoctorReport":
            return await reports.doctor_read(actor, p["patient_id"], p["report_id"])
        case "createObservation":
            return await observations.create(actor, body)
        case "listObservations":
            rows = await store.all("observations", patient_id=actor)
            built = page(rows, key=lambda r: (r["observed_at"], r["id"]))
            built["items"] = [await observations.view(row) for row in built["items"]]
            return built
        case "confirmObservation":
            return await observations.confirm(actor, p["observation_id"], body)
        case "requestReview":
            return await alerts.request(actor, body)
        case "listPatientAlerts":
            built = page(await store.all("alerts", patient_id=actor), lambda r: r)
            built["items"] = [await alerts.view(row) for row in built["items"]]
            return built
        case "listDoctorAlerts":
            _, rows = await alerts.visible(actor, p["patient_id"])
            built = page(rows, lambda r: r)
            built["items"] = [await alerts.view(row) for row in built["items"]]
            await care.audit(actor, p["patient_id"], "alerts_read", "alert", None)
            return built
        case "updateDoctorAlert":
            return await alerts.doctor_update(actor, p["patient_id"], p["alert_id"], body)
        case "getDoctorAlertAssessment":
            return await AssessmentService(store).doctor_alert_assessment(
                actor, p["patient_id"], p["alert_id"]
            )
        case "listAssessments":
            return await AssessmentService(store).list()
        case "submitAssessment":
            return await AssessmentService(store).submit(actor, p["assessment_id"], body)
        case "getMyMedicationReminder":
            active_links = {
                link["clinician_id"]
                for link in await store.all("care_links", patient_id=actor, state="active")
            }
            reminders = [
                r
                for r in await store.all("medication_reminders", patient_id=actor, active=True)
                if r["clinician_id"] in active_links
            ]
            reminders.sort(key=lambda r: r["updated_at"], reverse=True)
            if not reminders:
                return {"reminder": None}
            top = reminders[0]
            return {
                "reminder": {
                    "reminder_id": top["id"],
                    "patient_id": top["patient_id"],
                    "clinician_id": top["clinician_id"],
                    "message": top["message"],
                    "schedule_time": top["schedule_time"],
                    "active": bool(top["active"]),
                    "updated_at": top["updated_at"],
                }
            }
        case "setDoctorMedicationReminder":
            await care.clinician(actor)
            patient_id = p["patient_id"]
            link = await store.get(
                "care_links", patient_id=patient_id, clinician_id=actor, state="active"
            )
            if not link:
                raise DomainError("RESOURCE_NOT_FOUND", 404)
            now_ts = stamp()
            existing = await store.get(
                "medication_reminders", patient_id=patient_id, clinician_id=actor
            )
            if existing:
                await store.update(
                    "medication_reminders",
                    {"id": existing["id"], "patient_id": patient_id, "clinician_id": actor},
                    {
                        "message": body["message"],
                        "schedule_time": body["schedule_time"],
                        "active": body["active"],
                        "updated_at": now_ts,
                    },
                )
                rid = existing["id"]
            else:
                rid = str(uuid4())
                await store.add(
                    "medication_reminders",
                    id=rid,
                    patient_id=patient_id,
                    clinician_id=actor,
                    message=body["message"],
                    schedule_time=body["schedule_time"],
                    active=body["active"],
                    updated_at=now_ts,
                    created_at=now_ts,
                )
            await care.audit(
                actor, patient_id, "medication_reminder_set", "medication_reminder", rid
            )
            return {
                "reminder_id": rid,
                "patient_id": patient_id,
                "clinician_id": actor,
                "message": body["message"],
                "schedule_time": body["schedule_time"],
                "active": body["active"],
                "updated_at": now_ts,
            }
    raise DomainError("RESOURCE_NOT_FOUND", 404)
