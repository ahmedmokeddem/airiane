# Mobile startup and catalogue latency

14 November 2026. No backend, auth, provider settings or wire contract changes.

## Evidence

Code inspection found that useProductData waited for all six dashboard requests before publishing any result. The Home and Activities controls also used that aggregate loading flag. A slow insights/reminder/care-link/streak request could therefore hold the catalogue and controls after catalogue completion.

Connection startup read the session in recovery and immediately read it again before bootstrap. First connections also read back a session just created and activated by the existing API.

A workstation public-HTTPS sample returned /health/live in 0.307s and /health/ready in 1.882s. This is not an authenticated endpoint benchmark, phone measurement, or proof that each request has that latency. Provider handshake and backend transactions remain real asynchronous work.

## Changes

- Publish independent authenticated dashboard sections as each resolves, guarded by the existing auth/refresh epoch. Retain existing displayed data during refresh.
- Give Activities its own initial-catalogue loading state. Home controls no longer wait for unrelated dashboard refreshes.
- Reuse the freshly read/created session returned by recovery for bootstrap. New connections avoid the two redundant session reads; existing-session startup avoids one. Server ownership/version checks and SDK connection acknowledgements remain mandatory.
- Existing connected text conversations remain reusable across tab navigation. No microphone access before intent, provider-token prefetch, raw-transcript persistence or relaxed TLS/auth is added.

## Verification

71 mobile tests, TypeScript and ESLint pass. Tests cover early catalogue publication with an unresolved independent request, stale-auth suppression, failure/loading handling, and no first-session readback. Android build succeeded in 1m01s. The optimized APK was installed on Samsung SM-G998B; real authenticated catalogue rendering, text-connected state and text-to-voice Listening were observed. No text message or activity completion was submitted in this latency pass. See implementation status for the artifact/checksum. No numerical phone speedup is claimed without comparative measurement.
