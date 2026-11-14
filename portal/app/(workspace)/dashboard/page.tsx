import Link from "next/link";
import { directory, patientReports } from "@/lib/workspace";
import { PatientDirectory } from "@/components/workspace/directory";
import { ReportList } from "@/components/workspace/report-list";
import { Icon } from "@/components/brand";
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string; report?: string; error?: string }>;
}) {
  const query = await searchParams;
  // Preserve older bookmarks without returning private content from the public homepage.
  if (query.patient) {
    const { redirect } = await import("next/navigation");
    redirect(
      query.report
        ? `/reports/${encodeURIComponent(query.patient)}/${encodeURIComponent(query.report)}`
        : `/patients/${encodeURIComponent(query.patient)}`,
    );
  }
  const d = await directory();
  const withReports = d.patients.filter((p) => p.scopes.includes("reports"));
  const first = withReports[0];
  const reports = first ? await patientReports(first.patient_id) : null;
  return (
    <>
      <header className="workspace-heading">
        <div>
          <p className="section-kicker">Your shared view</p>
          <h1>Care, with context.</h1>
          <p>Review the experiences patients have chosen to share.</p>
        </div>
        <Link className="button button-outline button-small" href="/patients">
          View patients <Icon name="arrow" />
        </Link>
      </header>
      {query.error && (
        <p className="form-error" role="alert">
          The connection could not be updated. Refresh and check your
          authorization.
        </p>
      )}
      <div className="workspace-summary">
        <div>
          <span>Patients shown</span>
          <strong>{d.patients.length}</strong>
          <small>
            {d.nextCursor
              ? "More patients are available in the directory."
              : "Current accessible directory"}
          </small>
        </div>
        <div>
          <span>With report access</span>
          <strong>{withReports.length}</strong>
          <small>Permission checked on each request</small>
        </div>
        <div>
          <span>Pending invitations</span>
          <strong>{d.invitations.length}</strong>
          <small>A connection does not grant report access</small>
        </div>
      </div>
      {d.invitations.length > 0 && (
        <section className="invitation-panel">
          <h2>Connection invitations</h2>
          {d.invitations.map((link) => (
            <form key={link.care_link_id} action="/care/accept" method="post">
              <input
                type="hidden"
                name="care_link_id"
                value={link.care_link_id}
              />
              <p>
                A patient has invited you to connect. Their report permission
                remains separate.
              </p>
              <button className="button button-small" type="submit">
                Accept connection
              </button>
            </form>
          ))}
        </section>
      )}
      <div className="workspace-section-heading">
        <h2>Connected patients</h2>
        <span>Search your accessible directory</span>
      </div>
      <PatientDirectory patients={d.patients} compact />
      <div className="overview-bottom">
        <section>
          <div className="workspace-section-heading">
            <h2>Shared reports</h2>
            <Link href="/reports">Browse reports</Link>
          </div>
          {first && reports ? (
            <ReportList
              {...reports}
              patientId={first.patient_id}
              name={first.display_name}
            />
          ) : (
            <div className="workspace-empty">
              <Icon name="document" />
              <h3>A little context, when it’s shared.</h3>
              <p>
                Authorized patient reports will be available here. A care link
                alone does not expose a patient’s records.
              </p>
            </div>
          )}
        </section>
        <aside className="connection-card">
          <Icon name="path" />
          <h2>Start with a connection.</h2>
          <p>
            Patients use your doctor connection code to send an invitation.
            Accept it here, then let them choose what to share.
          </p>
          {d.code && (
            <details>
              <summary>Show my connection code</summary>
              <code>{d.code}</code>
            </details>
          )}
          <p className="small-copy">
            AIriane provides supplementary wellbeing records, not continuous
            medical monitoring.
          </p>
        </aside>
      </div>
    </>
  );
}
