# Full game lurking-issues audit Checklist

Source of truth checklist for a large/intense task.

## Metadata
- Created: 2026-03-11T12:24:21
- Last Updated: 2026-03-11T12:36:00
- Workspace: /Users/davedixon/Documents/GitHub/NewGenPromisedLand
- Checklist Doc: /Users/davedixon/Documents/GitHub/NewGenPromisedLand/docs/full-game-lurking-issues-audit-production-checklist.md

## Scope
- [x] Q-000 [status:verified] Audit and harden the live game shell and high-risk UI flows for runtime crashes, provider drift, and mobile viewport regressions without reverting unrelated user worktree changes.

## Sign-off Gate
- [x] G-001 [status:verified] All queued work, findings, fixes, and validations are complete.
- [x] G-002 [status:verified] All findings are resolved or marked `accepted_risk` with rationale and owner.
- [x] G-003 [status:verified] Required validation suite has been rerun on the final code state.
- [x] G-004 [status:verified] Residual risks and follow-ups are documented.

## Rerun Matrix
- [x] G-010 [status:verified] Validation items were rerun after the final `select.tsx` and `PlayerSetup.tsx` edits.
- [x] G-011 [status:verified] Final sign-off is based on rerun validations completed after the last code edit.

## Audit Queue
- [x] Q-001 [status:verified] Create checklist and baseline scope.
- [x] Q-002 [status:verified] Complete discovery/audit of impacted systems.
- [x] Q-003 [status:verified] Implement required changes.
- [x] Q-004 [status:verified] Expand or update automated tests.
- [x] Q-005 [status:verified] Run full validation suite.
- [x] Q-006 [status:verified] Final code-quality pass and sign-off review.

## Findings Log
- [x] F-001 [status:verified] [P1] [confidence:0.96] `App` special routes bypassed shared providers, leaving route-specific shells vulnerable to the same class of context/provider failure as the original toast crash.
  - Evidence: [App.tsx](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/App.tsx) early-returned `#combat-demo` and `/animations` before `TouchModeProvider`, `AudioProvider`, and `VisualFeedbackProvider`.
  - Owner: Codex
  - Linked Fix: P-001
- [x] F-002 [status:verified] [P1] [confidence:0.99] Mobile player setup could not reliably select factions because the Radix select popup exceeded the available viewport height, leaving options outside the tappable viewport.
  - Evidence: `npx playwright test test/e2e/main-menu-setup.spec.ts --project=mobile-chrome` failed for both mobile setup/start tests with `element is outside of the viewport`; screenshot: [/Users/davedixon/Documents/GitHub/NewGenPromisedLand/test-results/main-menu-setup-Main-Menu--6015b-nd-enables-start-once-valid-mobile-chrome/test-failed-1.png](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/test-results/main-menu-setup-Main-Menu--6015b-nd-enables-start-once-valid-mobile-chrome/test-failed-1.png)
  - Owner: Codex
  - Linked Fix: P-002
- [x] F-003 [status:verified] [P3] [confidence:0.88] `ToastProvider` and `PlayerHUD` had unstable hook dependencies that produced lint warnings and made shell behavior more fragile than necessary.
  - Evidence: `npm run lint` warnings in [ToastProvider.tsx](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/ToastProvider.tsx) and [PlayerHUD.tsx](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/hud/PlayerHUD.tsx) before the fix pass.
  - Owner: Codex
  - Linked Fix: P-003

## Fix Log
- [x] P-001 [status:verified] Unified `App` route rendering so all routes share the same root providers and added regression coverage for special-route provider coverage.
  - Addresses: F-001
  - Evidence: [App.tsx](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/App.tsx), [AppProviders.test.tsx](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/test/AppProviders.test.tsx)
- [x] P-002 [status:verified] Constrained Radix select content to available viewport height and updated the player setup faction dropdown override to honor that cap on mobile.
  - Addresses: F-002
  - Evidence: [select.tsx](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/select.tsx), [PlayerSetup.tsx](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/PlayerSetup.tsx), passing mobile Playwright rerun
- [x] P-003 [status:verified] Stabilized toast callbacks with `useCallback` and narrowed `PlayerHUD` memo dependencies to remove shell lint warnings.
  - Addresses: F-003
  - Evidence: [ToastProvider.tsx](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/ToastProvider.tsx), [PlayerHUD.tsx](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/hud/PlayerHUD.tsx), clean `npm run lint`

## Validation Log
- [x] V-001 [status:verified] `npm run check`
  - Evidence: 2026-03-11 12:36 ET - passed after the final select/mobile fix.
- [x] V-002 [status:verified] `npm run lint`
  - Evidence: 2026-03-11 12:36 ET - passed with no warnings after the final hook-stability cleanup.
- [x] V-003 [status:verified] `npx vitest run test/AppProviders.test.tsx test/MainEntrypoint.test.tsx test/ToastProviderFallback.test.tsx test/CityPanelIntegration.test.tsx`
  - Evidence: 2026-03-11 12:30 ET - 4 files / 16 tests passed.
- [x] V-004 [status:verified] `npx playwright test test/e2e/main-menu-setup.spec.ts --project=chromium --project=mobile-chrome`
  - Evidence: 2026-03-11 12:33 ET - desktop (`chromium`) passed and mobile initially failed, surfacing the real dropdown overflow bug in F-002.
- [x] V-005 [status:verified] `npx playwright test test/e2e/main-menu-setup.spec.ts --project=mobile-chrome`
  - Evidence: 2026-03-11 12:36 ET - mobile rerun passed after the select-height fix (3 tests passed).
- [x] V-006 [status:verified] `npm run build`
  - Evidence: 2026-03-11 12:36 ET - passed after the final code edits.
- [x] V-007 [status:verified] Repo Playwright client smoke capture on the updated UI shell
  - Evidence: 2026-03-11 12:36 ET - passed; artifacts captured under [/Users/davedixon/Documents/GitHub/NewGenPromisedLand/output/web-game-player-setup](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/output/web-game-player-setup) and visually inspected via [/Users/davedixon/Documents/GitHub/NewGenPromisedLand/output/web-game-player-setup/shot-0.png](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/output/web-game-player-setup/shot-0.png)

## Residual Risks
- [x] R-001 [status:accepted_risk] Untracked `* 2.ts(x|)` backup files remain in the workspace and can confuse future audits, but they are not part of the active build/test path I validated.
  - Rationale: These look like user/worktree artifacts. Deleting them in a dirty tree would risk removing user-owned work.
  - Owner: repo owner
  - Follow-up trigger/date: Clean up or move these backups when you want source-tree hygiene and lower audit noise.

## Change Log
- 2026-03-11T12:24:21: Checklist initialized.
- 2026-03-11T12:31: Route-provider shell unification and hook-stability cleanup implemented; regression coverage added for special routes.
- 2026-03-11T12:34: Mobile Playwright audit found player-setup faction dropdown overflow on `mobile-chrome`.
- 2026-03-11T12:36: Shared select viewport-height fix applied; mobile Playwright rerun, lint, typecheck, and build all passed.
