# server backed sidecar chat transport implementation Checklist

Source of truth checklist for a large/intense task.

## Metadata
- Created: 2026-03-02T01:04:25
- Last Updated: 2026-03-02T03:53:03
- Workspace: /Users/davedixon/Documents/GitHub/NewGenPromisedLand
- Checklist Doc: /Users/davedixon/Documents/GitHub/NewGenPromisedLand/docs/server-backed-sidecar-chat-transport-implementation-production-checklist.md

## Scope
- [x] Q-000 [status:verified] Capture explicit scope, constraints, and success criteria.
  - Scope: Implement server-backed chat transport for lobby + online matches (text, voice-note metadata, typing, read updates) and wire existing UI channel hook from local broadcast to authenticated lobby API polling.
  - Constraints: Keep current data model (no new DB tables/migrations), preserve existing chat UI, avoid breaking multiplayer action sync, and keep validation green.
  - Success: Cross-device chat events flow through backend routes, client polling receives events, sends are idempotent, unread/read/typing continue to function, and existing tests/check/lint pass.
- [x] Q-007 [status:verified] Capture hardening-cycle scope for production readiness audit.
  - Scope: Deep-audit full voice-note chat implementation for regressions, blockers, edge cases, and production gaps across client/server/storage integration.
  - Constraints: Avoid disrupting other local-agent work; do not commit/push in this pass; patch only deterministic local fixes.
  - Success: All discovered code issues fixed locally, validations rerun after final edit, and any remaining infra/server deployment tasks explicitly documented.

## Sign-off Gate
- [x] G-001 [status:verified] All queued work, findings, fixes, and validations are complete.
- [x] G-002 [status:verified] All findings are resolved or marked `accepted_risk` with rationale and owner.
- [x] G-003 [status:verified] Required validation suite has been rerun on the final code state.
- [x] G-004 [status:verified] Residual risks and follow-ups are documented.

## Rerun Matrix
- [x] G-010 [status:verified] If code changes after any checked `V-*`, reset affected validation items to unchecked.
- [x] G-011 [status:verified] Final sign-off only after a full validation pass completed after the last code edit.

## Audit Queue
- [x] Q-001 [status:verified] Create checklist and baseline scope.
- [x] Q-002 [status:verified] Complete discovery/audit of impacted systems.
- [x] Q-003 [status:verified] Implement required changes.
- [x] Q-004 [status:verified] Expand or update automated tests.
- [x] Q-005 [status:verified] Run full validation suite.
- [x] Q-006 [status:verified] Final code-quality pass and sign-off review.
- [x] Q-008 [status:verified] Run end-to-end production-hardening audit across voice-note send/retry/playback and backend contracts.
- [x] Q-009 [status:verified] Implement fixes for all discovered regressions and edge cases.
- [x] Q-010 [status:verified] Rerun final validation suite on post-fix code state.
- [x] Q-011 [status:verified] Document residual infra/deployment tasks and complete sign-off.

## Findings Log
- [x] F-001 [status:verified] [P1] [confidence:0.99] Chat transport is browser-local only (`BroadcastChannel` + localStorage) and cannot deliver across devices.
  - Evidence: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/hooks/useChatChannel.ts` uses `BroadcastChannel`, no backend chat API calls.
  - Owner: codex
  - Linked Fix: P-001
- [x] F-002 [status:verified] [P1] [confidence:0.95] No backend chat routes exist for message persistence, typing, or read updates.
  - Evidence: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/routes.ts` has no `/chat` endpoints under lobbies.
  - Owner: codex
  - Linked Fix: P-002
- [x] F-003 [status:verified] [P2] [confidence:0.92] Default JSON body size limit can reject voice-note payloads when transported as data URLs.
  - Evidence: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/index.ts` uses `express.json()` with default limit.
  - Owner: codex
  - Linked Fix: P-003
- [x] F-004 [status:verified] [P1] [confidence:0.93] Lobby start route references `hostLastSeen` before initialization, risking runtime failure.
  - Evidence: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/routes.ts` line region around player map/start uses `lastSeenAt: hostLastSeen` before `const hostLastSeen = Date.now()`.
  - Owner: codex
  - Linked Fix: P-004
- [x] F-005 [status:verified] [P2] [confidence:0.83] No targeted automated tests currently cover server-backed chat endpoint behavior or client event-polling integration.
  - Evidence: no existing chat transport tests in `test/` and `client/src/hooks/__tests__/`.
  - Owner: codex
  - Linked Fix: P-005
