"""Deterministic check-in state, activity tailoring and clinician attention rules.

Everything here is a transparent rule over values the patient explicitly confirmed. Nothing is
inferred from voice tone, camera or any automatic measurement, and nothing here is a diagnosis.
The thresholds are demo assumptions that a clinical team must review before real use.
"""

from datetime import UTC, datetime, timedelta
from statistics import mean
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from .domain import RecordStore, now

CHECKIN_FIELDS = ["mood", "energy", "sleep_hours"]

BREATHING = "22222222-2222-4222-8222-222222222222"
ACOUSTIC = "22222222-2222-4222-8222-222222222223"
GROUNDING = "22222222-2222-4222-8222-222222222224"
WALK = "22222222-2222-4222-8222-222222222226"
WARM_CUP = "22222222-2222-4222-8222-222222222227"
DAYLIGHT = "22222222-2222-4222-8222-222222222228"
RELEASE = "22222222-2222-4222-8222-222222222229"
WATER = "22222222-2222-4222-8222-22222222222a"
STRETCH = "22222222-2222-4222-8222-22222222222b"
SONG = "22222222-2222-4222-8222-22222222222c"
MESSAGE = "22222222-2222-4222-8222-22222222222d"
TIDY = "22222222-2222-4222-8222-22222222222e"


def _step(activity_id, slug, kind, title, description, seconds, steps, renderer="step_v1"):
    return {
        "id": activity_id,
        "slug": slug,
        "version": 1,
        "kind": kind,
        "title": title,
        "description": description,
        "duration_seconds": seconds,
        "config": {
            "renderer": renderer,
            "asset_id": "grounding-chime-v1",
            "instructions": steps,
            "inhale_seconds": None,
            "exhale_seconds": None,
        },
        "active": True,
    }


# Small everyday calming steps. Appended to the seeded catalog.
SMALL_ACTIVITIES = [
    _step(
        WATER,
        "glass-of-water",
        "behavioral_activation",
        "Pour a Glass of Water",
        "One minute to pour a glass of water and drink it slowly.",
        60,
        [
            "Pour a glass of water.",
            "Take a few slow sips and notice the temperature.",
            "Set the glass down and take one easy breath.",
        ],
    ),
    _step(
        STRETCH,
        "gentle-stretch",
        "behavioral_activation",
        "Two-Minute Gentle Stretch",
        "Loosen your neck, shoulders and back, seated or standing.",
        120,
        [
            "Reach both arms up, then let them float down.",
            "Tilt your head gently to each side.",
            "Roll your shoulders and let your back lengthen.",
        ],
    ),
    _step(
        SONG,
        "favourite-song",
        "reflection",
        "Listen to One Favourite Song",
        "Put on one song you like and do nothing else for three minutes.",
        180,
        [
            "Choose a song that feels kind to you today.",
            "Let it play. There is nothing you need to do.",
            "Notice one part of the song you enjoy.",
        ],
        "reflection_v1",
    ),
    _step(
        MESSAGE,
        "message-someone",
        "social_reconnection",
        "Send One Short Message",
        "A quick hello to someone you trust. A single line is enough.",
        120,
        [
            "Think of one person who feels safe to contact.",
            "Write one short line, such as 'thinking of you'.",
            "Send it, or save it for later. Either counts.",
        ],
        "social_v1",
    ),
    _step(
        TIDY,
        "tidy-one-thing",
        "behavioral_activation",
        "Tidy One Small Thing",
        "Put away one item or clear one small surface. Just one.",
        120,
        [
            "Pick one small thing within reach.",
            "Put it where it belongs.",
            "Look at the cleared spot for a moment. That is done.",
        ],
    ),
]

