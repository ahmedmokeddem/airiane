import Link from "next/link";
import { Icon } from "@/components/brand";
import { ThreadStory } from "@/components/public/thread-story";
export const metadata = { title: "How it works" };
export default function How() {
  return (
    <main id="main-content" tabIndex={-1} className="public-main">
      <header className="inner-hero">
        <p className="section-kicker">A thread through the everyday</p>
        <h1>
          Start where
          <br />
          you are.
        </h1>
        <p>
          A conversation, a small activity, a reflection worth keeping. There’s
          room to find what fits.
        </p>
      </header>
      <div className="section-width inner-content">
        <ThreadStory />
        <section className="editorial-row" style={{ marginTop: 55 }}>
          <h2>
            Speak naturally.
            <br />
            Or take your time typing.
          </h2>
          <div>
            <p>
              The mobile app supports voice and text conversations with AIriane.
              You can use either to reflect on your day or explore a guided
              activity.
            </p>
            <p>
              AIriane is an AI wellbeing companion. It cannot diagnose,
              prescribe or replace a treating clinician. Camera preview, if
              enabled, stays local; AIriane cannot see it.
            </p>
          </div>
        </section>
        <section className="editorial-row">
          <h2>Try something small.</h2>
          <div>
            <p>
              Choose a guided breathing activity, a short walk, daylight and
              fresh air, or another activity in the app’s catalogue. You can
              select an option by voice or touch.
            </p>
            <p>
              Completed activities and optional feedback are saved to your own
              record. Participation is not a measure of recovery or treatment
              success.
            </p>
          </div>
        </section>
        <section id="journey" className="editorial-row">
          <h2>
            A Journey you
            <br />
            choose to keep.
          </h2>
          <div>
            <p>
              Your completed activities and confirmed reflections form a
              personal history. Review a suggested reflection before saving,
              edit it in your words, or leave it unsaved.
            </p>
            <p>
              Optional daily check-in values are patient reports. Questionnaires
              are separate from everyday conversation and do not turn the
              companion into a diagnostic system.
            </p>
          </div>
        </section>
        <section className="editorial-row">
          <h2>Share with intention.</h2>
          <div>
            <p>
              Connect with a clinician, choose a reporting period and explicitly
              grant report access. A connection alone does not authorize every
              record.
            </p>
            <p>
              You can revoke future application access. Downloaded documents
              remain with the person who downloaded them.
            </p>
            <Link className="text-link" href="/privacy">
              Read about your choices <Icon name="arrow" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