- [x] F-006 [status:accepted_risk] [P2] [confidence:0.88] Voice transport currently stores data URLs directly in lobby state instead of object storage URLs, which is functional but heavier than production-grade blob storage.
  - Evidence: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/hooks/useChatChannel.ts` sends `audioUrl` data URL to `/chat/messages`; `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/routes.ts` persists it in `gameState.chat`.
  - Owner: codex
  - Linked Fix: P-006
- [x] F-007 [status:verified] [P1] [confidence:0.92] `/chat/messages` accepts any `https://` audio URL, allowing external tracker/media URLs instead of enforcing trusted storage origin.
  - Evidence: Enforced storage URL prefix checks in `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/routes.ts` using `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/r2.ts:isVoiceStorageUrl`.
  - Owner: codex
  - Linked Fix: P-007
- [x] F-008 [status:verified] [P1] [confidence:0.90] Voice drafts can resolve with `durationMs=0`, which passes upload but is rejected by message validation, causing unrecoverable failed voice sends.
  - Evidence: Added fallback-duration draft generation in `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/chat/VoiceRecorderComposer.tsx`; added non-positive duration rejection in `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/routes.ts` and `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/hooks/useChatChannel.ts`.
  - Owner: codex
  - Linked Fix: P-008
- [x] F-009 [status:verified] [P2] [confidence:0.87] Voice retry gating is inconsistent with server URL policy and can show retry attempts that are guaranteed to fail.
  - Evidence: Retry now requires HTTPS URL + positive duration in `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/hooks/useChatChannel.ts`; dead-end retry button hidden in `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/chat/ChatFeed.tsx`.
  - Owner: codex
  - Linked Fix: P-009
- [x] F-010 [status:verified] [P2] [confidence:0.84] Unread behavior does not fully match focused-read intent when chat is open but tab/window is not focused.
  - Evidence: Unread increment now keys on open+focused visibility check in `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/hooks/useChatUIState.ts`; behavior covered by new tests in `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/hooks/__tests__/useChatUIState.test.ts`.
  - Owner: codex
  - Linked Fix: P-010
- [x] F-011 [status:verified] [P3] [confidence:0.88] Voice duration limits are still duplicated across modules, risking future drift.
  - Evidence: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/chatState.ts` now consumes `VOICE_LIMITS.maxDurationMs`; verified in `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/test/server/chatState.test.ts`.
  - Owner: codex
  - Linked Fix: P-011

## Fix Log
- [x] P-001 [status:verified] Replace local-only chat channel transport with authenticated backend polling/events transport while preserving existing UI state contract.
  - Addresses: F-001
  - Evidence: Implemented backend polling + API writes in `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/hooks/useChatChannel.ts` with message snapshot bootstrap and realtime event polling.
- [x] P-002 [status:verified] Add lobby chat backend endpoints (messages/events/typing/read) with participant auth, idempotency, and bounded retention.
  - Addresses: F-002
  - Evidence: Added `/api/lobbies/:code/chat/messages`, `/api/lobbies/:code/chat/events`, `/api/lobbies/:code/chat/typing`, `/api/lobbies/:code/chat/read` in `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/routes.ts`.
- [x] P-003 [status:verified] Increase JSON body limit safely and enforce chat payload validation/limits server-side.
  - Addresses: F-003
  - Evidence: Raised JSON body cap in `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/index.ts`; added message/voice validation + retention bounds in `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/chatState.ts`.
- [x] P-004 [status:verified] Fix `hostLastSeen` initialization order in lobby start flow.
  - Addresses: F-004
  - Evidence: Moved `hostLastSeen` initialization ahead of player map in `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/routes.ts` and preserved chat state across start transition.
- [x] P-005 [status:verified] Add targeted tests for chat store/channel and server route contracts where feasible in this repo context.
  - Addresses: F-005
  - Evidence: Added `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/test/server/chatState.test.ts`; existing `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/hooks/__tests__/useChatUIState.test.ts` rerun.
- [x] P-006 [status:accepted_risk] Defer object-storage voice media pipeline; keep validated data URL transport for this phase.
  - Addresses: F-006
  - Evidence: Explicitly accepted for this implementation phase; requires infra/storage wiring outside current scope.
- [x] P-007 [status:verified] Enforce trusted voice storage URL origin on server-side message ingest.
  - Addresses: F-007
  - Evidence: Added `isVoiceStorageUrl` in `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/r2.ts` and enforced it for inbound voice messages in `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/routes.ts`.
- [x] P-008 [status:verified] Harden voice draft duration handling and reject non-positive durations before upload/message send.
  - Addresses: F-008
  - Evidence: Updated fallback draft generation in `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/chat/VoiceRecorderComposer.tsx`; added positive-duration guards in `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/hooks/useChatChannel.ts` and `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/routes.ts`.
- [x] P-009 [status:verified] Align client retryability rules with server URL policy and hide dead-end voice retries.
  - Addresses: F-009
  - Evidence: Retry guard hardened in `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/hooks/useChatChannel.ts`; retry button gating/labels hardened in `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/chat/ChatFeed.tsx`.
- [x] P-010 [status:verified] Correct unread increment logic to require focused visibility for “auto-read while open.”
  - Addresses: F-010
  - Evidence: Updated unread logic in `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/hooks/useChatUIState.ts` plus regression coverage in `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/hooks/__tests__/useChatUIState.test.ts`.
- [x] P-011 [status:verified] Remove remaining duplicated voice-duration constants by consuming shared limits in chat state validation.
  - Addresses: F-011
  - Evidence: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/chatState.ts` now imports `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/shared/types/voiceLimits.ts`.

