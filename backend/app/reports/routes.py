"""Authenticated ephemeral exports, with consent and snapshot rechecked after rendering."""

import asyncio
from uuid import UUID

from fastapi import Request
from fastapi.responses import Response

from ..care import CareService, current_user
from ..domain import DomainError
from ..reporting import ReportService, authorization_start
from ..storage import SqlStore
from .narrative import validate_document
from .pdf import render_pdf

OPERATIONS = {"exportPatientReportPdf", "exportDoctorReportPdf"}


def install(app, engine, auth):
    capacity = asyncio.Semaphore(2)

    async def export(request: Request):
        identity = await auth.verify(request.headers.get("Authorization"))
        params = request.path_params
        try:
            for value in params.values():
                UUID(value)
        except ValueError:
            raise DomainError("VALIDATION_ERROR", 422) from None
        doctor = "patient_id" in params
        perspective = "clinician" if doctor else request.query_params.get("perspective", "patient")
        disposition = request.query_params.get("disposition", "attachment")
        if perspective not in ("patient", "clinician") or disposition not in (
            "inline",
            "attachment",
        ):
            raise DomainError("VALIDATION_ERROR", 422)

        async def authorized(store, *, final=False):
            user = await current_user(store, identity.subject)
            patient = params.get("patient_id", user["id"])
            if final:
                await store.get_locked("users", id=patient)
            if not doctor and user["role"] != "patient":
                raise DomainError("ROLE_REQUIRED", 403)
            service = ReportService(store)
            row = await service.owned(patient, params["report_id"])
            if final:
                row = await store.get_locked("reports", id=row["id"], patient_id=patient)
            care = CareService(store)
            if doctor:
                link, _ = await care.authorize_report(user["id"], patient, authorization_start(row))
                if final:
                    await store.get_locked("care_links", id=link["id"])
                    await care.authorize_report(user["id"], patient, authorization_start(row))
            if row["state"] != "ready":
                raise DomainError("REPORT_INVALIDATED", 409)
            report = row["payload"]
            if not report or not report.get("document"):
                raise DomainError("REPORT_REGENERATION_REQUIRED", 409)
            validate_document(report["document"])
            for ref in report["sources"]:
                source = await store.get("source_records", id=ref["source_id"], patient_id=patient)
                if (
                    not source
                    or source["unavailable_at"]
                    or source["revision"] != ref["source_revision"]
                ):
                    raise DomainError("REPORT_INVALIDATED", 409)
            return user, patient, report

        # Bound both rendering work and waiters. No database connection is held during layout.
        if capacity.locked():
            raise DomainError("EXPORT_BUSY", 503)
        async with capacity:
            async with engine.begin() as connection:
                _, _, report = await authorized(SqlStore(connection))
            try:
                worker = asyncio.create_task(asyncio.to_thread(render_pdf, report, perspective))
                try:
                    pdf = await asyncio.shield(worker)
                except asyncio.CancelledError:
                    # Retain capacity until the CPU work has actually stopped.
                    await worker
                    raise
            except DomainError:
                raise
            except Exception:  # noqa: BLE001 — renderer exceptions never expose patient text/paths
                raise DomainError("PDF_RENDER_FAILED", 503) from None
            async with engine.begin() as connection:
                store = SqlStore(connection)
                actor, patient, fresh = await authorized(store, final=True)
                if fresh["document"]["content_hash"] != report["document"]["content_hash"]:
                    raise DomainError("REPORT_INVALIDATED", 409)
                await CareService(store).audit(
                    actor["id"], patient, "report_pdf_exported", "report", report["report_id"]
                )
            return Response(
                pdf,
                media_type="application/pdf",
                headers={
                    "Cache-Control": "private, no-store, max-age=0",
                    "Pragma": "no-cache",
                    "X-Content-Type-Options": "nosniff",
                    "Content-Disposition": f'{disposition}; filename="AIriane-report-{report["report_id"]}.pdf"',
                },
            )

    app.add_api_route(
        "/v1/reports/{report_id}/pdf", export, methods=["GET"], name="exportPatientReportPdf"
    )
    app.add_api_route(
        "/v1/doctor/patients/{patient_id}/reports/{report_id}/pdf",
        export,
        methods=["GET"],
        name="exportDoctorReportPdf",
    )
