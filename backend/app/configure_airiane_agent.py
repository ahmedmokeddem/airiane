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
"""


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    settings = Settings()
    definition = json.loads(
        (Path(__file__).resolve().parents[2] / "contracts/client_ui_tools.json").read_text()
    )["tools"][0]
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
                        "tool": definition["name"],
                        "preserves_existing_tools": True,
                        "privacy_settings_change": False,
                        "apply_flag_required": True,
                    }
                )
            )
            return
        all_tools = await client.get("https://api.elevenlabs.io/v1/convai/tools")
        all_tools.raise_for_status()
        existing = next(
            (
                t
                for t in all_tools.json().get("tools", [])
                if t.get("tool_config", {}).get("name") == definition["name"]
            ),
            None,
        )
        if existing:
            tool_id = existing["id"]
        else:
            parameters = definition["parameters"]
            properties = {
                k: {
                    "type": v["type"],
                    "description": v.get(
                        "description",
                        f"{k}; match the patient-reported draft, text <=500 characters.",
                    ),
                    **({"enum": v["enum"]} if "enum" in v else {}),
                }
                for k, v in parameters["properties"].items()
            }
            tool = {
                "type": "client",
                "name": definition["name"],
                "description": definition["description"],
                "expects_response": True,
                "parameters": {
                    "type": "object",
                    "required": parameters["required"],
                    "properties": properties,
                },
            }
            created = await client.post(
                "https://api.elevenlabs.io/v1/convai/tools", json={"tool_config": tool}
            )
            created.raise_for_status()
            tool_id = created.json()["id"]
        old = prompt["prompt"]
        marker = "AIRIANE BRAND AND PATIENT-REVIEWED NOTES"
        base = old.split(marker)[0].rstrip()
        base = base.replace("You are RE,", "You are AIriane,")
        ids = list(dict.fromkeys([*prompt.get("tool_ids", []), tool_id]))
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
                    "client_tool": definition["name"],
                    "expects_response": True,
                    "existing_tools_retained": set(prompt.get("tool_ids", [])).issubset(ids),
                    "privacy_settings_unchanged": True,
                    "patient_confirmation_is_UI_only": True,
                }
            )
        )


if __name__ == "__main__":
    asyncio.run(main())
