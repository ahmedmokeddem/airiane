"""Conversation insight report service and isolated HTTP routes.

This module only reads existing records for the authenticated patient. It does not mutate
conversations, chatbot prompts or the existing report/alert flows. Report drafts are stored in
a dedicated table and become visible to a clinician only after an explicit in-app share.
"""

from __future__ import annotations

from datetime import timedelta
from uuid import UUID, uuid4

from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from . import assessments
from .care import CareService, current_user
from .domain import DomainError, now, stamp
from .insight_agent import (
    AssessmentSection,
    AssessmentSummary,
    InsightReportCreate,
    InsightReportShare,
    build_insight_report,
)
from .services import PatientService, SessionService
from .storage import SqlStore

NO_STORE = {"Cache-Control": "no-store"}
MAX_BODY = 1_000_000


def _uuid(value: str) -> str:
    try:
        return str(UUID(value))
    except (ValueError, TypeError):
        raise DomainError("VALIDATION_ERROR", 422) from None


async def _body(request: Request, model):
    if int(request.headers.get("content-length") or 0) > MAX_BODY:
        raise DomainError("BODY_TOO_LARGE", 413)
    try:
        payload = await request.json()
    except ValueError:
        raise DomainError("VALIDATION_ERROR", 422) from None
    try:
        return model.model_validate(payload)
    except ValidationError:
        raise DomainError("VALIDATION_ERROR", 422) from None


async def _assessment_section(store: SqlStore, patient: str) -> AssessmentSection:
    rows = await store.all("assessment_responses", patient_id=patient, complete=True)
    rows.sort(key=lambda row: row["observed_at"], reverse=True)
    found: dict[str, AssessmentSummary] = {}
    for row in rows:
        result = assessments.score(row["assessment_id"], row["answers"])
        if not result:
            continue
        instrument = result["instrument"]
        if instrument not in ("phq9", "bdi_themes") or instrument in found:
            continue
        definition = await store.get(
            "assessment_definitions",
            id=row["assessment_id"],
            version=row["assessment_version"],
        )
        found[instrument] = AssessmentSummary(
            instrument=instrument,
            title=definition["title"] if definition else result["instrument"],
            version=row["assessment_version"],
            observed_at=row["observed_at"],
            total=result["total"],
            max_total=result["max_total"],
            severity=result["severity"],
            validated=result["validated"],
            safety_item_positive=result["safety"]["item_positive"],
        )
    return AssessmentSection(
        phq9=found.get("phq9"),
        bdi_ii=found.get("bdi_themes"),
        note=(
            "Only questionnaire records persisted by the existing backend are included. "
            "PHQ-9 and BDI-II are separate instruments and are never combined."
        ),
    )


def _view(row: dict) -> dict:
    return {
        "report_id": row["id"],
        "patient_id": row["patient_id"],
        "session_id": row["session_id"],
        "status": row["status"],
        "schema_version": row["schema_version"],
        "created_at": row["created_at"],
        "shared_at": row["shared_at"],
        "recipient_care_link_id": row["shared_care_link_id"],
        "report": row["payload"],
    }


