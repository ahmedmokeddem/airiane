"""Operator-only diagnostics using production SSL settings; no verification bypass.

python -m app.database_tls_diagnostic --handshake --driver
No endpoint exposes these diagnostics. Without flags, no network requests occur.
"""

import argparse
import asyncio
import hashlib
import json
import os
import shutil
import socket
import ssl
import struct
import subprocess
import tempfile
from datetime import UTC, datetime
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.x509.oid import NameOID
from sqlalchemy.engine import make_url

from .config import Settings
from .database_tls import classify, context_facts, exception_facts, production_ssl_context
from .database_url import postgres_dsn


def certificate_facts(der):
    cert = x509.load_der_x509_certificate(der)
    try:
        san = cert.extensions.get_extension_for_class(x509.SubjectAlternativeName).value
        names = san.get_values_for_type(x509.DNSName)
    except x509.ExtensionNotFound:
        names = []
    return {
        "sha256": cert.fingerprint(hashes.SHA256()).hex(),
        "subject": cert.subject.rfc4514_string(),
        "issuer": cert.issuer.rfc4514_string(),
        "common_names": [x.value for x in cert.subject.get_attributes_for_oid(NameOID.COMMON_NAME)],
        "dns_sans": names,
        "not_before": cert.not_valid_before_utc.isoformat(),
        "not_after": cert.not_valid_after_utc.isoformat(),
        "expired_at_diagnostic_time": cert.not_valid_after_utc < datetime.now(UTC),
    }


def endpoint(settings):
    url = make_url(postgres_dsn(settings.database_url))
    host = url.query.get("host") or url.host
    if not host or "," in host or host.startswith("/"):
        raise ValueError("Handshake diagnostic requires a single TCP hostname")
    return host, int(url.query.get("port") or url.port or 5432)


def handshake(settings, context):
    host, port = endpoint(settings)
    # PostgreSQL SSLRequest only: no username/password, startup packet, or SQL is sent.
    with socket.create_connection((host, port), timeout=settings.database_connect_timeout) as sock:
        negotiation = make_url(postgres_dsn(settings.database_url)).query.get(
            "sslnegotiation", os.getenv("PGSSLNEGOTIATION", "postgres")
        )
        if negotiation != "direct":
            sock.sendall(struct.pack("!II", 8, 80877103))
            if sock.recv(1) != b"S":
                return {"status": "postgres_ssl_request_refused_or_wrong_protocol"}
        with context.wrap_socket(sock, server_hostname=host) as tls:
            return {
                "status": "verified",
                "peer_address": tls.getpeername(),
                "protocol": tls.version(),
                "cipher": tls.cipher(),
                "leaf": certificate_facts(tls.getpeercert(binary_form=True)),
                "check_hostname": tls.context.check_hostname,
                "verify_mode": tls.context.verify_mode.name,
            }


def openssl_chain(settings, context):
    """Observe presented chain with strict verification; never use -verify 0."""
    executable = shutil.which("openssl")
    if not executable:
        return {"status": "not_available", "reason": "openssl executable absent"}
    host, port = endpoint(settings)
    with tempfile.TemporaryDirectory(prefix="airiane-tls-") as directory:
        ca = Path(directory) / "effective-trust.pem"
        ca.write_text(
            "".join(ssl.DER_cert_to_PEM_cert(c) for c in context.get_ca_certs(binary_form=True))
        )
        command = [
            executable,
            "s_client",
            "-showcerts",
            "-starttls",
            "postgres",
            "-connect",
            f"{host}:{port}",
            "-servername",
            host,
            "-verify_hostname",
            host,
            "-verify_return_error",
            "-CAfile",
            str(ca),
            "-no-CApath",
            "-no-CAstore",
        ]
        negotiation = make_url(postgres_dsn(settings.database_url)).query.get(
            "sslnegotiation", os.getenv("PGSSLNEGOTIATION", "postgres")
        )
        if negotiation == "direct":
            index = command.index("-starttls")
            del command[index : index + 2]
        if context.verify_flags & ssl.VERIFY_X509_STRICT:
            command.append("-x509_strict")
        if context.verify_flags & ssl.VERIFY_X509_PARTIAL_CHAIN:
            command.append("-partial_chain")
        try:
            result = subprocess.run(
                command,
                input="",
                text=True,
                capture_output=True,
                timeout=settings.database_connect_timeout + 5,
                check=False,
            )
        except subprocess.TimeoutExpired:
            return {"status": "timeout"}
        import re

        certificates = []
        for block in re.findall(
            r"-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----", result.stdout, re.DOTALL
        ):
            certificates.append(certificate_facts(ssl.PEM_cert_to_DER_cert(block)))
        return {
            "status": "verified" if result.returncode == 0 else "verification_or_connection_failed",
            "exit_code": result.returncode,
            "presented_chain": certificates,
            "note": "Presented chain is evidence, not a trust source. Python probe is authoritative for its SSLContext; OpenSSL CLI cipher defaults may differ.",
        }


