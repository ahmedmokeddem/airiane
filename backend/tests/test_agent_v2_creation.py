import copy

import pytest

from app.create_airiane_v2 import prepare


def source():
    return {
        "name": "Original working agent",
        "agent_id": "original-id",
        "conversation_config": {
            "tts": {"voice_id": "fixture-voice", "model_id": "fixture-tts"},
            "agent": {
                "first_message": "Original introduction",
                "language": "en",
                "prompt": {
                    "prompt": "Original instructions",
                    "llm": "fixture-model",
                    "tool_ids": ["foreign-workspace-id"],
                    "tools": [
                        {
                            "type": "client",
                            "name": name,
                            "expects_response": True,
                            "parameters": {"type": "object"},
                        }
                        for name in [
                            "present_activity_recommendations",
                            "select_activity",
                            "propose_conversation_insight",
                        ]
                    ],
                },
            },
        },
        "platform_settings": {
            "privacy": {
                "record_voice": True,
                "retention_days": -1,
                "user_memory": {"enabled": True},
            }
        },
    }


def test_new_agent_payload_preserves_original_and_does_not_reuse_workspace_ids():
    original = source()
    snapshot = copy.deepcopy(original)
    payload, tools = prepare(original, "Reviewed nonclinical AIriane prompt")
    assert original == snapshot
    assert payload["name"] == "AIriane V2"
    assert "agent_id" not in payload
    assert payload["conversation_config"]["agent"]["prompt"]["tool_ids"] == []
    assert payload["conversation_config"]["tts"] == original["conversation_config"]["tts"]
    assert payload["platform_settings"]["auth"]["enable_auth"] is True
    privacy = payload["platform_settings"]["privacy"]
    assert privacy["record_voice"] is False and privacy["retention_days"] == 0
    assert privacy["delete_audio"] and privacy["delete_transcript_and_pii"]
    assert not privacy["user_memory"]["enabled"]
    assert all(t["expects_response"] for t in tools)


def test_creation_refuses_unimplemented_client_tools_and_missing_prompt():
    original = source()
    original["conversation_config"]["agent"]["prompt"]["tools"].append(
        {"type": "client", "name": "automatic_confirmation", "expects_response": True}
    )
    with pytest.raises(ValueError, match="implemented mobile baseline"):
        prepare(original, "Reviewed prompt")
    with pytest.raises(ValueError, match="complete reviewed"):
        prepare(source(), " ")
