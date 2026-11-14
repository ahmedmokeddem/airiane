import { uuid } from "../../integration/runtime";
import type { ActivitySession } from "../../integration/types";
import type { Job, Progress } from "./types";

/** Expected business conflicts must not become fatal ElevenLabs SDK errors. */
export async function settleChoice(
  apply: () => Promise<Progress>,
  current: () => Progress | null,
): Promise<string> {
  try {
    return JSON.stringify(await apply());
  } catch (error) {
    return JSON.stringify({
      state: "not_confirmed",
      current: current(),
      requires_patient_ui:
        error instanceof Error &&
        error.message.includes("PATIENT_CONFIRMATION_REQUIRED"),
      instruction:
        "The action was not confirmed here. Use only the latest backend state; do not assume a timed-out request failed or succeeded. Never claim completion; ask the patient to use the on-screen confirmation if required.",
    });
  }
}

export async function settleGeneration(
  generateAndRender: () => Promise<Job | null>,
  showPermission: () => void,
): Promise<string> {
  try {
    const job = await generateAndRender();
    return JSON.stringify(job ?? { state: "cancelled" });
  } catch (error) {
    const requiresUI =
      error instanceof Error &&
      error.message.includes("GENERATION_CONSENT_REQUIRED");
    if (requiresUI) showPermission();
    return JSON.stringify({
      state: requiresUI ? "permission_required" : "unavailable",
      requires_patient_ui: requiresUI,
      instruction: requiresUI
        ? "Ask the patient to review creation permission on screen. Do not give permission on their behalf. The call can continue."
        : "Creation is unavailable. Offer the existing curated activities or keep talking; the call can continue.",
    });
  }
}

/** Preserve canonical ActivitySession success and Error failure shapes. */
export async function settleSelection(
  select: () => Promise<ActivitySession>,
): Promise<string> {
  try {
    return JSON.stringify(await select());
  } catch (error) {
    const stale =
      error instanceof Error &&
      /current recommendations|stale|VERSION_CONFLICT/i.test(error.message);
    return JSON.stringify({
      code: stale ? "STALE_RECOMMENDATION" : "SELECTION_UNCONFIRMED",
      message: stale
        ? "The displayed choices changed. Retrieve current recommendations before selecting."
        : "Selection is not confirmed. Read current state before retrying; do not claim an activity started.",
      request_id: uuid(),
      retryable: !stale,
    });
  }
}
