"""Bounded readiness without upstream provider calls or sensitive response details."""

import asyncio

from fastapi.responses import JSONResponse
from sqlalchemy import text


def install_health(app, engine, settings):
    @app.get("/health/live", include_in_schema=False)
    async def live():
        return JSONResponse({"status": "alive"}, headers={"Cache-Control": "no-store"})

    @app.get("/health/ready", include_in_schema=False)
    async def ready():
        try:
            async with asyncio.timeout(settings.readiness_timeout):
                async with engine.connect() as connection:
                    # Check required schema, not just an available PostgreSQL socket.
                    prefix = "" if engine.dialect.name == "sqlite" else "re."
                    for table in ("users", "reports", "confirmed_insights", "activity_catalog"):
                        await connection.execute(text(f"SELECT 1 FROM {prefix}{table} LIMIT 1"))
                    available = await connection.scalar(
                        text(f"SELECT 1 FROM {prefix}activity_catalog WHERE active = true LIMIT 1")
                    )
                    if available is None:
                        raise RuntimeError("Catalogue unavailable")
            status, code = "ready", 200
        except Exception:  # noqa: BLE001 — health never exposes database exceptions
            status, code = "not_ready", 503
        return JSONResponse(
            {"status": status}, status_code=code, headers={"Cache-Control": "no-store"}
        )
