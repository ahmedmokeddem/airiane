import test from "node:test";
import assert from "node:assert/strict";
import { actionFor, formats } from "../src/features/generative/types";
import type { Progress } from "../src/features/generative/types";
import { MobileUIBridge } from "../src/integration/mobile-ui-bridge";
import fixture from "../../contracts/fixtures/recommendation.json";
import type { Recommendation } from "../src/integration/types";

test("all five formats share one bounded transition envelope", () => {
  assert.equal(new Set(formats.map((f) => f.id)).size, 5);
  const p = {
    activity_session_id: "fixture",
    revision: 4,
    step: 1,
    current: { id: "one", type: "choice", prompt: "Pick" },
    finished: false,
    confirmed: false,
    paused: false,
  } as Progress;
  const action = actionFor(p, "next", {
    choice_id: "rest",
    expected_revision: 999,
    step_id: "invented",
  });
  assert.equal(action.expected_revision, 4);
  assert.equal(action.step_id, "one");
  assert.equal(action.choice_id, "rest");
  assert.equal(
    actionFor({ ...p, current: null }, "confirm_completion").step_id,
    "completion",
  );
});
test("generated proposals use the existing committed-card barrier without auto-starting", async () => {
  const rec = fixture.data as Recommendation;
  let commit = () => {};
  let started = false;
  let resolved = false;
  const bridge = new MobileUIBridge(
    {
      recommendations: async () => rec,
      start: async () => {
        started = true;
        throw new Error("not used");
      },
    },
    rec.session_id,
    async () =>
      new Promise<void>((r) => {
        commit = r;
      }),
    () => {},
  );
  const pending = bridge.presentExact(rec).then(() => {
    resolved = true;
  });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(resolved, false);
  assert.equal(started, false);
  commit();
  await pending;
  assert.equal(resolved, true);
  assert.equal(started, false);
  assert.equal(bridge.recommendation?.recommendation_id, rec.recommendation_id);
});

test("a voice/touch conflict resolves with authoritative state instead of a fatal SDK rejection", async () => {
  const { settleChoice } = await import(
    "../src/features/generative/tool-results"
  );
  const latest = {
    activity_session_id: "fixture",
    revision: 5,
    step: 2,
    current: null,
    finished: true,
    confirmed: false,
    paused: false,
  } as Progress;
  const result = JSON.parse(
    await settleChoice(
      async () => {
        throw new Error("VERSION_CONFLICT");
      },
      () => latest,
    ),
  );
  assert.equal(result.state, "not_confirmed");
  assert.equal(result.current.revision, 5);
  assert.equal(result.current.confirmed, false);
});

test("generation permission opens patient review without rejecting the live client-tool callback", async () => {
  const { settleGeneration } = await import(
    "../src/features/generative/tool-results"
  );
  let review = false;
  const result = JSON.parse(
    await settleGeneration(
      async () => {
        throw new Error("GENERATION_CONSENT_REQUIRED");
      },
      () => {
        review = true;
      },
    ),
  );
  assert.equal(review, true);
  assert.equal(result.state, "permission_required");
  assert.equal(result.requires_patient_ui, true);
});

test("stale activity selection returns canonical Error without interrupting the SDK callback", async () => {
  const { settleSelection } = await import(
    "../src/features/generative/tool-results"
  );
  const result = JSON.parse(
    await settleSelection(async () => {
      throw new Error("No current recommendations");
    }),
  );
  assert.equal(result.code, "STALE_RECOMMENDATION");
  assert.equal(result.retryable, false);
  assert.match(result.request_id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(Object.keys(result).sort(), [
    "code",
    "message",
    "request_id",
    "retryable",
  ]);
});
