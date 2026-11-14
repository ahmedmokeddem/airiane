import asyncio
import hashlib
import json
import logging
import ssl
from datetime import UTC, datetime, timedelta

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

from app.config import Settings
from app.database_tls import classify, context_facts, exception_facts, production_ssl_context
from app.storage import engine_for


@pytest.fixture
def ca_pem():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "fictional diagnostic CA")])
    certificate = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.now(UTC) - timedelta(minutes=1))
        .not_valid_after(datetime.now(UTC) + timedelta(days=1))
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .sign(key, hashes.SHA256())
    )
    return certificate.public_bytes(serialization.Encoding.PEM).decode()


def settings(pem):
    # No real provider credentials, DNS or network calls in this test module.
    return Settings(
        _env_file=None,
        environment="production",
        demo_auth=False,
        database_url="postgresql://hidden-user:hidden-password@postgres.example.invalid:5432/hidden-db?sslmode=verify-full&sslrootcert=/missing/declared.pem",
        database_ca_pem=pem,
        supabase_url="https://auth.example.invalid",
        cors_origins="https://portal.example.invalid",
        elevenlabs_api_key="hidden-provider-key",
        elevenlabs_agent_id="fixture-agent",
        provider_privacy_verified=True,
        provider_privacy_policy_version="fixture-only",
    )


def test_context_reports_loaded_certificates_and_explicit_context_precedence(ca_pem):
    configured = settings(ca_pem)
    context = production_ssl_context(configured)
    report = context_facts(context, configured)
    digest = hashlib.sha256(ssl.PEM_cert_to_DER_cert(ca_pem)).hexdigest()
    assert report["loaded_ca_der_sha256"] == [digest]
    assert report["configured_cas_actually_loaded"]
    assert report["ca_source"] == "RE_DATABASE_CA_PEM_in_memory"
    assert report["effective_ca_path"] is None
    assert report["sslrootcert_declared"]["path"] == "/missing/declared.pem"
    assert not report["sslrootcert_declared"]["exists"]
    assert not report["sslrootcert_applied"]
    assert report["check_hostname"] and report["verify_mode"] == "CERT_REQUIRED"
    assert report["sslmode_requested"] == "verify-full"
    assert report["hostname"] == "postgres.example.invalid"
    assert not report["matches_local_tested_ca"]
    serialized = json.dumps(report)
    assert "hidden-password" not in serialized and "hidden-user" not in serialized
    assert "hidden-provider-key" not in serialized and "postgresql://" not in serialized


def test_exception_graph_includes_exact_tls_details_but_masks_credentials(ca_pem):
    configured = settings(ca_pem)
    tls = ssl.SSLCertVerificationError(1, "certificate verify failed hidden-password")
    tls.verify_code = 19
    tls.verify_message = "self-signed certificate in certificate chain"
    wrapper = RuntimeError("must not log this wrapper or hidden-provider-key")
    wrapper.__cause__ = tls
    wrapper.orig = ConnectionResetError("must not log this either")
    report = exception_facts(wrapper, configured)
    assert len(report) == 3
    detail = next(item for item in report if item["type"] == "ssl.SSLCertVerificationError")
    assert detail["verification_code"] == 19
    assert detail["verification_message"] == tls.verify_message
    assert "[redacted]" in detail["message"]
    assert "hidden-password" not in json.dumps(report)
    assert "hidden-provider-key" not in json.dumps(report)
    assert "untrusted_ca_or_incomplete_chain" in classify(report)
    for code, expected in [
        (62, "hostname_mismatch_or_wrong_endpoint"),
        (10, "certificate_validity_period"),
    ]:
        assert (
            classify([{"type": "ssl.SSLCertVerificationError", "verification_code": code}])
            == expected
        )


def test_actual_asyncpg_call_receives_reported_context(ca_pem, monkeypatch, caplog):
    configured = settings(ca_pem)
    passed = []

    async def fake_connect(dsn, **kwargs):
        passed.append(kwargs["ssl"])
        error = ssl.SSLCertVerificationError(1, "certificate verify failed")
        error.verify_code = 19
        error.verify_message = "self-signed certificate in certificate chain"
        raise error

    monkeypatch.setattr("asyncpg.connect", fake_connect)
    engine = engine_for(configured.database_url, configured)

    async def run():
        try:
            async with engine.connect():
                pytest.fail("fixture must fail")
        except ssl.SSLCertVerificationError:
            pass
        finally:
            await engine.dispose()

    with caplog.at_level(logging.WARNING, logger="uvicorn.error"):
        asyncio.run(run())
    message = next(
        r.getMessage()
        for r in caplog.records
        if r.getMessage().startswith("PostgreSQL TLS diagnostic:")
    )
    report = json.loads(message.split(": ", 1)[1])
    facts = report["effective_context_passed_to_asyncpg"]
    assert facts["context_object_id"] == id(passed[0])
    assert facts["configured_cas_actually_loaded"]
    assert passed[0].check_hostname and passed[0].verify_mode == ssl.CERT_REQUIRED
    assert "hidden-password" not in message


def test_ca_file_inventory_reports_readability_size_and_file_hash(ca_pem, tmp_path):
    from app.database_tls import file_facts

    path = tmp_path / "public-ca.pem"
    path.write_text(ca_pem)
    result = file_facts(str(path), settings(ca_pem))
    assert result["exists"] and result["readable"]
    assert result["size"] == len(ca_pem.encode())
    assert result["sha256"] == hashlib.sha256(ca_pem.encode()).hexdigest()


def test_malformed_ca_reports_driver_was_not_invoked(monkeypatch, caplog):
    configured = settings("-----BEGIN CERTIFICATE-----\nQUJD\n-----END CERTIFICATE-----")

    async def forbidden_connect(*args, **kwargs):
        pytest.fail("asyncpg must not be called if SSLContext construction failed")

    monkeypatch.setattr("asyncpg.connect", forbidden_connect)
    engine = engine_for(configured.database_url, configured)

    async def run():
        try:
            async with engine.connect():
                pytest.fail("malformed certificate must fail")
        except ssl.SSLError:
            pass
        finally:
            await engine.dispose()

    with caplog.at_level(logging.WARNING, logger="uvicorn.error"):
        asyncio.run(run())
    message = next(
        r.getMessage()
        for r in caplog.records
        if r.getMessage().startswith("PostgreSQL TLS diagnostic:")
    )
    report = json.loads(message.split(": ", 1)[1])
    assert report["context_construction_failed"]
    assert not report["driver_invoked"]
    assert report["effective_context_passed_to_asyncpg"] is None
    assert report["exceptions"][0]["type"] == "ssl.SSLError"
