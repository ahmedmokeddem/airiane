"""Seed only an isolated pg.fixture.test test database, never a hosted service."""

import asyncio

from app.config import Settings
from app.domain import stamp
from app.seed_catalog import ensure_catalog
from app.storage import SqlStore, engine_for


async def main():
    settings = Settings()
    assert "@pg.fixture.test:" in settings.database_url and "/re_test?" in settings.database_url, (
        "Refusing a non-fixture database"
    )
    engine = engine_for(settings.database_url, settings)
    async with engine.begin() as connection:
        store = SqlStore(connection)
        await ensure_catalog(store)
        uid = "55555555-5555-4555-8555-555555555555"
        await store.add(
            "users",
            id=uid,
            auth_subject="44444444-4444-4444-8444-444444444444",
            role="clinician",
            disabled_at=None,
            created_at=stamp(),
        )
        await store.add(
            "clinician_profiles",
            clinician_id=uid,
            display_name="Fictional TLS clinician",
            verified_at=stamp(),
            verified_by=uid,
        )
    await engine.dispose()
    print("Fictional isolated catalogue and verified clinician provisioned.")


asyncio.run(main())
