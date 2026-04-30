# HUD compact layout hardening Checklist

Source of truth checklist for a large/intense task.

## Metadata
- Created: 2026-03-11T12:30:36
- Last Updated: 2026-03-11T12:30:36
- Workspace: /Users/davedixon/Documents/GitHub/NewGenPromisedLand
- Checklist Doc: /Users/davedixon/Documents/GitHub/NewGenPromisedLand/docs/hud-compact-layout-hardening-production-checklist.md

## Scope
- [x] Q-000 [status:verified] Audit and harden the recent compact desktop HUD, game log, selected-unit panel, and AI setup contrast changes without disturbing unrelated in-flight repo work.

## Sign-off Gate
- [x] G-001 [status:verified] All queued work, findings, fixes, and validations are complete.
- [x] G-002 [status:verified] All findings are resolved or marked `accepted_risk` with rationale and owner.
- [x] G-003 [status:verified] Required validation suite has been rerun on the final code state.
- [x] G-004 [status:verified] Residual risks and follow-ups are documented.

## Rerun Matrix
- [x] G-010 [status:verified] Code changed after the initial sweep, and affected validations were rerun on the final state.
- [x] G-011 [status:verified] Final sign-off is based on the post-edit validation pass recorded below.

## Audit Queue
- [x] Q-001 [status:verified] Create checklist and baseline scope.
- [x] Q-002 [status:verified] Completed static and live audit of `PlayerHUD`, `GameLogPanel`, `SelectedUnitPanel`, `GameUI`, and the recent `PlayerSetup` contrast changes.
- [x] Q-003 [status:verified] Fixed the compact desktop game log overlay regression and tightened compact HUD presentation details.
- [x] Q-004 [status:verified] Added a regression test covering compact desktop game log modal behavior.
- [x] Q-005 [status:verified] Reran typecheck, lint, targeted vitest suites, and browser smoke verification after the last code edit.
- [x] Q-006 [status:verified] Completed final code-quality pass, checked for regressions, and documented residual risk status.

## Findings Log
- [x] F-001 [status:verified] [P2] [confidence:0.95] Compact desktop `Game Log` still rendered as a bottom-left floating panel and overlaid the HUD action row after the integrated HUD trigger was added.
  - Evidence: live Playwright screenshot at `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/output/compact-hud-gamelog-baseline.png`; code path in `client/src/components/ui/GameLogPanel.tsx` and `client/src/components/game/GameUI.tsx`.
  - Owner: Codex
  - Linked Fix: P-001

## Fix Log
- [x] P-001 [status:verified] Converted compact desktop `Game Log` into a focused modal panel below the HUD, aligned naming to `Game Log`, disabled the legacy bottom-left avoidance offset in that mode, and added regression coverage.
  - Addresses: F-001
  - Evidence: `client/src/components/ui/GameLogPanel.tsx`, `client/src/components/game/GameUI.tsx`, `client/src/components/hud/PlayerHUD.tsx`, `test/PlayerHUDCompactLayout.test.tsx`, final Playwright screenshot `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/output/compact-hud-gamelog-hardened.png`.

## Validation Log
- [x] V-001 [status:verified] `npm run check`
  - Evidence: 2026-03-11 12:39 EDT + pass
- [x] V-002 [status:verified] `npm run lint -- client/src/components/hud/PlayerHUD.tsx client/src/components/ui/SelectedUnitPanel.tsx client/src/components/ui/GameLogPanel.tsx client/src/components/game/GameUI.tsx client/src/components/ui/PlayerSetup.tsx test/PlayerHUDCompactLayout.test.tsx test/MovementSystemCore.test.tsx test/MovementSystemIntegration.test.tsx test/MovementUIFlowIntegration.test.tsx`
  - Evidence: 2026-03-11 12:39 EDT + pass
- [x] V-003 [status:verified] `npx vitest run test/PlayerHUDCompactLayout.test.tsx test/MovementSystemCore.test.tsx test/MovementSystemIntegration.test.tsx test/MovementUIFlowIntegration.test.tsx test/OverlayPointerEventsCanary.test.tsx`
  - Evidence: 2026-03-11 12:39 EDT + pass (5 files, 46 tests)
- [x] V-004 [status:verified] `VITE_E2E_MINIMAL_GAME_STAGE=true npx vite --host 127.0.0.1 --port 4174 --force` + Playwright compact-desktop smoke test for HUD/game log/unit panel/player setup
  - Evidence: 2026-03-11 12:40 EDT + pass; browser verified modal `Game Log` no longer covers HUD controls and AI player-name field remains readable with dark background/light text.

## Residual Risks
- [x] R-001 [status:verified] No unresolved issues found in the audited HUD/log/unit-panel/player-setup paths after final rerun.
  - Rationale: Static review, targeted automated tests, and live compact-desktop/browser checks all passed on the final code state.
  - Owner: Codex
  - Follow-up trigger/date: Revisit if the compact desktop breakpoint or utility dock layout changes materially.

## Change Log
- 2026-03-11T12:30:36: Checklist initialized.
- 2026-03-11T12:40:00: Logged compact desktop game log overlay regression, implemented modal-panel fix, reran validations, and completed sign-off.
