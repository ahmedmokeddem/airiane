export default function Loading() {
  return (
    <section
      className="workspace-skeleton"
      role="status"
      aria-label="Checking authorized records"
    >
      <div className="skeleton-title" />
      <div className="skeleton-subtitle" />
      <div className="skeleton-panels">
        <i />
        <i />
        <i />
      </div>
      <div className="skeleton-rows">
        <i />
        <i />
        <i />
      </div>
      <p>Checking your current access…</p>
    </section>
  );
}
