"""Core mappings match the existing baseline. PostgreSQL DDL is never auto-created."""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Integer,
    MetaData,
    Numeric,
    String,
    Table,
    Uuid,
    select,
    update,
)
from sqlalchemy.ext.asyncio import AsyncConnection, create_async_engine

metadata = MetaData(schema="re")


def table(name: str, specs: str) -> Table:
    columns = []
    for spec in specs.split():
        name_, kind = spec.split(":")
        typ = {
            "u": Uuid,
            "s": String,
            "i": Integer,
            "b": Boolean,
            "j": JSON,
            "n": lambda: Numeric(5, 2),
            "t": lambda: DateTime(timezone=True),
        }[kind]
        columns.append(Column(name_, typ(), primary_key=name_ == "id"))
    return Table(name, metadata, *columns)


TABLES = {
    "users": table("users", "id:u auth_subject:u role:s disabled_at:t created_at:t"),
    "patient_profiles": table(
        "patient_profiles", "patient_id:u display_name:s timezone:s preferences:j avatar:j"
    ),
    "conversation_sessions": table(
        "conversation_sessions",
        "id:u patient_id:u state:s mode:s version:i guided_state:j last_seen_at:t ended_at:t created_at:t",
    ),
    "activity_catalog": table(
        "activity_catalog",
        "id:u slug:s version:i kind:s title:s description:s duration_seconds:i config:j active:b",
    ),
    "recommendations": table(
        "recommendations", "id:u patient_id:u session_id:u expires_at:t created_at:t"
    ),
    "recommendation_items": table(
        "recommendation_items",
        "recommendation_id:u patient_id:u activity_id:u activity_version:i rank:i reason:s",
    ),
    "activity_sessions": table(
        "activity_sessions",
        "id:u patient_id:u session_id:u recommendation_id:u activity_id:u activity_version:i selection_channel:s state:s version:i started_at:t ended_at:t",
    ),
    "source_records": table(
        "source_records",
        "id:u patient_id:u kind:s session_id:u revision:i occurred_at:t unavailable_at:t created_at:t",
    ),
    "activity_events": table(
        "activity_events",
        "id:u patient_id:u activity_session_id:u client_event_id:u source_id:u event_type:s elapsed_seconds:i event_at:t created_at:t",
    ),
    "activity_feedback": table(
        "activity_feedback",
        "id:u patient_id:u activity_session_id:u source_id:u rating:i comment:s created_at:t",
    ),
    "idempotency_keys": table(
        "idempotency_keys",
        "actor_id:u method:s route:s key:u request_hash:s response_status:i response_body:j expires_at:t created_at:t",
    ),
    "provider_connections": table(
        "provider_connections",
        "id:u patient_id:u session_id:u provider:s mode:s transport:s state:s connection_epoch:i context_version:i version:i provider_conversation_id:s connect_before:t closed_at:t created_at:t",
    ),
    "tool_calls": table(
        "tool_calls",
        "id:u patient_id:u provider_connection_id:u session_id:u tool_call_id:s tool_name:s contract_version:s request_hash:s result_resource_id:u outcome_code:s created_at:t",
    ),
    "clinician_profiles": table(
        "clinician_profiles", "clinician_id:u display_name:s verified_at:t verified_by:u"
    ),
    "care_links": table("care_links", "id:u patient_id:u clinician_id:u state:s created_at:t"),
    "consent_grants": table(
        "consent_grants",
        "id:u patient_id:u care_link_id:u scope:s expires_at:t data_from:t revoked_at:t created_at:t",
    ),
    "reports": table(
        "reports",
        "id:u patient_id:u version:i calculation_version:s period_start:t period_end:t state:s generated_at:t data_cutoff:t payload:j created_at:t",
    ),
    "report_sources": table(
        "report_sources", "report_id:u source_id:u patient_id:u source_revision:i"
    ),
    "observations": table(
        "observations",
        "id:u patient_id:u session_id:u kind:s value:n observed_at:t state:s version:i supersedes_observation_id:u confirmed_at:t created_at:t",
    ),
    "observation_sources": table(
        "observation_sources", "observation_id:u source_id:u patient_id:u source_revision:i"
    ),
    "confirmed_insights": table(
        "confirmed_insights",
        "id:u patient_id:u session_id:u theme:s text:s observed_at:t statement_kind:s confirmed_at:t state:s version:i supersedes_insight_id:u source_id:u created_at:t",
    ),
    "assessment_definitions": table(
        "assessment_definitions", "id:u version:i title:s clinical_instrument:b questions:j"
    ),
    "assessment_responses": table(
        "assessment_responses",
        "id:u patient_id:u session_id:u assessment_id:u assessment_version:i source_id:u answers:j complete:b observed_at:t created_at:t",
    ),
    "audit_events": table(
        "audit_events",
        "id:u actor_id:u patient_id:u action:s resource_type:s resource_id:u request_id:u created_at:t",
    ),
}


