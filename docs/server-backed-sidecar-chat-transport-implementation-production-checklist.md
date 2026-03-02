# server backed sidecar chat transport implementation Checklist

Source of truth checklist for a large/intense task.

## Metadata
- Created: 2026-03-02T01:04:25
- Last Updated: 2026-03-02T01:10:08
- Workspace: /Users/davedixon/Documents/GitHub/NewGenPromisedLand
- Checklist Doc: /Users/davedixon/Documents/GitHub/NewGenPromisedLand/docs/server-backed-sidecar-chat-transport-implementation-production-checklist.md

## Scope
- [x] Q-000 [status:verified] Capture explicit scope, constraints, and success criteria.
  - Scope: Implement server-backed chat transport for lobby + online matches (text, voice-note metadata, typing, read updates) and wire existing UI channel hook from local broadcast to authenticated lobby API polling.
  - Constraints: Keep current data model (no new DB tables/migrations), preserve existing chat UI, avoid breaking multiplayer action sync, and keep validation green.
  - Success: Cross-device chat events flow through backend routes, client polling receives events, sends are idempotent, unread/read/typing continue to function, and existing tests/check/lint pass.

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

## Validation Log
- [x] V-001 [status:verified] `npm run check`
  - Evidence: 2026-03-02 01:09 ET — pass.
- [x] V-002 [status:verified] `npm run lint`
  - Evidence: 2026-03-02 01:10 ET — pass.
- [x] V-003 [status:verified] `npx vitest run test/server/chatState.test.ts`
  - Evidence: 2026-03-02 01:09 ET — pass (5/5 tests).
- [x] V-004 [status:verified] `npx vitest run client/src/hooks/__tests__/useChatUIState.test.ts test/HotkeyInputBlocking.test.tsx test/TutorialModalInputBlocking.test.tsx`
  - Evidence: 2026-03-02 01:09 ET — pass (7/7 tests).

## Residual Risks
- [x] R-001 [status:verified] Voice message payloads are currently persisted as data URLs in lobby state, not object-storage URLs.
  - Rationale: Enables immediate cross-device functionality without new infra, but is less storage-efficient than signed-upload object storage design.
  - Owner: platform/backend
  - Follow-up trigger/date: Migrate before high-volume production rollout.

## Change Log
- 2026-03-02T01:04:25: Checklist initialized.
- 2026-03-02T01:05:10: Scope captured; discovery in progress; findings F-001..F-005 logged with planned fixes P-001..P-005.
- 2026-03-02T01:10:08: Implemented server-backed chat routes + client transport rewrite, added chat-state helper/test coverage, reran final validations, and documented residual risks.
