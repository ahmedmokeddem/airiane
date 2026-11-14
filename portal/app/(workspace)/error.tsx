"use client";
import Link from "next/link";
export default function WorkspaceError({ reset }: { reset: () => void }) {
  return (
    <section className="workspace-empty" role="alert">
      <h1>The workspace could not load.</h1>
      <p>
        No cached patient record has been substituted. Check your connection or
        sign in again to verify current access.
      </p>
      <div className="empty-actions">
        <button className="button button-small" onClick={reset}>
          Try again
        </button>
        <Link className="button button-outline button-small" href="/login">
          Sign in again
        </Link>
      </div>
    </section>
  );
}
