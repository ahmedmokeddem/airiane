"""Dispatch the existing report/care HTTP operations to application services."""

from .care import CareService
from .domain import DomainError
from .reporting import ReportService
from .services import utc

SHARED_OPERATIONS = {
    "getMe",
    "listCareLinks",
    "updateCareLink",
    "listDoctorPatients",
    "listDoctorReports",
    "getDoctorReport",
}
OPERATIONS = {
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
}


async def dispatch(op, store, actor, p, body, query, pages):
    care, reports = CareService(store), ReportService(store)
    scope = op + ":" + actor + ":" + p.get("patient_id", "")

    def page(rows, view=lambda r: r, key=lambda r: (r["created_at"], r["id"]), descending=True):
        return pages.build(rows, view, key, query, scope, descending)

    match op:
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
                scopes = sorted(
                    {
                        g["scope"]
                        for g in await store.all(
                            "consent_grants", patient_id=link["patient_id"], care_link_id=link["id"]
                        )
                        if g["scope"] in ["reports", "alerts"] and care.active_grant(g)
                    }
                )
                if scopes:
                    patients.append(
                        {
                            "patient_id": link["patient_id"],
                            "display_name": profile["display_name"],
                            "care_link_id": link["id"],
                            "scopes": scopes,
                        }
                    )
            return page(patients, key=lambda r: (r["patient_id"],), descending=False)
        case "listDoctorReports":
            patient = p["patient_id"]
            _, grant = await care.authorize_report(actor, patient)
            rows = [
                r
                for r in await store.all("reports", patient_id=patient)
                if grant["data_from"] is None or utc(r["period_start"]) >= utc(grant["data_from"])
            ]
            return page(rows, reports.receipt)
        case "getDoctorReport":
            return await reports.doctor_read(actor, p["patient_id"], p["report_id"])
    raise DomainError("RESOURCE_NOT_FOUND", 404)
