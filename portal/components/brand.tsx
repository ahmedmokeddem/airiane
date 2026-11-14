import Image from "next/image";
import Link from "next/link";
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className={`brand-link ${compact ? "brand-compact" : ""}`}
      aria-label="AIriane home"
    >
      <Image
        src={
          compact ? "/brand/airiane-symbol.png" : "/brand/airiane-wordmark.png"
        }
        alt="AIriane"
        width={compact ? 52 : 184}
        height={compact ? 52 : 48}
        priority
      />
    </Link>
  );
}
export function Icon({
  name,
  className = "",
}: {
  name:
    | "arrow"
    | "voice"
    | "message"
    | "leaf"
    | "sun"
    | "path"
    | "document"
    | "people"
    | "grid"
    | "lock"
    | "check"
    | "download";
  className?: string;
}) {
  const paths = {
    arrow: "M5 12h14m-6-6 6 6-6 6",
    voice:
      "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8",
    message: "M21 11a9 9 0 0 1-9 9H4l-2 2V11a9 9 0 0 1 19 0ZM7 9h9M7 13h6",
    leaf: "M20 3C8 3 3 7 4 14s12 8 16-11ZM5 20l10-10",
    sun: "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2",
    path: "M5 4a2 2 0 1 0 0 .1M7 4h9a5 5 0 0 1 0 10H9a3 3 0 0 0 0 6h8m0-2 3 2-3 2",
    document: "M5 3h10l4 4v14H5ZM14 3v5h5M8 12h8M8 16h6",
    people:
      "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-3a7 7 0 0 1 14 0v3m0-17a4 4 0 0 1 0 8m3 3a6 6 0 0 1 3 6",
    grid: "M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z",
    lock: "M6 10h12v11H6ZM8 10V6a4 4 0 0 1 8 0v4M12 14v3",
    check: "m5 12 4 4L19 6",
    download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  };
  return (
    <svg
      className={`icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
