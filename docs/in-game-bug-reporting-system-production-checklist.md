# in-game bug reporting system Checklist

Source of truth checklist for a large/intense task.

## Metadata
- Created: 2026-03-05T13:29:13
- Last Updated: 2026-03-05T13:46:30
- Workspace: /Users/davedixon/Documents/GitHub/NewGenPromisedLand
- Checklist Doc: /Users/davedixon/Documents/GitHub/NewGenPromisedLand/docs/in-game-bug-reporting-system-production-checklist.md

## Scope
- [x] Q-000 [status:verified] Capture explicit scope, constraints, and success criteria.
  - Evidence: Implement desktop utility-dock launcher + mobile menu entry, modal host outside `ErrorBoundary`, idempotent submission via `submissionId`, diagnostics capture from existing game/debug stores, R2-backed screenshot uploads, offline queue + retry, server persistence, webhook alerting, and targeted tests.

## Sign-off Gate
- [x] G-001 [status:verified] All queued work, findings, fixes, and validations are complete.
  - Evidence: Feature implementation, tests, docs, and final checklist review completed on 2026-03-05.
- [x] G-002 [status:verified] All findings are resolved or marked `accepted_risk` with rationale and owner.
  - Evidence: F-001/F-002 resolved by P-001/P-002; residual non-blocking concerns are documented under `Residual Risks`.
- [x] G-003 [status:verified] Required validation suite has been rerun on the final code state.
  - Evidence: `npm run check`, `npm run lint`, and both Vitest suites rerun after the final code edits at 2026-03-05 13:45 America/New_York.
- [x] G-004 [status:verified] Residual risks and follow-ups are documented.
  - Evidence: R-001 through R-003.

## Rerun Matrix
- [x] G-010 [status:verified] If code changes after any checked `V-*`, reset affected validation items to unchecked.
  - Evidence: Validation was deferred until after the last application code edits.
- [x] G-011 [status:verified] Final sign-off only after a full validation pass completed after the last code edit.
  - Evidence: Final validation pass completed at 2026-03-05 13:45 America/New_York before sign-off.

## Audit Queue
- [x] Q-001 [status:verified] Create checklist and baseline scope.
- [x] Q-002 [status:verified] Complete discovery/audit of impacted systems.
  - Evidence: Audited `client/src/components/game/GameUI.tsx`, `client/src/components/hud/MobileHUD.tsx`, `client/src/components/ErrorBoundary.tsx`, `client/src/utils/errorReporting.ts`, `client/src/utils/gameDebug.ts`, `client/src/utils/telemetry/*`, `server/routes.ts`, `server/r2.ts`, `server/storage.ts`, `shared/schema.ts`, and existing test harness.
- [x] Q-003 [status:verified] Implement required changes.
  - Evidence: Added shared bug-report contracts, DB schema/storage support, server routes + R2 screenshot uploads, client diagnostics/queueing flow, modal host/UI, error-triggered prompts, docs, and env wiring.
- [x] Q-004 [status:verified] Expand or update automated tests.
  - Evidence: Added targeted tests in `test/BugReportDialog.test.tsx`, `test/server/bugReports.test.ts`, and `client/src/utils/__tests__/bugReport.test.ts`; reused navigation/hotkey integration coverage.
- [x] Q-005 [status:verified] Run full validation suite.
  - Evidence: V-001 through V-004 completed on 2026-03-05 13:45 America/New_York.
- [x] Q-006 [status:verified] Final code-quality pass and sign-off review.
  - Evidence: Final review completed with residual risks documented and no unresolved task-blocking findings.

## Findings Log
- [x] F-001 [status:verified] [P2] [confidence:0.96] Bug-report integration risked deepening the existing telemetry split between legacy `client/src/utils/sentry.ts` and the active `client/src/utils/telemetry/*` runtime.
  - Evidence: `client/src/components/ErrorBoundary.tsx` imported `../utils/sentry` while `client/src/main.tsx` initializes telemetry through `client/src/utils/telemetry/index.ts`.
  - Owner: Codex
  - Linked Fix: P-001
