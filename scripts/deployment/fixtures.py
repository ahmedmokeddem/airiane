"""Generate short-lived LOCAL test-only TLS/JWT keys outside the Docker build context."""

import base64
import datetime as dt
import ipaddress
import os
import sys
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

root = Path(sys.argv[1])
root.mkdir(parents=True, exist_ok=True)
root.chmod(0o755)
key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "AIriane LOCAL fixture CA")])
now = dt.datetime.now(dt.UTC)
ca = (
    x509.CertificateBuilder()
    .subject_name(name)
    .issuer_name(name)
    .public_key(key.public_key())
    .serial_number(x509.random_serial_number())
    .not_valid_before(now - dt.timedelta(minutes=1))
    .not_valid_after(now + dt.timedelta(days=1))
    .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
    .sign(key, hashes.SHA256())
)
(root / "ca.pem").write_bytes(ca.public_bytes(serialization.Encoding.PEM))
for stem in ["gateway", "pg"]:
    leaf = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    cert = (
        x509.CertificateBuilder()
        .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "LOCAL fixture server")]))
        .issuer_name(name)
        .public_key(leaf.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - dt.timedelta(minutes=1))
        .not_valid_after(now + dt.timedelta(days=1))
        .add_extension(
            x509.SubjectAlternativeName(
                [
                    *[
                        x509.DNSName(n)
                        for n in [
                            "api.fixture.test",
                            "portal.fixture.test",
                            "auth.fixture.test",
                            "pg.fixture.test",
                        ]
                    ],
                    x509.IPAddress(ipaddress.ip_address("127.0.0.1")),
                ]
            ),
            critical=False,
        )
        .sign(key, hashes.SHA256())
    )
    (root / (stem + ".crt")).write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    (root / (stem + ".key")).write_bytes(
        leaf.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
    )
    os.chmod(root / (stem + ".key"), 0o600)
jwtkey = rsa.generate_private_key(public_exponent=65537, key_size=2048)
(root / "jwt.key").write_bytes(
    jwtkey.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    )
)
os.chmod(root / "jwt.key", 0o600)
(root / "portal.key").write_text(base64.b64encode(os.urandom(32)).decode())
# These are intentionally non-live fixture configuration files, not reusable credentials.
common = "RE_ENVIRONMENT=production\nRE_DEMO_AUTH=false\nRE_DATABASE_URL=postgresql://re:local_container_fixture@pg.fixture.test:5432/re_test?sslmode=verify-full&sslrootcert=/fixtures/ca.pem\nRE_SUPABASE_URL=https://auth.fixture.test\nRE_CORS_ORIGINS=https://portal.fixture.test:9443\nRE_ELEVENLABS_API_KEY=fixture-no-provider-calls\nRE_ELEVENLABS_AGENT_ID=fixture-agent\nRE_PROVIDER_PRIVACY_VERIFIED=true\nRE_PROVIDER_PRIVACY_POLICY_VERSION=fixture-only\nSSL_CERT_FILE=/fixtures/ca.pem\n"
(root / "api.env").write_text(common)
(root / "portal.env").write_text(
    "NODE_ENV=production\nPORTAL_DATA_MODE=api\nPORTAL_DEMO_AUTH=false\nRE_API_URL=https://api.fixture.test\nRE_SUPABASE_URL=https://auth.fixture.test\nRE_SUPABASE_ANON_KEY=sb_publishable_fictional\nPORTAL_PUBLIC_URL=https://portal.fixture.test:9443\nPORTAL_SESSION_KEY="
    + (root / "portal.key").read_text()
    + "\nNODE_EXTRA_CA_CERTS=/fixtures/ca.pem\n"
)
print("Generated local-only short-lived fixtures; no live environment file read.")

for filename in ["api.env", "portal.env", "portal.key"]:
    os.chmod(root / filename, 0o600)
