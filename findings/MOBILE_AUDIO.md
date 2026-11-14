# Mobile audio: asset duplication and test-runner constraints

Context: `Artifacts/plan.md` — "make the activity soundscape audible on
native iOS/Android" (`mobile/src/features/activity/audio-therapy.ts`).

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

Native reads `mobile/assets/audio/` via
`mobile/src/features/activity/native-audio-assets.ts` (Metro `require()`
table, numeric asset ids). Web reads `/audio/*` served from
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
`syncElapsed`/`stop`).

Consequence: `audio-therapy.ts`, and anything it statically imports, must
never statically `import` `react-native`, `expo-audio`, or any `*.wav`/
`*.mp3` file — any of those would execute React Native / expo-modules-core
or a Metro-only asset require inside the Node test process and can break
`npm test`. All native wiring (the `expo-audio` backend and the
`native-audio-assets.ts` Metro `require()` table) must be loaded lazily via
`require(...)` inside `try/catch`, and tests inject fakes through the
`AudioTherapyOptions` constructor parameter (`platform`, `nativeBackend`,
`nativeAssets`) instead of mocking modules.

## Steady-state cost of the native soundscape player (measured in expo-audio 58.0.12)

`createAudioPlayer(source)` defaults to `updateInterval = 500` ms
(`node_modules/expo-audio/build/ExpoAudio.js` `createAudioPlayer`). iOS registers an
AVPlayer periodic time observer on the main queue that builds a 17-field status
dictionary and emits it to JS (`ios/AudioPlayer.swift` `registerTimeObserver` ->
`updateStatus` -> `currentStatus`); Android runs the same loop in a
`Dispatchers.Main` coroutine (`android/.../BaseAudioPlayer.kt` `startUpdating`).
Nothing in this app subscribes to `playbackStatusUpdate`, so the engine now asks
for a 60 s interval (`NATIVE_STATUS_INTERVAL_MS` in `audio-therapy.ts`). Never use
`0`: Android would `delay(0)` in a tight loop and iOS rejects a zero `CMTime`.
Every expo-audio property write is also a blocking hop to the native main thread
(each `Property` in `android/.../AudioModule.kt` is wrapped in `runOnMain`), which
is why `setMuted()` only writes when the value changed, and why muting pauses the
player instead of leaving it decoding at volume 0.

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
