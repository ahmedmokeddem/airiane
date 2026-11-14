"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "../brand";
export function WorkspaceNav() {
  const path = usePathname();
  return (
    <nav className="workspace-nav" aria-label="Clinician workspace">
      {[
        { href: "/dashboard", label: "Overview", icon: "grid" as const },
        { href: "/patients", label: "Patients", icon: "people" as const },
        { href: "/reports", label: "Reports", icon: "document" as const },
      ].map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={
            path === item.href || path.startsWith(item.href + "/")
              ? "page"
              : undefined
          }
        >
          <Icon name={item.icon} />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
