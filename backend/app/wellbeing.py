"""Patient-confirmed check-in observations and explicit clinician review requests.

Observations are always proposed first (by the UI or a voice tool) and enter reports only
after an explicit patient confirmation. Review requests are recorded even when no clinician is
authorized to see them; delivery is a separate, consent-gated recipient row.
"""

from datetime import timedelta

from .care import CareService
from .domain import DomainError, RecordStore, now, stamp
from .services import SessionService, uid, utc

REVIEW_RULE = "patient_requested_review"
# A questionnaire whose self-harm question was answered above 0, sent to connected doctors.
SAFETY_RULE = "questionnaire_safety_item"
SCALE_LIMITS = {"mood": 10, "energy": 10, "sleep_hours": 24}


class ObservationService:
    def __init__(self, store: RecordStore):
        self.store = store

    async def view(self, row: dict) -> dict:
        links = await self.store.all(
            "observation_sources", observation_id=row["id"], patient_id=row["patient_id"]
        )
        return {
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
            "sources": [
                {"source_id": link["source_id"], "source_revision": link["source_revision"]}
                for link in sorted(links, key=lambda r: (r["source_id"], r["source_revision"]))
            ],
        }

    async def owned(self, patient: str, observation_id: str, lock: bool = False) -> dict:
        filters = {"id": observation_id, "patient_id": patient}
        row = await (
            self.store.get_locked("observations", **filters)
            if lock
            else self.store.get("observations", **filters)
        )
        if not row:
            raise DomainError("RESOURCE_NOT_FOUND", 404)
        return row

    @staticmethod
    def check_value(kind: str, value: float, observed_at: str) -> None:
        if value > SCALE_LIMITS[kind] or utc(observed_at) > now() + timedelta(minutes=5):
            raise DomainError("VALIDATION_ERROR", 422)

    async def link_source(self, patient: str, observation_id: str, ref: dict) -> None:
        await self.store.add(
            "observation_sources",
            observation_id=observation_id,
            source_id=ref["source_id"],
            patient_id=patient,
            source_revision=ref["source_revision"],
        )

    async def create(self, patient: str, body: dict) -> dict:
        self.check_value(body["kind"], body["value"], body["observed_at"])
        if body["session_id"] is not None:
            await SessionService(self.store).owned(patient, body["session_id"])
        refs = {(r["source_id"], r["source_revision"]): r for r in body["sources"]}.values()
        for ref in refs:
            source = await self.store.get(
                "source_records",
                id=ref["source_id"],
                patient_id=patient,
                revision=ref["source_revision"],
            )
            # Only same-patient, currently available evidence may back a proposal.
            if not source or source["unavailable_at"] is not None:
                raise DomainError("VALIDATION_ERROR", 422)
        row = await self.store.add(
            "observations",
            id=uid(),
            patient_id=patient,
            session_id=body["session_id"],
            kind=body["kind"],
            value=body["value"],
            observed_at=body["observed_at"],
            state="proposed",
            version=1,
            supersedes_observation_id=None,
            confirmed_at=None,
            created_at=stamp(),
        )
        for ref in refs:
            await self.link_source(patient, row["id"], ref)
        return await self.view(await self.owned(patient, row["id"]))

    async def confirm(self, patient: str, observation_id: str, body: dict) -> dict:
        row = await self.owned(patient, observation_id, lock=True)
        if row["version"] != body["expected_version"]:
            raise DomainError("VERSION_CONFLICT")
        if row["state"] != "proposed":
            raise DomainError("INVALID_TRANSITION")
        changes: dict = {"version": row["version"] + 1}
        if body["decision"] == "confirm":
            value = body.get("value", float(row["value"]))
            observed_at = body.get("observed_at", row["observed_at"])
            self.check_value(row["kind"], value, observed_at)
            confirmed = stamp()
            changes.update(
                state="confirmed", value=value, observed_at=observed_at, confirmed_at=confirmed
            )
            # The patient's explicit confirmation is itself the structured evidence.
            source = uid()
            await self.store.add(
                "source_records",
                id=source,
                patient_id=patient,
                kind="structured_input",
                session_id=row["session_id"],
                revision=1,
                occurred_at=confirmed,
                unavailable_at=None,
                created_at=confirmed,
            )
            await self.link_source(
                patient, observation_id, {"source_id": source, "source_revision": 1}
            )
        else:
            changes.update(state="rejected")
        if body["decision"] == "confirm":
            # An update: the patient's newer answer for the same day replaces the earlier one,
            # so each day keeps one current value per kind (the earlier row stays as history).
            earlier = await self.same_day_confirmed(patient, row["kind"], changes["observed_at"])
            if earlier:
                changes["supersedes_observation_id"] = earlier[-1]["id"]
            for old in earlier:
                await self.store.update(
                    "observations",
                    {"id": old["id"], "patient_id": patient, "state": "confirmed"},
                    {"state": "superseded", "version": old["version"] + 1},
                )
        await self.store.update(
            "observations",
            {"id": observation_id, "patient_id": patient, "version": row["version"]},
            changes,
        )
        return await self.view(await self.owned(patient, observation_id))

    async def same_day_confirmed(self, patient: str, kind: str, observed_at: str) -> list[dict]:
        """Confirmed values of `kind` on the same local day as `observed_at`, oldest first."""
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

        profile = await self.store.get("patient_profiles", patient_id=patient)
        try:
            zone = ZoneInfo(profile["timezone"])
        except (ZoneInfoNotFoundError, TypeError, KeyError):
            zone = ZoneInfo("UTC")
        day = utc(observed_at).astimezone(zone).date()
        rows = [
            r
            for r in await self.store.all(
                "observations", patient_id=patient, kind=kind, state="confirmed"
            )
            if utc(r["observed_at"]).astimezone(zone).date() == day
        ]
        return sorted(rows, key=lambda r: (r["observed_at"], r["id"]))


