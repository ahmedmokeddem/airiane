# RE:SONANCE — User flows

Status: planning contract v2.0.0, 14 November 2026. Proposed; no application functionality is implemented. Fictional patient data only.

All diagrams describe proposed behavior, not observed execution. HTTP names are canonical OpenAPI operationIds.

## 1. Registration and onboarding

```mermaid
sequenceDiagram
  actor P as Patient
  participant M as Mobile
  participant A as Supabase Auth
  participant F as FastAPI
  participant D as PostgreSQL
  P->>M: Register / fictional account sign-in
  M->>A: Provider registration and verification flow
  A-->>M: Authenticated session / access JWT
  M->>F: onboardPatient (no role parameter)
  F->>A: Trusted signing-key discovery as needed
  F->>D: Map JWT subject / create patient profile transaction
  D-->>F: Trusted application identity
  F-->>M: Me (patient role / nullable avatar)
  P->>M: Optional avatar settings / history choice
  M->>F: updateProfile / grantConsent only if chosen
  F->>D: Persist explicit choices
```

Unverified registration may not yield a session; wait for provider verification. A clinician is operator-provisioned, not selected from a public role toggle.

## 2. Patient login

```mermaid
sequenceDiagram
  participant M as Mobile
  participant A as Supabase Auth
  participant F as FastAPI
  participant D as PostgreSQL
  M->>A: Sign-in / refresh with provider client
  A-->>M: Access JWT and provider session
  M->>F: getMe with Bearer access JWT
  F->>D: Resolve subject / role / disabled flag
  D-->>F: Current application identity
  F-->>M: Me
  M->>F: getPatientContext
  F->>D: Owner-scoped context
  F-->>M: Minimal PatientContext
```

Expired/invalid JWT returns 401; refresh once through Supabase, then retry. Do not send refresh tokens to FastAPI.

## 3. Starting an ElevenAgents V1 voice conversation

```mermaid
sequenceDiagram
  participant M as Mobile / ElevenLabsAdapter
  participant F as FastAPI / Python Controller
  participant E as ElevenAgents
  participant D as PostgreSQL
  M->>F: createConversation mode=voice (no camera field)
  F->>D: Persist application conversation
  F-->>M: ConversationSession
  M->>F: createAgentConnection(mode=voice, expected_version)
  F->>F: Verify owner / session / actual agent privacy attestation
  F->>D: Allocate owned connection ID / epoch and context snapshot
  F->>E: Private WebRTC conversation token (server API key)
  E-->>F: Token / opaque provider conversation ID
  F-->>M: ElevenLabsVoiceBootstrap (no-store)
  M->>E: Start authenticated audio-only WebRTC
  M->>F: updateAgentConnection active
  opt User chooses local camera preview
    M->>M: Separate camera permission and native preview
    M->>M: Display camera-preview-only disclosure; no frame export
  end
  E-->>M: Voice / message events / client tools
```

UI shows “Camera preview only — RE cannot see your video yet.” No camera field/image/video travels to FastAPI or ElevenLabs. Microphone and camera permission/lifecycle are independent. No Gemini key/SDK/bootstrap is involved.

## 4. Separate text mode, same application context

```mermaid
sequenceDiagram
  actor P as Patient
  participant M as Mobile / VoiceAgentAdapter
  participant F as FastAPI / Python Controller
  participant E as ElevenAgents
  P->>M: Switch to text mode
  M->>E: Disconnect voice transport
  M->>F: updateAgentConnection closed (old connection)
  M->>F: updateConversation mode=text; keep application session ID
  M->>F: createAgentConnection(mode=text, expected_version)
  F->>F: Current owner/context and agent privacy verification
  F->>E: Obtain private signed WebSocket URL
  F-->>M: ElevenLabsTextBootstrap and same application AgentContext
  M->>E: Open textOnly WebSocket; no microphone/audio capture
  P->>M: Typed message
  M->>E: Send typed input
  E-->>M: Text reply / client-tool events
  opt Active RE transcript-storage grant
    M->>F: ingestMessages with owned connection ID/epoch
  end
```

