"""Explicit operator catalogue initialization; no patient records or automatic production writes."""

import asyncio

from .config import Settings
from .services import ACTIVITY_ID
from .storage import SqlStore, engine_for


async def ensure_catalog(store):
    if not await store.get("activity_catalog", id=ACTIVITY_ID):
        await store.add(
            "activity_catalog",
            id=ACTIVITY_ID,
            slug="calm-breathing",
            version=1,
            kind="breathing",
            title="Calm Breathing",
            description="Take an optional gentle pause. Stop whenever you want.",
            duration_seconds=60,
            config={
                "renderer": "breathing_v1",
                "asset_id": None,
                "instructions": ["Breathe comfortably. Stop if uncomfortable."],
                "inhale_seconds": 4,
                "exhale_seconds": 4,
            },
            active=True,
        )


async def main():
    settings = Settings()
    engine = engine_for(settings.database_url, settings)
    try:
        async with engine.begin() as connection:
            await ensure_catalog(SqlStore(connection))
        print("Catalogue initialization completed; existing entries preserved.")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
