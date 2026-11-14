"""Idempotency metadata contains IDs, never patient text or response bodies."""

from .domain import ConversationController, DomainError
from .services import ActivityService, SessionService


def metadata(op: str, result: dict) -> dict:
    if op == "dispatchTool":
        return {
            "tool_call_id": result["tool_call_id"],
            "resource": metadata("tool", result["result"]),
        }
    if op == "updateDoctorAlert":
        return {"alert_id": result["alert_id"], "doctor_patient_id": result["patient_id"]}
    if "patient_id" in result and "preferences" in result:
        return {"type": "patient_context"}
    if "missing_fields" in result:
        return {"type": "guided_question"}
    keys = [
        "session_id",
        "recommendation_id",
        "activity_session_id",
        "feedback_id",
        "connection_id",
        "report_id",
        "care_link_id",
        "consent_grant_id",
        "observation_id",
        "alert_id",
    ]
    return {key: result[key] for key in keys if key in result}


async def restore(op: str, meta: dict, store, patient: str) -> dict:
    activities, sessions = ActivityService(store), SessionService(store)
    if op == "dispatchTool":
        result = await restore(
            "tool",
            {**meta["resource"], "application_session_id": meta["application_session_id"]},
            store,
            patient,
        )
        return {"tool_call_id": meta["tool_call_id"], "contract_version": "2.0.0", "result": result}
    if "observation_id" in meta:
        from .wellbeing import ObservationService

        observations = ObservationService(store)
        return await observations.view(await observations.owned(patient, meta["observation_id"]))
    if "alert_id" in meta:
        from .wellbeing import AlertService

        alerts = AlertService(store)
        if "doctor_patient_id" in meta:
            # Clinician replay re-checks the live link and alerts grant before returning.
            _, rows = await alerts.visible(patient, meta["doctor_patient_id"])
            row = next((r for r in rows if r["id"] == meta["alert_id"]), None)
            if not row:
                raise DomainError("RESOURCE_NOT_FOUND", 404)
            return await alerts.view(row)
        return await alerts.view(await alerts.owned(patient, meta["alert_id"]))
    if "consent_grant_id" in meta:
        from .care import CareService

        row = await store.get("consent_grants", id=meta["consent_grant_id"], patient_id=patient)
        if not row:
            raise DomainError("RESOURCE_NOT_FOUND", 404)
        return None if meta.get("deleted") else CareService.consent_view(row)
    if "care_link_id" in meta:
        from .care import CareService

        return CareService.link_view(await CareService(store).link(patient, meta["care_link_id"]))
    if "report_id" in meta:
        from .reporting import ReportService

        row = await ReportService(store).owned(patient, meta["report_id"])
        return ReportService.receipt(row)
    if meta.get("type") == "patient_context":
        return {
            "patient_id": patient,
            "preferences": {},
            "recovery_plan": None,
            "memories": [],
            "recent_observations": [],
        }
    if meta.get("type") == "guided_question":
        session = await sessions.owned(patient, meta["application_session_id"])
        return ConversationController().question(session["version"])
    if "feedback_id" in meta:
        row = await store.get("activity_feedback", id=meta["feedback_id"], patient_id=patient)
        if not row:
            raise DomainError("RESOURCE_NOT_FOUND", 404)
        return {
            "feedback_id": row["id"],
            **{k: row[k] for k in ["activity_session_id", "source_id", "rating", "comment"]},
        }
    if "connection_id" in meta:
        row = await store.get("provider_connections", id=meta["connection_id"], patient_id=patient)
        if not row:
            raise DomainError("RESOURCE_NOT_FOUND", 404)
        return {
            "connection_id": row["id"],
            **{
                k: row[k]
                for k in [
                    "session_id",
                    "connection_epoch",
                    "provider",
                    "mode",
                    "transport",
                    "state",
                    "provider_conversation_id",
                    "context_version",
                    "version",
                ]
            },
        }
    if "activity_session_id" in meta:
        return activities.view(await activities.owned(patient, meta["activity_session_id"]))
    if "recommendation_id" in meta:
        return await activities.recommendation(patient, meta["recommendation_id"])
    if "session_id" in meta:
        return await sessions.view(await sessions.owned(patient, meta["session_id"]))
    # Context/question reads are safe to repeat, but current state must be reconstructed.
    raise DomainError("IDEMPOTENCY_CONFLICT")