# Plain-language reason shown with each suggestion (see docs/ACTIVITY_RATIONALE.md for sources).
RATIONALE = {
    BREATHING: "Slow, even breathing is linked to a calmer heart rhythm and a lower stress response.",
    ACOUSTIC: "A steady listening pause that asks nothing of you. 40 Hz sound is early-stage research, offered here for calm rather than as treatment.",
    GROUNDING: "Noticing what you can see, hear and feel anchors attention in the present, which can interrupt looping thoughts.",
    WALK: "Short walks count. Physical activity is one of the best-supported self-help steps for low mood.",
    WARM_CUP: "Finishing a small, pleasant routine can gently rebuild a sense of reward when motivation is low.",
    DAYLIGHT: "Daylight is the main signal that sets the body clock, and is linked to steadier sleep and mood.",
    RELEASE: "Releasing muscle tension, as in progressive muscle relaxation, is associated with lower physical stress.",
    WATER: "A tiny act of self-care that is easy to finish. Small completed steps make the next one easier.",
    STRETCH: "Gentle movement eases stiffness and can give a brief lift in energy.",
    SONG: "Listening to music you like is associated with short-term mood lift and lower stress.",
    MESSAGE: "Brief, low-pressure contact with someone you trust counters the urge to withdraw when mood dips.",
    TIDY: "Completing one visible task gives a small sense of control, a core idea in behavioural activation.",
}
KIND_RATIONALE = {
    "breathing": RATIONALE[BREATHING],
    "nature": "A low-effort sensory pause; no reading or typing needed.",
    "social_reconnection": "Warm, low-pressure connection gently counters withdrawal.",
    "behavioral_activation": RATIONALE[TIDY],
    "reflection": "A quiet moment to notice one gentle thought.",
}

# Lowest-effort first: used when the patient reports little energy.
LOW_EFFORT = [BREATHING, WATER, WARM_CUP, RELEASE, SONG, GROUNDING]
ACTIVATING = [WALK, MESSAGE, SONG, DAYLIGHT, TIDY]
AFTER_SHORT_SLEEP = [DAYLIGHT, BREATHING, STRETCH, WATER]


def _utc(value: str) -> datetime:
    d = datetime.fromisoformat(value)
    return d.replace(tzinfo=UTC) if d.tzinfo is None else d


def _zone(name: str | None):
    try:
        return ZoneInfo(name or "UTC")
    except ZoneInfoNotFoundError:
        return UTC


async def todays_checkin(store: RecordStore, patient: str) -> dict[str, float]:
    """Latest confirmed value per kind observed on the patient's current local day."""
    profile = await store.get("patient_profiles", patient_id=patient)
    zone = _zone(profile["timezone"] if profile else None)
    today = now().astimezone(zone).date()
    latest: dict[str, tuple[datetime, float]] = {}
    for row in await store.all("observations", patient_id=patient, state="confirmed"):
        at = _utc(row["observed_at"])
        if at.astimezone(zone).date() != today:
            continue
        if row["kind"] not in latest or latest[row["kind"]][0] < at:
            latest[row["kind"]] = (at, float(row["value"]))
    return {kind: value for kind, (_, value) in latest.items()}


async def missing_checkin_fields(store: RecordStore, patient: str) -> list[str]:
    done = await todays_checkin(store, patient)
    return [field for field in CHECKIN_FIELDS if field not in done]


def tailor(activities: list[dict], state: dict[str, float]) -> list[tuple[dict, str]]:
    """Order catalog activities for today's confirmed check-in and attach a reason to each.

    With no check-in the catalog order is unchanged. Each matching rule moves its activities
    forward; later rules win, so the patient's energy decides between otherwise equal options.
    """
    order = {a["activity_id"]: float(i) for i, a in enumerate(activities)}
    lead = {}
    rules = [
        (
            state.get("mood") is not None and state["mood"] <= 4,
            ACTIVATING,
            "Since your mood is on the lower side today: ",
        ),
        (
            state.get("sleep_hours") is not None and state["sleep_hours"] < 6,
            AFTER_SHORT_SLEEP,
            "After a short night: ",
        ),
        (
            state.get("energy") is not None and state["energy"] <= 3,
            LOW_EFFORT,
            "Since your energy is low right now, this asks very little: ",
        ),
    ]
    for step, (applies, preferred, prefix) in enumerate(rules, 1):
        if not applies:
            continue
        for position, activity_id in enumerate(preferred):
            if activity_id in order:
                order[activity_id] = -100.0 * step + position
                lead[activity_id] = prefix
    ranked = sorted(activities, key=lambda a: order[a["activity_id"]])
    result = []
    for activity in ranked:
        base = RATIONALE.get(activity["activity_id"]) or KIND_RATIONALE.get(
            activity["kind"], "An optional gentle pause."
        )
        result.append((activity, (lead.get(activity["activity_id"], "") + base)[:300]))
    return result