Switching provider native conversation IDs does not reset Python controller, current recommendation or accepted activity. Restore only approved context; do not secretly retain/upload a transcript when history is off. Camera releases on call-view unfocus/unmount, not as a side effect of SDK disconnect. Reverse switch uses a fresh voice connection under the same application conversation.

## 5. ElevenLabs activity recommendation

```mermaid
sequenceDiagram
  participant G as ElevenAgents V1
  participant B as Mobile Bridge
  participant F as FastAPI
  participant R as Recommendation application module
  participant D as PostgreSQL
  G->>B: present_activity_recommendations tool call
  B->>F: dispatchTool with call ID / contract version / key
  F->>R: Current patient/session context
  R->>D: Active catalog / preferences / prior feedback
  D-->>R: Eligible versioned records
  R->>D: Store recommendation and ordered options
  R-->>F: Recommendation with stable IDs
  F-->>B: Canonical ToolResult
```

Rank deterministically: active supported catalog rows, preferred kind/duration compatibility, prior personal feedback and recent completion, stable ID tie-break. Do not infer medical suitability or fabricate catalog entries.

## 6. Synchronized voice and interactive cards

```mermaid
sequenceDiagram
  participant G as ElevenAgents V1
  participant B as Mobile Bridge
  participant U as React Native UI
  participant F as FastAPI
  B->>U: Apply exact Recommendation and current batch ID
  U-->>B: State applied / cards visible
  B->>G: Resolve blocking client-tool callback with same IDs/options
  G-->>U: Spoken introduction to displayed options
  alt Patient touches an option
    U->>F: startActivity with touch and current IDs
  else Patient chooses by voice
    G->>B: select_activity with current IDs
    B->>F: dispatchTool (voice channel derived by server)
  end
  F-->>U: Same ActivitySession identity / accepted state
```

Late batches are discarded/reconciled before narration. Two simultaneous choices cannot create two running activities. Backend never trusts an activity title as identity.

## 7. Activity execution, feedback and conversation return

```mermaid
sequenceDiagram
  actor P as Patient
  participant M as Mobile activity / Rive
  participant F as FastAPI
  participant D as PostgreSQL
  participant G as ElevenAgents V1
  F-->>M: Accepted ActivitySession
  M->>M: Local activity renderer / bundled assets
  G-->>P: Optional guidance while session stays active
  P->>M: Complete or abandon
  M->>F: recordActivityEvent with client_event_id / expected_version
  F->>D: Lock state / store event and outbox atomically
  F-->>M: Accepted terminal ActivitySession
  opt Completed
    P->>M: Rating / explicit optional comment
    M->>F: submitFeedback
    F->>D: Store feedback + source + outbox
  end
  M->>G: Accepted activity outcome as context
  M->>M: Refresh My Journey from accepted completion/feedback
  M->>F: getMyJourney (owner)
  F-->>M: Joined activity state / catalog version / feedback
  M->>M: Return to same application conversation / question progress
```

Local animation is not a network event. Offline completion is visibly pending until accepted; abandonment is not counted as completion.

## 8. Conversation persistence and observation extraction

```mermaid
sequenceDiagram
  participant G as ElevenAgents V1
  participant B as Mobile Bridge
  participant F as FastAPI
  participant C as Conversation / Extraction modules
  participant D as PostgreSQL
  actor P as Patient
  G-->>B: User/agent message events (tentative/final as supported)
  B->>B: Normalize owned connection epoch, speaker, turn and finality
  alt Active transcript grant
    B->>F: ingestMessages (grant ID / bounded events)
    F->>D: Lock/check consent and session ownership
    F->>C: Validated final or interrupted turns
    C->>D: Store consented history and source-linked summary
    C->>C: Propose facts only from patient speech
  else History disabled
    B->>B: Discard transient transcript; no upload
    P->>F: Explicit guided answer or observation proposal
    F->>D: Structured source; no hidden transcript
  end
  F-->>P: Proposed observation / confirmation UI
  P->>F: confirmObservation or correctObservation
  F->>D: Confirm/new correction + lineage + report invalidation
```