def converted(t: Table, values: dict) -> dict:
    output = {}
    for k, v in values.items():
        if v is not None and isinstance(t.c[k].type, Uuid):
            v = UUID(str(v))
        if v is not None and isinstance(t.c[k].type, DateTime) and isinstance(v, str):
            v = datetime.fromisoformat(v)
        output[k] = v
    return output


def exported(row: Any) -> dict:
    return {
        k: str(v)
        if isinstance(v, UUID)
        else (v if v.tzinfo else v.replace(tzinfo=UTC)).isoformat()
        if isinstance(v, datetime)
        else v
        for k, v in row.items()
    }


class SqlStore:
    def __init__(self, connection: AsyncConnection):
        self.connection = connection

    async def all(self, name: str, **filters: Any) -> list[dict]:
        t = TABLES[name]
        stmt = select(t).filter_by(**converted(t, filters))
        return [exported(r) for r in (await self.connection.execute(stmt)).mappings()]

    async def get(self, table: str, **filters: Any) -> dict | None:
        rows = await self.all(table, **filters)
        return rows[0] if rows else None

    async def get_locked(self, name: str, **filters: Any) -> dict | None:
        t = TABLES[name]
        stmt = select(t).filter_by(**converted(t, filters)).with_for_update()
        row = (await self.connection.execute(stmt)).mappings().first()
        return exported(row) if row else None

    async def add(self, name: str, **values: Any) -> dict:
        t = TABLES[name]
        await self.connection.execute(t.insert().values(**converted(t, values)))
        return values

    async def update(self, name: str, filters: dict, values: dict) -> None:
        t = TABLES[name]
        stmt = update(t).filter_by(**converted(t, filters)).values(**converted(t, values))
        result = await self.connection.execute(stmt)
        if result.rowcount != 1:
            from .domain import DomainError

            raise DomainError("VERSION_CONFLICT")


def engine_for(url: str, settings=None):
    if url.startswith(("postgres://", "postgresql://", "postgresql+asyncpg://")):
        import asyncpg

        from .database_url import postgres_dsn

        dsn = postgres_dsn(url)

        async def connect():
            kwargs = {
                "timeout": settings.database_connect_timeout if settings else 15,
                "command_timeout": settings.database_command_timeout if settings else 15,
            }
            if settings and settings.environment == "production":
                import ssl

                kwargs["ssl"] = ssl.create_default_context(cadata=settings.database_ca_pem or None)
            return await asyncpg.connect(dsn, **kwargs)

        # Native asyncpg parses provider SSL parameters; engine logs contain no credentials.
        return create_async_engine(
            "postgresql+asyncpg://",
            async_creator=connect,
            pool_pre_ping=True,
            pool_size=settings.database_pool_size if settings else 2,
            max_overflow=settings.database_max_overflow if settings else 1,
            pool_timeout=settings.database_pool_timeout if settings else 5,
            pool_recycle=300,
            hide_parameters=True,
        )
    engine = create_async_engine(url, pool_pre_ping=True)
    if url.startswith("sqlite"):
        engine = engine.execution_options(schema_translate_map={"re": None})
    return engine
