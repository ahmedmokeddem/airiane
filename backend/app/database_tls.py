"""Observe the exact SSLContext passed to asyncpg; never weaken verification."""

import hashlib
import os
import platform
import re
import ssl
from importlib.metadata import version
from pathlib import Path

from sqlalchemy.engine import make_url

from .database_url import postgres_dsn

# Comparison metadata only, NOT a new trust anchor or embedded CA certificate.
LOCAL_TESTED_CA_SHA256 = "065a750d0d64f62dacdc979e3b83d211954071ea59b8f3407c4e87ca68346457"


def redact(value, settings):
    text = str(value)
    try:
        url = make_url(postgres_dsn(settings.database_url))
        secrets = [url.password, url.username, settings.database_url]
    except ValueError:
        secrets = [settings.database_url]
    secrets += [settings.elevenlabs_api_key]
    for secret in sorted(filter(None, secrets), key=len, reverse=True):
        text = text.replace(secret, "[redacted]")
    text = re.sub(r"(?:postgres(?:ql)?(?:\+asyncpg)?://)\S+", "[redacted-dsn]", text)
    return text[:2048]


def file_facts(path, settings):
    if not path:
        return {"path": None, "exists": False, "readable": False, "size": None, "sha256": None}
    result = {
        "path": redact(path, settings),
        "exists": False,
        "readable": False,
        "size": None,
        "sha256": None,
    }
    try:
        p = Path(path).expanduser()
        result.update(exists=p.exists(), readable=os.access(p, os.R_OK))
        if p.is_file():
            result.update(size=p.stat().st_size, sha256=hashlib.sha256(p.read_bytes()).hexdigest())
    except (OSError, ValueError):
        result["inspection"] = "unavailable"
    return result


def exception_facts(error, settings):
    """Walk orig, cause, context and exception groups; emit TLS messages only."""
    pending = [("root", error)]
    seen = set()
    records = []
    while pending and len(records) < 16:
        relation, current = pending.pop(0)
        if id(current) in seen:
            continue
        seen.add(id(current))
        item = {
            "relation": relation,
            "type": f"{type(current).__module__}.{type(current).__qualname__}",
        }
        state = getattr(current, "sqlstate", None)
        if isinstance(state, str) and re.fullmatch(r"[A-Z0-9]{5}", state):
            item["sqlstate"] = state
        if isinstance(current, OSError) and isinstance(current.errno, int):
            item["errno"] = current.errno
        if isinstance(current, ssl.SSLError):
            item.update(
                tls=True,
                message=redact(str(current), settings),
                verification_code=getattr(current, "verify_code", None),
                verification_message=redact(getattr(current, "verify_message", ""), settings),
                library=getattr(current, "library", None),
                reason=getattr(current, "reason", None),
            )
        records.append(item)
        for attr in ("orig", "__cause__", "__context__"):
            child = getattr(current, attr, None)
            if isinstance(child, BaseException):
                pending.append((attr, child))
        for child in getattr(current, "exceptions", ()):
            if isinstance(child, BaseException):
                pending.append(("group_member", child))
    return records


def classify(records):
    codes = {r.get("verification_code") for r in records}
    if 62 in codes or 64 in codes:
        return "hostname_mismatch_or_wrong_endpoint"
    if codes & {9, 10, 11, 12}:
        return "certificate_validity_period"
    if codes & {18, 19, 20, 21}:
        return "untrusted_ca_or_incomplete_chain_compare_loaded_ca_and_peer_chain"
    if any(r.get("verification_code") is not None for r in records):
        return "certificate_validation_failure"
    if any(r.get("tls") or "SSLError" in r["type"] for r in records):
        return "ssl_configuration_or_protocol_failure"
    if any(r.get("sqlstate") in ("28P01", "28000") for r in records):
        return "database_authentication_failure_after_tls"
    if any("TimeoutError" in r["type"] for r in records):
        return "network_or_handshake_timeout"
    if any(r.get("errno") is not None for r in records):
        return "network_failure"
    return "network_protocol_or_non_tls_failure_inspect_exception_types"


