import { directory, patientReports } from "@/lib/workspace";
import { ReportList } from "@/components/workspace/report-list";
import { Icon } from "@/components/brand";
import Link from "next/link";
export const metadata = { title: "Reports" };
export default async function Reports() {
  const d = await directory();
  const patients = d.patients
    .filter((p) => p.scopes.includes("reports"))
    .slice(0, 12);
  const reports = await Promise.all(
    patients.map(async (p) => ({
      patient: p,
      reports: await patientReports(p.patient_id),
    })),
  );
  return (
    <>
      <header className="workspace-heading">
        <div>
          <p className="section-kicker">Patient-authorized documents</p>
          <h1>A clearer shared record.</h1>
          <p>
            Stored reports describe available records. They do not measure
            recovery.
          </p>
        </div>
      </header>
      {reports.length ? (
        <div className="all-reports">
          {reports.map(({ patient, reports }) => (
            <section key={patient.patient_id}>
              <ReportList
                {...reports}
                patientId={patient.patient_id}
                name={patient.display_name}
              />
              {reports.nextCursor && (
                <p className="workspace-footnote">
                  More reports are available.{" "}
                  <Link href={`/patients/${patient.patient_id}`}>
                    Open the patient record.
                  </Link>
                </p>
              )}
            </section>
          ))}
        </div>
      ) : (
        <div className="workspace-empty">
          <Icon name="document" />
          <h2>No report access is active.</h2>
          <p>
            A patient must explicitly share a reporting period. Connecting alone
            does not grant access.
          </p>
          <Link className="button button-small" href="/patients">
            View patients
          </Link>
        </div>
      )}
      <p className="workspace-footnote">
        Showing reports for up to 12 patients on the current directory page. For
        other records, open the patient directory.{" "}
        <Link href="/patients">Find a patient</Link>
      </p>
    </>
  );
}
