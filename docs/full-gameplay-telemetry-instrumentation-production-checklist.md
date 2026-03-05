# Full gameplay telemetry instrumentation Checklist

Source of truth checklist for a large/intense task.

## Metadata
- Created: 2026-03-05T10:08:54
- Last Updated: 2026-03-05T10:19:20
- Workspace: /Users/davedixon/Documents/GitHub/NewGenPromisedLand
- Checklist Doc: /Users/davedixon/Documents/GitHub/NewGenPromisedLand/docs/full-gameplay-telemetry-instrumentation-production-checklist.md

## Scope
- [x] Q-000 [status:verified] Capture explicit scope, constraints, and success criteria.
  - Scope: instrument full gameplay analytics for tuning (lifecycle, setup choices, gameplay actions, combat/ability outcomes, save/load, end-state).
  - Constraints: keep telemetry payloads compact/safe, avoid breaking online/local flows, keep PostHog optional via env gating.
  - Success criteria: events emit from real game sources (not placeholders), docs updated, and checks pass on final code.

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
- [x] F-001 [status:verified] [P1] [confidence:0.98] Gameplay telemetry helpers exist but are not wired to core gameplay flows, so gameplay tuning signal is mostly missing.
  - Evidence: `client/src/utils/posthog.ts` exports lifecycle/action helpers, but grep audit shows no runtime usage in gameplay components/stores; only web vitals are captured by default (`client/src/utils/telemetry/webVitals.ts` + `client/src/utils/telemetry/index.ts`).
  - Owner: codex
  - Linked Fix: P-001
- [x] F-002 [status:verified] [P1] [confidence:0.95] Shared simulation telemetry (`emitTelemetry`) from combat/ability/technology paths is not bridged into PostHog, so blocked/success outcomes are lost from analytics backend.
  - Evidence: `emitTelemetry` calls in `shared/logic/actions/abilities.ts`, `shared/logic/actions/movementCombat.ts`, and `shared/logic/worldElementActions.ts`; no `subscribeTelemetry` initialization in app startup (`rg initTelemetryStore|initTelemetryConsole` => only definitions).
  - Owner: codex
  - Linked Fix: P-002

## Fix Log
- [x] P-001 [status:verified] Wire lifecycle/setup/action/save-load telemetry in gameplay store/components with compact structured payloads.
  - Addresses: F-001
  - Evidence: Added gameplay analytics module and store/component wiring in `client/src/utils/telemetry/gameplayAnalytics.ts`, `client/src/lib/stores/useLocalGame.ts`, `client/src/components/ui/MainMenu.tsx`, `client/src/components/ui/SaveLoadMenu.tsx`, `client/src/components/ui/SaveSystem.tsx`, `client/src/hooks/useOnlineGameSync.ts`, `client/src/components/ui/LobbyRoom.tsx`, and `client/src/components/game/GameUI.tsx`.
- [x] P-002 [status:verified] Add bridge from shared telemetry bus to PostHog and dedupe-safe initialization.
  - Addresses: F-002
  - Evidence: Added `initSharedTelemetryBridge()` in `client/src/utils/telemetry/gameplayAnalytics.ts` and invoked it from `client/src/utils/telemetry/index.ts`.

## Validation Log
- [x] V-001 [status:verified] `npm run check`
  - Evidence: 2026-03-05 10:20 EST pass
- [x] V-002 [status:verified] `npm run lint`
  - Evidence: 2026-03-05 10:20 EST pass (0 errors, 2 pre-existing hook-dependency warnings in `client/src/components/hud/PlayerHUD.tsx`)
- [x] V-003 [status:verified] `npx vitest run`
  - Evidence: 2026-03-05 10:18 EST pass (111 files, 807 tests)
- [x] V-004 [status:verified] `npx eslint client/src/lib/stores/useLocalGame.ts client/src/utils/telemetry/gameplayAnalytics.ts client/src/utils/telemetry/index.ts client/src/components/ui/MainMenu.tsx client/src/components/ui/SaveLoadMenu.tsx client/src/components/ui/SaveSystem.tsx client/src/hooks/useOnlineGameSync.ts client/src/components/game/GameUI.tsx client/src/components/ui/LobbyRoom.tsx`
  - Evidence: 2026-03-05 10:16 EST pass

## Residual Risks
- [x] R-001 [status:accepted_risk] Event volume could increase on long sessions if every action is captured without guardrails.
  - Rationale: Full instrumentation introduces high-frequency action events; payload discipline and event naming should keep this manageable.
  - Owner: codex
  - Follow-up trigger/date: evaluate PostHog ingest volume after first production week.

## Change Log
- 2026-03-05T10:08:54: Checklist initialized.
- 2026-03-05T10:18:00: Scoped job, completed discovery, logged findings F-001/F-002, and started implementation queue Q-003.
- 2026-03-05T10:19:20: Completed implementation, added regression tests, reran lint/types/full vitest, resolved findings, and closed sign-off gates.
- 2026-03-05T10:20:40: Final post-edit rerun completed (`npm run check`, `npm run lint`) and checklist validator reconfirmed clean sign-off.
