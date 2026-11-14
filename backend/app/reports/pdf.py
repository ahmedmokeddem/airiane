"""Selectable, tagged A4 documents. Only embedded, application-owned assets are fetched."""

import base64
from functools import lru_cache
from pathlib import Path
from zoneinfo import ZoneInfo

from jinja2 import Environment, FileSystemLoader, select_autoescape

try:
    from weasyprint import HTML
    from weasyprint.text.fonts import FontConfiguration
    from weasyprint.urls import URLFetcherResponse
except OSError:  # WeasyPrint's GTK/Pango system libraries are absent (e.g. a Windows dev PC).
    # Keep the rest of the API running; only PDF export reports itself unavailable.
    HTML = FontConfiguration = URLFetcherResponse = None

from ..domain import DomainError
from ..services import utc
from .narrative import validate_document

ROOT = Path(__file__).resolve().parents[3]


def embedded(path: Path, mime: str) -> str:
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


@lru_cache(maxsize=1)
def assets():
    # Exact approved wordmark, not a reconstructed mark. No patient-provided resource URL.
    logo = embedded(ROOT / "portal/public/brand/airiane-wordmark.png", "image/png")
    fonts = ROOT / "mobile/assets/fonts"
    return logo, [embedded(p, "font/ttf") for p in [fonts / "Manrope-Regular.ttf"]]


def render_pdf(report: dict, perspective: str = "patient") -> bytes:
    if HTML is None:
        raise DomainError("PDF_RENDER_FAILED", 503)
    doc = report.get("document")
    if report["state"] != "ready":
        raise DomainError("REPORT_INVALIDATED", 409)
    if not doc:
        raise DomainError("REPORT_REGENERATION_REQUIRED", 409)
    validate_document(doc)
    if perspective not in ("patient", "clinician"):
        raise DomainError("VALIDATION_ERROR", 422)
    evidence = doc["snapshot"]["evidence"]
    refs = {row["id"]: f"E{i + 1:03}" for i, row in enumerate(evidence)}
    sections = []
    for section in doc["sections"]:
        sections.append(
            {
                "title": section[perspective + "_title"],
                "claims": [
                    dict(
                        c,
                        text=c[perspective + "_text"],
                        references=", ".join(sorted(refs[i] for i in c["evidence_ids"])),
                    )
                    for c in doc["claims"]
                    if c["section"] == section["id"]
                ],
            }
        )
    logo, fonts = assets()
    allowed = {logo, *fonts}

    def fetch(url, *args, **kwargs):
        if url not in allowed:
            raise ValueError("External and filesystem PDF resources are disabled")
        header, data = url.split(",", 1)
        return URLFetcherResponse(
            url,
            body=base64.b64decode(data),
            headers={"Content-Type": header.split(":", 1)[1].split(";")[0]},
        )

    env = Environment(
        loader=FileSystemLoader(Path(__file__).parent / "templates"), autoescape=select_autoescape()
    )
    content = env.get_template("report.html").render(
        report=report,
        doc=doc,
        sections=sections,
        refs=refs,
        evidence=evidence,
        perspective=perspective,
        logo=logo,
        fonts=fonts,
        date=lambda s: utc(s).astimezone(ZoneInfo(report["timezone"])).strftime("%d %b %Y"),
    )
    return HTML(string=content, url_fetcher=fetch).write_pdf(
        font_config=FontConfiguration(),
        pdf_tags=True,
        pdf_identifier=doc["content_hash"].encode(),
    )
