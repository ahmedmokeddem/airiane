# ElevenAgents V1 — Compatibility and retention verification

Current continuation evidence: [implementation status](IMPLEMENTATION_STATUS.md), [actual saved settings](implementation-validation/elevenlabs-saved-settings.json), and [physical Android voice evidence](implementation-validation/android-voice.json). A real Android voice response and recommendation client tool now succeeded. The saved agent is private, audio saving is off, and new data has zero-day scheduled deletion. Actual deletion behavior and ZRM remain unverified/off respectively. The planning-time “no account/build available” statements below describe the earlier baseline, not the current continuation.


Implementation update: the mobile scaffold resolves a newer SDK baseline than the planning candidate below. See `mobile/package-lock.json`, `mobile/README.md`, and [implementation status](IMPLEMENTATION_STATUS.md). Installed dependencies and static checks do not establish actual device compatibility or verified provider retention. The original planning evidence remains below.

Checked official documentation on 14 November 2026. This is a documented compatibility path, not a tested Expo build or confirmation of a saved ElevenLabs account configuration. No application manifests, build artifacts, provider credentials or connected ElevenLabs account tools are present in this repository.

## Compatibility evidence

| Item | Documented evidence | Selected planning target / actual status |
| --- | --- | --- |
| React Native voice SDK | Official RN SDK uses LiveKit and supports Expo development builds rather than Expo Go; documented export resolution requires RN 0.79+ or equivalent Metro setup. | SDK release/peer pins must be resolved and tested; not installed. |
| Expo example | Official example currently lists Expo ~57.0.15, RN 0.86.2, React 19.2.3 and development client ~57.0.14, with LiveKit native dependencies. | Select that SDK 57 family as the candidate build baseline; this is example metadata, not RE build evidence. |
| ElevenLabs package | Repository main uses workspace dependencies and its package declares a next publishing tag. | Do not equate repository package version with a stable published SDK. Confirm registry release, peer graph and reproducible lockfile at G0. |
| Native camera | SDK 57 camera documentation provides a local preview view and separate permission handling; it also has capture APIs that RE V1 must not call. | Preview-only subset; actual device permission/coexistence tests pending. |
| Rive | Existing local-Rive architecture retained. | Resolve the chosen Rive/Nitro/native asset combination with SDK 57; no .riv asset or working build yet. |
| Voice/text/tools | SDK documentation describes WebRTC voice, text-only WebSocket mode and result-bearing client callbacks. | Verify selected RN release, private-agent token/signed URL, tool wait behavior and text no-microphone behavior on both target platforms. |

Sources: [RN SDK](https://elevenlabs.io/docs/eleven-agents/libraries/react-native), [official Expo example manifest](https://raw.githubusercontent.com/elevenlabs/packages/main/examples/react-native-expo/package.json), [RN package metadata](https://raw.githubusercontent.com/elevenlabs/packages/main/packages/react-native/package.json), [client controls/tools](https://elevenlabs.io/docs/eleven-agents/libraries/react), [SDK 57 camera](https://docs.expo.dev/versions/v57.0.0/sdk/camera/).

## Provider retention evidence

ElevenLabs documents audio saving enabled by default and a separate transcript-retention control; default conversation retention is two years. Turning audio saving off is insufficient to stop transcript retention. Zero-day retention schedules deletion; it is not equivalent to ZRM or a proof that no transient provider data exists.

Sources: [audio saving](https://elevenlabs.io/docs/eleven-agents/customization/privacy/audio-saving), [retention](https://elevenlabs.io/docs/eleven-agents/customization/privacy/retention), [per-agent ZRM](https://elevenlabs.io/docs/eleven-agents/customization/privacy/zrm), [agent API privacy fields](https://elevenlabs.io/docs/eleven-agents/api-reference/agents/get).

The required target is recorded in [provider_privacy.requirements.json](../contracts/provider_privacy.requirements.json). Proposed controls: private authenticated agent; record_voice=false; retention_days=0; confirm delete_audio/delete_transcript_and_pii for the pinned API; disable content-bearing post-call webhooks/debug exports. Confirm whether ZRM is available and appropriate for the chosen account/model/region, without assuming it is included. Apply to voice and text configurations. Provider PII/debug/backups/deletion semantics need a verified account policy; no compliance claim is made.

Actual observed settings: **not available / unverified**. No API key or account was accessed or changed. Required pre-launch evidence: redacted saved-agent export/version and workspace overrides; tested private connection; end-of-call review proving no retained audio and expected transcript deletion; explicit residual retention/ZRM limitations; timestamp and operator approval. Do not store tokens, real patient content or recordings as evidence. App history opt-in independently controls RE PostgreSQL retention. The bootstrap must fail PROVIDER_PRIVACY_UNVERIFIED until this gate is satisfied.

## G0 device and configuration matrix (not executed)

| Test | Evidence required | Current result |
| --- | --- | --- |
| Exact native build | Expo/RN/SDK/LiveKit/Rive/Nitro versions, lockfile/build IDs, device/OS, supported config plugins. | Pending. |
| Audio-only WebRTC | Natural voice, playback/interruption, audio-session coexistence; inspect sent tracks. | Pending; zero video tracks required. |
| Local preview isolation | Camera on/off/deny/background/revoke while voice connects/reconnects; network/storage/log audit. | Pending; zero frames/files/URIs transmitted or persisted required. |
| Blocking client tools | Cards visibly applied before callback resolves and spoken recommendation references exact IDs. | Pending. |
| Separate text connection | textOnly private WebSocket without microphone capture, same application context/IDs after switching. | Pending. |
| Provider privacy | Actual saved settings/export and deletion behavior for both modes. | Unverified; release gate blocked. |

Use fictional content only. A documentation-supported matrix is not “SDK compatibility confirmed.” No app/runtime implementation or dependency installation is part of this planning update.
