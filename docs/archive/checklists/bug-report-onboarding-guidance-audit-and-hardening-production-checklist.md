# Bug Report Onboarding Guidance Audit And Hardening Checklist

Source of truth checklist for the onboarding/reporting audit requested on 2026-03-06.

## Metadata
- Created: 2026-03-06T01:52:08-05:00
- Last Updated: 2026-03-06T01:56:40-05:00
- Workspace: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand`
- Checklist Doc: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/docs/bug-report-onboarding-guidance-audit-and-hardening-production-checklist.md`

## Scope
- [x] Q-000 [status:verified] Audit the just-landed bug-report onboarding flow for regressions, hidden/blocked hints, device-specific layout issues, and first-session guidance conflicts; fix concrete issues; rerun proof on the final state.

## Sign-off Gate
- [x] G-001 [status:verified] All queued work, findings, fixes, and validations are complete.
- [x] G-002 [status:verified] All findings are resolved or marked `accepted_risk` with rationale and owner.
- [x] G-003 [status:verified] Required validation suite has been rerun on the final code state.
- [x] G-004 [status:verified] Residual risks and follow-ups are documented.

## Rerun Matrix
- [x] G-010 [status:verified] Code changed after the initial onboarding implementation, so affected validation items were rerun after the fixes.
- [x] G-011 [status:verified] Final sign-off is based on the post-fix validation pass, not the earlier onboarding run.

## Audit Queue
- [x] Q-001 [status:verified] Create checklist and baseline scope.
- [x] Q-002 [status:verified] Complete discovery/audit of impacted systems.
- [x] Q-003 [status:verified] Implement required changes in the gameplay hint presentation path.
- [x] Q-004 [status:verified] Expand automated tests for the discovered edge cases.
- [x] Q-005 [status:verified] Run the validation suite on the final code state.
- [x] Q-006 [status:verified] Final code-quality pass and sign-off review.

## Findings Log
- [x] F-001 [status:verified] [P1] [confidence:0.88] The in-game bug-report hint could be marked as "seen" before the player ever saw it because first-turn tutorial overlays can cover it.
  - Evidence: [GameUI.tsx](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/game/GameUI.tsx) opens the overview tutorial on match start for non-tutorial games, while [BugReportStartHint.tsx](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/BugReportStartHint.tsx) previously marked the match hint as seen immediately on eligible render. If an overlay/library was active, the hint could be effectively consumed without being visible.
  - Owner: Codex
  - Linked Fix: P-001
- [x] F-002 [status:verified] [P2] [confidence:0.93] The mobile hint offset double-counted the safe-area inset and could drift too far below the HUD on notched devices.
  - Evidence: [BugReportStartHint.tsx](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/BugReportStartHint.tsx) used `env(safe-area-inset-top) + var(--mobile-hud-height, 0px)`, while [MobileHUD.tsx](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/hud/MobileHUD.tsx) already measures a height that includes the safe-area padding.
  - Owner: Codex
  - Linked Fix: P-002

## Fix Log
- [x] P-001 [status:verified] Gate the in-game bug-report hint behind a `blocked` prop and suppress it while tutorial overlays/library are active or while the game is in `tutorialEpisode` mode.
  - Addresses: F-001
  - Evidence: [GameUI.tsx](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/game/GameUI.tsx) now computes `shouldBlockBugReportHint`; [BugReportStartHint.tsx](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/BugReportStartHint.tsx) now waits until the hint is actually displayable before marking the match as seen.
- [x] P-002 [status:verified] Align the mobile hint offset with the shared HUD overlay offset and add regression tests for blocked presentation and mobile positioning.
  - Addresses: F-002
  - Evidence: [BugReportStartHint.tsx](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/BugReportStartHint.tsx) now uses `calc(var(--mobile-hud-height, 0px) + 0.75rem)`; [BugReportGuidance.test.tsx](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/test/BugReportGuidance.test.tsx) now covers both edge cases.

## Validation Log
- [x] V-001 [status:verified] `npm run check`
  - Evidence: 2026-03-06 01:53 EST - passed.
- [x] V-002 [status:verified] `npm run lint`
  - Evidence: 2026-03-06 01:53 EST - passed with the same two pre-existing warnings in [PlayerHUD.tsx](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/hud/PlayerHUD.tsx).
- [x] V-003 [status:verified] `npx vitest run test/BugReportGuidance.test.tsx test/GameUINavigationIntegration.test.tsx test/BugReportDialog.test.tsx client/src/utils/__tests__/bugReport.test.ts --reporter=dot`
  - Evidence: 2026-03-06 01:53 EST - passed, 32 tests.
- [x] V-004 [status:verified] `npm run build`
  - Evidence: 2026-03-06 01:53 EST - passed. Existing non-blocking warnings remained for stale Browserslist data and large Vite chunks.

## Residual Risks
- [x] R-001 [status:accepted_risk] The once-per-match hint still intentionally marks itself as seen on first real presentation, not after explicit dismissal.
  - Rationale: This avoids reappearing repeatedly during the same match if the player ignores it or opens/closes nearby UI. The remaining tradeoff is acceptable because the durable HUD/menu reporter remains available at all times.
  - Owner: Codex
  - Follow-up trigger/date: Revisit only if playtest feedback suggests the hint is still too easy to miss after the current blocking fixes.
- [x] R-002 [status:accepted_risk] Pre-existing unrelated lint warnings remain in [PlayerHUD.tsx](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/hud/PlayerHUD.tsx).
  - Rationale: They are outside the onboarding/reporting scope and were already present before this audit.
  - Owner: repository maintainer
  - Follow-up trigger/date: Fix when touching `PlayerHUD` next.

## Change Log
- 2026-03-06T01:52:08-05:00: Checklist initialized.
- 2026-03-06T01:56:40-05:00: Logged two findings, applied gameplay hint gating/offset fixes, reran validation, and recorded residual risks.
