import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { openSession } from "./session";
import { ApiError, ClinicianApi } from "./api";
import fixture from "@/fixtures/clinician.json";
import type { DoctorPatient, Report, ReportReceipt } from "./types";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const clinician = cache(async () => {
  const mock =
    process.env.NODE_ENV !== "production" &&
    process.env.PORTAL_DATA_MODE === "mock";
  if (mock)
    return {
      mock: true,
      api: null,
      name: "Development preview",
      code: "",
      demo: false,
    };
  const token = openSession((await cookies()).get("re_access_token")?.value);
  if (!token) redirect("/login");
  const api = new ClinicianApi(
    process.env.RE_API_URL ?? "http://127.0.0.1:8000",
    token,
  );
  let me;
  try {
    me = await api.me();
  } catch (error) {
    if (error instanceof ApiError && [401, 403].includes(error.status))
      redirect("/login?error=session-expired");
    throw error;
  }
  if (me.role !== "clinician" || !me.clinician_verified)
    redirect("/login?error=session-expired");
  return {
    mock: false,
    api,
    name: me.display_name,
    code: me.user_id,
    demo: token === "demo-clinician-token",
  };
});
export const directory = cache(async () => {
  const session = await clinician();
  if (session.mock)
    return {
      ...session,
      patients: fixture.patients.items as DoctorPatient[],
      nextCursor: null,
      invitations: [],
    };
  const [patients, links] = await Promise.all([
    session.api!.patients(),
    session.api!.careLinks(),
  ]);
  return {
    ...session,
    patients: patients.items,
    nextCursor: patients.next_cursor,
    invitations: links.items.filter((link) => link.state === "pending"),
  };
});
export async function patient(patientId: string) {
  if (!UUID.test(patientId)) notFound();
  const d = await directory();
  let found = d.patients.find((p) => p.patient_id === patientId);
  let cursor = d.nextCursor;
  // Bounded traversal; every page remains scoped to the authenticated clinician.
  for (let i = 0; !found && cursor && i < 19; i++) {
    const page = await d.api!.patients(cursor);
    found = page.items.find((p) => p.patient_id === patientId);
    cursor = page.next_cursor;
  }
  if (!found) notFound();
  return { ...d, patient: found };
}
export async function patientReports(
  patientId: string,
  cursor?: string,
): Promise<{
  items: ReportReceipt[];
  unavailable?: string;
  nextCursor?: string | null;
}> {
  const d = await patient(patientId);
  if (!d.patient.scopes.includes("reports"))
    return {
      items: [],
      unavailable: "This patient has not authorized report access.",
    };
  if (d.mock) {
    const r = fixture.report as Report;
    return {
      items: [{ report_id: r.report_id, state: r.state, version: r.version }],
    };
  }
  try {
    const page = await d.api!.reports(patientId, cursor);
    return { items: page.items, nextCursor: page.next_cursor };
  } catch (error) {
    return {
      items: [],
      unavailable:
        error instanceof ApiError
          ? error.message
          : "Reports could not be loaded. Try again.",
    };
  }
}
export async function reportRecord(patientId: string, reportId: string) {
  if (!UUID.test(reportId)) notFound();
  const d = await patient(patientId);
  if (!d.patient.scopes.includes("reports"))
    return {
      ...d,
      report: undefined,
      error: "This patient has not authorized report access.",
    };
  if (d.mock) {
    const r = fixture.report as Report;
    return {
      ...d,
      report: r.report_id === reportId ? r : undefined,
      error:
        r.report_id === reportId
          ? undefined
          : "Report not found in the fictional preview.",
    };
  }
  try {
    return {
      ...d,
      report: await d.api!.report(patientId, reportId),
      error: undefined,
    };
  } catch (error) {
    return {
      ...d,
      report: undefined,
      error:
        error instanceof ApiError
          ? error.message
          : "This report could not be loaded. Try again.",
    };
  }
}
