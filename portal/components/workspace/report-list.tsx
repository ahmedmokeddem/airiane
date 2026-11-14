import Link from "next/link";
import type { ReportReceipt } from "@/lib/types";
import { Icon } from "../brand";
export function ReportList({
  items,
  patientId,
  name,
  unavailable,
}: {
  items: ReportReceipt[];
  patientId: string;
  name?: string;
  unavailable?: string;
}) {
  return (
    <div className="report-list">
      {name && <h3>{name}</h3>}
      {unavailable ? (
        <div className="access-notice" role="status">
          <Icon name="lock" />
          <p>{unavailable} Previously available records are not substituted.</p>
        </div>
      ) : items.length ? (
        items.map((r) => (
          <Link
            className="report-list-row"
            href={`/reports/${patientId}/${r.report_id}`}
            key={r.report_id}
          >
            <span className="report-file-mark">
              <Icon name="document" />
            </span>
            <div>
              <strong>Patient-shared report</strong>
              <span>
                Snapshot version {r.version} ·{" "}
                {r.state === "ready"
                  ? "Ready to read"
                  : r.state === "stale"
                    ? "Saved snapshot, refresh needed"
                    : r.state === "pending"
                      ? "Being prepared"
                      : "Preparation failed"}
              </span>
              <small>
                The reporting period is shown inside the authorized document.
              </small>
            </div>
            <Icon name="arrow" />
          </Link>
        ))
      ) : (
        <div className="workspace-empty small-empty">
          <Icon name="document" />
          <h3>No shared reports yet</h3>
          <p>
            A connected patient can generate a report and grant access for a
            reporting period. Missing records are not a negative result.
          </p>
        </div>
      )}
    </div>
  );
}
