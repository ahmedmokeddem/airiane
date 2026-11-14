"""Create a separate private AIriane V2 from a reviewed source export and prompt.

Default is a local plan. --create makes NEW resources only, never patches an agent.
Credentials are read from a private file, never a CLI key argument or source constant.
"""

import argparse
import asyncio
import copy
import hashlib
import json
import os
from pathlib import Path

import httpx

SUPPORTED_CLIENT_TOOLS = {
    "present_activity_recommendations",
    "select_activity",
    "propose_conversation_insight",
}


def prepare(source: dict, prompt: str) -> tuple[dict, list[dict]]:
    if not prompt.strip():
        raise ValueError("A complete reviewed system-prompt file is required")
    conversation = copy.deepcopy(source["conversation_config"])
    agent = conversation["agent"]
    configuration = agent["prompt"]
    tools = [copy.deepcopy(t) for t in configuration.pop("tools", []) if t.get("type") == "client"]
    names = {t["name"] for t in tools}
    if names != SUPPORTED_CLIENT_TOOLS:
        raise ValueError(
            "Source client tools differ from the implemented mobile baseline; review required"
        )
    for tool in tools:
        if tool.get("expects_response") is not True:
            raise ValueError("Every client tool must wait for the application response")
    contract = json.loads(
        (Path(__file__).resolve().parents[2] / "contracts/tool_contracts.json").read_text()
    )
    for declaration in contract["tools"]:
        if declaration["name"] in {"get_patient_context", "get_next_guided_question"}:
            tools.append(
                {
                    "type": "client",
                    "name": declaration["name"],
                    "description": declaration["description"],
                    "expects_response": True,
                    "parameters": {
                        "type": "object",
                        "description": declaration["description"],
                        "properties": {},
                        "required": [],
                    },
                }
            )
    agent.setdefault("dynamic_variables", {})["dynamic_variable_placeholders"] = {
        "application_context": "{}"
    }
    # IDs belong to the source workspace; create target-owned tool resources below.
    configuration["tool_ids"] = []
    if (
        configuration.get("mcp_server_ids")
        or configuration.get("native_mcp_server_ids")
        or configuration.get("knowledge_base")
    ):
        raise ValueError(
            "Source contains workspace resources that require an explicit migration plan"
        )
    configuration["prompt"] = prompt.strip()
    configuration["rich_content"] = {"enabled_components": []}
    configuration["enable_parallel_tool_calls"] = False
    # User-initiated conversation; no static introduction races application context.
    agent["first_message"] = ""
    platform = source.get("platform_settings", {})
    privacy = copy.deepcopy(platform.get("privacy", {}))
    privacy.update(
        record_voice=False,
        retention_days=0,
        delete_transcript_and_pii=True,
        delete_audio=True,
        apply_to_existing_conversations=False,
    )
    if isinstance(privacy.get("user_memory"), dict):
        privacy["user_memory"]["enabled"] = False
    return {
        "name": "AIriane V2",
        "tags": ["airiane-v2", "validation-pending"],
        "conversation_config": conversation,
        "platform_settings": {
            "auth": {"enable_auth": True, "allowlist": []},
            "privacy": privacy,
            "overrides": copy.deepcopy(platform.get("overrides", {})),
        },
    }, tools


