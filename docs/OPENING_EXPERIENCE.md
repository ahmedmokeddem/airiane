# AIriane opening — Ariadne's thread

The opening is a rare cold-launch moment of delight. It uses the approved symbol's exact SVG geometry and the existing Inter-rendered horizontal artwork; neither approved source file is modified. The source has **two separate strokes and a detached mint endpoint**. This is a faithful sequential path reveal, not an invented continuous connector or morph.

## Sequence

After the app's first layout, fonts (or fallback) and logo image settle, the retained native splash hands off to a matching `#081018` scene. The normal application is mounted underneath throughout.

| Time after handoff | Scene |
| --- | --- |
| 0–250 ms | Midnight background and a small soft teal light |
| 250–850 ms | Reveal the exact lower thread stroke |
| 850–1600 ms | Reveal the exact arcing stroke |
| 1600–1800 ms | Mint endpoint completes the approved symbol |
| 1650–2100 ms | Symbol settles into the original horizontal lockup; existing wordmark fades in |
| 2200–2500 ms | Scene dissolves into the current application screen |

Soft pre-rendered decorative illumination gives the original dark navy strokes/text contrast without recoloring the mark. It is an animated backdrop, not replacement logo artwork. The decorative RGBA light is generated from a small SVG once; this avoids platform-dependent animated SVG gradient/shadow clipping. Reanimated drives logo dash offsets, image opacity and transforms on the native UI runtime. There are no per-frame React state updates, animated blur, API calls, audio/camera initialization or navigation resets in this feature.

A signed-in Home remains Home. The existing signed-out flow reveals Welcome; the opening does not bypass authentication or fabricate a signed-in state. The current app does not restore a production auth session on cold launch, so that remains an independent authentication concern.

## Lifecycle and accessibility

- Native `preventAutoHideAsync` runs at module scope before application setup. Hiding waits for first layout/resources; two animation frames allow the RN scene to paint beneath it. Native and RN backgrounds match.
- Font/error fallback releases the UI after 4.5 seconds from React mount. A 4.65-second watchdog prevents an image failure from retaining the splash. If readiness takes 2 seconds or more, the decorative sequence is skipped rather than adding 2.5 seconds to a slow start. Time before JS executes remains OS/native startup time.
- `Skip introduction` has a 48-point minimum touch target and safe-area positioning. The overlay is not modal and does not intercept the application's controls. A touch/pointer interaction dismisses it immediately while the underlying app receives its normal interaction.
- System reduced motion skips the drawing and settling sequence. A reduced-motion change during playback cancels it. There is no forced 2.5-second wait.
- Backgrounding cancels the opening; returning does not restart it. Navigation never resets its runtime lease. A full development JS reload creates a new runtime and can replay it; ordinary tab navigation and foregrounding do not.
- Providers, authentication and API fetching run independently. The current screen is never gated on animation completion.

## Files and regeneration

- `mobile/src/features/opening/opening-experience.tsx`: scene, exact symbol rendering, interruption and resource handoff.
- `timing.ts`: timing budget and per-runtime completion lease.
- `splash.ts`: early native splash retention/release.
- `use-startup-ready.ts`: bounded font readiness fallback.
- `symbol.generated.ts`: paths/lengths and source SHA-256; regenerate with `node mobile/scripts/generate-opening-symbol.mjs` after reviewing any approved source change.
- `mobile/App.tsx`: wraps the existing mounted screen, preserving the provider/navigation architecture.
- `mobile/app.json`: native splash background matches the opening; the approved symbol-only launcher artwork is used for Android’s system mask; full wordmark appears in the RN sequence.
- `mobile/package*.json`: Expo SDK 58-compatible `react-native-svg` 15.16.0. Existing audio/native dependency versions remain unchanged.
- `mobile/assets/opening/illumination.svg`/`.png` and `scripts/generate-opening-illumination.mjs`: reproducible decorative light export; run `node mobile/scripts/generate-opening-illumination.mjs` with playwright-cli/Chromium available. It never alters the approved logos.
- `mobile/tests/opening.test.ts`: exact source geometry/hash and timing/reduced-motion/slow-start decisions.

## Launch and verification

The SVG renderer and splash configuration require a new native build; Metro reload alone cannot add them. From `mobile/`:

```sh
npx --yes @expo/agent-cli@latest prebuild --platform android --no-install --no-clean
ANDROID_HOME="$HOME/Android/Sdk" npx --yes @expo/agent-cli@latest run:android \
  --variant release --no-bundler --device SERIAL
```

This is a local release test APK using the existing local signing configuration, not a store submission. The existing backend/USB forwarding and development identity settings still apply. For Metro development, rebuild a debug client with `run:android --device SERIAL --no-bundler`, then open the existing USB-forwarded port-8082 development URL from DEVICE_VERIFICATION.md. The CLI rejects combining `--port` with `--no-bundler`. Do not start another backend or Metro instance.

