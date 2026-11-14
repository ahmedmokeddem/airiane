import Link from "next/link";
import { patient, patientReports } from "@/lib/workspace";
import { ReportList } from "@/components/workspace/report-list";
import { AlertList } from "@/components/alert-list";
import { AssessmentResults } from "@/components/assessment-results";
import { InsightReportPanel } from "@/components/insight-report";
import { Icon } from "@/components/brand";
import type { Alert, AssessmentResponse } from "@/lib/types";
import type { InsightReportResponse } from "@/lib/insight-types";
export const metadata = { title: "Patient record" };
export default async function PatientPage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<{
    error?: string;
    medication?: string;
    cursor?: string;
  }>;
}) {
  const { patientId } = await params;
  const query = await searchParams;
  const d = await patient(patientId);
  const reports = await patientReports(patientId, query.cursor);
  let alerts: Alert[] = [];
  let alertMessage: string | undefined;
  let questionnaires: AssessmentResponse[] = [];
  let insightReports: InsightReportResponse[] = [];
  let insightUnavailable: string | undefined;
  if (
    !d.mock &&
    (d.patient.scopes.includes("alerts") || d.patient.attention?.flagged)
  ) {
    try {
      alerts = (await d.api!.alerts(patientId)).items;
      questionnaires = await Promise.all(
        alerts
          .filter((a) => a.rule_key === "questionnaire_safety_item")
          .map((a) => d.api!.alertAssessment(patientId, a.alert_id)),
      );
    } catch {
      alerts = [];
      questionnaires = [];
      alertMessage =
        "Requests are unavailable under current access or could not be loaded. Refresh to check again.";
    }
  }
  if (!d.mock) {
    try {
      insightReports = (await d.api!.insightReports(patientId)).items;
    } catch {
      insightReports = [];
      insightUnavailable =
        "Shared conversation insight reports are unavailable under current access.";
    }
  }
  return (
    <>
      <Link className="back-link" href="/patients">
        <Icon name="arrow" />
        Patient directory
      </Link>
      <header className="workspace-heading patient-page-heading">
        <div className="directory-avatar" aria-hidden="true">
          {d.patient.display_name[0]}
        </div>
        <div>
          <p className="section-kicker">Patient record</p>
          <h1>{d.patient.display_name}</h1>
          <p>Only currently authorized records are shown.</p>
        </div>
        <span
          className={`access-pill ${d.patient.scopes.includes("reports") ? "access-on" : ""}`}
        >
          {d.patient.scopes.includes("reports")
            ? "Reports authorized"
            : "Reports not shared"}
        </span>
      </header>
      {query.error && (
        <p className="form-error" role="alert">
          {query.error === "medication-unavailable"
            ? "The reminder could not be saved. Check the patient connection and try again."
            : "The request could not be updated. Refresh and check current access."}
        </p>
      )}
      {query.medication === "saved" && (
        <p className="save-notice" role="status">
          <Icon name="check" />
          The daily reminder was saved.
        </p>
      )}
      {d.patient.attention?.flagged && (
        <section className="attention-notice">
          <h2>Shared information to review</h2>
          <p>{d.patient.attention.reasons.join(" · ")}</p>
          <small>
            Rule-based prompt from currently shared records. Not a diagnosis,
            relapse prediction or emergency monitoring.
          </small>
        </section>
      )}
      <div className="patient-detail-grid">
        <section>
          <div className="workspace-section-heading">
            <h2>Authorized reports</h2>
            <span>Stored document snapshots</span>
          </div>
          <ReportList {...reports} patientId={patientId} />
          {reports.nextCursor && (
            <Link
              className="button button-outline button-small"
              href={`/patients/${patientId}?cursor=${encodeURIComponent(reports.nextCursor)}`}
            >
              Next report page
            </Link>
          )}
          {(alerts.length > 0 || alertMessage) && (
            <AlertList
              patientId={patientId}
              alerts={alerts}
              unavailable={alertMessage}
              readOnly={d.mock}
            />
          )}{" "}
          {questionnaires.length > 0 && (
            <AssessmentResults
              report={{ assessments: questionnaires, timezone: "UTC" }}
              heading="Shared questionnaire records"
            />
          )}
          <InsightReportPanel
            reports={insightReports}
            patientName={d.patient.display_name}
            unavailable={insightUnavailable}
          />
        </section>
        <aside className="patient-context">
          <div className="context-note">
            <Icon name="lock" />
            <h2>Sharing is specific.</h2>
            <p>
              Report permission does not imply access to every conversation or
              record. A patient can revoke future access.
            </p>
            <Link href="/privacy">Sharing & limitations</Link>
          </div>
          {!d.mock && (
            <details className="medication-details">
              <summary>Daily medication reminder</summary>
              <p>
                Set a reminder for this connected patient. AIriane does not
                prescribe medication or change treatment.
              </p>
              <form
                className="med-form"
                action="/care/medication"
                method="post"
              >
                <input type="hidden" name="patient_id" value={patientId} />
                <label>
                  Reminder time
                  <input
                    name="schedule_time"
                    type="time"
                    defaultValue="09:00"
                    required
                  />
                </label>
                <label>
                  Reminder message
                  <input
                    name="message"
                    type="text"
                    defaultValue="Take your prescribed daily medication"
                    maxLength={240}
                    required
                  />
                </label>
                <button className="button button-small" type="submit">
                  Save reminder
                </button>
              </form>
            </details>
          )}
        </aside>
      </div>
    </>
  );
}
