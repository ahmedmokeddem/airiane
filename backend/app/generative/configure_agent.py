"""Review/apply two optional tools to the SAME agent; never changes its prompt or privacy."""

import argparse
import asyncio
import copy
import json
from pathlib import Path

import httpx

from ..config import Settings

CONTRACT = Path(__file__).resolve().parents[3] / "contracts/generative_tools.json"


def provider_parameters(schema):
    """ElevenLabs uses its own parameter schema; strict validation stays application-owned."""
    value = copy.deepcopy(schema)
    value.pop("additionalProperties", None)
    if "properties" in value:
        value["properties"] = {
            k: provider_parameters(
                {
                    "description": f"{k}: exact value from the patient's request or current confirmed step.",
                    **v,
                }
            )
            for k, v in value["properties"].items()
        }
    if "items" in value:
        value["items"] = provider_parameters(
            {"description": "One supported shape token.", **value["items"]}
        )
    return value


def contains(actual, expected):
    return (
        all(k in actual and contains(actual[k], v) for k, v in expected.items())
        if isinstance(expected, dict) and isinstance(actual, dict)
        else actual == expected
    )


async def configure(apply: bool, profile: Path | None = None):
    s = Settings(_env_file=[Path(".env"), profile] if profile else Path(".env"))
    tools = json.loads(CONTRACT.read_text())["tools"]
    async with httpx.AsyncClient(
        base_url="https://api.elevenlabs.io/v1/convai/",
        headers={"xi-api-key": s.elevenlabs_api_key},
        timeout=20,
    ) as client:
        response = await client.get("agents/" + s.elevenlabs_agent_id)
        response.raise_for_status()
        before = response.json()
        if before.get("name") != "AIriane V2":
            raise ValueError("This command only extends the existing AIriane V2 agent")
        configuration = copy.deepcopy(before["conversation_config"])
        prompt = configuration["agent"]["prompt"]
        ids = list(prompt.get("tool_ids", []))
        existing = {}
        for tid in ids:
            response = await client.get("tools/" + tid)
            response.raise_for_status()
            existing[response.json()["tool_config"]["name"]] = response.json()["tool_config"]
        response = await client.get("tools")
        response.raise_for_status()
        workspace_tools = response.json().get("tools", [])
        for tool in tools:
            expected = {
                k: tool[k]
                for k in (
                    "type",
                    "name",
                    "description",
                    "parameters",
                    "expects_response",
                    "response_timeout_secs",
                )
            }
            expected["parameters"] = provider_parameters(expected["parameters"])
            if tool["name"] in existing:
                if not contains(existing[tool["name"]], expected):
                    raise ValueError("Existing generated tool differs; manual review required")
                continue
            reusable = [t for t in workspace_tools if contains(t.get("tool_config", {}), expected)]
            if reusable:
                ids.append(reusable[0]["id"])
                continue
            if apply:
                response = await client.post("tools", json={"tool_config": expected})
                if response.status_code == 422:
                    detail = response.json().get("detail", [])
                    if isinstance(detail, list):
                        print(
                            json.dumps(
                                {
                                    "tool": tool["name"],
                                    "validation": [
                                        {
                                            "loc": d.get("loc"),
                                            "type": d.get("type"),
                                            "message": d.get("msg"),
                                        }
                                        for d in detail
                                    ],
                                }
                            )
                        )
                response.raise_for_status()
                ids.append(response.json()["id"])
        if apply:
            # Only tool bindings change; existing personality, messages and SDK configuration remain.
            prompt["tool_ids"] = ids
            response = await client.patch(
                "agents/" + s.elevenlabs_agent_id,
                json={"conversation_config": {"agent": {"prompt": {"tool_ids": ids}}}},
            )
            response.raise_for_status()
            response = await client.get("agents/" + s.elevenlabs_agent_id)
            response.raise_for_status()
            after = response.json()
            restored = copy.deepcopy(after["conversation_config"])
            restored["agent"]["prompt"]["tool_ids"] = before["conversation_config"]["agent"][
                "prompt"
            ].get("tool_ids", [])
            original = copy.deepcopy(before["conversation_config"])
            # GET expands bound tool IDs into `tools`; this is derived response data.
            restored["agent"]["prompt"].pop("tools", None)
            original["agent"]["prompt"].pop("tools", None)
            if restored != original or after.get("platform_settings") != before.get(
                "platform_settings"
            ):
                raise ValueError(
                    "Unexpected saved configuration change; inspect agent before enabling"
                )
        print(
            json.dumps(
                {
                    "applied": apply,
                    "tools": [t["name"] for t in tools],
                    "new_agent_created": False,
                    "prompt_changed": False,
                    "configuration_and_privacy_preserved": True,
                }
            )
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument(
        "--profile", type=Path, help="Private environment overlay for the existing V2 agent"
    )
    args = parser.parse_args()
    asyncio.run(configure(args.apply, args.profile))