## Validation Log
- [x] V-001 [status:verified] `npm run check`
  - Evidence: 2026-03-02 01:09 ET — pass.
- [x] V-002 [status:verified] `npm run lint`
  - Evidence: 2026-03-02 01:10 ET — pass.
- [x] V-003 [status:verified] `npx vitest run test/server/chatState.test.ts`
  - Evidence: 2026-03-02 01:09 ET — pass (5/5 tests).
- [x] V-004 [status:verified] `npx vitest run client/src/hooks/__tests__/useChatUIState.test.ts test/HotkeyInputBlocking.test.tsx test/TutorialModalInputBlocking.test.tsx`
  - Evidence: 2026-03-02 01:09 ET — pass (7/7 tests).
- [x] V-005 [status:verified] `npm run check`
  - Evidence: 2026-03-02 03:52 ET — pass.
- [x] V-006 [status:verified] `npm run lint`
  - Evidence: 2026-03-02 03:52 ET — pass.
- [x] V-007 [status:verified] `npx vitest run test/server/chatState.test.ts test/server/r2.test.ts`
  - Evidence: 2026-03-02 03:52 ET — pass (8/8 tests).
- [x] V-008 [status:verified] `npx vitest run client/src/hooks/__tests__/useChatUIState.test.ts test/HotkeyInputBlocking.test.tsx test/TutorialModalInputBlocking.test.tsx`
  - Evidence: 2026-03-02 03:52 ET — pass (9/9 tests).

## Residual Risks
- [x] R-001 [status:verified] Prior data-URL storage risk is resolved by object-storage URL flow.
  - Rationale: Voice-note upload now uses presigned object-storage PUT and persists URL metadata, removing large data-URL payload persistence from lobby state.
  - Owner: codex
  - Follow-up trigger/date: N/A.
- [x] R-002 [status:accepted_risk] Validate deployment environment prerequisites for presigned voice upload (R2 env vars, bucket CORS, and public URL reachability).
  - Rationale: Local code can be correct while deployed upload/playback still fails without matching cloud configuration.
  - Owner: platform/backend
  - Follow-up trigger/date: Before enabling voice notes for production traffic.

## Change Log
- 2026-03-02T01:04:25: Checklist initialized.
- 2026-03-02T01:05:10: Scope captured; discovery in progress; findings F-001..F-005 logged with planned fixes P-001..P-005.
- 2026-03-02T01:10:08: Implemented server-backed chat routes + client transport rewrite, added chat-state helper/test coverage, reran final validations, and documented residual risks.
- 2026-03-02T03:46:36: Reopened checklist for full production-hardening audit pass; reset gates/rerun matrix, added new queue/validation/risk items for this cycle.
- 2026-03-02T03:53:03: Completed production-hardening fixes (URL origin enforcement, retry/duration safety, focused unread handling, shared voice limits), reran validation matrix, and documented deployment-owned residual risks.
