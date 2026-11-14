"""Apply the committed baseline once; never resets existing data."""

import asyncio
from pathlib import Path

import asyncpg

from .config import Settings
from .database_url import postgres_dsn


async def main():
    url = postgres_dsn(Settings().database_url)
    connection = await asyncpg.connect(url, timeout=15)
    try:
        await connection.execute(
            (
                Path(__file__).resolve().parents[2] / "database/migrations/0001_baseline.sql"
            ).read_text()
        )
    finally:
        await connection.close()


if __name__ == "__main__":
    asyncio.run(main())
