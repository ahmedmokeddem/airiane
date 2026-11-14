export const metadata = { title: "Privacy & limitations" };
export default function Privacy() {
  return (
    <main id="main-content" tabIndex={-1} className="public-main">
      <header className="inner-hero">
        <p className="section-kicker">Privacy & limitations</p>
        <h1>
          Your experiences.
          <br />
          Your choices.
        </h1>
        <p>
          Clear boundaries matter. Here is what the current experience supports,
          and where it stops.
        </p>
      </header>
      <div className="section-width inner-content">
        <section className="editorial-row">
          <h2>
            What you choose
            <br />
            to save.
          </h2>
          <div>
            <p>
              A suggested reflection stays a proposal until you confirm it. You
              can edit your saved reflections and remove them through the app’s
              available controls.
            </p>
            <p>
              Completed activities, feedback and explicitly confirmed check-in
              values form your recorded history. Raw chat transcripts are not
              replayed as persistent app memory by the V2 continuity feature.
            </p>
            <p>
              If you enable confirmed-record context, selected confirmed notes
              and observations can be sent to the conversation provider for
              future conversations. Turning it off stops new context disclosure;
              it cannot retract information already sent.
            </p>
          </div>
        </section>
        <section className="editorial-row">
          <h2>
            Voice, text
            <br />
            and your camera.
          </h2>
          <div>
            <p>
              Voice and text conversations are processed by the configured
              conversation provider. Provider handling and retention are
              distinct from your app history.
            </p>
            <p>
              The reviewed agent settings disable voice recording and schedule
              deletion with zero-day retention. Scheduled deletion is not a
              zero-retention guarantee; actual deletion timing has not been
              independently demonstrated.
            </p>
            <p>
              The optional camera is a local preview only. Camera frames are not
              sent to AIriane in V1, and the companion cannot see your video.
            </p>
          </div>
        </section>
        <section className="editorial-row">
          <h2>
            Sharing has
            <br />a boundary.
          </h2>
          <div>
            <p>
              Reports require a connected clinician and your explicit
              report-sharing permission. You control the reporting period and
              can revoke future application access.
            </p>
            <p>
              Previously downloaded PDFs cannot be remotely recalled. Recipients
              remain responsible for their copies. Some structured questionnaire
              flows disclose their specific sharing behavior before you begin;
              review that notice before answering.
            </p>
          </div>
        </section>
        <section className="editorial-row">
          <h2>
            Support, with
            <br />
            clear limits.
          </h2>
          <div>
            <p>
              AIriane is an AI companion for nonclinical wellbeing support. It
              is not a person, doctor, therapist, diagnostic system or emergency
              service.
            </p>
            <p>
              Reports describe available records. Missing information is not a
              negative result, and participation is not evidence of treatment
              success. Clinicians bring their own professional judgement.
            </p>
            <p>
              If you need urgent help, contact local emergency services. Do not
              rely on this app or a shared report for an emergency response.
            </p>
          </div>
        </section>
        <aside className="policy-callout">
          <h2>About this information</h2>
          <p>
            This page describes the current product’s controls and known
            limitations. It does not claim regulatory certification, guaranteed
            confidentiality from third-party providers or independently verified
            deletion. No company contact address or regulatory status is
            asserted here.
          </p>
        </aside>
      </div>
    </main>
  );
}
