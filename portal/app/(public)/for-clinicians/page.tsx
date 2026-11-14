import { DocumentPreview } from "@/components/public/document-preview";
import Link from "next/link";
import { Icon } from "@/components/brand";
export const metadata = { title: "For clinicians" };
export default function Clinicians() {
  return (
    <main id="main-content" tabIndex={-1} className="public-main">
      <div className="section-width clinician-public-hero">
        <header className="inner-hero">
          <p className="section-kicker">For clinicians</p>
          <h1>
            More context.
            <br />A more considered
            <br />
            conversation.
          </h1>
          <p>
            Read what a patient chooses to share, with reporting periods,
            provenance and limitations kept in view.
          </p>
          <Link className="button" href="/login" style={{ marginTop: 28 }}>
            Enter the clinician workspace <Icon name="arrow" />
          </Link>
        </header>
        <div className="clinician-report-visual">
          <DocumentPreview />
          <p>
            Illustrative document layout. Actual reports contain only currently
            authorized records.
          </p>
        </div>
      </div>
      <div className="section-width inner-content">
        <section className="editorial-row">
          <h2>
            A record to read.
            <br />
            Not a verdict.
          </h2>
          <div>
            <p>
              Authorized reports bring together confirmed observations, activity
              participation, explicit feedback and patient-approved reflections.
              Evidence references support the record.
            </p>
            <p>
              Recorded activity frequency is descriptive. It does not establish
              symptom improvement, treatment effectiveness or causation.
            </p>
          </div>
        </section>
        <section className="editorial-row">
          <h2>
            Access follows
            <br />
            the patient’s choices.
          </h2>
          <div>
            <p>
              Sign in with a verified clinician account. Accept the patient’s
              connection invitation, then view only the records available under
              current authorization.
            </p>
            <p>
              Report access is checked by the backend on every request.
              Revocation can remove a report that was previously available. A
              connection code is not a sign-in credential.
            </p>
          </div>
        </section>
        <section className="editorial-row">
          <h2>
            Bring the right
            <br />
            context into view.
          </h2>
          <div>
            <p>
              Search your accessible patient directory, review authorized
              reporting periods, and open a report in a focused document view.
              Export eligible stored reports as PDFs.
            </p>
            <p>
              Some reports are pending, stale or have partial coverage. Those
              limitations remain visible rather than being filled with inferred
              patient information.
            </p>
          </div>
        </section>
        <aside className="policy-callout">
          <h2>A supplementary view of wellbeing.</h2>
          <p>
            AIriane is not continuous medical monitoring, an emergency response
            service or a substitute for clinical assessment. Check-in requests
            and questionnaire records depend on what is recorded and currently
            shared. No response or delivery time is guaranteed.
          </p>
        </aside>
      </div>
    </main>
  );
}
