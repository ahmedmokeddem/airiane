"""Patient-scoped projections reuse the original recommendation and activity lifecycle."""

import hashlib
import json
from datetime import timedelta
from uuid import uuid4

from ..domain import DomainError, now, stamp
from ..services import ActivityService, SessionService
from .schema import Definition, Transition

KINDS = {
    "mini_game": "reflection",
    "creative_activity": "reflection",
    "guided_experience": "breathing",
    "interactive_reflection": "reflection",
    "practical_activity": "behavioral_activation",
}


def digest(value):
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


async def active_session(store, patient, sid):
    session = await SessionService(store).owned(patient, sid)
    if session["state"] != "active":
        raise DomainError("INVALID_TRANSITION")
    return session


async def publish(store, patient, sid, definition: Definition):
    aid, rid = str(uuid4()), str(uuid4())
    d = definition.model_dump()
    # The canonical Activity remains backward compatible; details use an owned endpoint.
    config = {
        "renderer": "generated_v1",
        "asset_id": None,
        "instructions": [definition.introduction],
        "inhale_seconds": None,
        "exhale_seconds": None,
        "generated_activity_id": aid,
        "generated_format": definition.format,
    }
    await store.add(
        "activity_catalog",
        id=aid,
        slug="generated-" + aid,
        version=1,
        kind=KINDS[definition.format],
        title=definition.title,
        description=definition.purpose,
        duration_seconds=definition.duration_seconds,
        config=config,
        active=False,
    )
    await store.add(
        "recommendations",
        id=rid,
        patient_id=patient,
        session_id=sid,
        expires_at=(now() + timedelta(minutes=30)).isoformat(),
        created_at=stamp(),
    )
    await store.add(
        "recommendation_items",
        recommendation_id=rid,
        patient_id=patient,
        activity_id=aid,
        activity_version=1,
        rank=1,
        reason="Created together · " + definition.purpose,
    )
    await store.add(
        "generated_activity_definitions",
        id=aid,
        patient_id=patient,
        session_id=sid,
        recommendation_id=rid,
        definition=d,
        state="proposed",
        created_at=stamp(),
    )
    return rid


async def definition_for(store, patient, aid):
    row = await store.get("generated_activity_definitions", id=aid, patient_id=patient)
    if not row:
        raise DomainError("RESOURCE_NOT_FOUND", 404)
    return row


async def progress_for(store, patient, aid):
    activity = await ActivityService(store).owned(patient, aid)
    definition = await definition_for(store, patient, activity["activity_id"])
    row = await store.get("generated_activity_progress", id=aid, patient_id=patient)
    if not row:
        raise DomainError("RESOURCE_NOT_FOUND", 404)
    return activity, definition, row


def progress_view(activity, definition, row):
    steps = definition["definition"]["components"]
    return {
        "activity_session_id": activity["id"],
        "revision": row["revision"],
        "step": row["step"],
        "current": steps[row["step"]] if row["step"] < len(steps) else None,
        "paused": row["paused"],
        "finished": row["step"] >= len(steps),
        "confirmed": row["confirmed"],
    }


async def transition(store, patient, aid, body: Transition, *, ui=True):
    activity, definition, row = await progress_for(store, patient, aid)
    if activity["state"] != "started":
        raise DomainError("INVALID_TRANSITION")
    signature = digest(body.model_dump())
    if row["last_hash"] == signature:
        return progress_view(activity, definition, row)
    if row["revision"] != body.expected_revision:
        raise DomainError("VERSION_CONFLICT")
    steps = definition["definition"]["components"]
    current = steps[row["step"]] if row["step"] < len(steps) else None
    if body.step_id != (current["id"] if current else "completion"):
        raise DomainError("STALE_ACTIVITY_STEP")
    if body.action == "confirm_completion":
        if not ui or current:
            raise DomainError("PATIENT_CONFIRMATION_REQUIRED")
        row["confirmed"] = True
    elif body.action in ("pause", "resume"):
        row["paused"] = body.action == "pause"
    else:
        if row["paused"] or current is None:
            raise DomainError("INVALID_TRANSITION")
        target = row["step"] + 1
        if body.action == "next":
            if body.choice_id is not None and not current["choices"]:
                raise DomainError("INVALID_CHOICE", 422)
            if body.sequence and current["type"] != "visual_pattern":
                raise DomainError("INVALID_CHOICE", 422)
            if current["type"] == "practical_step" and not ui:
                raise DomainError("PATIENT_CONFIRMATION_REQUIRED")
            if current["type"] == "visual_pattern" and body.sequence != current["sequence"]:
                raise DomainError("PATTERN_TRY_AGAIN")
            if current["choices"]:
                chosen = next((x for x in current["choices"] if x["id"] == body.choice_id), None)
                if not chosen:
                    raise DomainError("INVALID_CHOICE", 422)
                target = chosen["next_step"] if chosen["next_step"] is not None else target
        row["step"] = target
    row.update(revision=row["revision"] + 1, last_hash=signature, updated_at=stamp())
    await store.update(
        "generated_activity_progress",
        {"id": aid, "patient_id": patient, "revision": body.expected_revision},
        {k: row[k] for k in ("step", "revision", "paused", "confirmed", "last_hash", "updated_at")},
    )
    return progress_view(activity, definition, row)
