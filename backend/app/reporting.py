"""Factual report projections from accepted PostgreSQL records; no generative claims."""

from datetime import timedelta
from statistics import mean
from uuid import uuid4
from zoneinfo import ZoneInfo

from .assessments import response_view
from .care import CareService
from .contracts import validate
from .domain import DomainError, RecordStore, now, stamp
from .insights import InsightService
from .services import ActivityService, utc


class ReportService:
    def __init__(self, store: RecordStore):
        self.store = store

    @staticmethod
    def receipt(row: dict) -> dict:
        return {"report_id": row["id"], "version": row["version"], "state": row["state"]}

    async def owned(self, patient: str, report_id: str) -> dict:
        row = await self.store.get("reports", id=report_id, patient_id=patient)
        if not row:
            raise DomainError("RESOURCE_NOT_FOUND", 404)
        return row

    async def read(self, patient: str, report_id: str) -> dict:
        row = await self.owned(patient, report_id)
        if row["state"] not in ["ready", "stale"]:
            raise DomainError("REPORT_NOT_READY")
        result = {**row["payload"], "state": row["state"], "version": row["version"]}
        validate("Report", result)
        return result

    async def create(self, patient: str, body: dict) -> dict:
        start, end = utc(body["period_start"]), utc(body["period_end"])
        cutoff = now()
        if end <= start or end > cutoff + timedelta(seconds=60) or end - start > timedelta(days=90):
            raise DomainError("VALIDATION_ERROR", 422)
        regeneration = None
        if body.get("regeneration_of"):
            regeneration = await self.owned(patient, body["regeneration_of"])
            if utc(regeneration["period_start"]) != start or utc(regeneration["period_end"]) != end:
                raise DomainError("VALIDATION_ERROR", 422)
        version = regeneration["version"] + 1 if regeneration else 1
        end = min(end, cutoff)
        profile = await self.store.get("patient_profiles", patient_id=patient)
        report_id = str(uuid4())
        generated = stamp()
        activity_service = ActivityService(self.store)

        def inside(value):
            return start <= utc(value) < end

        def known(row):
            return utc(row["created_at"]) <= cutoff

        all_activities = await self.store.all(
            "activity_sessions", patient_id=patient, state="completed"
        )
        activities = [
            row
            for row in all_activities
            if inside(row["ended_at"]) and utc(row["started_at"]) <= cutoff
        ]
        ids = {row["id"] for row in activities}
        all_feedback = await self.store.all("activity_feedback", patient_id=patient)
        feedback = [
            row
            for row in all_feedback
            if row["activity_session_id"] in ids and inside(row["created_at"]) and known(row)
        ]
        observations = [
            row
            for row in await self.store.all("observations", patient_id=patient, state="confirmed")
            if inside(row["observed_at"]) and known(row)
        ]
        assessments = [
            row
            for row in await self.store.all(
                "assessment_responses", patient_id=patient, complete=True
            )
            if inside(row["observed_at"]) and known(row)
        ]
        insights = [
            row
            for row in await self.store.all(
                "confirmed_insights", patient_id=patient, state="confirmed"
            )
            if inside(row["observed_at"]) and known(row)
        ]
        if (
            max(len(activities), len(feedback), len(observations), len(insights)) > 500
            or len(assessments) > 100
        ):
            raise DomainError("REPORT_TOO_LARGE", 422)
        sources = {}
        limitations = []

        async def source(source_id):
            row = await self.store.get("source_records", id=source_id, patient_id=patient)
            if not row or row["unavailable_at"] is not None:
                raise DomainError("REPORT_NOT_READY")
            ref = {"source_id": source_id, "source_revision": row["revision"]}
            sources[source_id] = ref
            return ref

        for event in await self.store.all(
            "activity_events", patient_id=patient, event_type="complete"
        ):
            if event["activity_session_id"] in ids:
                await source(event["source_id"])
        insight_views = []
        for row in insights:
            await source(row["source_id"])
            insight_views.append(InsightService.view(row))
        insight_views.sort(key=lambda r: (r["observed_at"], r["insight_id"]))
        fb = []
        for row in feedback:
            await source(row["source_id"])
            fb.append(
                {
                    "feedback_id": row["id"],
                    **{
                        k: row[k] for k in ["activity_session_id", "source_id", "rating", "comment"]
                    },
                }
            )
        obs = []
        for row in observations:
            refs = []
            for link in await self.store.all(
                "observation_sources", patient_id=patient, observation_id=row["id"]
            ):
                ref = await source(link["source_id"])
                if ref["source_revision"] != link["source_revision"]:
                    raise DomainError("REPORT_NOT_READY")
                refs.append(ref)
            obs.append(
                {
                    "observation_id": row["id"],
                    **{
                        k: row[k]
                        for k in [
                            "patient_id",
                            "session_id",
                            "kind",
                            "observed_at",
                            "state",
                            "version",
                            "supersedes_observation_id",
                        ]
                    },
                    "value": float(row["value"]),
                    "sources": refs,
                }
            )
        assessment_views = []
        for row in assessments:
            definition = await self.store.get(
                "assessment_definitions", id=row["assessment_id"], version=row["assessment_version"]
            )
            if not definition:
                raise DomainError("REPORT_NOT_READY")
            await source(row["source_id"])
            assessment_views.append(response_view(row, definition["title"]))
        for collection, key in [
            (activities, "id"),
            (fb, "feedback_id"),
            (obs, "observation_id"),
            (assessment_views, "assessment_response_id"),
        ]:
            collection.sort(key=lambda r: r[key])
        trends = []
        completion_refs = [
            sources[event["source_id"]]
            for event in await self.store.all(
                "activity_events", patient_id=patient, event_type="complete"
            )
            if event["activity_session_id"] in ids
        ]
        trends.append(
            {
                "metric": "activity_completions",
                "unit": "count",
                "count": len(activities),
                "mean": None,
                "delta": None,
                "coverage": f"{len(activities)} completed activities in requested period; no scheduled participation denominator is available",
                "sources": completion_refs,
            }
        )
        for metric, unit, values, refs in [
            (
                "activity_rating",
                "scale_1_5",
                [row["rating"] for row in fb],
                [sources[row["source_id"]] for row in fb],
            ),
            *[
                (
                    kind,
                    "hours" if kind == "sleep_hours" else "scale_0_10",
                    [row["value"] for row in obs if row["kind"] == kind],
                    [ref for row in obs if row["kind"] == kind for ref in row["sources"]],
                )
                for kind in ["mood", "energy", "sleep_hours"]
            ],
        ]:
            trends.append(
                {
                    "metric": metric,
                    "unit": unit,
                    "count": len(values),
                    "mean": round(mean(values), 2) if values else None,
                    "delta": None,
                    "coverage": f"{len(values)} accepted records in requested period; no prior-period comparison",
                    "sources": list({r["source_id"]: r for r in refs}.values()),
                }
            )
        if len(sources) > 1000:
            raise DomainError("REPORT_TOO_LARGE", 422)
        limitations.extend(
            [
                "Only accepted records available at generation are included; missing data is not a negative result.",
                "Ratings are patient-reported; no clinical inference or treatment-effect claim is made.",
                "Trend deltas are unavailable until a prior-period comparison is calculated.",
                "Conversation insights are patient-approved summaries, not diagnoses or independently verified clinical findings.",
                "No prior-period evidence is included outside this report's consent-bounded period.",
            ]
        )
        payload = {
            "report_id": report_id,
            "patient_id": patient,
            "version": version,
            "calculation_version": "facts-v3",
            "period_start": body["period_start"],
            "period_end": body["period_end"],
            "timezone": profile["timezone"],
            "generated_at": generated,
            "data_cutoff": cutoff.isoformat(),
            "state": "ready",
            "observations": obs,
            "confirmed_insights": insight_views,
            "factual_overview": {
                "confirmed_insight_count": len(insight_views),
                "completed_activity_count": len(activities),
                "feedback_count": len(fb),
                "assessment_count": len(assessment_views),
                "active_days": len(
                    {
                        utc(value).astimezone(ZoneInfo(profile["timezone"])).date()
                        for value in [
                            *[r["ended_at"] for r in activities],
                            *[r["observed_at"] for r in observations],
                            *[r["observed_at"] for r in insights],
                            *[r["observed_at"] for r in assessments],
                        ]
                    }
                ),
                "coverage_note": "Counts reflect available confirmed records only; days without records do not imply non-participation.",
            },
            "completed_activities": [activity_service.view(row) for row in activities],
            "feedback": fb,
            "assessments": assessment_views,
            "trends": trends,
            "sources": list(sources.values()),
            "limitations": limitations,
        }
        from .reports.evidence import EvidenceAggregator
        from .reports.narrative import document

        snapshot = await EvidenceAggregator(self.store).build(
            payload, body.get("compare_previous", False)
        )
        payload["document"] = document(snapshot, regeneration_of=body.get("regeneration_of"))
        payload["evidence_period_start"] = snapshot["authorization_start"]
        payload["limitations"] = [x for x in payload["limitations"] if "prior-period" not in x]
        validate("Report", payload)
        # Pending and ready transitions execute in one bounded, atomic application transaction.
        row = await self.store.add(
            "reports",
            id=report_id,
            patient_id=patient,
            version=version,
            calculation_version="facts-v3",
            period_start=body["period_start"],
            period_end=body["period_end"],
            state="pending",
            generated_at=None,
            data_cutoff=None,
            payload=None,
            created_at=generated,
        )
        await self.store.update(
            "reports",
            {"id": report_id, "patient_id": patient, "state": "pending"},
            {
                "state": "ready",
                "generated_at": generated,
                "data_cutoff": cutoff.isoformat(),
                "payload": payload,
            },
        )
        for ref in payload["sources"]:
            await self.store.add("report_sources", report_id=report_id, patient_id=patient, **ref)
        await CareService(self.store).audit(
            patient, patient, "report_generated", "report", report_id
        )
        return {"report_id": report_id, "version": version, "state": "ready"}

    async def doctor_read(self, clinician: str, patient: str, report_id: str) -> dict:
        row = await self.owned(patient, report_id)
        care = CareService(self.store)
        await care.authorize_report(clinician, patient, authorization_start(row))
        payload = await self.read(patient, report_id)
        await care.authorize_report(clinician, patient, authorization_start(row))
        await care.audit(clinician, patient, "report_read", "report", report_id)
        return payload


def authorization_start(row: dict) -> str:
    payload = row.get("payload") or {}
    return payload.get("evidence_period_start") or payload.get("document", {}).get(
        "snapshot", {}
    ).get("authorization_start", row["period_start"])
