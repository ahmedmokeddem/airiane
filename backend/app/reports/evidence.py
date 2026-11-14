"""Build a versioned, patient-owned evidence snapshot. No transcript or model calls."""

import json
import math
from collections import Counter
from hashlib import sha256
from zoneinfo import ZoneInfo

from ..domain import DomainError
from ..insights import InsightService
from ..services import ACTIVITY_ID, utc


def digest(value: object) -> str:
    return sha256(
        json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()
    ).hexdigest()


class EvidenceAggregator:
    def __init__(self, store):
        self.store = store

    async def build(self, report: dict, compare: bool) -> dict:
        patient = report["patient_id"]
        start, end, cutoff = map(
            utc, [report["period_start"], report["period_end"], report["data_cutoff"]]
        )
        prior_start = start - (end - start)
        evidence: list[dict] = []
        refs = {r["source_id"]: r for r in report["sources"]}

        async def add(
            kind,
            row_id,
            date,
            source_ids,
            *,
            label,
            text=None,
            value=None,
            unit=None,
            category=None,
            phase="current",
            origin="not_recorded",
        ):
            if kind == "observation" and (
                not math.isfinite(value)
                or not 0 <= value <= (24 if category == "sleep_hours" else 10)
            ):
                raise DomainError("REPORT_NOT_READY")
            for sid in source_ids:
                source = await self.store.get("source_records", id=sid, patient_id=patient)
                if (
                    not source
                    or source["unavailable_at"] is not None
                    or utc(source["created_at"]) > cutoff
                ):
                    raise DomainError("REPORT_NOT_READY")
                refs[sid] = {"source_id": sid, "source_revision": source["revision"]}
            if not source_ids:
                return  # An untraceable legacy row is not promoted to a narrative finding.
            evidence.append(
                {
                    "id": kind + ":" + row_id,
                    "record_id": row_id,
                    "kind": kind,
                    "date": date,
                    "source_ids": sorted(set(source_ids)),
                    "label": label,
                    "text": text,
                    "value": value,
                    "unit": unit,
                    "category": category,
                    "phase": phase,
                    "origin": origin,
                }
            )

        async def activity(row, phase):
            rid = row.get("activity_session_id", row.get("id"))
            catalog = await self.store.get(
                "activity_catalog", id=row["activity_id"], version=row["activity_version"]
            )
            events = await self.store.all(
                "activity_events",
                patient_id=patient,
                activity_session_id=rid,
                event_type="complete",
            )
            await add(
                "activity",
                rid,
                row["ended_at"],
                [e["source_id"] for e in events],
                label=catalog["title"] if catalog else "Archived catalogue activity",
                category=catalog["kind"] if catalog else "unrecorded",
                phase=phase,
                origin="curated_catalog"
                if row["activity_id"] == ACTIVITY_ID and row["activity_version"] == 1
                else "not_recorded",
            )

        for row in report["completed_activities"]:
            await activity(row, "current")
        activity_by_id = {e["record_id"]: e for e in evidence if e["kind"] == "activity"}
        for row in report["feedback"]:
            linked = activity_by_id.get(row["activity_session_id"])
            stored = await self.store.get(
                "activity_feedback", id=row["feedback_id"], patient_id=patient
            )
            if linked and stored:
                await add(
                    "feedback",
                    row["feedback_id"],
                    stored["created_at"],
                    [row["source_id"]],
                    label=linked["label"],
                    text=row["comment"],
                    value=row["rating"],
                    unit="helpfulness_1_5",
                    category=linked["category"],
                    origin="patient_explicit_feedback",
                )
        for row in report.get("confirmed_insights", []):
            await add(
                "insight",
                row["insight_id"],
                row["observed_at"],
                [r["source_id"] for r in row["sources"]],
                label=row["theme"].replace("_", " "),
                text=row["text"],
                category=row["theme"],
                origin=row["statement_kind"],
            )
        for row in report["observations"]:
            await add(
                "observation",
                row["observation_id"],
                row["observed_at"],
                [r["source_id"] for r in row["sources"]],
                label=row["kind"],
                value=row["value"],
                unit="hours" if row["kind"] == "sleep_hours" else "self_report_0_10",
                category=row["kind"],
                origin="patient_confirmed_value",
            )
        for row in report["assessments"]:
            await add(
                "questionnaire",
                row["assessment_response_id"],
                row["observed_at"],
                [row["source_id"]],
                label=f"{row['title']} · version {row['assessment_version']}",
                value=len(row["answers"]),
                unit="recorded_answers",
                origin="instrument_validation_not_recorded",
            )

        if compare:
            for row in await self.store.all(
                "confirmed_insights", patient_id=patient, state="confirmed"
            ):
                if (
                    prior_start <= utc(row["observed_at"]) < start
                    and utc(row["created_at"]) <= cutoff
                ):
                    view = InsightService.view(row)
                    await add(
                        "insight",
                        row["id"],
                        row["observed_at"],
                        [r["source_id"] for r in view["sources"]],
                        label=row["theme"].replace("_", " "),
                        text=row["text"],
                        category=row["theme"],
                        phase="previous",
                        origin=row["statement_kind"],
                    )
            for row in await self.store.all(
                "activity_sessions", patient_id=patient, state="completed"
            ):
                if prior_start <= utc(row["ended_at"]) < start:
                    await activity(row, "previous")
            for row in await self.store.all("observations", patient_id=patient, state="confirmed"):
                if (
                    prior_start <= utc(row["observed_at"]) < start
                    and utc(row["created_at"]) <= cutoff
                ):
                    links = await self.store.all(
                        "observation_sources", patient_id=patient, observation_id=row["id"]
                    )
                    for link in links:
                        source = await self.store.get(
                            "source_records", id=link["source_id"], patient_id=patient
                        )
                        if not source or source["revision"] != link["source_revision"]:
                            raise DomainError("REPORT_NOT_READY")
                    await add(
                        "observation",
                        row["id"],
                        row["observed_at"],
                        [r["source_id"] for r in links],
                        label=row["kind"],
                        value=float(row["value"]),
                        unit="hours" if row["kind"] == "sleep_hours" else "self_report_0_10",
                        category=row["kind"],
                        phase="previous",
                        origin="patient_confirmed_value",
                    )
        if len(evidence) > 1600 or len(refs) > 1000:
            raise DomainError("REPORT_TOO_LARGE", 422)
        evidence.sort(key=lambda e: (e["date"], e["kind"], e["id"]))
        zone = ZoneInfo(report["timezone"])

        def stats(phase):
            rows = [e for e in evidence if e["phase"] == phase]
            return {
                "counts": dict(Counter(e["kind"] for e in rows)),
                "active_days": len(
                    {utc(e["date"]).astimezone(zone).date().isoformat() for e in rows}
                ),
                "themes": dict(
                    sorted(Counter(e["category"] for e in rows if e["kind"] == "insight").items())
                ),
            }

        # Consent bounds include every earlier source, even when the sample is too sparse for a comparison.
        authorization_start = (
            prior_start.isoformat()
            if any(e["phase"] == "previous" for e in evidence)
            else report["period_start"]
        )
        snapshot = {
            "evidence": evidence,
            "current_start": report["period_start"],
            "current_end": report["period_end"],
            "previous_start": prior_start.isoformat() if compare else None,
            "timezone": report["timezone"],
            "aggregates": {
                "current": stats("current"),
                "previous": stats("previous") if compare else None,
            },
            "authorization_start": authorization_start,
        }
        report["sources"] = list(refs.values())
        return snapshot
