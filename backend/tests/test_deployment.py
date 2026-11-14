import asyncio
from datetime import timedelta
from types import SimpleNamespace
from uuid import uuid4

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app.auth import Authenticator
from app.config import Settings
from app.domain import DomainError, now
from app.main import create_app
from app.storage import engine_for


def production(**overrides):
    values = {
        "environment": "production",
        "database_url": "postgresql://fictional:fixture@db.example.invalid/test?sslmode=verify-full",
        "supabase_url": "https://auth.example.invalid",
        "cors_origins": "https://portal.example.invalid",
        "elevenlabs_api_key": "fixture-only",
        "elevenlabs_agent_id": "fixture-agent",
        "provider_privacy_verified": True,
        "provider_privacy_policy_version": "fixture-review",
        "_env_file": None,
    }
    return Settings(**(values | overrides))


def test_production_rejects_demo_incomplete_config_insecure_tls_and_origins():
    production()
    for fields in [
        {"demo_auth": True},
        {"database_url": "sqlite+aiosqlite:///x"},
        {"database_url": "postgresql://u:p@db/x?sslmode=require"},
        {"cors_origins": "*"},
        {"cors_origins": "https://*"},
        {"supabase_url": "http://localhost"},
        {"provider_privacy_verified": False},
        {"elevenlabs_api_key": ""},
    ]:
        with pytest.raises(ValueError):
            production(**fields)
    engine = engine_for(production().database_url, production())
    assert engine.pool.size() == 2 and engine.pool._max_overflow == 1
    asyncio.run(engine.dispose())


def test_health_survives_database_outage_without_exposing_details():
    settings = production(
        database_url="postgresql://fixture:private-test-password@127.0.0.1:1/unavailable?sslmode=verify-full",
        readiness_timeout=0.2,
    )
    with TestClient(create_app(settings)) as client:
        assert client.get("/health/live").json() == {"status": "alive"}
        r = client.get("/health/ready")
        assert r.status_code == 503 and r.json() == {"status": "not_ready"}
        assert "password" not in r.text and "127.0.0.1" not in r.text
        assert (
            client.get("/v1/me", headers={"Authorization": "Bearer demo-patient-token"}).status_code
            == 401
        )


def test_production_jwt_verifies_signature_issuer_audience_and_expiry():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    verifier = Authenticator(production())
    verifier.keys = SimpleNamespace(
        get_signing_key_from_jwt=lambda _: SimpleNamespace(key=key.public_key())
    )
    claims = {
        "sub": str(uuid4()),
        "iss": "https://auth.example.invalid/auth/v1",
        "aud": "authenticated",
        "exp": now() + timedelta(minutes=5),
    }
    good = jwt.encode(claims, key, algorithm="RS256")
    assert asyncio.run(verifier.verify("Bearer " + good)).subject == claims["sub"]
    for payload, signer in [
        (claims, other),
        (claims | {"aud": "other"}, key),
        (claims | {"iss": "https://other.invalid/auth/v1"}, key),
        (claims | {"exp": now() - timedelta(seconds=2)}, key),
    ]:
        with pytest.raises(DomainError):
            asyncio.run(verifier.verify("Bearer " + jwt.encode(payload, signer, algorithm="RS256")))


def test_readiness_logs_only_safe_reason(caplog):
    import logging
    import ssl

    from app.health import readiness_reason

    secret = "postgresql://private-user:private-password@private-host/db"
    assert readiness_reason(ssl.SSLError(secret)) == "database_tls"
    assert readiness_reason(ConnectionRefusedError(secret)) == "database_network"
    assert readiness_reason(TimeoutError(secret)) == "database_timeout"
    settings = production(
        database_url="postgresql://fixture:private-test-password@127.0.0.1:1/unavailable?sslmode=verify-full",
        readiness_timeout=0.2,
    )
    with (
        caplog.at_level(logging.WARNING, logger="uvicorn.error"),
        TestClient(create_app(settings)) as client,
    ):
        assert client.get("/health/ready").status_code == 503
        assert client.get("/health/ready").status_code == 503
    records = [r.getMessage() for r in caplog.records if "Readiness failed:" in r.getMessage()]
    assert len(records) == 1
    assert records[0] in (
        "Readiness failed: database_network",
        "Readiness failed: database_timeout",
    )
    assert "private-test-password" not in " ".join(records)
