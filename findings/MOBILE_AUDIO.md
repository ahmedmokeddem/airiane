# Mobile audio: asset duplication and test-runner constraints

Context: `Artifacts/plan.md` — "make the activity soundscape audible on
native iOS/Android" (`mobile/src/features/activity/audio-therapy.ts`).

**Superseded note (post-merge with `main`):** the native-audio engine
described in the first two sections below (single-file platform branching
in `audio-therapy.ts`, the `native-audio-assets.ts` Metro `require()`
table, and the `NATIVE_STATUS_INTERVAL_MS` tweak in the third section) was
replaced wholesale when this branch merged `main`'s independently-built,
more complete rewrite: `audio-therapy.ts` is now the shared/web-only module
again (re-exporting `soundscapes.ts`), and native playback lives in the
sibling `audio-therapy.native.ts` + `native-playback.ts` +
`native-audio-session.ts`, using `expo-audio`'s `useAudioPlayer`/
`useAudioPlayerStatus` hooks directly (with retry/loading/error UX) instead
of a hand-rolled backend. `native-audio-assets.ts` was deleted; the
`Record<string, number>` asset table now lives inline in
`audio-therapy.native.ts`. The asset-duplication fact (next section) still
holds regardless of architecture — it's a filesystem fact, not an
implementation detail.

## `mobile/assets/audio/` and `mobile/public/audio/` are byte-identical mirrors

`md5 assets/audio/* public/audio/*` (run from `mobile/`) shows the same 8
files, identical hashes, in both directories (~9 MB each):

```
31896a84462882107d48a9957d42a754  bilateral-grounding-chimes.wav   (both dirs)
11d6534701384307f03346f4e571c9d8  gamma_40hz_pink_noise.wav        (both dirs)
70886637b5b4f1ede98ebf5225937ce6  gentle-rain-stream.wav           (both dirs)
fe1229521c2fbc2a6971c1286143063e  gentle_rain.mp3                  (both dirs)
1183f91b746e05134889ff8a4b7f291d  manifest.json                    (both dirs)
646d5e8336de45b74c73dce75e270850  nordic-forest-birds-40hz.wav     (both dirs)
128ad7264ce32a812f345b6330455a5b  nordic_forest_birds.mp3          (both dirs)
54ca9e646972b02dcb0c1474c732c842  nordic_stream.mp3                (both dirs)
```

Native reads `mobile/assets/audio/` via the `tracks` map inline in
`mobile/src/features/activity/audio-therapy.native.ts` (Metro `require()`
table, numeric asset ids; see the superseded note above). Web reads `/audio/*` served from
`mobile/public/audio/` (fetched by `build40HzResonanceGraph` in
`audio-therapy.ts`). Both paths point at the same bytes today, but the two
directories are maintained separately (~9 MB duplicated). Deduping — e.g.
generating `public/audio/` from `assets/audio/` at build time, or vice versa
— is open work; it was explicitly out of scope for the native-audio-playback
fix (`Artifacts/plan.md §1 Correction A`) and the files were not deleted or
merged.

## `mobile/tests/*.ts` run in plain Node — no DOM, no Web Audio

`mobile/package.json` test script: `"test": "node --import tsx tests/run.ts"`.
Confirmed with plain Node, no React Native / jsdom / react-native-web
polyfills:

```
$ node -e "console.log('AudioContext:', typeof globalThis.AudioContext, '| document:', typeof globalThis.document, '| node', process.version)"
AudioContext: undefined | document: undefined | node v24.19.0
```

`mobile/tests/wellbeing.test.ts` imports
`src/features/activity/audio-therapy.ts` directly into that plain-Node
process and exercises `AudioTherapySynthesizer` (`start`/`setMuted`/
`syncElapsed`/`stop`) — the web-only implementation now re-exported from
`soundscapes.ts`.

Consequence: `audio-therapy.ts` (the shared/web module), and anything it
statically imports, must never statically `import` `react-native`,
`expo-audio`, or any `*.wav`/`*.mp3` file — any of those would execute
React Native / expo-modules-core or a Metro-only asset require inside the
Node test process and can break `npm test`. The native implementation now
lives entirely in the sibling `audio-therapy.native.ts` (resolved by Metro
via the platform-extension convention, never imported by the plain-Node
test runner), which uses `expo-audio`'s `useAudioPlayer` hook and is
exercised by `mobile/tests/native-playback.test.ts` instead.

## Steady-state cost of a native soundscape player (measured in expo-audio 58.0.12)

`createAudioPlayer`/`useAudioPlayer` defaults to `updateInterval = 500` ms
(`node_modules/expo-audio/build/ExpoAudio.js`). iOS registers an
AVPlayer periodic time observer on the main queue that builds a 17-field status
dictionary and emits it to JS (`ios/AudioPlayer.swift` `registerTimeObserver` ->
`updateStatus` -> `currentStatus`); Android runs the same loop in a
`Dispatchers.Main` coroutine (`android/.../BaseAudioPlayer.kt` `startUpdating`).
This is no longer wasted in the merged implementation: `audio-therapy.native.ts`
passes the explicit `updateInterval: 500` and actually subscribes via
`useAudioPlayerStatus` to drive `loading`/`playbackError`/`playing` UI state, so
the 2×/s status emission has a real consumer — unlike the superseded
single-file implementation this finding originally described, which asked for
`updateInterval: 500` but never read it. If a future change stops using the
status object, revisit the interval. Every expo-audio property write is also a
blocking hop to the native main thread (each `Property` in
`android/.../AudioModule.kt` is wrapped in `runOnMain`); worth keeping in mind
for any future change to how often `NativePlayback` writes `loop`/`muted`/
`volume`.

Known, still open (not caused by the branch, not fixed here):

- `mobile/App.tsx:249-252` ticks `elapsed` once a second, re-rendering the whole
  App tree (call screen and activity screen alike). Moving the tick into the
  screens is blocked by `elapsed` being read inside the completion/abandon
  payloads (`App.tsx:685,821,920,1271`), so it needs its own task.
- During a call the call screen also polls LiveKit audio devices at 1 Hz
  (`use-audio-routes.ts:58`), the provider volume at 10 Hz
  (`eleven-provider.tsx:95`), and restarts two `Animated.timing`s every 120 ms
  (`companion.tsx:74,240`).
- The bundled loops are 8 s long (`assets/audio/manifest.json`), and in a
  development build `createAudioPlayer(assetId)` resolves to the Metro dev-server
  URL (`expo-audio/build/utils/resolveSource.js` -> `asset.localUri ?? asset.uri`)
  while iOS builds a fresh `AVPlayerItem` per loop iteration
  (`ios/AudioPlayer.swift` `enqueueNextLoopItem`). A dev build therefore re-fetches
  ~0.7-1.8 MB from the dev server about every 8 s. Fixing it means downloading the
  asset through `expo-asset` before creating the player, i.e. async work inside a
  synchronous engine; release builds read the embedded file instead.