class InsightReportService:
    def __init__(self, store: SqlStore):
        self.store = store

    async def create(self, patient: str, body: InsightReportCreate) -> dict:
        if not body.consent_to_analyze:
            raise DomainError("CONSENT_REQUIRED", 403)
        try:
            UUID(body.session_id)
        except (ValueError, TypeError):
            raise DomainError("VALIDATION_ERROR", 422) from None
        await SessionService(self.store).owned(patient, body.session_id)
        if any(turn.session_id != body.session_id for turn in body.messages):
            raise DomainError("VALIDATION_ERROR", 422)
        if max(turn.event_at for turn in body.messages) > now() + timedelta(minutes=5):
            raise DomainError("VALIDATION_ERROR", 422)

        report_id = str(uuid4())
        generated_at = now()
        payload = build_insight_report(
            report_id=report_id,
            patient_id=patient,
            messages=body.messages,
            assessments=await _assessment_section(self.store, patient),
            generated_at=generated_at,
        )
        row = await self.store.add(
            "insight_reports",
            id=report_id,
            patient_id=patient,
            session_id=body.session_id,
            status="private_draft",
            schema_version=payload.schema_version,
            period_start=payload.coverage.period_start,
            period_end=payload.coverage.period_end,
            shared_care_link_id=None,
            shared_at=None,
            created_at=stamp(),
            payload=payload.model_dump(mode="json"),
        )
        return _view(row)

    async def list(self, patient: str) -> dict:
        rows = await self.store.all("insight_reports", patient_id=patient)
        rows.sort(key=lambda row: row["created_at"], reverse=True)
        return {"items": [_view(row) for row in rows], "next_cursor": None}

    async def owned(self, patient: str, report_id: str) -> dict:
        row = await self.store.get("insight_reports", id=report_id, patient_id=patient)
        if not row:
            raise DomainError("RESOURCE_NOT_FOUND", 404)
        return row

    async def get(self, patient: str, report_id: str) -> dict:
        return _view(await self.owned(patient, report_id))

    async def share(
        self,
        patient: str,
        report_id: str,
        body: InsightReportShare,
    ) -> dict:
        if not body.consent:
            raise DomainError("CONSENT_REQUIRED", 403)
        row = await self.owned(patient, report_id)
        care_link_id = _uuid(body.care_link_id)
        link = await self.store.get(
            "care_links",
            id=care_link_id,
            patient_id=patient,
            state="active",
        )
        if not link:
            raise DomainError("RESOURCE_NOT_FOUND", 404)
        await CareService(self.store).clinician(link["clinician_id"])

        if row["status"] == "shared" and row["shared_care_link_id"] == care_link_id:
            return _view(row)
        shared_at = stamp()
        payload = dict(row["payload"])
        payload["consent"] = {
            "analysis_consent": True,
            "sharing_status": "shared",
            "recipient_care_link_id": care_link_id,
            "shared_at": shared_at,
        }
        await self.store.update(
            "insight_reports",
            {"id": report_id, "patient_id": patient},
            {
                "status": "shared",
                "shared_care_link_id": care_link_id,
                "shared_at": shared_at,
                "payload": payload,
            },
        )
        await CareService(self.store).audit(
            patient, patient, "insight_report_shared", "insight_report", report_id
        )
        fresh = await self.owned(patient, report_id)
        return _view(fresh)

    async def revoke(self, patient: str, report_id: str) -> dict:
        row = await self.owned(patient, report_id)
        if row["status"] == "shared":
            payload = dict(row["payload"])
            payload["consent"] = {
                "analysis_consent": True,
                "sharing_status": "private_draft",
                "recipient_care_link_id": None,
                "shared_at": None,
            }
            await self.store.update(
                "insight_reports",
                {"id": report_id, "patient_id": patient},
                {
                    "status": "private_draft",
                    "shared_care_link_id": None,
                    "shared_at": None,
                    "payload": payload,
                },
            )
            await CareService(self.store).audit(
                patient, patient, "insight_report_sharing_revoked", "insight_report", report_id
            )
        return _view(await self.owned(patient, report_id))

    async def doctor_link(self, clinician: str, patient: str) -> dict:
        await CareService(self.store).clinician(clinician)
        profile = await self.store.get("patient_profiles", patient_id=patient)
        user = await self.store.get("users", id=patient)
        if not profile or not user or user["disabled_at"]:
            raise DomainError("RESOURCE_NOT_FOUND", 404)
        link = await self.store.get(
            "care_links",
            patient_id=patient,
            clinician_id=clinician,
            state="active",
        )
        if not link:
            raise DomainError("CONSENT_REQUIRED", 403)
        return link

    async def doctor_list(self, clinician: str, patient: str) -> dict:
        link = await self.doctor_link(clinician, patient)
        rows = await self.store.all(
            "insight_reports",
            patient_id=patient,
            status="shared",
            shared_care_link_id=link["id"],
        )
        rows.sort(key=lambda row: row["created_at"], reverse=True)
        return {"items": [_view(row) for row in rows], "next_cursor": None}

    async def doctor_get(self, clinician: str, patient: str, report_id: str) -> dict:
        link = await self.doctor_link(clinician, patient)
        row = await self.store.get(
            "insight_reports",
            id=report_id,
            patient_id=patient,
            status="shared",
            shared_care_link_id=link["id"],
        )
        if not row:
            raise DomainError("RESOURCE_NOT_FOUND", 404)
        await CareService(self.store).audit(
            clinician, patient, "insight_report_read", "insight_report", report_id
        )
        return _view(row)


