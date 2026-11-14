"""Explicit checksum-ledger migrations. Never invoked by application startup."""

import argparse
import asyncio
import hashlib
from pathlib import Path

import asyncpg

from .config import Settings
from .database_url import postgres_dsn

MIGRATIONS = Path(__file__).resolve().parents[2] / "database/migrations"


async def apply(connection, name, *, adopt=False, check=False):
    script = (MIGRATIONS / name).read_text()
    checksum = hashlib.sha256(script.encode()).hexdigest()
    async with connection.transaction():
        await connection.execute("SELECT pg_advisory_xact_lock(714092601)")
        ledger = await connection.fetchval("SELECT to_regclass('public.airiane_schema_migrations')")
        if ledger:
            prior = await connection.fetchval(
                "SELECT checksum FROM public.airiane_schema_migrations WHERE name=$1", name
            )
            if prior:
                if prior != checksum:
                    raise RuntimeError("Committed migration checksum differs from the ledger")
                return "already_applied"
        if check:
            return "pending_or_untracked"
        target = {
            "0001_baseline.sql": "re.users",
            "0002_confirmed_insights.sql": "re.confirmed_insights",
            "0004_companion_continuity.sql": "re.companion_state",
            "0003_clinical_questionnaires.sql": "re.assessment_definitions",
            "0005_medication_reminders.sql": "re.medication_reminders",
        }[name]
        exists = await connection.fetchval("SELECT to_regclass($1)", target)
        if name == "0003_clinical_questionnaires.sql":
            # This migration alters existing tables rather than creating its target.
            exists = (
                bool(exists)
                and not await connection.fetchval(
                    "SELECT 1 FROM pg_constraint WHERE conrelid='re.assessment_definitions'::regclass "
                    "AND conname='assessment_definitions_clinical_instrument_check'"
                )
                and await connection.fetchval(
                    "SELECT is_nullable='YES' FROM information_schema.columns "
                    "WHERE table_schema='re' AND table_name='alert_recipients' AND column_name='consent_grant_id'"
                )
            )
        if exists and not adopt:
            raise RuntimeError(
                "Existing untracked schema: review it before explicit --adopt-existing; baseline will not be rerun"
            )
        if adopt and not exists:
            raise RuntimeError("Cannot adopt a missing migration target")
        if name != "0001_baseline.sql" and (
            not ledger
            or not await connection.fetchval(
                "SELECT 1 FROM public.airiane_schema_migrations WHERE name='0001_baseline.sql'"
            )
        ):
            raise RuntimeError("Apply or explicitly adopt the baseline first")
        if name == "0004_companion_continuity.sql" and (
            not ledger
            or not await connection.fetchval(
                "SELECT 1 FROM public.airiane_schema_migrations WHERE name='0002_confirmed_insights.sql'"
            )
        ):
            raise RuntimeError(
                "Apply or explicitly adopt confirmed insights before companion continuity"
            )
        if adopt:
            required = (
                [
                    "users",
                    "patient_profiles",
                    "conversation_sessions",
                    "provider_connections",
                    "reports",
                    "source_records",
                    "activity_catalog",
                    "care_links",
                    "consent_grants",
                ]
                if name == "0001_baseline.sql"
                else (
                    ["confirmed_insights"]
                    if name == "0002_confirmed_insights.sql"
                    else (
                        ["assessment_definitions", "alert_recipients"]
                        if name == "0003_clinical_questionnaires.sql"
                        else (
                            ["medication_reminders"]
                            if name == "0005_medication_reminders.sql"
                            else ["companion_state", "daily_checkins"]
                        )
                    )
                )
            )
            for table in required:
                if not await connection.fetchval("SELECT to_regclass($1)", "re." + table):
                    raise RuntimeError("Incomplete schema cannot be adopted")
            # Structural presence is not proof of full DDL equivalence: operator review is mandatory.
        else:
            begin = script.index("BEGIN;") + len("BEGIN;")
            body = script[begin:].strip()
            if not body.endswith("COMMIT;"):
                raise RuntimeError("Expected transactional committed migration")
            await connection.execute(body[: -len("COMMIT;")])
        await connection.execute(
            "CREATE TABLE IF NOT EXISTS public.airiane_schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, adopted boolean NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())"
        )
        await connection.execute("REVOKE ALL ON public.airiane_schema_migrations FROM PUBLIC")
        await connection.execute(
            "INSERT INTO public.airiane_schema_migrations(name,checksum,adopted) VALUES($1,$2,$3)",
            name,
            checksum,
            adopt,
        )
        return "adopted" if adopt else "applied"


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--migration",
        required=True,
        choices=[
            "0001_baseline.sql",
            "0002_confirmed_insights.sql",
            "0003_clinical_questionnaires.sql",
            "0004_companion_continuity.sql",
            "0005_medication_reminders.sql",
        ],
    )
    parser.add_argument(
        "--adopt-existing",
        action="store_true",
        help="Only after manual DDL review of an existing untracked database",
    )
    parser.add_argument(
        "--check", action="store_true", help="Read-only ledger check; no schema changes"
    )
    args = parser.parse_args()
    settings = Settings()
    kwargs = {"timeout": settings.database_connect_timeout, "command_timeout": 60}
    if settings.environment == "production":
        import ssl

        kwargs["ssl"] = ssl.create_default_context(cadata=settings.database_ca_pem or None)
    connection = await asyncpg.connect(postgres_dsn(settings.database_url), **kwargs)
    try:
        print(
            args.migration,
            await apply(connection, args.migration, adopt=args.adopt_existing, check=args.check),
        )
    finally:
        await connection.close()


if __name__ == "__main__":
    asyncio.run(main())