async def request(client, method, path, **kwargs):
    response = await client.request(method, "https://api.elevenlabs.io/v1/convai" + path, **kwargs)
    if not response.is_success:
        # No response bodies, request headers, prompts, or credentials in failures.
        raise RuntimeError(f"Provider operation failed: HTTP {response.status_code}")
    return response.json()


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-export", type=Path, required=True)
    parser.add_argument("--prompt-file", type=Path, required=True)
    parser.add_argument("--key-file", type=Path)
    parser.add_argument("--output-profile", type=Path, default=Path(".env.airiane-v2.local"))
    parser.add_argument("--create", action="store_true")
    args = parser.parse_args()
    source = json.loads(args.source_export.read_text())
    payload, tools = prepare(source, args.prompt_file.read_text())
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    if not args.create:
        print(
            json.dumps(
                {
                    "action": "create_new_agent",
                    "name": payload["name"],
                    "source_untouched": True,
                    "prompt_and_configuration_sha256": digest,
                    "client_tools": [t["name"] for t in tools],
                    "production_change": False,
                }
            )
        )
        return
    if args.key_file is None:
        raise ValueError("--key-file is required for creation")
    if not args.output_profile.name.startswith(".env.") or not args.output_profile.name.endswith(
        ".local"
    ):
        raise ValueError("Use a Git-ignored .env.*.local output profile, never a source file")
    if args.output_profile.exists():
        raise ValueError("Output profile already exists; refusing duplicate creation")
    key = args.key_file.read_text().strip()
    async with httpx.AsyncClient(timeout=30, headers={"xi-api-key": key}) as client:
        # Refuse duplicate names, including agents on later result pages.
        cursor = None
        while True:
            result = await request(
                client, "GET", "/agents", params={"cursor": cursor} if cursor else {}
            )
            if any(a.get("name") == "AIriane V2" for a in result.get("agents", [])):
                raise ValueError(
                    "AIriane V2 already exists; inspect it rather than creating a duplicate"
                )
            cursor = result.get("next_cursor")
            if not result.get("has_more") or not cursor:
                break
        existing = await request(client, "GET", "/tools")
        ids = []
        for tool in tools:
            matches = [
                item
                for item in existing.get("tools", [])
                if item.get("tool_config", {}).get("name") == tool["name"]
            ]
            if len(matches) > 1:
                raise ValueError("Ambiguous existing tool name; refusing duplicate creation")
            if matches:
                old = matches[0]["tool_config"]
                if (
                    old.get("type") != "client"
                    or old.get("expects_response") is not True
                    or old.get("parameters", {}).get("properties")
                    != tool["parameters"].get("properties")
                    or old.get("parameters", {}).get("required", [])
                    != tool["parameters"].get("required", [])
                ):
                    raise ValueError("Existing tool differs from the reviewed implementation")
                ids.append(matches[0]["id"])
            else:
                result = await request(client, "POST", "/tools", json={"tool_config": tool})
                ids.append(result["id"])
        payload["conversation_config"]["agent"]["prompt"]["tool_ids"] = ids
        result = await request(client, "POST", "/agents/create", json=payload)
        agent_id = result["agent_id"]
        # Save immediately after provider confirmation so verification failure cannot lose identity.
        fd = os.open(args.output_profile, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as output:
            output.write(
                f"RE_ELEVENLABS_AGENT_ID={agent_id}\nRE_ELEVENLABS_API_KEY={key}\nRE_COMPANION_V2_ENABLED=true\n"
            )
        saved = await request(client, "GET", "/agents/" + agent_id)
        private = saved.get("platform_settings", {})
        saved_agent = saved.get("conversation_config", {}).get("agent", {})
        saved_privacy = private.get("privacy", {})
        verified = (
            saved.get("name") == "AIriane V2"
            and private.get("auth", {}).get("enable_auth") is True
            and saved_agent.get("first_message") == ""
            and saved_agent.get("prompt", {}).get("prompt")
            == payload["conversation_config"]["agent"]["prompt"]["prompt"]
            and set(saved_agent.get("prompt", {}).get("tool_ids", [])) == set(ids)
            and saved_privacy.get("record_voice") is False
            and saved_privacy.get("retention_days") == 0
            and saved_privacy.get("delete_audio") is True
            and saved_privacy.get("delete_transcript_and_pii") is True
        )
        if not verified:
            raise RuntimeError(
                "New agent created but verification failed; inspect the saved local profile"
            )
        print(
            json.dumps(
                {
                    "created_agent_id": agent_id,
                    "name": saved["name"],
                    "authenticated_access": True,
                    "production_changed": False,
                    "validation_status": "provider_configuration_only_not_conversation_validation",
                }
            )
        )


if __name__ == "__main__":
    asyncio.run(main())