class AlertService:
    def __init__(self, store: RecordStore):
        self.store = store
        self.care = CareService(store)

    async def view(self, row: dict) -> dict:
        sources = []
        for source_id in row["source_ids"]:
            source = await self.store.get(
                "source_records", id=source_id, patient_id=row["patient_id"]
            )
            if source and source["unavailable_at"] is None:
                sources.append({"source_id": source_id, "source_revision": source["revision"]})
        return {
            "alert_id": row["id"],
            **{k: row[k] for k in ["patient_id", "rule_key", "state", "version", "created_at"]},
            "sources": sources,
        }

    async def owned(self, patient: str, alert_id: str) -> dict:
        row = await self.store.get("alerts", id=alert_id, patient_id=patient)
        if not row:
            raise DomainError("RESOURCE_NOT_FOUND", 404)
        return row

    async def deliver(self, patient: str, alert_id: str) -> None:
        """Add a visible recipient for every active link holding an active alerts grant."""
        for link in await self.store.all("care_links", patient_id=patient, state="active"):
            grants = [
                g
                for g in await self.store.all(
                    "consent_grants", patient_id=patient, care_link_id=link["id"], scope="alerts"
                )
                if self.care.active_grant(g)
            ]
            if not grants or await self.store.get(
                "alert_recipients", alert_id=alert_id, care_link_id=link["id"]
            ):
                continue
            await self.store.add(
                "alert_recipients",
                alert_id=alert_id,
                patient_id=patient,
                care_link_id=link["id"],
                consent_grant_id=grants[0]["id"],
                delivery_state="visible",
                acknowledged_at=None,
            )

    async def request(self, patient: str, body: dict) -> dict:
        if body["session_id"] is not None:
            await SessionService(self.store).owned(patient, body["session_id"])
        # One open request at a time; repeating it re-checks delivery instead of duplicating.
        existing = await self.store.get(
            "alerts", patient_id=patient, rule_key=REVIEW_RULE, state="open"
        )
        if existing:
            await self.deliver(patient, existing["id"])
            return await self.view(existing)
        at, source, alert_id = stamp(), uid(), uid()
        await self.store.add(
            "source_records",
            id=source,
            patient_id=patient,
            kind="structured_input",
            session_id=body["session_id"],
            revision=1,
            occurred_at=at,
            unavailable_at=None,
            created_at=at,
        )
        row = await self.store.add(
            "alerts",
            id=alert_id,
            patient_id=patient,
            session_id=body["session_id"],
            rule_key=REVIEW_RULE,
            rule_version=1,
            dedup_key=alert_id,
            state="open",
            version=1,
            source_ids=[source],
            created_at=at,
        )
        await self.deliver(patient, alert_id)
        await self.care.audit(patient, patient, "review_requested", "alert", alert_id)
        return await self.view(row)

    async def share_questionnaire(self, patient: str, source_id: str, session_id) -> bool:
        """Send a questionnaire to every connected doctor; the patient agreed before starting."""
        links = await self.store.all("care_links", patient_id=patient, state="active")
        if not links:
            return False
        alert_id = uid()
        row = await self.store.add(
            "alerts",
            id=alert_id,
            patient_id=patient,
            session_id=session_id,
            rule_key=SAFETY_RULE,
            rule_version=1,
            dedup_key=source_id,
            state="open",
            version=1,
            source_ids=[source_id],
            created_at=stamp(),
        )
        for link in links:
            grant = next(
                (
                    g
                    for g in await self.store.all(
                        "consent_grants",
                        patient_id=patient,
                        care_link_id=link["id"],
                        scope="alerts",
                    )
                    if self.care.active_grant(g)
                ),
                None,
            )
            await self.store.add(
                "alert_recipients",
                alert_id=alert_id,
                patient_id=patient,
                care_link_id=link["id"],
                consent_grant_id=grant["id"] if grant else None,
                delivery_state="visible",
                acknowledged_at=None,
            )
        await self.care.audit(patient, patient, "questionnaire_shared", "alert", row["id"])
        return True

    async def visible(self, clinician: str, patient: str) -> tuple[dict, list[dict]]:
        """Alerts this doctor may see: check-in requests need an alerts grant; questionnaires
        sent after a positive Q9 need only the active connection the patient agreed to."""
        await self.care.clinician(clinician)
        profile = await self.store.get("patient_profiles", patient_id=patient)
        user = await self.store.get("users", id=patient)
        link = await self.store.get(
            "care_links", patient_id=patient, clinician_id=clinician, state="active"
        )
        if not profile or not user or user["disabled_at"] or not link:
            raise DomainError("CONSENT_REQUIRED", 403)
        grant = next(
            (
                g
                for g in await self.store.all(
                    "consent_grants", patient_id=patient, care_link_id=link["id"], scope="alerts"
                )
                if self.care.active_grant(g)
            ),
            None,
        )
        rows = []
        for row in await self.store.all("alerts", patient_id=patient):
            recipient = await self.store.get(
                "alert_recipients", alert_id=row["id"], care_link_id=link["id"]
            )
            if not recipient or recipient["delivery_state"] != "visible":
                continue
            if (
                row["rule_key"] == SAFETY_RULE
                or grant
                and (
                    grant["data_from"] is None or utc(row["created_at"]) >= utc(grant["data_from"])
                )
            ):
                rows.append(row)
        if grant is None and not rows:
            raise DomainError("CONSENT_REQUIRED", 403)
        return link, rows

    async def doctor_update(self, clinician: str, patient: str, alert_id: str, body: dict) -> dict:
        link, rows = await self.visible(clinician, patient)
        if alert_id not in {r["id"] for r in rows}:
            raise DomainError("RESOURCE_NOT_FOUND", 404)
        row = await self.store.get_locked("alerts", id=alert_id, patient_id=patient)
        if row["version"] != body["expected_version"]:
            raise DomainError("VERSION_CONFLICT")
        allowed = {"open": {"acknowledged", "resolved"}, "acknowledged": {"resolved"}}
        if body["state"] not in allowed.get(row["state"], set()):
            raise DomainError("INVALID_TRANSITION")
        await self.store.update(
            "alerts",
            {"id": alert_id, "patient_id": patient, "version": row["version"]},
            {"state": body["state"], "version": row["version"] + 1},
        )
        recipient = await self.store.get(
            "alert_recipients", alert_id=alert_id, care_link_id=link["id"]
        )
        if recipient["acknowledged_at"] is None:
            await self.store.update(
                "alert_recipients",
                {"alert_id": alert_id, "care_link_id": link["id"]},
                {"acknowledged_at": stamp()},
            )
        await self.care.audit(clinician, patient, "alert_" + body["state"], "alert", alert_id)
        row.update(state=body["state"], version=row["version"] + 1)
        return await self.view(row)
