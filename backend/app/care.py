"""Patient sharing decisions and current clinician authorization, within the existing app."""

from uuid import uuid4

from .domain import DomainError, RecordStore, now, stamp
from .services import utc


async def current_user(store: RecordStore, subject: str) -> dict:
    user = await store.get("users", auth_subject=subject)
    if not user or user["disabled_at"]:
        raise DomainError("RESOURCE_NOT_FOUND", 404)
    return user


class CareService:
    def __init__(self, store: RecordStore):
        self.store = store

    async def audit(self, actor: str, patient: str, action: str, kind: str, resource: str):
        await self.store.add(
            "audit_events",
            id=str(uuid4()),
            actor_id=actor,
            patient_id=patient,
            action=action,
            resource_type=kind,
            resource_id=resource,
            request_id=str(uuid4()),
            created_at=stamp(),
        )

    async def clinician(self, actor: str) -> dict:
        user = await self.store.get("users", id=actor)
        profile = await self.store.get("clinician_profiles", clinician_id=actor)
        if (
            not user
            or user["disabled_at"]
            or user["role"] != "clinician"
            or not profile
            or not profile["verified_at"]
        ):
            raise DomainError("ROLE_REQUIRED", 403)
        return profile

    async def link(self, actor: str, link_id: str, lock: bool = False) -> dict:
        row = await (
            self.store.get_locked("care_links", id=link_id)
            if lock
            else self.store.get("care_links", id=link_id)
        )
        if not row or actor not in [row["patient_id"], row["clinician_id"]]:
            raise DomainError("RESOURCE_NOT_FOUND", 404)
        return row

    @staticmethod
    def link_view(row: dict) -> dict:
        return {
            "care_link_id": row["id"],
            **{k: row[k] for k in ["patient_id", "clinician_id", "state", "created_at"]},
        }

    @staticmethod
    def consent_view(row: dict) -> dict:
        return {
            "consent_grant_id": row["id"],
            **{
                k: row[k]
                for k in ["scope", "care_link_id", "expires_at", "data_from", "revoked_at"]
            },
        }

    async def invite(self, patient: str, body: dict) -> dict:
        await self.clinician(body["clinician_id"])
        row = await self.store.get(
            "care_links", patient_id=patient, clinician_id=body["clinician_id"]
        )
        if row and row["state"] == "revoked":
            await self.store.update(
                "care_links", {"id": row["id"], "state": "revoked"}, {"state": "pending"}
            )
            row["state"] = "pending"
        elif not row:
            row = await self.store.add(
                "care_links",
                id=str(uuid4()),
                patient_id=patient,
                clinician_id=body["clinician_id"],
                state="pending",
                created_at=stamp(),
            )
        await self.audit(patient, patient, "care_link_invited", "care_link", row["id"])
        return self.link_view(row)

    async def update_link(self, actor: str, link_id: str, action: str) -> dict:
        row = await self.link(actor, link_id, lock=True)
        target = "active" if action == "accept" else "revoked"
        if action == "accept":
            await self.clinician(actor)
            if actor != row["clinician_id"] or row["state"] != "pending":
                raise DomainError("INVALID_TRANSITION")
        if row["state"] != target:
            await self.store.update(
                "care_links", {"id": link_id, "state": row["state"]}, {"state": target}
            )
            if target == "revoked":
                for grant in await self.store.all(
                    "consent_grants", care_link_id=link_id, patient_id=row["patient_id"]
                ):
                    if grant["revoked_at"] is None:
                        await self.store.update(
                            "consent_grants",
                            {"id": grant["id"], "revoked_at": None},
                            {"revoked_at": stamp()},
                        )
            row["state"] = target
        await self.audit(actor, row["patient_id"], "care_link_" + action, "care_link", link_id)
        return self.link_view(row)

    async def grant(self, patient: str, body: dict) -> dict:
        if utc(body["expires_at"]) <= now():
            raise DomainError("VALIDATION_ERROR", 422)
        if body["scope"] == "transcripts":
            # History capture is not part of this rollout; do not grant a nonfunctional promise.
            raise DomainError("INVALID_TRANSITION")
        row = await self.link(patient, body["care_link_id"], lock=True)
        if row["patient_id"] != patient or row["state"] != "active":
            raise DomainError("CONSENT_REQUIRED", 403)
        await self.clinician(row["clinician_id"])
        if body["data_from"] and utc(body["data_from"]) > now():
            raise DomainError("VALIDATION_ERROR", 422)
        for prior in await self.store.all(
            "consent_grants", patient_id=patient, care_link_id=row["id"], scope=body["scope"]
        ):
            if prior["revoked_at"] is None:
                await self.store.update(
                    "consent_grants",
                    {"id": prior["id"], "revoked_at": None},
                    {"revoked_at": stamp()},
                )
        grant = await self.store.add(
            "consent_grants",
            id=str(uuid4()),
            patient_id=patient,
            **body,
            revoked_at=None,
            created_at=stamp(),
        )
        await self.audit(patient, patient, "consent_granted", "consent", grant["id"])
        return self.consent_view(grant)

    async def revoke(self, patient: str, grant_id: str):
        row = await self.store.get("consent_grants", id=grant_id, patient_id=patient)
        if not row:
            raise DomainError("RESOURCE_NOT_FOUND", 404)
        if row["revoked_at"] is None:
            await self.store.update(
                "consent_grants",
                {"id": grant_id, "patient_id": patient, "revoked_at": None},
                {"revoked_at": stamp()},
            )
        await self.audit(patient, patient, "consent_revoked", "consent", grant_id)

    @staticmethod
    def active_grant(grant: dict) -> bool:
        return grant["revoked_at"] is None and utc(grant["expires_at"]) > now()

    async def authorize_report(self, clinician: str, patient: str, start: str | None = None):
        return await self.authorize_scope(clinician, patient, "reports", start)

    async def authorize_scope(
        self, clinician: str, patient: str, scope: str, start: str | None = None
    ):
        await self.clinician(clinician)
        profile = await self.store.get("patient_profiles", patient_id=patient)
        user = await self.store.get("users", id=patient)
        if not profile or not user or user["disabled_at"]:
            raise DomainError("RESOURCE_NOT_FOUND", 404)
        links = await self.store.all(
            "care_links", patient_id=patient, clinician_id=clinician, state="active"
        )
        for link in links:
            grants = await self.store.all(
                "consent_grants", patient_id=patient, care_link_id=link["id"], scope=scope
            )
            for grant in grants:
                if self.active_grant(grant) and (
                    start is None
                    or grant["data_from"] is None
                    or utc(grant["data_from"]) <= utc(start)
                ):
                    return link, grant
        raise DomainError("CONSENT_REQUIRED", 403)
