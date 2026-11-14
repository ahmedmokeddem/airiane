import Link from "next/link";
import { Icon } from "@/components/brand";
export default function NotFound() {
  return (
    <section className="workspace-empty">
      <Icon name="lock" />
      <h1>This record is not available.</h1>
      <p>
        The record may not exist, or current sharing permission may have
        changed. Previously available data is not shown.
      </p>
      <Link className="button button-small" href="/patients">
        Check patient directory
      </Link>
    </section>
  );
}
