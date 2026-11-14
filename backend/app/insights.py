"""Patient-approved summaries, independent of provider transcripts and model tools."""

from datetime import timedelta
from uuid import uuid4

from .care import CareService
from .domain import DomainError, RecordStore, now, stamp
from .services import SessionService, utc


class InsightService:
    def __init__(self, store: RecordStore):
        self.store = store

    @staticmethod
    def view(row: dict) -> dict:
        return {
            "insight_id": row["id"],
            **{
                k: row[k]
                for k in [
                    "patient_id",
                    "session_id",
                    "theme",
                    "text",
                    "observed_at",
                    "statement_kind",
                    "confirmed_at",
                    "state",
                    "version",
                    "supersedes_insight_id",
                ]
            },
            "sources": [{"source_id": row["source_id"], "source_revision": 1}],
        }

    async def owned(self, patient: str, insight_id: str) -> dict:
        row = await self.store.get_locked("confirmed_insights", id=insight_id, patient_id=patient)
        if not row or row["state"] == "deleted":
            raise DomainError("RESOURCE_NOT_FOUND", 404)
        return row

    async def confirm(self, patient: str, body: dict, prior: dict | None = None) -> dict:
        # Also serialize direct service callers; HTTP mutations already lock the actor row.
        await self.store.get_locked("patient_profiles", patient_id=patient)
        # The authenticated patient UI owns this endpoint. It is deliberately absent from dispatchTool.
        if body["confirmation"] is not True or not body["text"].strip():
            raise DomainError("VALIDATION_ERROR", 422)
        if utc(body["observed_at"]) > now() + timedelta(seconds=30):
            raise DomainError("VALIDATION_ERROR", 422)
        if body["session_id"]:
            await SessionService(self.store).owned(patient, body["session_id"])
        text = body["text"].strip()
        if prior is None:
            for row in await self.store.all(
                "confirmed_insights", patient_id=patient, state="confirmed"
            ):
                if (
                    all(row[k] == body[k] for k in ["theme", "session_id", "statement_kind"])
                    and row["text"] == text
                    and utc(row["observed_at"]) == utc(body["observed_at"])
                ):
                    return self.view(row)
        source_id, insight_id, timestamp = str(uuid4()), str(uuid4()), stamp()
        await self.store.add(
            "source_records",
            id=source_id,
            patient_id=patient,
            kind="correction" if prior else "structured_input",
            session_id=body["session_id"],
            revision=1,
            occurred_at=body["observed_at"],
            unavailable_at=None,
            created_at=timestamp,
        )
        row = await self.store.add(
            "confirmed_insights",
            id=insight_id,
            patient_id=patient,
            text=text,
            **{k: body[k] for k in ["session_id", "theme", "observed_at", "statement_kind"]},
            confirmed_at=timestamp,
            state="confirmed",
            version=1,
            supersedes_insight_id=prior["id"] if prior else None,
            source_id=source_id,
            created_at=timestamp,
        )
        await CareService(self.store).audit(
            patient, patient, "insight_confirmed", "insight", insight_id
        )
        return self.view(row)

    async def correct(self, patient: str, insight_id: str, body: dict) -> dict:
        prior = await self.owned(patient, insight_id)
        if prior["version"] != body["expected_version"]:
            raise DomainError("VERSION_CONFLICT")
        if prior["state"] != "confirmed":
            raise DomainError("INVALID_TRANSITION")
        result = await self.confirm(patient, body, prior)
        await self.store.update(
            "confirmed_insights",
            {"id": insight_id, "patient_id": patient, "version": prior["version"]},
            {"state": "superseded", "version": prior["version"] + 1},
        )
        await self.scrub_reports(patient, {insight_id}, {prior["source_id"]})
        return result

    async def scrub_reports(self, patient: str, ids: set[str], sources: set[str]):
        # Stored report snapshots must not continue exposing deleted/superseded text.
        for report in await self.store.all("reports", patient_id=patient):
            payload = report["payload"]
            doc_evidence = (
                (payload or {}).get("document", {}).get("snapshot", {}).get("evidence", [])
            )
            affected = any(
                r["insight_id"] in ids for r in (payload or {}).get("confirmed_insights", [])
            ) or any(
                r["record_id"] in ids or bool(set(r["source_ids"]) & sources) for r in doc_evidence
            )
            if not payload or not affected:
                continue
            payload = dict(payload)
            if "document" in payload:
                payload["evidence_period_start"] = payload["document"]["snapshot"][
                    "authorization_start"
                ]
            payload.pop(
                "document", None
            )  # Withdrawn text must not survive in either narrative or prior-period snapshot.
            payload["confirmed_insights"] = [
                r for r in payload["confirmed_insights"] if r["insight_id"] not in ids
            ]
            payload["sources"] = [r for r in payload["sources"] if r["source_id"] not in sources]
            if "factual_overview" in payload:
                payload["factual_overview"] = {
                    **payload["factual_overview"],
                    "confirmed_insight_count": len(payload["confirmed_insights"]),
                    "coverage_note": "An insight was corrected or deleted; generate a new report for current coverage.",
                }
            payload["state"] = "stale"
            payload["limitations"] = list(
                dict.fromkeys(
                    [
                        *payload["limitations"],
                        "A previously included insight was corrected or deleted; this report requires regeneration.",
                    ]
                )
            )[-30:]
            await self.store.update(
                "reports",
                {"id": report["id"], "patient_id": patient},
                {"payload": payload, "state": "stale"},
            )

    async def delete(self, patient: str, insight_id: str):
        await self.owned(patient, insight_id)
        rows = await self.store.all("confirmed_insights", patient_id=patient)
        ids = {insight_id}
        # Delete all correction ancestors and descendants, including their approved prior text.
        while True:
            expanded = (
                ids
                | {r["id"] for r in rows if r["supersedes_insight_id"] in ids}
                | {
                    r["supersedes_insight_id"]
                    for r in rows
                    if r["id"] in ids and r["supersedes_insight_id"]
                }
            )
            if expanded == ids:
                break
            ids = expanded
        sources = {r["source_id"] for r in rows if r["id"] in ids}
        await self.scrub_reports(patient, ids, sources)
        for row in rows:
            if row["id"] in ids:
                await self.store.update(
                    "confirmed_insights",
                    {"id": row["id"], "patient_id": patient},
                    {"text": "[deleted]", "state": "deleted", "version": row["version"] + 1},
                )
                await self.store.update(
                    "source_records",
                    {"id": row["source_id"], "patient_id": patient},
                    {"unavailable_at": stamp()},
                )
        await CareService(self.store).audit(
            patient, patient, "insight_deleted", "insight", insight_id
        )
