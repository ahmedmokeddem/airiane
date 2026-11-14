import { DocumentPreview } from "@/components/public/document-preview";
import Link from "next/link";
import { Icon } from "@/components/brand";
import { ProductPreview } from "@/components/public/product-preview";
import { ThreadStory } from "@/components/public/thread-story";
import { Reveal } from "@/components/public/reveal";
export const metadata = {
  title: { absolute: "AIriane — A little thread through the everyday" },
  description:
    "A calm space for conversation, guided activities and reflections. Your pace, your Journey, your choice of what to share.",
};
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string; report?: string }>;
}) {
  const query = await searchParams;
  if (query.patient) {
    const { redirect } = await import("next/navigation");
    redirect(
      query.report
        ? `/reports/${encodeURIComponent(query.patient)}/${encodeURIComponent(query.report)}`
        : `/patients/${encodeURIComponent(query.patient)}`,
    );
  }
  return (
    <main id="main-content" tabIndex={-1} className="public-main">
      <section className="home-hero section-width">
        <div className="hero-copy">
          <p className="intro-line">
            <span />A companion for the everyday
          </p>
          <h1>
            Find a little
            <br />
            space.
            <br />
            Find your thread.
          </h1>
          <p className="hero-description">
            Some days, a conversation helps. Others, a moment to breathe.
            AIriane is a calm space to begin, wherever you are.
          </p>
          <div className="hero-actions">
            <Link className="button" href="#experience">
              Explore AIriane <Icon name="arrow" />
            </Link>
            <Link className="text-link" href="/for-clinicians">
              For clinicians <Icon name="arrow" />
            </Link>
          </div>
          <p className="hero-footnote">
            Voice. Text. Small, meaningful moments.
            <br />
            Always at your pace.
          </p>
        </div>
        <ProductPreview />
      </section>
      <section className="story-section" aria-labelledby="story-title">
        <div className="section-width">
          <Reveal>
            <div className="section-heading">
              <p className="section-kicker">The idea behind AIriane</p>
              <h2 id="story-title">
                You don’t need a perfect plan.
                <br />
                Just a place to begin.
              </h2>
            </div>
            <ThreadStory />
          </Reveal>
        </div>
      </section>
      <section id="experience" className="section-width experience-section">
        <Reveal>
          <div className="section-heading split-heading">
            <div>
              <p className="section-kicker">Meet your companion</p>
              <h2>
                A conversation.
                <br />
                Not a checklist.
              </h2>
            </div>
            <p>
              Talk it through, type a few words, or simply take a quiet moment.
              Voice and text give you different ways to express what’s on your
              mind.
            </p>
          </div>
          <div className="conversation-scene">
            <div className="conversation-copy">
              <Icon name="message" />
              <h3>
                You don’t have to
                <br />
                find the right words.
              </h3>
              <p>
                AIriane offers nonclinical wellbeing support. It can listen,
                invite reflection and help you explore an activity when that
                feels useful.
              </p>
              <Link className="text-link" href="/how-it-works">
                See how it works <Icon name="arrow" />
              </Link>
            </div>
            <div
              className="conversation-sample"
              aria-label="Illustrative conversation"
            >
              <span>For the days that feel a little tangled.</span>
              <p className="sample-user">
                I don’t really feel like doing much today.
              </p>
              <p className="sample-agent">
                We can keep things small. A quiet moment is a place to start,
                too.
              </p>
              <small>Illustrative dialogue, not a patient conversation.</small>
            </div>
          </div>
        </Reveal>
      </section>
      <section className="activities-section section-width">
        <Reveal>
          <div className="section-heading split-heading">
            <div>
              <p className="section-kicker">A change of pace</p>
              <h2>
                Small things.
                <br />
                Room to exhale.
              </h2>
            </div>
            <p>
              Choose from the app’s guided activities. No perfect routine to
              keep up with. Just something that fits this moment.
            </p>
          </div>
          <div className="activity-editorial">
            <article className="activity-breathing">
              <div className="breath-art" aria-hidden="true">
                <i />
                <i />
                <i />
                <span />
              </div>
              <div>
                <span>One quiet minute</span>
                <h3>Calm Breathing</h3>
                <p>A gentle rhythm to follow, at your own pace.</p>
              </div>
            </article>
            <div className="activity-pair">
              <article className="activity-walk">
                <Icon name="leaf" />
                <span>A little movement</span>
                <h3>Go for a 5-Minute Walk</h3>
                <p>
                  Step away from the screen and into a small change of scene.
                </p>
              </article>
              <article className="activity-daylight">
                <Icon name="sun" />
                <span>A familiar pause</span>
                <h3>Window Daylight & Fresh Air</h3>
                <p>Make room for a simple moment with the world outside.</p>
              </article>
            </div>
          </div>
        </Reveal>
      </section>
      <section className="journey-section">
        <div className="section-width journey-layout">
          <Reveal>
            <p className="section-kicker">Your Journey</p>
            <h2>
              Every small moment
              <br />
              has a place.
            </h2>
            <p>
              A personal history of the activities you complete and the
              reflections you choose to save. A thread to return to, without
              turning life into a progress score.
            </p>
            <Link className="text-link" href="/how-it-works#journey">
              Discover your Journey <Icon name="arrow" />
            </Link>
          </Reveal>
          <div
            className="journey-art"
            aria-label="Illustrative Journey of saved moments"
          >
            <svg viewBox="0 0 540 350" fill="none" aria-hidden="true">
              <path
                d="M30 280C170 330 90 110 250 175S470 290 450 40"
                stroke="#6ea99e"
                strokeWidth="2"
              />
              <circle cx="30" cy="280" r="7" fill="#a3eee2" />
              <circle cx="250" cy="175" r="9" fill="#a3eee2" />
              <circle cx="450" cy="40" r="6" fill="#a3eee2" />
            </svg>
            <span className="moment moment-one">
              <Icon name="leaf" />A moment to breathe
            </span>
            <span className="moment moment-two">
              <Icon name="message" />A reflection, saved by you
            </span>
            <span className="moment moment-three">
              <Icon name="sun" />A little fresh air
            </span>
            <small>Illustrative moments, not clinical milestones.</small>
          </div>
        </div>
      </section>
      <section className="sharing-section section-width">
        <Reveal>
          <div className="section-heading">
            <p className="section-kicker">Sharing on your terms</p>
            <h2>
              A shared view.
              <br />
              Your choice.
            </h2>
            <p>
              You decide what to save and which reports to share with a
              connected clinician. Conversation and clinical care stay distinct.
            </p>
          </div>
          <ol className="sharing-steps">
            <li>
              <span>1</span>
              <h3>Keep what matters</h3>
              <p>
                Review a reflection before confirming it. A suggestion is not a
                saved record.
              </p>
            </li>
            <li>
              <span>2</span>
              <h3>Choose to share</h3>
              <p>
                Create a report and grant access to a connected clinician for
                the relevant period.
              </p>
            </li>
            <li>
              <span>3</span>
              <h3>Stay in control</h3>
              <p>
                Revoke future access in the app. Previously downloaded copies
                cannot be recalled.
              </p>
            </li>
          </ol>
        </Reveal>
      </section>
      <section className="clinician-callout section-width">
        <DocumentPreview />
        <div>
          <p className="section-kicker">For clinicians</p>
          <h2>
            Context for your
            <br />
            next conversation.
          </h2>
          <p>
            Review authorized reports with clear reporting periods, evidence
            references and data limitations. Read carefully, export a PDF, and
            bring your own clinical judgement.
          </p>
          <p className="small-copy">
            AIriane does not provide continuous monitoring or replace clinical
            assessment.
          </p>
          <Link className="button" href="/for-clinicians">
            Explore the clinician workspace <Icon name="arrow" />
          </Link>
        </div>
      </section>
      <section className="privacy-strip section-width">
        <Icon name="lock" />
        <div>
          <h2>Clarity is part of care.</h2>
          <p>
            AIriane is an AI companion, not a clinician or an emergency service.
            Learn what is saved, what can be shared and where its limits are.
          </p>
        </div>
        <Link className="text-link" href="/privacy">
          Privacy & limitations <Icon name="arrow" />
        </Link>
      </section>
    </main>
  );
}
