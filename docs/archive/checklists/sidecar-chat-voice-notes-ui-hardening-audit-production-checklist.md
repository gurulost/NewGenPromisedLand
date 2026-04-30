# sidecar chat voice notes ui hardening audit Checklist

Source of truth checklist for a large/intense task.

## Metadata
- Created: 2026-03-02T00:40:54
- Last Updated: 2026-03-02T00:57:08
- Workspace: /Users/davedixon/Documents/GitHub/NewGenPromisedLand
- Checklist Doc: /Users/davedixon/Documents/GitHub/NewGenPromisedLand/docs/sidecar-chat-voice-notes-ui-hardening-audit-production-checklist.md

## Scope
- [x] Q-000 [status:verified] Capture explicit scope, constraints, and success criteria.
  - Scope: Audit and harden sidecar chat + voice-notes UX implementation across desktop, mobile, lobby integration, input safety, accessibility, and delivery-state handling.
  - Constraints: Keep existing slate/amber system, preserve non-blocking sidecar behavior, avoid backend architecture expansion in this pass, and keep TypeScript/lint/test clean.
  - Success: Plan-aligned behavior for unread/read states, recording/retry safety, scope gating (online-only), reduced-motion handling, and no regressions in game input flow.

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
- [x] F-001 [status:verified] [P1] [confidence:0.93] Duplicate chat channel subscriptions occur when desktop dock is open, causing duplicate event handling work and risk of duplicate side effects.
  - Evidence: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/chat/ChatDock.tsx` and `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/chat/ChatPanel.tsx` both call `useChatChannel(identity)` for the same lobby while panel is open.
  - Owner: codex
  - Linked Fix: P-001
- [x] F-002 [status:verified] [P1] [confidence:0.96] Opening chat immediately clears unread count instead of honoring the 500ms focused-read rule.
  - Evidence: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/hooks/useChatUIState.ts` `setLobbyOpen` sets `unreadCount: 0` whenever `isOpen` is true.
  - Owner: codex
  - Linked Fix: P-002
- [x] F-003 [status:verified] [P1] [confidence:0.90] Failed voice sends can lose audio payload, leaving retry unavailable for voice-note failure states.
  - Evidence: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/hooks/useChatChannel.ts` pending voice message is created without `audioUrl`; failure path sets status failed without attaching encoded audio.
  - Owner: codex
  - Linked Fix: P-003
- [x] F-004 [status:verified] [P2] [confidence:0.88] Mobile chat entry is visible in offline/local sessions, violating online-only chat scope.
  - Evidence: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/hud/MobileHUD.tsx` always renders Chat tile; `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/game/GameUI.tsx` always passes `onOpenChat`.
  - Owner: codex
  - Linked Fix: P-004
- [x] F-005 [status:verified] [P2] [confidence:0.84] Reduced-motion and accessibility polish requirements are not fully implemented for chat interactions.
  - Evidence: No reduced-motion behavior in chat motion/pulse elements; incomplete focus-visible treatments across icon controls in chat components.
  - Owner: codex
  - Linked Fix: P-005
- [x] F-006 [status:verified] [P2] [confidence:0.83] Closing voice composer while actively recording can still commit a draft after close, creating stale hidden drafts.
  - Evidence: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/chat/VoiceRecorderComposer.tsx` `handleClose` stops recorder but `onstop` still creates/saves draft.
  - Owner: codex
  - Linked Fix: P-006
- [x] F-007 [status:verified] [P1] [confidence:0.94] `GameUI` can crash when `onlineSession.myPlayerIds` is missing, breaking hotkey/input flows in tests and edge session states.
  - Evidence: `npx vitest run test/HotkeyInputBlocking.test.tsx` failed with `Cannot read properties of undefined (reading 'includes')` in `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/game/GameUI.tsx`; all direct `myPlayerIds.includes(...)` usages were guarded and retested.
  - Owner: codex
  - Linked Fix: P-007
- [x] F-008 [status:accepted_risk] [P2] [confidence:0.87] Chat transport is still browser-local (`BroadcastChannel` + local state) and is not yet server-backed for cross-device multiplayer delivery.
  - Evidence: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/hooks/useChatChannel.ts` has no server API integration; behavior is local-tab/browser-origin scoped.
  - Owner: codex
  - Linked Fix: P-008
- [x] F-009 [status:verified] [P2] [confidence:0.90] Voice message cards were missing explicit avatar identity and had sub-44px primary playback controls on mobile.
  - Evidence: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/chat/ChatFeed.tsx` voice row lacked avatar and used `h-8 w-8` play control.
  - Owner: codex
  - Linked Fix: P-009
- [x] F-010 [status:verified] [P2] [confidence:0.86] Single-active voice playback was local to a single feed instance, not globally coordinated across concurrent chat surfaces.
  - Evidence: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/chat/ChatFeed.tsx` managed playback via component-local state only.
  - Owner: codex
  - Linked Fix: P-010
- [x] F-011 [status:verified] [P2] [confidence:0.84] Peek suppression did not include standard tutorial overlays/library in normal games.
  - Evidence: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/game/GameUI.tsx` suppression conditions excluded `useTutorialStore.activeCardId`/`isLibraryOpen`.
  - Owner: codex
  - Linked Fix: P-011
- [x] F-012 [status:verified] [P2] [confidence:0.83] `C` hotkey could open chat while other blocking overlays were active, conflicting with global hotkey suppression behavior.
  - Evidence: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/game/GameUI.tsx` chat hotkey path ignored `shouldIgnoreGlobalHotkeys`.
  - Owner: codex
  - Linked Fix: P-012