def install(app, engine, auth, settings):
    async def create(request: Request):
        identity = await auth.verify(request.headers.get("Authorization"))
        body = await _body(request, InsightReportCreate)
        async with engine.begin() as connection:
            store = SqlStore(connection)
            patient = await PatientService(store).user(identity.subject)
            return JSONResponse(
                await InsightReportService(store).create(patient["id"], body),
                status_code=201,
                headers=NO_STORE,
            )

    async def list_own(request: Request):
        identity = await auth.verify(request.headers.get("Authorization"))
        async with engine.begin() as connection:
            store = SqlStore(connection)
            patient = await PatientService(store).user(identity.subject)
            return JSONResponse(
                await InsightReportService(store).list(patient["id"]), headers=NO_STORE
            )

    async def get_own(request: Request):
        identity = await auth.verify(request.headers.get("Authorization"))
        report_id = _uuid(request.path_params["report_id"])
        async with engine.begin() as connection:
            store = SqlStore(connection)
            patient = await PatientService(store).user(identity.subject)
            return JSONResponse(
                await InsightReportService(store).get(patient["id"], report_id),
                headers=NO_STORE,
            )

    async def share(request: Request):
        identity = await auth.verify(request.headers.get("Authorization"))
        report_id = _uuid(request.path_params["report_id"])
        body = await _body(request, InsightReportShare)
        async with engine.begin() as connection:
            store = SqlStore(connection)
            patient = await PatientService(store).user(identity.subject)
            return JSONResponse(
                await InsightReportService(store).share(patient["id"], report_id, body),
                headers=NO_STORE,
            )

    async def revoke(request: Request):
        identity = await auth.verify(request.headers.get("Authorization"))
        report_id = _uuid(request.path_params["report_id"])
        async with engine.begin() as connection:
            store = SqlStore(connection)
            patient = await PatientService(store).user(identity.subject)
            return JSONResponse(
                await InsightReportService(store).revoke(patient["id"], report_id),
                headers=NO_STORE,
            )

    async def doctor_list(request: Request):
        identity = await auth.verify(request.headers.get("Authorization"))
        patient_id = _uuid(request.path_params["patient_id"])
        async with engine.begin() as connection:
            store = SqlStore(connection)
            user = await current_user(store, identity.subject)
            if user["role"] != "clinician":
                raise DomainError("ROLE_REQUIRED", 403)
            return JSONResponse(
                await InsightReportService(store).doctor_list(user["id"], patient_id),
                headers=NO_STORE,
            )

    async def doctor_get(request: Request):
        identity = await auth.verify(request.headers.get("Authorization"))
        patient_id = _uuid(request.path_params["patient_id"])
        report_id = _uuid(request.path_params["report_id"])
        async with engine.begin() as connection:
            store = SqlStore(connection)
            user = await current_user(store, identity.subject)
            if user["role"] != "clinician":
                raise DomainError("ROLE_REQUIRED", 403)
            return JSONResponse(
                await InsightReportService(store).doctor_get(user["id"], patient_id, report_id),
                headers=NO_STORE,
            )

    app.add_api_route("/v1/insight-reports", create, methods=["POST"], name="createInsightReport")
    app.add_api_route("/v1/insight-reports", list_own, methods=["GET"], name="listInsightReports")
    app.add_api_route(
        "/v1/insight-reports/{report_id}", get_own, methods=["GET"], name="getInsightReport"
    )
    app.add_api_route(
        "/v1/insight-reports/{report_id}/share",
        share,
        methods=["POST"],
        name="shareInsightReport",
    )
    app.add_api_route(
        "/v1/insight-reports/{report_id}/revoke",
        revoke,
        methods=["POST"],
        name="revokeInsightReport",
    )
    app.add_api_route(
        "/v1/doctor/patients/{patient_id}/insight-reports",
        doctor_list,
        methods=["GET"],
        name="listDoctorInsightReports",
    )
    app.add_api_route(
        "/v1/doctor/patients/{patient_id}/insight-reports/{report_id}",
        doctor_get,
        methods=["GET"],
        name="getDoctorInsightReport",
    )