def streak(sessions: list[dict], timezone_name: str | None) -> tuple[int, bool]:
    """(consecutive local days with a completed activity, whether today already counts)."""
    zone = _zone(timezone_name)
    days = {
        _utc(s["ended_at"] or s["started_at"]).astimezone(zone).date()
        for s in sessions
        if s.get("state") == "completed" and (s.get("ended_at") or s.get("started_at"))
    }
    today = now().astimezone(zone).date()
    cursor = today if today in days else today - timedelta(days=1)
    count = 0
    while cursor in days:
        count += 1
        cursor -= timedelta(days=1)
    return count, today in days


def attention(
    observations: list[dict] | None,
    open_request: bool,
    assessments: list[dict] | None = None,
    safety_shared: bool = False,
) -> dict:
    """Reasons a clinician may want to look at this patient first.

    `observations` are confirmed rows the clinician is currently permitted to read, or None when
    reports are not shared (then only an explicit patient request can raise attention).
    """
    reasons = []
    # Questionnaire results (scored views), most important first.
    recent_results = sorted(
        (
            a
            for a in assessments or []
            if a.get("result") and _utc(a["observed_at"]) >= now() - timedelta(days=30)
        ),
        key=lambda a: a["observed_at"],
        reverse=True,
    )
    if safety_shared:
        reasons.append("Self-harm question answered above 0 · all answers sent to you")
    elif any(a["result"]["safety"]["item_positive"] for a in recent_results):
        reasons.append("Self-harm question answered above 0 in a recent questionnaire")
    latest_by_instrument = {}
    for a in recent_results:
        latest_by_instrument.setdefault(a["result"]["instrument"], a["result"])
    phq = latest_by_instrument.get("phq9")
    if phq and phq["total"] >= 10:
        reasons.append(f"PHQ-9 {phq['total']}/27: {phq['severity'].lower()}")
    extended = latest_by_instrument.get("bdi_themes")
    if extended and extended["level"] in ("moderate", "high"):
        reasons.append(
            f"Extended questions {extended['total']}/63: {extended['severity'].lower()} (indicative)"
        )
    if open_request:
        reasons.append("Patient asked for a check-in")
    rows = sorted(observations or [], key=lambda r: r["observed_at"])
    cutoff = now() - timedelta(days=7)
    recent = [r for r in rows if _utc(r["observed_at"]) >= cutoff]
    latest = {r["kind"]: float(r["value"]) for r in recent}
    if latest.get("mood", 10) <= 3:
        reasons.append(f"Low mood reported ({latest['mood']:g}/10)")
    if latest.get("energy", 10) <= 3:
        reasons.append(f"Low energy reported ({latest['energy']:g}/10)")
    if latest.get("sleep_hours", 24) < 5:
        reasons.append(f"Short sleep reported ({latest['sleep_hours']:g} h)")
    moods = [float(r["value"]) for r in rows if r["kind"] == "mood"]
    if len(moods) >= 3 and "mood" in latest and mean(moods[:-1]) - moods[-1] >= 3:
        reasons.append("Mood dropped sharply from earlier check-ins")
    if rows and not recent:
        days = (now() - _utc(rows[-1]["observed_at"])).days
        if days <= 21:
            reasons.append(f"No check-in for {days} days")
    return {"flagged": bool(reasons), "reasons": reasons[:6]}
