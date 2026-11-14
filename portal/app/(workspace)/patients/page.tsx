import { directory, clinician } from "@/lib/workspace";
import { PatientDirectory } from "@/components/workspace/directory";
import Link from "next/link";
export const metadata = { title: "Patients" };
export default async function Patients({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const d = await directory();
  const { cursor } = await searchParams;
  const session = await clinician();
  const page =
    cursor && session.api
      ? await session.api.patients(cursor)
      : { items: d.patients, next_cursor: d.nextCursor };
  return (
    <>
      <header className="workspace-heading">
        <div>
          <p className="section-kicker">The people behind the records</p>
          <h1>Your patients.</h1>
          <p>Connections and current sharing permissions, kept in view.</p>
        </div>
      </header>
      <PatientDirectory patients={page.items} />
      {page.next_cursor && (
        <Link
          className="button button-outline button-small"
          style={{ marginTop: 25 }}
          href={`/patients?cursor=${encodeURIComponent(page.next_cursor)}`}
        >
          Next directory page
        </Link>
      )}
      <p className="workspace-footnote">
        Search and filters apply to this page of the accessible directory.
        Backend authorization is checked again when a record is opened.
      </p>
    </>
  );
}