Model tool proposals do not confirm themselves. Direct guided answers can be confirmed structured input. Disconnect labels partial history and does not invent lost turns.

## 9. Report generation and patient viewing

```mermaid
sequenceDiagram
  actor P as Patient
  participant F as FastAPI
  participant D as PostgreSQL
  participant J as Optional jobs / Report Service
  P->>F: requestReport with period
  F->>D: Pending report + outbox in transaction
  F-->>P: ReportReceipt (202)
  J->>D: Safely claim job / read current confirmed records
  D-->>J: Facts / completions / feedback / assessment responses / sources
  J->>J: Factual counts/means/deltas and coverage; shape Report JSON
  J->>D: Fence lease / atomically save version and sources
  P->>F: getReport (owner)
  F->>D: Owner-scoped current report
  F-->>P: Viewable structured JSON (no PDF)
```

Optional job module may be invoked synchronously by a supervisor/entrypoint but never loses the durable request. Corrections mark stale and enqueue refresh; pending report is not presented as ready.

## 10. Doctor linking and scoped consent

```mermaid
sequenceDiagram
  actor P as Patient
  participant F as FastAPI
  participant D as PostgreSQL
  actor C as Verified clinician
  P->>F: inviteClinician with known verified clinician ID
  F->>D: Pending care link
  C->>F: listCareLinks / updateCareLink accept
  F->>D: Validate participant / activate link
  P->>F: grantConsent (reports and/or alerts, expiry, history scope)
  F->>D: Retire prior grant / persist explicit new grant
  F-->>P: ConsentGrant
  P->>F: revokeConsent or revoke relationship
  F->>D: Revoke / audit / suppress future visibility
```

Accepting a link grants no report access by itself. Transcript retention consent has no clinician and does not grant sharing. No email or external message is sent by this plan.

## 11. Doctor reports, follow-up and revocation

```mermaid
sequenceDiagram
  actor C as Doctor Portal
  participant F as FastAPI
  participant A as Care Link and Consent Check
  participant R as Report Service
  participant D as PostgreSQL
  C->>F: getDoctorReport with JWT / patient and report IDs
  F->>A: Verify trusted role / active relationship / report grant
  A->>D: Current scope/expiry/revocation and patient ownership
  alt Authorized
    A->>R: Authorized patient/report scope
    R->>D: Read scoped records/report projection
    D-->>R: Current versions and source references
    R-->>F: Factual Report JSON
    F->>A: Final response authorization check
    F-->>C: Viewable report (private, no-store)
    C->>F: listDoctorAlerts / updateDoctorAlert
  else Missing, revoked or expired grant
    F-->>C: 403/404 with no patient report content
  end
```

Review requests become visible only with alerts scope; no push delivery is implied. Previously viewed or already-authorized in-flight responses cannot be recalled after revocation.

## 12. Local camera lifecycle without voice coupling

```mermaid
sequenceDiagram
  actor P as Patient
  participant U as Call UI
  participant C as LocalCameraPreviewController
  participant V as ElevenLabsAdapter
  P->>U: Toggle Camera preview on
  U->>C: Request camera permission independently
  alt Camera allowed and view focused/foreground
    C-->>U: Render native local preview only
    U->>U: Camera preview only — RE cannot see your video yet.
  else Denied or unavailable
    C-->>U: Explain preview unavailable
  end
  V-->>U: Voice disconnect / reconnect event
  U->>U: Update voice status only; no camera mutation
  P->>U: Camera off or leave/background view
  U->>C: Unmount/release preview independently
```

There is deliberately no camera-to-provider/backend arrow. Camera denial/off does not terminate voice; microphone denial does not prevent a local preview on the focused call view.