def production_ssl_context(settings):
    # Identical to the previous production code. Do not change trust or verify flags.
    return ssl.create_default_context(cadata=settings.database_ca_pem or None)


def context_facts(context, settings):
    """Inspect loaded trust, not merely the configured environment variable."""
    url = make_url(postgres_dsn(settings.database_url))
    defaults = ssl.get_default_verify_paths()
    configured = settings.database_ca_pem
    loaded = sorted(hashlib.sha256(c).hexdigest() for c in context.get_ca_certs(binary_form=True))
    declared = []
    for block in re.findall(
        r"-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----", configured, re.DOTALL
    ):
        declared.append(hashlib.sha256(ssl.PEM_cert_to_DER_cert(block)).hexdigest())
    root = url.query.get("sslrootcert") or os.getenv("PGSSLROOTCERT")
    host = url.query.get("host") or url.host
    return {
        "driver": "asyncpg",
        "driver_version": version("asyncpg"),
        "python": platform.python_version(),
        "openssl": ssl.OPENSSL_VERSION,
        "uid": os.geteuid(),
        "hostname": redact(host, settings),
        "port": url.query.get("port") or url.port or 5432,
        "dsn_hostname": redact(url.host, settings),
        "hostname_from_query": bool(url.query.get("host")),
        "sslmode_requested": redact(
            url.query.get("sslmode", os.getenv("PGSSLMODE", "unset")), settings
        ),
        "ssl_argument": "explicit_SSLContext",
        "context_object_id": id(context),
        "check_hostname": context.check_hostname,
        "verify_mode": context.verify_mode.name,
        "verify_flags": int(context.verify_flags),
        "minimum_version": context.minimum_version.name,
        "maximum_version": context.maximum_version.name,
        "asyncpg_internal_mode": "require_for_SSLContext_but_context_verification_is_preserved",
        "sslrootcert_declared": file_facts(root, settings),
        "sslrootcert_applied": False,
        "sslrootcert_note": "explicit SSLContext takes precedence; driver does not load this file",
        "other_ssl_parameters": {
            key: {"present": key in url.query, "applied_by_this_context": False}
            for key in (
                "sslcert",
                "sslkey",
                "sslcrl",
                "sslpassword",
                "ssl_min_protocol_version",
                "ssl_max_protocol_version",
            )
        },
        "sslnegotiation_requested": redact(
            url.query.get("sslnegotiation", os.getenv("PGSSLNEGOTIATION", "postgres")), settings
        ),
        "ca_source": "RE_DATABASE_CA_PEM_in_memory" if configured else "system_default_paths",
        "effective_ca_path": None if configured else defaults.cafile,
        "effective_ca_file": None if configured else file_facts(defaults.cafile, settings),
        "ca_input_bytes": len(configured.encode()),
        "ca_input_sha256": hashlib.sha256(configured.encode()).hexdigest() if configured else None,
        "configured_ca_der_sha256": declared,
        "loaded_ca_der_sha256": loaded[:16],
        "loaded_ca_count": len(loaded),
        "loaded_ca_list_truncated": len(loaded) > 16,
        "loaded_ca_set_sha256": hashlib.sha256("\n".join(loaded).encode()).hexdigest(),
        "configured_cas_actually_loaded": bool(declared) and set(declared).issubset(loaded),
        "matches_local_tested_ca": LOCAL_TESTED_CA_SHA256 in loaded,
        "local_tested_ca_der_sha256": LOCAL_TESTED_CA_SHA256,
        "system_cafile": file_facts(defaults.cafile, settings),
        "system_capath": file_facts(defaults.capath, settings),
        "default_ca_paths_active": not bool(configured),
        "trust_store_stats": context.cert_store_stats(),
    }
