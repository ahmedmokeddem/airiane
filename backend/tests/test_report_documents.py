import copy
from datetime import timedelta
from io import BytesIO

import pytest
from pypdf import PdfReader
from test_insights import proposal
from test_reports import complete, report, report_client, sharing  # noqa: F401
from test_slice import headers, onboard, start

from app.domain import DomainError, now, stamp
from app.reports.narrative import document, validate_document
from app.reports.pdf import render_pdf


def test_pdf_ownership_consent_revocation_and_selectable_text(report_client):  # noqa: F811
    c = report_client
    complete(c)
    rid, payload = report(c)
    path = f"/v1/reports/{rid}/pdf"
    assert c.get(path).status_code == 401
    onboard(c, "demo-other-patient-token")
    assert c.get(path, headers=headers("demo-other-patient-token")).status_code == 404
    assert c.get(path, headers=headers("demo-clinician-token")).status_code == 403
    exported = c.get(path, headers=headers())
    assert exported.status_code == 200, exported.text[:200] if exported.status_code != 200 else ""
    assert "no-store" in exported.headers["cache-control"]
    assert exported.content.startswith(b"%PDF")
    reader = PdfReader(BytesIO(exported.content))
    assert all(abs(float(p.mediabox.width) - 595.28) < 1 for p in reader.pages)
    text = " ".join(p.extract_text() for p in reader.pages)
    assert "Evidence references" in text and "1 breathing" in text
    assert reader.trailer["/Root"].get("/StructTreeRoot")
    doctor = f"/v1/doctor/patients/{payload['patient_id']}/reports/{rid}/pdf"
    assert c.get(doctor, headers=headers("demo-clinician-token")).status_code == 403
    _, grant = sharing(c)
    assert c.get(doctor, headers=headers("demo-clinician-token")).status_code == 200
    c.delete("/v1/consents/" + grant, headers=headers())
    assert c.get(doctor, headers=headers("demo-clinician-token")).status_code == 403


def test_unicode_withdrawal_and_new_version(report_client):  # noqa: F811
    c = report_client
    sid = start(c)
    body = {
        **proposal(sid),
        "text": "Fictional: Café, naïve, hyvää yötä — Ελληνικά. <script>evil</script>",
    }
    note = c.post("/v1/confirmed-insights", json=body, headers=headers()).json()
    rid, payload = report(c)
    pdf = render_pdf(payload)
    text = " ".join(p.extract_text() for p in PdfReader(BytesIO(pdf)).pages)
    assert "Café" in text and "Ελληνικά" in text and "<script>evil</script>" in text
    assert (
        c.delete("/v1/confirmed-insights/" + note["insight_id"], headers=headers()).status_code
        == 204
    )
    assert c.get(f"/v1/reports/{rid}/pdf", headers=headers()).status_code == 409
    stale = c.get("/v1/reports/" + rid, headers=headers()).json()
    assert "document" not in stale and body["text"] not in str(stale)
    response = c.post(
        "/v1/reports",
        json={
            "period_start": payload["period_start"],
            "period_end": payload["period_end"],
            "regeneration_of": rid,
        },
        headers=headers(),
    )
    assert response.status_code == 202, response.text
    assert response.json()["version"] == 2 and response.json()["report_id"] != rid


def test_comparisons_and_prior_period_grants(report_client):  # noqa: F811
    c = report_client
    sid = start(c)
    for days in (1, 2, 3, 8, 9, 10):
        response = c.post(
            "/v1/confirmed-insights",
            json={
                **proposal(sid),
                "text": f"Fictional confirmed note {days}",
                "observed_at": (now() - timedelta(days=days)).isoformat(),
            },
            headers=headers(),
        )
        assert response.status_code == 201, response.text
    start_date = (now() - timedelta(days=7)).isoformat()
    receipt = c.post(
        "/v1/reports",
        json={"period_start": start_date, "period_end": stamp(), "compare_previous": True},
        headers=headers(),
    ).json()
    rid = receipt["report_id"]
    payload = c.get("/v1/reports/" + rid, headers=headers()).json()
    doc = payload["document"]
    assert len(doc["snapshot"]["evidence"]) == 6
    comparison = next(c for c in doc["claims"] if c["id"] == "changes-fatigue")
    assert len(comparison["evidence_ids"]) == 6
    assert "not a measured change" in comparison["patient_text"]
    lid, _ = sharing(c)
    c.post(
        "/v1/consents",
        json={
            "scope": "reports",
            "care_link_id": lid,
            "expires_at": (now() + timedelta(days=1)).isoformat(),
            "data_from": start_date,
        },
        headers=headers(),
    )
    path = f"/v1/doctor/patients/{payload['patient_id']}/reports"
    assert c.get(path + "/" + rid, headers=headers("demo-clinician-token")).status_code == 403
    assert (
        c.get(path + "/" + rid + "/pdf", headers=headers("demo-clinician-token")).status_code == 403
    )
    assert not c.get(path, headers=headers("demo-clinician-token")).json()["items"]
    mutated = copy.deepcopy(doc)
    mutated["claims"][0]["patient_text"] = "Your symptoms improved by 50%."
    from app.reports.evidence import digest

    mutated["content_hash"] = digest({k: v for k, v in mutated.items() if k != "content_hash"})
    with pytest.raises(DomainError):
        validate_document(mutated)


