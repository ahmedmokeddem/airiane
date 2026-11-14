"""Bounded readiness without upstream provider calls or sensitive response details."""

import asyncio
import hashlib
import logging
import re
import ssl
import time

from fastapi.responses import JSONResponse
from sqlalchemy import text

logger = logging.getLogger("uvicorn.error")


def readiness_reason(error: Exception) -> str:
    """Classify only; never log exception messages, SQL or connection parameters."""
    seen = set()
    current = error
    while current is not None and id(current) not in seen:
        seen.add(id(current))
        state = getattr(current, "sqlstate", None)
        if isinstance(current, ssl.SSLError):
            return "database_tls"
        if state in ("28P01", "28000"):
            return "database_authentication"
        if state in ("42P01", "3F000"):
            return "database_schema_missing"
        if state == "42501":
            return "database_permission"
        if isinstance(current, TimeoutError):
            return "database_timeout"
        if isinstance(current, OSError):
            return "database_network"
        current = getattr(current, "orig", None) or current.__cause__ or current.__context__
    return "database_or_catalogue_unavailable"


def tls_diagnostic(error: Exception, pem: str) -> str:
    """Public certificate hash and bounded TLS codes only; no exception text."""
    fingerprint = "absent"
    if pem:
        try:
            block = re.search(
                r"-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----", pem, re.DOTALL
            )
            der = ssl.PEM_cert_to_DER_cert(block.group(0)) if block else b""
            fingerprint = hashlib.sha256(der).hexdigest() if der else "invalid"
        except (ValueError, TypeError):
            fingerprint = "invalid"
    seen = set()
    current = error
    code = "unknown"
    kind = "unknown"
    while current is not None and id(current) not in seen:
        seen.add(id(current))
        if isinstance(current, ssl.SSLError):
            number = getattr(current, "verify_code", None)
            code = str(number) if isinstance(number, int) else "none"
            kind = (
                "certificate_verification"
                if isinstance(current, ssl.SSLCertVerificationError)
                else "ssl_configuration_or_handshake"
            )
            break
        current = getattr(current, "orig", None) or current.__cause__ or current.__context__
    return f"tls_kind={kind} verify_code={code} ca_sha256={fingerprint}"


def install_health(app, engine, settings):
    last_failure_log = float("-inf")

    @app.get("/health/live", include_in_schema=False)
    async def live():
        return JSONResponse({"status": "alive"}, headers={"Cache-Control": "no-store"})

    @app.get("/health/ready", include_in_schema=False)
    async def ready():
        nonlocal last_failure_log
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
        except Exception as error:  # noqa: BLE001 — public health stays sanitized
            if time.monotonic() - last_failure_log >= 30:
                reason = readiness_reason(error)
                if reason == "database_tls":
                    logger.warning(
                        "Readiness failed: %s %s",
                        reason,
                        tls_diagnostic(error, settings.database_ca_pem),
                    )
                else:
                    logger.warning("Readiness failed: %s", reason)
                last_failure_log = time.monotonic()
            status, code = "not_ready", 503
        return JSONResponse(
            {"status": status}, status_code=code, headers={"Cache-Control": "no-store"}
        )
