"use client";
import { useState } from "react";
import Link from "next/link";
import type { DoctorPatient } from "@/lib/types";
import { Icon } from "../brand";
export function PatientDirectory({
  patients,
  compact = false,
}: {
  patients: DoctorPatient[];
  compact?: boolean;
}) {
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all");
  const shown = patients.filter(
    (p) =>
      p.display_name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) &&
      (filter === "all" ||
        (filter === "reports" && p.scopes.includes("reports")) ||
        (filter === "attention" && p.attention?.flagged)),
  );
  return (
    <section className="directory-surface">
      <div className="directory-toolbar">
        <label className="patient-search">
          <Icon name="people" />
          <span className="sr-only">Search shown patients</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patients by name"
          />
        </label>
        <label className="directory-filter">
          <span className="sr-only">Filter patients</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All shown patients</option>
            <option value="reports">Report access</option>
            <option value="attention">Needs review</option>
          </select>
        </label>
      </div>
      <p className="directory-count" aria-live="polite">
        {shown.length} {shown.length === 1 ? "patient" : "patients"} shown
      </p>
      {shown.length ? (
        <div className={compact ? "patient-rows compact-rows" : "patient-rows"}>
          {shown.map((p) => (
            <Link
              className="patient-directory-row"
              key={p.patient_id}
              href={`/patients/${p.patient_id}`}
            >
              <span className="directory-avatar" aria-hidden="true">
                {p.display_name[0]}
              </span>
              <span className="patient-identity">
                <strong>{p.display_name}</strong>
                <small>
                  {p.attention?.flagged
                    ? p.attention.reasons.join(" · ")
                    : "Connected patient"}
                </small>
              </span>
              <span
                className={`access-pill ${p.scopes.includes("reports") ? "access-on" : ""}`}
              >
                {p.scopes.includes("reports")
                  ? "Reports authorized"
                  : "Report access not shared"}
              </span>
              <Icon name="arrow" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="workspace-empty">
          <Icon name="people" />
          <h3>
            {patients.length
              ? "No matching patients"
              : "No connected patients yet"}
          </h3>
          <p>
            {patients.length
              ? "Try a different name or filter."
              : "Share your connection code with a patient. Accept their invitation here; report sharing requires their separate permission."}
          </p>
        </div>
      )}
    </section>
  );
}
