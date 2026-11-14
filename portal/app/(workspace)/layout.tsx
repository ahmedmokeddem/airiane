import Link from "next/link";
import { Brand, Icon } from "@/components/brand";
import { WorkspaceNav } from "@/components/workspace/workspace-nav";
import { AutoRefresh } from "@/components/auto-refresh";
import { clinician } from "@/lib/workspace";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Clinician workspace",
  robots: { index: false, follow: false },
};
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await clinician();
  return (
    <div className="clinician-shell">
      <a className="skip-link" href="#workspace-content">
        Skip to workspace
      </a>
      <aside className="clinician-sidebar">
        <Brand />
        <p className="rail-title">Clinician workspace</p>
        <WorkspaceNav />
        <div className="rail-note">
          <Icon name="path" />
          <p>
            A shared view.
            <br />
            The patient stays in control.
          </p>
          <Link href="/privacy">Privacy & limitations</Link>
        </div>
      </aside>
      <div className="workspace-frame">
        <header className="workspace-topbar">
          <span>
            <i />
            Patient-authorized records
          </span>
          <div>
            <span className="clinician-avatar" aria-hidden="true">
              {me.name.slice(0, 1)}
            </span>
            <span>{me.name}</span>
            {!me.mock && (
              <form action="/auth/logout" method="post">
                <button type="submit">Sign out</button>
              </form>
            )}
          </div>
        </header>
        <main id="workspace-content" tabIndex={-1} className="workspace-main">
          {me.mock && (
            <div className="preview-banner" role="status">
              Fictional design preview. These records are fixtures, not live
              patient data.
            </div>
          )}
          {me.demo && (
            <div className="preview-banner" role="status">
              Development clinician identity. Backend authorization still
              applies.
            </div>
          )}
          {!me.mock && <AutoRefresh />}
          {children}
        </main>
      </div>
    </div>
  );
}
