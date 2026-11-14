"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Brand } from "../brand";
export function SiteNavigation() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  return (
    <header className="site-header">
      <div className="site-nav">
        <Brand />
        <button
          className="menu-toggle"
          aria-expanded={open}
          aria-controls="public-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? "Close" : "Menu"}
          <span aria-hidden="true">{open ? "−" : "+"}</span>
        </button>
        <nav
          id="public-navigation"
          aria-label="Main navigation"
          className={open ? "is-open" : ""}
        >
          {[
            ["/how-it-works", "How it works"],
            ["/for-clinicians", "For clinicians"],
            ["/privacy", "Privacy"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={path === href ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {label}
            </Link>
          ))}
          <Link
            href="/login"
            className="button button-small button-outline"
            onClick={() => setOpen(false)}
          >
            Clinician sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
