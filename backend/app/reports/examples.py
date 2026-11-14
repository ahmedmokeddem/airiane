"""Reproducible fictional document specimens; never reads the database or environment secrets."""

import argparse
import json
from collections import Counter
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from .narrative import document
from .pdf import render_pdf


def uid(label):
    return str(uuid5(NAMESPACE_URL, "airiane-fictional-report/" + label))


def example(name):
    end = datetime(2026, 11, 14, tzinfo=UTC)
    start = end - timedelta(days=7)
    rows = []

    def add(
        kind,
        index,
        days,
        label,
        category,
        text=None,
        value=None,
        phase="current",
        origin="direct_statement",
        unit=None,
    ):
        key = f"{name}-{kind}-{index}"
        rows.append(
            {
                "id": kind + ":" + uid(key),
                "record_id": uid(key),
                "kind": kind,
                "date": (end - timedelta(days=days)).isoformat(),
                "source_ids": [uid("source-" + key)],
                "label": label,
                "text": text,
                "value": value,
                "unit": unit,
                "category": category,
                "phase": phase,
                "origin": origin,
            }
        )

    if name != "empty":
        for i in range(3):
            add("activity", i, i + 1, "Calm Breathing", "breathing", origin="curated_catalog")
            add(
                "feedback",
                i,
                i + 1,
                "Calm Breathing",
                "breathing",
                text="Fictional: I enjoyed having a quiet minute." if i == 0 else None,
                value=[4, 3, 5][i],
                unit="helpfulness_1_5",
                origin="patient_explicit_feedback",
            )
    if name in ("confirmed", "longitudinal"):
        texts = [
            ("fatigue", "Fictional: I felt tired after work, so I chose to rest."),
            ("goal", "Fictional: I want to make room for a gentle daily pause."),
            ("clinician_question", "Fictional: Could we discuss my sleep routine?"),
            (
                "reflection",
                "Fictional: Café, hyvää yötä — Ελληνικά. A quiet moment mattered to me.",
            ),
        ]
        for i, (theme, text) in enumerate(texts):
            add("insight", i, i + 1, theme.replace("_", " "), theme, text=text)
        if name == "longitudinal":
            for i in range(3):
                add(
                    "insight",
                    i + 10,
                    i + 8,
                    "fatigue",
                    "fatigue",
                    text=f"Fictional previous-period note {i + 1}: I wanted an afternoon rest.",
                    phase="previous",
                )
            for i, value in enumerate((6, 7.5, 6.5, 8)):
                add(
                    "observation",
                    i,
                    i + 1,
                    "sleep hours",
                    "sleep_hours",
                    value=value,
                    unit="hours",
                    origin="patient_confirmed_value",
                )
    rows.sort(key=lambda r: (r["date"], r["kind"], r["id"]))

    def stats(phase):
        rr = [r for r in rows if r["phase"] == phase]
        return {
            "counts": dict(Counter(r["kind"] for r in rr)),
            "active_days": len({r["date"][:10] for r in rr}),
            "themes": dict(Counter(r["category"] for r in rr if r["kind"] == "insight")),
        }

    snapshot = {
        "evidence": rows,
        "current_start": start.isoformat(),
        "current_end": end.isoformat(),
        "previous_start": (start - timedelta(days=7)).isoformat()
        if name == "longitudinal"
        else None,
        "timezone": "Europe/Helsinki",
        "aggregates": {
            "current": stats("current"),
            "previous": stats("previous") if name == "longitudinal" else None,
        },
        "authorization_start": (start - timedelta(days=7)).isoformat()
        if name == "longitudinal"
        else start.isoformat(),
    }
    return {
        "report_id": uid(name),
        "patient_id": uid("fictional-person"),
        "version": 1,
        "state": "ready",
        "period_start": start.isoformat(),
        "period_end": end.isoformat(),
        "generated_at": end.isoformat(),
        "data_cutoff": end.isoformat(),
        "timezone": "Europe/Helsinki",
        "calculation_version": "facts-v3",
        "document": document(snapshot),
        "sources": [{"source_id": s, "source_revision": 1} for r in rows for s in r["source_ids"]],
        "observations": [],
        "completed_activities": [],
        "feedback": [],
        "assessments": [],
        "confirmed_insights": [],
        "trends": [],
        "limitations": [],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    for name in ("empty", "activities", "confirmed", "longitudinal"):
        report = example(name)
        (args.output / f"{name}.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
        perspective = "clinician" if name == "longitudinal" else "patient"
        (args.output / f"{name}.pdf").write_bytes(render_pdf(report, perspective))
        print(
            f"Fictional {name}: {len(report['document']['snapshot']['evidence'])} evidence records"
        )


if __name__ == "__main__":
    main()
