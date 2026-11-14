import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  nextCompanionState,
  preferredRoute,
} from "../src/features/call/call-state";
import { ElevenLabsAdapter } from "../src/integration/voice-agent-adapter";
import type { Bootstrap } from "../src/integration/types";
test("real session events drive companion; transcript alone never claims playback", () => {
  assert.equal(
    nextCompanionState("idle", { type: "connecting" }),
    "connecting",
  );
  assert.equal(
    nextCompanionState("connecting", { type: "connected" }),
    "listening",
  );
  assert.equal(
    nextCompanionState("listening", { type: "message_final", role: "user" }),
    "thinking",
  );
  assert.equal(
    nextCompanionState("thinking", { type: "message_final", role: "agent" }),
    "thinking",
  );
  assert.equal(
    nextCompanionState("thinking", { type: "mode", mode: "speaking" }),
    "speaking",
  );
  assert.equal(
    nextCompanionState("speaking", { type: "interrupted" }),
    "interrupted",
  );
  assert.equal(
    nextCompanionState("speaking", { type: "error" }),
    "disconnected",
  );
});
test("automatic routing prefers communication headsets, then speaker with earpiece still available", () => {
  assert.equal(
    preferredRoute(["speaker", "earpiece", "bluetooth", "headset"]),
    "bluetooth",
  );
  assert.equal(preferredRoute(["earpiece", "speaker", "headset"]), "headset");
  assert.equal(preferredRoute(["speaker", "earpiece"]), "speaker");
  assert.equal(preferredRoute(["speaker"]), "speaker");
  assert.equal(preferredRoute([]), undefined);
});
test("cancel while connecting promptly settles the adapter and skips context delivery", async () => {
  let ended = 0;
  let contexts = 0;
  const adapter = new ElevenLabsAdapter(
    {
      startSession: () => {},
      endSession: () => {
        ended++;
      },
      sendUserMessage: () => {},
      sendContextualUpdate: () => {
        contexts++;
      },
      setVolume: () => {},
    },
    () => {},
  );
  const pending = adapter.connect({
    provider: "elevenlabs",
    camera_policy: "local_preview_only_no_transmission",
    mode: "voice",
    conversation_token: "fixture",
  } as Bootstrap);
  const rejected = assert.rejects(pending, /interrupted/);
  await adapter.disconnect();
  await rejected;
  assert.equal(ended, 1);
  assert.equal(contexts, 0);
});
test("installed SDK patch is active; voice permission path never requests camera", () => {
  const sdk = readFileSync(
    new URL(
      "../node_modules/@elevenlabs/react-native/dist/index.react-native.js",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(
    sdk.includes(
      'preferredOutputList: ["bluetooth", "headset", "speaker", "earpiece"]',
    ),
  );
  assert.ok(sdk.includes("AndroidAudioTypePresets.communication"));
  const permissions = readFileSync(
    new URL("../src/features/call/audio-session.native.ts", import.meta.url),
    "utf8",
  );
  assert.ok(permissions.includes("PERMISSIONS.RECORD_AUDIO"));
  assert.ok(!permissions.includes("PERMISSIONS.CAMERA"));
  const screen = readFileSync(
    new URL("../src/features/call/call-screen.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(
    !/takePicture|recordAsync|onBarcodeScanned|sendMultimodal|uploadFile/.test(
      screen,
    ),
  );
});

test('late SDK mode and transcript events cannot revive a disconnected call label',()=>{
 for(const event of [{type:'mode',mode:'listening'},{type:'thinking'},{type:'interrupted'},{type:'message_final',role:'user'}] as const)
  assert.equal(nextCompanionState('disconnected',event),'disconnected');
 assert.equal(nextCompanionState('disconnected',{type:'connecting'}),'connecting');
 assert.equal(nextCompanionState('disconnected',{type:'connected'}),'listening');
});
test("the local camera preview is independent of the voice connection state", () => {
  const screen = readFileSync(
    new URL("../src/features/call/call-screen.tsx", import.meta.url),
    "utf8",
  );
  // docs/FRONTEND_SPEC.md: "A preview can be previewing while voice is
  // connecting/disconnected"; a failed voice start must not disable the camera.
  assert.ok(screen.includes("useLocalCamera(!p.ending)"));
  assert.ok(screen.includes("cameraAvailable={!p.ending}"));
  assert.ok(!screen.includes('p.state !== "disconnected"'));
  // A failed preview mount explains itself instead of re-running toggle().
  assert.ok(screen.includes("camera.fail("));
  assert.ok(!/onMountError=\{\(\) => \{\s*void camera\.toggle\(\)/.test(screen));
  const hook = readFileSync(
    new URL("../src/features/call/use-local-camera.ts", import.meta.url),
    "utf8",
  );
  // A permanently denied permission gets a settings route, not a dead button.
  assert.ok(hook.includes("result.canAskAgain"));
  assert.ok(hook.includes("Linking.openSettings()"));
});
