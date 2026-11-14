import Link from "next/link";
import { reportRecord } from "@/lib/workspace";
import { ReportView } from "@/components/report-view";
import { PdfDownload } from "@/components/pdf-download";
import { Icon } from "@/components/brand";
export const metadata = { title: "Patient-shared report" };
export default async function ReportPage({
  params,
}: {
  params: Promise<{ patientId: string; reportId: string }>;
}) {
  const { patientId, reportId } = await params;
  const d = await reportRecord(patientId, reportId);
  const r = d.report;
  const date = (v: string) =>
    new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeZone: r?.timezone ?? "UTC",
    }).format(new Date(v));
  return (
    <>
      <Link className="back-link" href={`/patients/${patientId}`}>
        <Icon name="arrow" />
        Back to patient record
      </Link>
      <header className="workspace-heading report-page-heading">
        <div>
          <p className="section-kicker">Patient-shared wellbeing record</p>
          <h1>{d.patient.display_name}</h1>
          <p>
            {r
              ? `${date(r.period_start)} – ${date(r.period_end)} · ${r.timezone} · End exclusive`
              : "Access is checked each time this document opens."}
          </p>
        </div>
        {r && <span className="access-pill">Snapshot version {r.version}</span>}
      </header>
      {!r ? (
        <section className="workspace-empty" role="status">
          <Icon name="lock" />
          <h2>This report is unavailable.</h2>
          <p>{d.error} No previous or fictional report has been substituted.</p>
          <Link
            className="button button-outline button-small"
            href={`/patients/${patientId}`}
          >
            Check current access
          </Link>
        </section>
      ) : (
        <div className="document-layout">
          <aside className="document-sidebar">
            <h2>In this report</h2>
            <nav aria-label="Report contents">
              <a href="#report-content">Shared record</a>
              {r.document &&
                r.state === "ready" &&
                r.document.sections.map((section) => (
                  <a key={section.id} href={`#section-${section.id}`}>
                    {section.clinician_title}
                  </a>
                ))}
              {r.document && r.state === "ready" && (
                <a href="#report-evidence">Evidence references</a>
              )}
              <a href="#report-export">Export & limitations</a>
            </nav>
            <p>
              Patient-reported information supports a conversation. It does not
              establish treatment effectiveness.
            </p>
          </aside>
          <div className="document-column">
            <div id="report-export" className="document-toolbar">
              <div>
                <Icon name="document" />
                <span>
                  {r.state === "ready"
                    ? "Ready to review"
                    : "Saved snapshot · refresh may be needed"}
                  <small>Generated {date(r.generated_at)}</small>
                </span>
              </div>
              {!d.mock ? (
                <PdfDownload
                  patientId={patientId}
                  reportId={reportId}
                  enabled={!!r.document && r.state === "ready"}
                />
              ) : (
                <p className="workspace-footnote">
                  PDF download requires authenticated backend access.
                </p>
              )}
            </div>
            <div id="report-content">
              <ReportView report={r} />
            </div>
            <aside className="document-limits">
              <Icon name="lock" />
              <p>
                Confidential patient-shared information. Revocation blocks
                future application access; previously downloaded copies cannot
                be remotely revoked. This record does not provide emergency
                monitoring, diagnosis or proof of treatment causation.
              </p>
            </aside>
          </div>
        </div>
      )}
    </>
  );
}
