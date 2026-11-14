"""Explicit fictional smoke check. Never reads patient records or enables the feature."""

import asyncio
import json

from ..config import Settings
from .provider import FeatherlessNemotronProvider, GenerationFailure
from .schema import GenerationRequest


async def main():
    settings = Settings()
    if not settings.featherless_api_key or not settings.featherless_model:
        raise SystemExit("Featherless configuration missing")
    try:
        result = await FeatherlessNemotronProvider(settings).generate(
            GenerationRequest(
                goal="A playful one-minute pattern with circles and squares",
                format="mini_game",
                duration_seconds=60,
            )
        )
    except GenerationFailure as error:
        print(json.dumps({"verified": False, "reason": error.code}))
        raise SystemExit(1) from None
    print(
        json.dumps(
            {
                "verified": True,
                "schema_version": result.schema_version,
                "format": result.format,
                "steps": len(result.components),
                "feature_enabled": settings.generative_activities_enabled,
            }
        )
    )


if __name__ == "__main__":
    asyncio.run(main())
