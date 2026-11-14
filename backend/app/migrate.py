"""Apply one explicitly selected committed migration once; never resets existing data."""

import argparse
import asyncio
from pathlib import Path

import asyncpg

from .config import Settings
from .database_url import postgres_dsn


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--migration",
        default="0001_baseline.sql",
        choices=["0001_baseline.sql", "0002_confirmed_insights.sql"],
    )
    args = parser.parse_args()
    url = postgres_dsn(Settings().database_url)
    connection = await asyncpg.connect(url, timeout=15)
    try:
        await connection.execute(
            (
                Path(__file__).resolve().parents[2] / "database/migrations" / args.migration
            ).read_text(encoding="utf-8")
        )
    finally:
        await connection.close()


if __name__ == "__main__":
    asyncio.run(main())
