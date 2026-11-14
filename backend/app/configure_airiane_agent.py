"""Apply the reviewed AIriane client-UI tool and brand copy; preserve provider privacy settings.

Usage: uv run --directory backend python -m app.configure_airiane_agent --apply
Default is a read-only plan. Never outputs keys, tokens, or patient content.
"""

import argparse
import asyncio
import json
from pathlib import Path

import httpx

from .config import Settings

ADDITION = """
AIRIANE BRAND AND PATIENT-REVIEWED NOTES
Your patient-facing name is AIriane. Do not introduce yourself as RE.
When the patient wants to keep a useful note about something they explicitly said,
you may call propose_conversation_insight to show a short neutral draft for review.
Only propose facts grounded in that patient's current statement. Never infer a
medical diagnosis, suicidality score, treatment outcome, or TMS effectiveness.
Ask before offering to keep a note. Use direct_statement for an explicitly reported
experience; label your paraphrased interpretation as patient_approved_interpretation.
Use only a reporting timestamp supplied by the application/session context or the
patient; ask if uncertain. Never invent a date, evidence reference, or observation.
The tool result awaiting_patient_review means NOT SAVED and NOT CONFIRMED.
Tell the patient they can edit, confirm or reject the note on screen. Only the
patient's explicit UI action saves it. Do not call any confirmation, correction,
deletion, consent, or memory-write tool. There are no such model tools.
If an activity is already active, help the patient resume rather than start another.
Never promise clinician delivery, monitoring, or emergency intervention.
Never claim visual access. Camera is strictly local preview only.
DAILY CHECK-IN
Read guided_question in your context. If missing_fields is not empty, begin the conversation by
warmly inviting the patient to a short check-in, then ask ONLY the missing questions, one at a
time, in a caring and unhurried way:
- mood: "How is your mood today, from zero to ten?"
- energy: "How is your energy right now, from zero to ten?"
- sleep_hours: "Roughly how many hours did you sleep last night?"
After each answer call propose_observation with kind, the numeric value and observed_at (now).
The app then shows a card; the value only counts when the patient confirms it there. Say what you
heard and ask them to confirm on screen. If they decline or the tool reports a rejection, ask
again gently or move on. Never record a value the patient did not state as a number, and never
estimate mood, energy or sleep from their tone of voice. If they would rather not answer, accept
that and continue.
UPDATING CHECK-IN ANSWERS
Keep listening for the rest of the conversation. If the patient gives a new number for mood,
energy or sleep (for example "actually my mood is more like a 6 now" or "I slept 8 hours, not 5"),
call propose_observation with the new value. The app asks them to confirm, and the confirmed value
replaces today's earlier one. Only propose numbers the patient actually said.
FULL ASSESSMENT
If the patient asks for a fuller check, a questionnaire or an assessment, offer the PHQ-9 (about
3 minutes) or the longer extended questions (about 8 minutes) and remind them they can stop at any
time. If the screen shows that a doctor is connected, say before the first question that answering
question 9 with anything other than "Not at all" sends all their answers to that doctor so they
can follow up. The app shows each question with its answer options; read the question and options aloud,
calmly. When the patient answers in words, call propose_assessment_answer with the matching option
value, repeat the option back and ask "Is that right?". Only when they clearly say yes, call
confirm_assessment_answer with the same question_id and value to record it (they can also tap it).
If they say no, ask again. Never confirm an answer the patient did not confirm. If the patient
wants to do the daily check-in in the middle, the app pauses the questionnaire; offer to continue
it afterwards. Never pick an answer they did not give and
never comment on scores, totals or what the answers might mean. If the patient indicates thoughts
of death or self-harm, respond with warmth, take it seriously, encourage them to use the support
shown on screen, and never promise that anyone is monitoring the conversation.
ACTIVITY SUGGESTIONS
When the check-in is complete, or whenever the patient wants help, call
present_activity_recommendations. The app orders the options from the patient's confirmed
check-in and returns a short reason for each. Offer the first option, give its returned reason in
one plain sentence, and let the patient choose. Do not invent other reasons, promise treatment
effects or describe an activity as therapy.
"""


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    settings = Settings()
    ui_tools = json.loads(
        (Path(__file__).resolve().parents[2] / "contracts/client_ui_tools.json").read_text(
            encoding="utf-8"
        )
    )["tools"]
    async with httpx.AsyncClient(
        timeout=30, headers={"xi-api-key": settings.elevenlabs_api_key}
    ) as client:
        url = f"https://api.elevenlabs.io/v1/convai/agents/{settings.elevenlabs_agent_id}"
        response = await client.get(url)
        response.raise_for_status()
        before = response.json()
        prompt = before["conversation_config"]["agent"]["prompt"]
        if not args.apply:
            print(
                json.dumps(
                    {
                        "action": "add transient client review tool and AIriane brand copy",
                        "tools": [t["name"] for t in ui_tools],
                        "preserves_existing_tools": True,
                        "privacy_settings_change": False,
                        "apply_flag_required": True,
                    }
                )
            )
            return
        all_tools = await client.get("https://api.elevenlabs.io/v1/convai/tools")
        all_tools.raise_for_status()
        registered = all_tools.json().get("tools", [])

        async def ensure_tool(spec: dict) -> str:
            """Return the id of the client tool named in `spec`, creating it when missing."""
            existing = next(
                (t for t in registered if t.get("tool_config", {}).get("name") == spec["name"]),
                None,
            )
            if existing:
                return existing["id"]
            parameters = spec["parameters"]
            properties = {
                k: {
                    "type": v["type"],
                    "description": v.get("description", f"{k} as reported by the patient."),
                    **({"enum": v["enum"]} if "enum" in v else {}),
                }
                for k, v in parameters["properties"].items()
            }
            created = await client.post(
                "https://api.elevenlabs.io/v1/convai/tools",
                json={
                    "tool_config": {
                        "type": "client",
                        "name": spec["name"],
                        "description": spec["description"],
                        "expects_response": True,
                        "parameters": {
                            "type": "object",
                            "required": parameters["required"],
                            "properties": properties,
                        },
                    }
                },
            )
            created.raise_for_status()
            return created.json()["id"]

        ui_ids = [await ensure_tool(t) for t in ui_tools]
        # Daily check-in and review request: the app shows a confirmation card for each answer.
        contract_tools = json.loads(
            (Path(__file__).resolve().parents[2] / "contracts/tool_contracts.json").read_text(
                encoding="utf-8"
            )
        )["tools"]
        extra_ids = [
            await ensure_tool(t)
            for t in contract_tools
            if t["name"] in ("propose_observation", "request_clinician_review")
        ]
        old = prompt["prompt"]
        marker = "AIRIANE BRAND AND PATIENT-REVIEWED NOTES"
        base = old.split(marker)[0].rstrip()
        base = base.replace("You are RE,", "You are AIriane,")
        ids = list(dict.fromkeys([*prompt.get("tool_ids", []), *ui_ids, *extra_ids]))
        update = {
            "conversation_config": {
                "agent": {
                    "first_message": "Hi, I’m AIriane. We can talk for a moment or find a small activity to help you unwind. What would feel helpful right now?",
                    "prompt": {"prompt": base + "\n\n" + ADDITION.strip(), "tool_ids": ids},
                }
            }
        }
        saved = await client.patch(url, json=update)
        saved.raise_for_status()
        verified = await client.get(url)
        verified.raise_for_status()
        after = verified.json()
        if before.get("platform_settings", {}).get("privacy") != after.get(
            "platform_settings", {}
        ).get("privacy"):
            raise RuntimeError(
                "Unexpected privacy configuration difference; manual review required"
            )
        print(
            json.dumps(
                {
                    "agent_configured": True,
                    "client_tools": [t["name"] for t in ui_tools],
                    "expects_response": True,
                    "existing_tools_retained": set(prompt.get("tool_ids", [])).issubset(ids),
                    "privacy_settings_unchanged": True,
                    "patient_confirmation_is_UI_only": True,
                }
            )
        )


if __name__ == "__main__":
    asyncio.run(main())
