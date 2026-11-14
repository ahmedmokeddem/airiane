"""Negative TLS and rollback-only ledger tests, strictly local fixture DB."""

import asyncio
import ssl

import asyncpg

from app.config import Settings
from app.database_url import postgres_dsn
from app.migrate import apply


async def main():
    settings = Settings()
    assert "@pg.fixture.test:" in settings.database_url
    dsn = postgres_dsn(settings.database_url)
    for url, context in [
        (dsn, ssl.create_default_context(cafile="/etc/ssl/certs/ca-certificates.crt")),
        (
            dsn.replace("@pg.fixture.test:", "@airiane-check-db:"),
            ssl.create_default_context(cafile="/fixtures/ca.pem"),
        ),
    ]:
        try:
            connection = await asyncpg.connect(url, ssl=context, timeout=3)
            await connection.close()
        except ssl.SSLCertVerificationError:
            pass
        else:
            raise AssertionError("Untrusted certificate/hostname was accepted")
    connection = await asyncpg.connect(
        dsn, ssl=ssl.create_default_context(cafile="/fixtures/ca.pem"), timeout=3
    )
    try:
        outer = connection.transaction()
        await outer.start()
        try:
            await connection.execute(
                "UPDATE public.airiane_schema_migrations SET checksum='not-the-file-checksum' WHERE name='0001_baseline.sql'"
            )
            try:
                await apply(connection, "0001_baseline.sql")
            except RuntimeError as error:
                assert "checksum" in str(error)
            else:
                raise AssertionError("Changed checksum accepted")
        finally:
            await outer.rollback()
        outer = connection.transaction()
        await outer.start()
        try:
            await connection.execute(
                "DELETE FROM public.airiane_schema_migrations WHERE name='0001_baseline.sql'"
            )
            try:
                await apply(connection, "0001_baseline.sql")
            except RuntimeError as error:
                assert "untracked" in str(error)
            else:
                raise AssertionError("Existing baseline was reapplied")
            assert await apply(connection, "0001_baseline.sql", adopt=True) == "adopted"
        finally:
            await outer.rollback()
    finally:
        await connection.close()
    print(
        "Rejected untrusted CA and wrong hostname; rejected checksum drift/reapply; explicit local schema adoption checked in rolled-back transaction."
    )


asyncio.run(main())