async def driver_probe(settings, context):
    import asyncpg

    connection = await asyncpg.connect(
        postgres_dsn(settings.database_url),
        ssl=context,
        timeout=settings.database_connect_timeout,
        command_timeout=settings.database_command_timeout,
    )
    try:
        async with connection.transaction(readonly=True):
            row = await connection.fetchrow(
                "SELECT ssl, version, cipher FROM pg_stat_ssl WHERE pid = pg_backend_pid()"
            )
        # Read-only observation; this private transport is diagnostic-only, not application logic.
        transport = getattr(connection, "_transport", None)
        actual = transport.get_extra_info("ssl_object") if transport else None
        return {
            "status": "connected_readonly",
            "pg_stat_ssl": dict(row) if row else None,
            "transport_observed": actual is not None,
            "transport_context_is_passed_context": actual.context is context if actual else None,
            "transport_check_hostname": actual.context.check_hostname if actual else None,
            "transport_verify_mode": actual.context.verify_mode.name if actual else None,
            "peer_leaf": certificate_facts(actual.getpeercert(binary_form=True))
            if actual
            else None,
        }
    finally:
        await connection.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--handshake", action="store_true")
    parser.add_argument("--driver", action="store_true", help="Read-only real asyncpg connection")
    parser.add_argument(
        "--compare-ca", type=Path, help="Optional independently obtained local CA PEM"
    )
    args = parser.parse_args()
    settings = Settings()
    # Same exact trust construction as production, even when run from a dev checkout.
    report = {"diagnostic": "postgres_tls_v2", "utc": datetime.now(UTC).isoformat()}
    try:
        context = production_ssl_context(settings)
        report["effective_context"] = context_facts(context, settings)
        if args.compare_ca:
            raw = args.compare_ca.read_text()
            der = ssl.PEM_cert_to_DER_cert(raw)
            digest = hashlib.sha256(der).hexdigest()
            loaded = {hashlib.sha256(c).hexdigest() for c in context.get_ca_certs(binary_form=True)}
            report["comparison"] = {
                "reference_der_sha256": digest,
                "reference_is_loaded": digest in loaded,
            }
    except Exception as error:  # noqa: BLE001 — operator diagnostic exports sanitized failures
        report["context_construction_errors"] = exception_facts(error, settings)
        print(json.dumps(report, indent=2))
        return
    if args.handshake:
        try:
            report["python_handshake"] = handshake(settings, context)
        except Exception as error:  # noqa: BLE001 — operator diagnostic exports sanitized failures
            records = exception_facts(error, settings)
            report["python_handshake"] = {
                "classification": classify(records),
                "exceptions": records,
            }
        try:
            report["openssl_presented_chain"] = openssl_chain(settings, context)
        except Exception as error:  # noqa: BLE001 — operator diagnostic exports sanitized failures
            report["openssl_presented_chain"] = {"exceptions": exception_facts(error, settings)}
    if args.driver:
        try:
            report["actual_asyncpg_probe"] = asyncio.run(driver_probe(settings, context))
        except Exception as error:  # noqa: BLE001 — operator diagnostic exports sanitized failures
            records = exception_facts(error, settings)
            report["actual_asyncpg_probe"] = {
                "classification": classify(records),
                "exceptions": records,
            }
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
