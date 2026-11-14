import Link from "next/link";
import { Icon } from "@/components/brand";
import { LoginForm } from "@/components/login-form";
export const metadata = { title: "Clinician sign in" };
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  const demo =
    process.env.NODE_ENV !== "production" &&
    process.env.PORTAL_DEMO_AUTH === "true";
  return (
    <main id="main-content" tabIndex={-1} className="auth-main">
      <section className="auth-editorial">
        <p className="section-kicker">The clinician workspace</p>
        <h1>
          A shared view.
          <br />A human perspective.
        </h1>
        <p>
          Bring patient-confirmed experiences into your next conversation, with
          context and sources close at hand.
        </p>
        <svg
          className="auth-thread"
          viewBox="0 0 420 260"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M0 210C150 250 30 75 180 125S360 240 340 30"
            stroke="#82c7b5"
            strokeWidth="2"
          />
          <circle cx="180" cy="125" r="7" fill="#a3eee2" />
        </svg>
        <p className="auth-note">
          A supplementary wellbeing record.
          <br />
          Not continuous monitoring or a clinical assessment.
        </p>
      </section>
      <section className="auth-form-panel" aria-labelledby="login-title">
        <Icon name="lock" />
        <h2 id="login-title">Welcome to your workspace.</h2>
        <p>Sign in to review records patients have chosen to share with you.</p>
        {query.error && (
          <div className="form-error" role="alert">
            {query.error === "session-expired"
              ? "Your session ended or your clinician access changed. Please sign in again."
              : "We couldn’t sign you in. Check your email and password, and that your account has verified clinician access."}
          </div>
        )}
        <LoginForm />
        <p className="auth-note">
          Access requires a verified clinician account and current patient
          authorization. Sessions expire after at most one hour.
        </p>
        <Link href="/" className="back-link">
          <Icon name="arrow" />
          Back to AIriane
        </Link>
        {demo && (
          <form className="demo-auth" action="/auth/login" method="post">
            <input type="hidden" name="mode" value="demo" />
            <p>
              Fictional development identity. Backend role and patient
              authorization still apply.
            </p>
            <button
              className="button button-small button-outline"
              type="submit"
            >
              Development clinician sign in
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