Web preview has no Android OS splash, uses DOM SVG/CSS/browser scheduling, and a full page reload resets the lease. A web screenshot cannot establish Android handoff, native performance or device behavior. Native release verification and measured results are recorded separately below and in the implementation status.

The physical-phone release test uses an ARM64-only build. Its exact build command, from the generated `mobile/android/` directory, is:

```sh
ANDROID_HOME="$HOME/Android/Sdk" ./gradlew app:assembleRelease \
  -PreactNativeArchitectures=arm64-v8a --build-cache --configure-on-demand -x lint -x test
```

Then install/launch that APK through `run:android --binary android/app/build/outputs/apk/release/app-release.apk --variant release --no-bundler --device SERIAL` from `mobile/`. Other device architectures require the corresponding build. A full multi-architecture release invocation was stopped during compilation to focus this local phone test; it is not reported as a completed universal build.

SDK reference: [Expo 58 SplashScreen](https://docs.expo.dev/versions/v58.0.0/sdk/splash-screen/) explicitly distinguishes development-client and release splash behavior. Browser-only results in [the web receipt](implementation-validation/opening/web-verification.json) do not substitute for the native checks.

## Verified results — 14 November 2026

**VERIFIED ON DEVICE:** Samsung SM-G998B / Android 15, optimized ARM64 release APK (`debuggable=false`), final build **5m33s**. Guarded cold-start samples show the real system symbol, exact thread drawing, unclipped light, wordmark and signed-out Welcome handoff. A physical ADB tap skipped early; background/foreground retained the same PID and did not replay. Setting the Android reduced-motion signal (`transition_animation_scale=0`) skipped the app drawing sequence; the original `1.0` preference was restored. The OS static splash icon can still be visible during its own exit transition, as the reduced-motion sample shows. Retained logs for the last release process contained no fatal exception or React Native JS error.

The initial native pass found that Android masks a horizontal splash image and that decorative SVG/shadow rendering differed from Chromium. The system splash now uses the approved symbol-only launcher asset. Decorative lighting is pre-rendered to RGBA, so there is no native gradient/shadow edge to clip; the logo paths and colors remain untouched.

**VERIFIED IN WEB PREVIEW:** final path/wordmark/handoff; skip, reduced motion, interaction passthrough and a font-delay fallback. With three fonts delayed 6.5 seconds, the UI was available about 4.5 seconds after the observed React mount. The existing backend CORS allowlist rejects the port-8082 preview origin; a sign-in request was dispatched during the opening, but successful web authentication is not claimed.

**VERIFIED AUTOMATED:** mobile typecheck/lint and 29 tests; unchanged approved source geometry is checked against its SHA-256 and exact path strings.

**NOT TESTED:** low-end-device frame timing, iOS and the full accessibility/device matrix. Sampled screenshots do not certify 60/120fps or the absence of a transient between every frame. A full development JS reload can replay the opening; ordinary foregrounding and tabs do not reset the runtime lease. Authentication/session recovery and release HTTPS backend configuration remain existing independent concerns. The local release test was for the opening; the configured local HTTP backend is used through the development build.

Evidence: [native receipt](implementation-validation/opening/native-verification.json), [web receipt](implementation-validation/opening/web-verification.json), [native thread](implementation-validation/opening/native-sequence-2.png), [completed symbol](implementation-validation/opening/native-sequence-3.png), [early skip](implementation-validation/opening/native-skip.png), [reduced-motion system handoff](implementation-validation/opening/native-reduced-motion.png), [ordinary foreground](implementation-validation/opening/native-foreground.png), [web thread](implementation-validation/opening/web-thread.png).

The development APK was rebuilt (**3m53s**) and restored after release testing. Real fictional backend sign-in/Home worked. Native Activities → Home navigation had no opening layer, and a 2-second runtime error window was empty. The device’s original stay-awake and animation preferences were restored. This does not claim a new end-to-end voice call in this opening-only pass.

To rebuild a debug client while reusing the existing servers, from `mobile/`:

```sh
ANDROID_HOME="$HOME/Android/Sdk" npx --yes @expo/agent-cli@latest run:android \
  --device SERIAL --no-bundler
adb -s SERIAL reverse tcp:8000 tcp:8000
adb -s SERIAL reverse tcp:8082 tcp:8082
adb -s SERIAL shell 'am start -a android.intent.action.VIEW -d "exp+re-patient://?__expo_url=http%3A%2F%2F127.0.0.1%3A8082&__expo_disable_fab=1&__expo_disable_auto_launch=1&__expo_disable_onboarding=1" -p dev.re.patient'
```

Additional changed integration/test documents: `mobile/tests/brand.test.ts` (system mask uses the approved symbol), `mobile/tests/run.ts`, `mobile/README.md`, `docs/IMPLEMENTATION_STATUS.md` and the opening receipts/screenshots. Backend, provider configuration, contracts, database and approved logo sources have no changes in this task.