def test_empty_snapshot_and_untrusted_generator(report_client):  # noqa: F811
    c = report_client
    start(c)
    _, payload = report(c)
    doc = payload["document"]
    assert not doc["charts"]
    assert any("no confirmed conversation" in c["patient_text"].lower() for c in doc["claims"])

    class Unsupported:
        version = "future-test"

        def generate(self, snapshot):
            claims = copy.deepcopy(doc["claims"])
            claims[0]["patient_text"] = "A fabricated result."
            return claims

    with pytest.raises(DomainError):
        document(doc["snapshot"], Unsupported())


def test_revocation_during_render_prevents_delivery(report_client, monkeypatch):  # noqa: F811
    c = report_client
    complete(c)
    rid, payload = report(c)
    _, grant = sharing(c)
    real = render_pdf

    def render_then_revoke(report, perspective):
        pdf = real(report, perspective)
        assert c.delete("/v1/consents/" + grant, headers=headers()).status_code == 204
        return pdf

    monkeypatch.setattr("app.reports.routes.render_pdf", render_then_revoke)
    response = c.get(
        f"/v1/doctor/patients/{payload['patient_id']}/reports/{rid}/pdf",
        headers=headers("demo-clinician-token"),
    )
    assert response.status_code == 403
    assert response.headers["content-type"].startswith("application/json")


def test_withdrawal_during_render_prevents_delivery(report_client, monkeypatch):  # noqa: F811
    c = report_client
    sid = start(c)
    note = c.post("/v1/confirmed-insights", json=proposal(sid), headers=headers()).json()
    rid, _ = report(c)

    def render_then_withdraw(payload, perspective):
        pdf = render_pdf(payload, perspective)
        assert (
            c.delete("/v1/confirmed-insights/" + note["insight_id"], headers=headers()).status_code
            == 204
        )
        return pdf

    monkeypatch.setattr("app.reports.routes.render_pdf", render_then_withdraw)
    assert c.get(f"/v1/reports/{rid}/pdf", headers=headers()).status_code == 409


def test_prior_note_withdrawal_invalidates_comparison_export(report_client):  # noqa: F811
    c = report_client
    sid = start(c)
    note = c.post(
        "/v1/confirmed-insights",
        json={**proposal(sid), "observed_at": (now() - timedelta(days=8)).isoformat()},
        headers=headers(),
    ).json()
    receipt = c.post(
        "/v1/reports",
        json={
            "period_start": (now() - timedelta(days=7)).isoformat(),
            "period_end": stamp(),
            "compare_previous": True,
        },
        headers=headers(),
    ).json()
    rid = receipt["report_id"]
    payload = c.get("/v1/reports/" + rid, headers=headers()).json()
    assert len(payload["document"]["snapshot"]["evidence"]) == 1
    assert (
        c.delete("/v1/confirmed-insights/" + note["insight_id"], headers=headers()).status_code
        == 204
    )
    stale = c.get("/v1/reports/" + rid, headers=headers()).json()
    assert stale["state"] == "stale" and "document" not in stale
    assert stale["evidence_period_start"] < payload["period_start"]
    lid, _ = sharing(c)
    c.post(
        "/v1/consents",
        json={
            "scope": "reports",
            "care_link_id": lid,
            "expires_at": (now() + timedelta(days=1)).isoformat(),
            "data_from": payload["period_start"],
        },
        headers=headers(),
    )
    path = f"/v1/doctor/patients/{payload['patient_id']}/reports"
    assert c.get(path + "/" + rid, headers=headers("demo-clinician-token")).status_code == 403
    assert not c.get(path, headers=headers("demo-clinician-token")).json()["items"]
    assert note["text"] not in str(stale)
    assert c.get("/v1/reports/" + rid + "/pdf", headers=headers()).status_code == 409


def test_pdf_dates_respect_patient_timezone_at_midnight():
    from app.reports.examples import example

    payload = example("empty")
    payload["period_start"] = "2026-11-06T22:00:00+00:00"
    payload["document"]["snapshot"]["current_start"] = payload["period_start"]
    payload["document"] = document(payload["document"]["snapshot"])
    text = "\n".join(p.extract_text() for p in PdfReader(BytesIO(render_pdf(payload))).pages)
    assert "07 Nov 2026" in text and "06 Nov 2026" not in text
