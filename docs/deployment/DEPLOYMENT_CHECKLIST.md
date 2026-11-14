# Deployment readiness and release gates

This checklist distinguishes locally verified preparation from hosted production behavior. **No deployment is authorized by this document.** Results and exact changed files are recorded in [verification](verification/) and implementation status.

| Requirement | Classification | Evidence / remaining action |
|---|---|---|
| Separate non-root API and portal images | READY | Root-context Dockerfiles, exact runtime versions, frozen uv / npm lockfiles, production entrypoints |
| Aiven manifests without another DB | READY WITH CONFIGURATION | Two app-only services; Console scan/build-context/region/plan must be reviewed |
| Runtime secrets and HTTPS URLs | READY WITH CONFIGURATION | Complete variable matrix and fail-closed startup; real values not supplied here |
| Tiger Data SSL / pool / cleanup | READY WITH CONFIGURATION | Certificate verification and bounded pool implemented; actual Aiven → Tiger Data route/CA/credentials not contacted |
| Explicit, repeatable migrations | READY WITH CONFIGURATION | Checksum/advisory-lock runner; repeated tracked commands no-op. Existing hosted schema adoption requires DDL review, backup and separate approval |
| Production startup does not write SQL | READY | Catalogue/migrations are explicit operator commands; readiness checks required schema/catalogue |
| Actual Supabase project/account flow | BLOCKED | No configured actual project credentials/accounts tested; local signed-JWKS fixtures are not a Supabase project |
| Verified clinician provisioning | READY WITH CONFIGURATION | Existing DB-backed role checks retained; trusted operator must verify/provision actual identities |
| Portal cookie / CSRF / authorization | READY WITH CONFIGURATION | AES-GCM encrypted HttpOnly Secure Lax cookie, configured-origin mutations; real hosted domain/proxy still needs smoke test |
| Patient/clinician reports and protected PDFs | READY WITH CONFIGURATION | Real production-image local integration; external accounts and hosted grant lifecycle must be repeated |
| PDF native libraries / logo / Unicode | READY | Real image rendering and fictional specimens; no PDFs copied into image |
| Liveness/readiness | READY WITH CONFIGURATION | `/health/live`, `/health/ready`; platform probe semantics/Console support not established by current Aiven docs |
| Existing ElevenLabs/Bluetooth/camera | NOT TESTED | Preserved SDK/adapter; no new actual production voice call, headset test or camera egress audit |
| Provider saved privacy and retention | BLOCKED | Operator must review actual production agent/workspace settings; local flag is not evidence of zero retention |
| Multi-replica/rolling/force-kill recovery | BLOCKED | Process-local bootstrap replay/pagination; abandoned connection recovery remains incomplete. Use one worker/replica and acknowledge restart gap |
| Android production HTTPS configuration | READY WITH CONFIGURATION | Build/runtime guards and public templates; actual endpoint must be supplied |
| Signed Android release / store | BLOCKED | Generated release currently uses debug signing unless explicit unsigned-preparation script is run; no real signing/EAS account approval supplied |
| Local image integration / shutdown / memory | READY when receipt passes | See actual receipts; fixture TLS/JWT, not cloud/provider behavior |
| Hosted deploy / HTTPS / rollback | NOT TESTED | Nothing provisioned, deployed or pushed; manual runbook includes redeploy/rollback procedure |
| Production load/security/privacy validation | NOT TESTED | Smoke measurements do not certify concurrent PDFs, tenant limits, all scripts, clinical use or an SLA |

## Before any later deployment

- [ ] Review exact release commits and all changed files; decide who may access Aiven Console environment variables.
- [ ] Configure only the two app services; Scan must propose **zero new managed data services**.
- [ ] Supply reviewed runtime variables/Secrets, exact public HTTPS origins and session key.
- [ ] Confirm outbound DNS/TLS reachability to Tiger Data, Supabase and ElevenLabs from the selected region.
- [ ] Provision least-privilege DB access; retain separate migration/admin credentials. Review existing schema before any ledger adoption.
- [ ] Configure/test actual Supabase asymmetric signing keys and real patient/verified clinician accounts. Test login failures, token expiry, disabled identities and denied roles.
- [ ] Review provider privacy evidence and temporary credential handling; do not enable retention/recording to make a smoke test pass.
- [ ] Decide whether the documented restart/abandoned-session limitation is acceptable; do not enable multiple replicas to hide it.
- [ ] Verify platform health routing, forwarded-host behavior and external TLS. Keep browser Origin matched to `PORTAL_PUBLIC_URL`.
- [ ] Explicitly approve deployment/resources/region/cost outside this preparation task.

## After a later deployment

- [ ] Verify both health URLs and safe failure on database outage; ElevenLabs outage should not change API liveness.
- [ ] Test actual HTTPS portal → API, private cookies, CSRF, denied CORS, JWT signatures/issuer/audience/expiry and clinician verification.
- [ ] On Android: real auth, voice → exact card → activity → feedback → PostgreSQL/Journey; optional camera stays local and permission-independent.
- [ ] Confirm/withdraw an insight; generate/download both PDF editions; grant/revoke and verify future portal/PDF access is denied.
- [ ] Test normal End call and crash/restart behavior honestly. Test memory/CPU under intended concurrent workloads.
- [ ] Verify signed release identity and public mobile environment; no private keys in Expo bundle.
- [ ] Record last-good backend/portal commits and configuration before manual redeploy; exercise schema-compatible rollback.