- [x] F-013 [status:verified] [P2] [confidence:0.88] Lobby desktop chat dock was hidden below `lg` breakpoints, creating a no-chat path on smaller desktop widths.
  - Evidence: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/LobbyRoom.tsx` used `hidden lg:block` for docked chat mount.
  - Owner: codex
  - Linked Fix: P-013

## Fix Log
- [x] P-001 [status:verified] Remove duplicate desktop channel wiring by sharing one channel hook instance between dock and panel.
  - Addresses: F-001
  - Evidence: Added shared channel injection from `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/chat/ChatDock.tsx` into `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/chat/ChatPanel.tsx`; panel now uses internal channel only when no injected channel is provided.
- [x] P-002 [status:verified] Align read/unread behavior with focused 500ms read confirmation.
  - Addresses: F-002
  - Evidence: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/hooks/useChatUIState.ts` no longer clears unread on open; `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/chat/ChatPanel.tsx` now queues focused-read marking and visibility/focus-driven delayed reads.
- [x] P-003 [status:verified] Preserve voice payload on send failure so failed voice notes can be retried.
  - Addresses: F-003
  - Evidence: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/hooks/useChatChannel.ts` now retains encoded voice payload and applies it in failed state updates for retry.
- [x] P-004 [status:verified] Gate mobile chat entry to online sessions only.
  - Addresses: F-004
  - Evidence: Added `showChat` gating in `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/hud/MobileHUD.tsx`; `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/game/GameUI.tsx` passes `showChat={Boolean(chatIdentity)}`.
- [x] P-005 [status:verified] Add reduced-motion handling and complete focus-visible accessibility affordances.
  - Addresses: F-005
  - Evidence: Reduced-motion-aware animation handling added to `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/chat/ChatDock.tsx` and `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/chat/VoiceRecorderComposer.tsx`; focus-visible rings added across chat controls including `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/chat/TextComposer.tsx` and `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/chat/ChatFeed.tsx`.
- [x] P-006 [status:verified] Prevent hidden/stale draft creation when closing recorder mid-capture.
  - Addresses: F-006
  - Evidence: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/chat/VoiceRecorderComposer.tsx` now tracks discard-on-stop, suppresses draft persistence on close/unmount cancellation, and resets recorder state safely.
- [x] P-007 [status:verified] Guard `myPlayerIds` access to avoid `includes` crash in sparse `onlineSession` shapes.
  - Addresses: F-007
  - Evidence: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/game/GameUI.tsx` now derives `onlineMyPlayerIds` with `Array.isArray` and routes all online-player checks through it.
- [x] P-008 [status:accepted_risk] Transport architecture follow-up deferred: keep current local channel behavior for this UI hardening pass.
  - Addresses: F-008
  - Evidence: Explicitly documented as residual risk requiring server API work in future phase.
- [x] P-009 [status:verified] Upgrade voice cards with sender avatar initials and 44px+ play/retry tap targets; upgrade jump-to-latest tap target for mobile ergonomics.
  - Addresses: F-009
  - Evidence: Updated `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/chat/ChatFeed.tsx` and `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/chat/ChatPanel.tsx`.
- [x] P-010 [status:verified] Add global active-voice coordination event so starting one voice note halts currently playing notes across chat instances.
  - Addresses: F-010
  - Evidence: Added global event coordination + cleanup in `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/chat/ChatFeed.tsx`.
- [x] P-011 [status:verified] Extend peek suppression rules to include active tutorial card/library overlays.
  - Addresses: F-011
  - Evidence: Added tutorial-store selectors to suppression checks in `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/game/GameUI.tsx`.
- [x] P-012 [status:verified] Respect global hotkey blocking when opening chat via `C` (while still allowing `C` to close chat if already open).
  - Addresses: F-012
  - Evidence: Updated chat keyboard subscription in `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/game/GameUI.tsx`.
- [x] P-013 [status:verified] Make lobby desktop docked chat available on all non-mobile desktop widths.
  - Addresses: F-013
  - Evidence: Updated lobby chat mount visibility in `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/LobbyRoom.tsx`.

## Validation Log
- [x] V-001 [status:verified] `npm run check`
  - Evidence: 2026-03-02 00:56 ET — pass.
- [x] V-002 [status:verified] `npm run lint`
  - Evidence: 2026-03-02 00:56 ET — pass.
- [x] V-003 [status:verified] `npx vitest run test/HotkeyInputBlocking.test.tsx test/TutorialModalInputBlocking.test.tsx`
  - Evidence: 2026-03-02 00:56 ET — pass (4/4 tests).
- [x] V-004 [status:verified] `npx vitest run client/src/hooks/__tests__/useChatUIState.test.ts`
  - Evidence: 2026-03-02 00:56 ET — pass (3/3 tests).

## Residual Risks
- [x] R-001 [status:verified] Cross-device/server chat transport is not implemented in this pass (current transport remains browser-local).
  - Rationale: This pass was scoped to UI/UX hardening and regressions; moving to server-backed multiplayer chat requires dedicated backend/API/storage workstream.
  - Owner: product + multiplayer backend
  - Follow-up trigger/date: Start before enabling chat for real cross-device online beta.

## Change Log
- 2026-03-02T00:40:54: Checklist initialized.
- 2026-03-02T00:44:37: Scope finalized; discovery audit underway; findings F-001..F-006 logged with planned fixes P-001..P-006.
- 2026-03-02T00:49:45: Implemented hardening fixes P-001..P-007, logged accepted-risk transport follow-up (P-008/F-008), added chat state tests, and completed final validation reruns.
- 2026-03-02T00:53:08: Hardened all `myPlayerIds` call sites in `GameUI` to remove undefined-session crash class; reran final validation suite.
- 2026-03-02T00:57:08: Completed final UX-polish hardening (voice avatar/tap-targets, global voice playback coordination, tutorial peek suppression, hotkey overlay gating, full desktop lobby dock visibility) and reran full targeted validations.
