"""Exercise actual production images against local TLS/JWKS/SQL fixtures; no real provider calls."""

import datetime as dt
import json
import ssl
from pathlib import Path
from uuid import uuid4

import httpx

context = ssl.create_default_context(cafile="/fixtures/ca.pem")
client = httpx.Client(verify=context, timeout=90, follow_redirects=False)
api = "https://api.fixture.test"
portal = "https://portal.fixture.test"


def token(who):
    r = client.post(
        "https://auth.fixture.test/auth/v1/token?grant_type=password",
        json={"email": who + "@example.invalid", "password": "local-fixture-password"},
    )
    r.raise_for_status()
    return r.json()["access_token"]


patient = token("patient")
doctor = token("clinician")
other = token("other")


def request(method, path, body=None, who=patient, status=200):
    r = client.request(
        method,
        api + "/v1" + path,
        json=body,
        headers={"Authorization": "Bearer " + who, "Idempotency-Key": str(uuid4())},
    )
    assert r.status_code == status, (path, r.status_code)
    return r.json() if r.content else None


assert client.get(api + "/health/live").json() == {"status": "alive"}
assert client.get(api + "/health/ready").status_code == 200
assert (
    client.get(api + "/v1/me", headers={"Authorization": "Bearer demo-patient-token"}).status_code
    == 401
)
for bearer in [patient, other]:
    request(
        "POST",
        "/me/onboarding",
        {"display_name": "Fictional container patient", "timezone": "Europe/Helsinki"},
        who=bearer,
        status=201,
    )
me = request("GET", "/me")
pid = me["user_id"]
cid = request("GET", "/me", who=doctor)["user_id"]
report = request(
    "POST",
    "/reports",
    {
        "period_start": (dt.datetime.now(dt.UTC) - dt.timedelta(days=7)).isoformat(),
        "period_end": dt.datetime.now(dt.UTC).isoformat(),
    },
    status=202,
)
rid = report["report_id"]
path = f"/doctor/patients/{pid}/reports/{rid}"
request("GET", path, who=doctor, status=403)
assert client.get(api + "/v1/reports/" + rid + "/pdf").status_code == 401
request("GET", "/reports/" + rid, who=other, status=404)
link = request("POST", "/care-links", {"clinician_id": cid}, status=201)
request("PATCH", "/care-links/" + link["care_link_id"], {"action": "accept"}, who=doctor)
grant = request(
    "POST",
    "/consents",
    {
        "scope": "reports",
        "care_link_id": link["care_link_id"],
        "expires_at": (dt.datetime.now(dt.UTC) + dt.timedelta(hours=1)).isoformat(),
        "data_from": None,
    },
    status=201,
)
request("GET", path, who=doctor)
pdf = client.get(api + "/v1" + path + "/pdf", headers={"Authorization": "Bearer " + doctor})
assert (
    pdf.status_code == 200
    and pdf.content.startswith(b"%PDF")
    and "no-store" in pdf.headers["cache-control"]
)
assert client.get(portal + "/login").status_code == 200
assert "development clinician" not in client.get(portal + "/login").text.lower()
proxy = f"{portal}/reports/{pid}/{rid}/pdf"
assert client.get(proxy).status_code == 401
assert (
    client.post(
        portal + "/auth/login", data={"mode": "demo"}, headers={"Origin": "https://evil.invalid"}
    ).status_code
    == 403
)
rejected = client.post(
    portal + "/auth/login",
    data={"email": "patient@example.invalid", "password": "local-fixture-password"},
    headers={"Origin": "https://portal.fixture.test:9443"},
)
assert (
    rejected.status_code == 303
    and "sign-in-failed" in rejected.headers["location"]
    and "set-cookie" not in rejected.headers
)
login = client.post(
    portal + "/auth/login",
    data={"email": "clinician@example.invalid", "password": "local-fixture-password"},
    headers={"Origin": "https://portal.fixture.test:9443"},
)
assert login.status_code == 303
cookie = login.headers["set-cookie"]
assert (
    "HttpOnly" in cookie
    and "Secure" in cookie
    and "SameSite=lax" in cookie
    and doctor not in cookie
)
page = client.get(portal + f"/?patient={pid}&report={rid}")
assert page.status_code == 200 and "A clearer thread" in page.text, (
    "portal report",
    page.status_code,
    page.headers.get("content-encoding"),
    "Reports unavailable" in page.text,
)
export = client.get(proxy)
assert (
    export.status_code == 200
    and export.headers["content-type"].startswith("application/pdf")
    and export.content.startswith(b"%PDF")
)
request("DELETE", "/consents/" + grant["consent_grant_id"], status=204)
assert client.get(proxy).status_code == 403
assert "A clearer thread" not in client.get(portal + f"/?patient={pid}&report={rid}").text
allowed = client.options(
    api + "/v1/me",
    headers={"Origin": "https://portal.fixture.test:9443", "Access-Control-Request-Method": "GET"},
)
assert allowed.headers.get("access-control-allow-origin") == "https://portal.fixture.test:9443"
denied = client.options(
    api + "/v1/me",
    headers={"Origin": "https://evil.invalid", "Access-Control-Request-Method": "GET"},
)
assert "access-control-allow-origin" not in denied.headers
result = {
    "production_containers": True,
    "local_verified_tls_postgresql": True,
    "signed_fixture_jwks_auth": True,
    "actual_supabase_project": False,
    "real_elevenlabs_call": False,
    "portal_secure_encrypted_cookie": True,
    "csrf": True,
    "cors": True,
    "report_authorization_and_revocation": True,
    "authorized_pdf_proxy": True,
    "pdf_bytes": len(export.content),
    "report_id": rid,
}
Path("/fixtures/result.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result))
