# PR #13 integration review

15 November 2026. PR head `9397f19` integrated with AIriane base `087c2b0` in an isolated worktree.

## Features retained

- Independent PHQ-9 and explicitly adapted, nonvalidated BDI-theme screens, Assessment Center and in-memory session history.
- Consent-based, deterministic conversation insight drafts with evidence references, patient preview, explicit clinician sharing/revocation and a portal panel. No external LLM is called.
- Existing ElevenLabs V2, voice/text bootstrap, camera boundary, headset patch, caption layout, generated activities, recommendation IDs, feedback, Journey, existing reports/PDFs, and landing showcase.

## Integration corrections

- Both branches had different migration 0007 files. The already-applied `0007_generated_activities.sql` is byte-for-byte preserved. The PR's new table is `0008_insight_reports.sql`; migration runner and references match.
- Both backend route installers and both mobile nudge exclusions are retained.
- Messages capture their session, timestamp and voice/text channel when received. Insight submission excludes other sessions and unknown provenance rather than attaching old messages to the current session. Duplicate submitted message IDs are rejected.
- Sharing and clinician reads lock the care relationship; sharing also locks the report. Revoking the relationship clears its old insight shares, so re-invitation does not restore them. A new explicit report share is required.
- Missing migration 0008 disables only the new insight routes (HTTP 503). Existing care-link revocation still works before that migration.

## Verification

- Complete backend suite: **120 passed** with disposable PostgreSQL 16 configured. All eight migrations applied and 0007/0008 replayed without rerunning DDL. Two existing upstream deprecation warnings.
- Mobile: **160 tests**, typecheck and lint passed; all routes compiled in mock-mode web export.
- Portal: **19 tests**, lint, typecheck and production compilation passed. The isolated worktree build warned that symlinked dependencies were outside its tracing root; that output is not a deployment artifact.
- Browser, 390×844: Assessment Center rendered; fictional zero-response PHQ-9 and adapted BDI completed separately and rendered their privacy/disclaimer/result screens without settled horizontal overflow. No real account or patient data used.
- Existing shared contracts: **11 fixtures** passed. [Sanitized receipt and protected-file hashes](implementation-validation/pr13/verification.json).
- No new real Android conversation, Bluetooth, camera, native assessment or generated-voice acceptance is claimed by these checks.

## Rollout and remaining limits

The new hosted migration has **not** been applied. Before using private insight drafts on Aiven, apply explicitly:

```sh
uv run --directory backend python -m app.migrate --migration 0008_insight_reports.sql
```

Do not rerun 0007 or the baseline. Use the configured verified Tiger Data CA; no TLS verification relaxation is needed. Redeploy backend and portal, and rebuild the mobile APK for the new routes. Standalone assessment results remain device memory only; only existing backend-persisted questionnaires appear in insight reports. They are never silently combined or uploaded. Insight evidence is client-submitted and not independently authenticated against stored transcripts. The PR has no patient deletion endpoint/retention scheduler for insight drafts; report revocation stops sharing but does not delete the private draft. Native voice generation and consecutive games retain their existing pending acceptance check.
