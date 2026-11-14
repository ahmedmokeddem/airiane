"""Review/apply bounded waits to V2 activity tools; never log credentials or patient data."""

import argparse
import asyncio
import copy
import json
from pathlib import Path

import httpx
from dotenv import dotenv_values

NAMES = {"present_activity_recommendations", "select_activity"}


async def configure(profile: Path, apply: bool) -> None:
    values = dotenv_values(profile)
    agent_id = values.get("RE_ELEVENLABS_AGENT_ID")
    key = values.get("RE_ELEVENLABS_API_KEY")
    if not agent_id or not key:
        raise ValueError("A private V2 profile with agent ID and API key is required")
    async with httpx.AsyncClient(
        base_url="https://api.elevenlabs.io/v1/convai",
        headers={"xi-api-key": key},
        timeout=20,
    ) as client:
        response = await client.get(f"/agents/{agent_id}")
        response.raise_for_status()
        agent = response.json()
        if agent.get("name") != "AIriane V2":
            raise ValueError("This command is restricted to AIriane V2")
        prompt = agent["conversation_config"]["agent"]["prompt"]
        plans = []
        for tool_id in prompt.get("tool_ids", []):
            response = await client.get(f"/tools/{tool_id}")
            response.raise_for_status()
            tool = response.json()["tool_config"]
            if tool.get("name") in NAMES:
                if tool.get("type") != "client" or tool.get("expects_response") is not True:
                    raise ValueError("Activity tools must be response-waiting client tools")
                plans.append((tool_id, tool))
        if {tool["name"] for _, tool in plans} != NAMES:
            raise ValueError("Expected both V2 activity tools")
        # Shared workspace tools could affect another agent: refuse that case.
        response = await client.get("/agents", params={"page_size": 100})
        response.raise_for_status()
        listing = response.json()
        if listing.get("has_more"):
            raise ValueError("Review shared tools manually in a paginated workspace")
        for other in listing.get("agents", []):
            if other["agent_id"] == agent_id:
                continue
            response = await client.get(f"/agents/{other['agent_id']}")
            response.raise_for_status()
            ids = response.json()["conversation_config"]["agent"]["prompt"].get("tool_ids", [])
            if set(ids) & {tool_id for tool_id, _ in plans}:
                raise ValueError("Activity tools are shared with another agent; no change made")
        for tool_id, original in plans:
            updated = copy.deepcopy(original)
            updated["response_timeout_secs"] = 45
            if apply:
                response = await client.patch(f"/tools/{tool_id}", json={"tool_config": updated})
                response.raise_for_status()
                response = await client.get(f"/tools/{tool_id}")
                response.raise_for_status()
                if response.json()["tool_config"] != updated:
                    raise ValueError(
                        "Saved tool configuration differs from requested configuration"
                    )
            print(
                json.dumps(
                    {
                        "tool": original["name"],
                        "before_seconds": original.get("response_timeout_secs"),
                        "after_seconds": 45,
                        "applied_and_verified": apply,
                    }
                )
            )
        response = await client.get(f"/agents/{agent_id}")
        response.raise_for_status()
        after = response.json()
        if after["platform_settings"] != agent["platform_settings"]:
            raise ValueError("Agent platform settings changed unexpectedly")
        print("V2 agent platform/privacy settings unchanged")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", type=Path, default=Path(".env.airiane-v2.local"))
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    asyncio.run(configure(args.profile, args.apply))


if __name__ == "__main__":
    main()
