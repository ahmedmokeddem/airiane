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
