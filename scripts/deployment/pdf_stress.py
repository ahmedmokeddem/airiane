"""Bounded larger fictional report; local rendering memory/time measurement only."""

import copy
import json
import resource
import time
from pathlib import Path

from app.reports.examples import example, uid
from app.reports.narrative import document
from app.reports.pdf import render_pdf

r = example("confirmed")
snapshot = r["document"]["snapshot"]
base = next(e for e in snapshot["evidence"] if e["kind"] == "insight")
rows = []
for i in range(80):
    row = copy.deepcopy(base)
    row.update(
        id="insight:" + uid("stress" + str(i)),
        record_id=uid("stress" + str(i)),
        source_ids=[uid("stress-source" + str(i))],
        category="fatigue",
        label="fatigue",
        date=f"2026-11-{8 + i % 5:02}T12:00:00+00:00",
        text=("Fictional: I chose a short rest after a busy day. " * 8).strip(),
    )
    rows.append(row)
snapshot["evidence"] = rows
snapshot["aggregates"]["current"] = {
    "counts": {"insight": 80},
    "active_days": 5,
    "themes": {"fatigue": 80},
}
r["document"] = document(snapshot)
r["sources"] = [{"source_id": row["source_ids"][0], "source_revision": 1} for row in rows]
start = time.monotonic()
pdf = render_pdf(r)
out = Path("/tmp/fictional-pdfs")
out.mkdir(exist_ok=True)
(out / "large.pdf").write_bytes(pdf)
result = {
    "fictional_notes": 80,
    "bytes": len(pdf),
    "seconds": round(time.monotonic() - start, 2),
    "max_rss_kib": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
    "limit": "one container, 1 CPU, 1 GiB; not a concurrency/load certification",
}
(out / "large-check.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result))