- [x] F-002 [status:verified] [P1] [confidence:0.93] The original plan stored screenshots inline and queued failed submissions without idempotency, which would create DB bloat and duplicate reports on reconnect.
  - Evidence: audit of current R2 upload path in `server/r2.ts` and lack of any existing submission-id dedupe route in `server/routes.ts`.
  - Owner: Codex
  - Linked Fix: P-002

## Fix Log
- [x] P-001 [status:verified] Standardize new bug-report analytics and error-triggered flows on `client/src/utils/telemetry/*`, including error-boundary launch integration.
  - Addresses: F-001
  - Evidence: `client/src/components/ErrorBoundary.tsx` now uses `client/src/utils/telemetry/sentry`; bug-report analytics emit through `client/src/utils/telemetry/posthog`; `client/src/utils/errorReporting.ts` and `client/src/components/ui/BugReportHost.tsx` open the shared dialog flow.
- [x] P-002 [status:verified] Implement idempotent bug-report submission with `submissionId`, offline retry, and R2-backed screenshot uploads instead of inline image storage.
  - Addresses: F-002
  - Evidence: `shared/types/bugReport.ts` defines `submissionId`; `server/routes.ts` dedupes by `submissionId`; `client/src/utils/bugReport.ts` queues retries; `server/r2.ts` generates screenshot upload URLs and `server/bugReports.ts` formats persisted reports/webhook summaries.

## Validation Log
- [x] V-001 [status:verified] `npm run check`
  - Evidence: 2026-03-05 13:45 America/New_York - passed (`tsc` exited 0).
- [x] V-002 [status:verified] `npm run lint`
  - Evidence: 2026-03-05 13:45 America/New_York - passed with 2 pre-existing warnings in `client/src/components/hud/PlayerHUD.tsx` for missing `extractAuraEffect` hook deps; no errors.
- [x] V-003 [status:verified] `npx vitest run test/BugReportDialog.test.tsx test/server/bugReports.test.ts client/src/utils/__tests__/bugReport.test.ts`
  - Evidence: 2026-03-05 13:45 America/New_York - passed (3 files, 8 tests).
- [x] V-004 [status:verified] `npx vitest run test/GameUINavigationIntegration.test.tsx test/HotkeyInputBlocking.test.tsx`
  - Evidence: 2026-03-05 13:45 America/New_York - passed (2 files, 19 tests).

## Residual Risks
- [x] R-001 [status:accepted_risk] Screenshot uploads will be skipped when R2 is not configured; text + diagnostics submission must still remain fully usable.
  - Rationale: Bug intake should not be blocked on optional object-storage setup.
  - Owner: Codex
  - Follow-up trigger/date: Confirm production R2 configuration before expecting screenshot evidence from players.
- [x] R-002 [status:accepted_risk] No internal bug-report viewer/API was added in this scope; triage is through the database plus optional webhook notifications.
  - Rationale: The implementation goal was player intake and automation first. A review surface is valuable but separable.
  - Owner: Codex
  - Follow-up trigger/date: Add an internal triage UI or admin query route when report volume justifies it.
- [x] R-003 [status:accepted_risk] `npm run lint` still reports two pre-existing warnings in `client/src/components/hud/PlayerHUD.tsx` unrelated to this feature.
  - Rationale: Those warnings were already present, outside the touched surface area, and do not block bug-reporting behavior.
  - Owner: Codex
  - Follow-up trigger/date: Clean up `extractAuraEffect` dependencies the next time `PlayerHUD.tsx` is modified.

## Change Log
- 2026-03-05T13:29:13: Checklist initialized.
- 2026-03-05T13:35:00: Refined scope around idempotent submission, R2-backed screenshots, modern telemetry integration, and targeted validation commands.
- 2026-03-05T13:46:30: Recorded implementation completion, final validation evidence, residual risks, and sign-off state.
