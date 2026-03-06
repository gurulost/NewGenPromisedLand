# Bug Reporting System Audit And Hardening Checklist

Source of truth checklist for the 2026-03-06 audit/hardening pass.

## Metadata
- Created: 2026-03-06T01:29:23-05:00
- Last Updated: 2026-03-06T01:37:00-05:00
- Workspace: /Users/davedixon/Documents/GitHub/NewGenPromisedLand
- Checklist Doc: /Users/davedixon/Documents/GitHub/NewGenPromisedLand/docs/bug-reporting-system-audit-and-hardening-production-checklist.md

## Scope
- [x] Q-000 [status:verified] Audit the full bug-reporting system end to end and fix concrete issues in client queueing, server report viewing, webhook triage output, and supporting tests/docs.

## Sign-off Gate
- [x] G-001 [status:verified] All queued work, findings, fixes, and validations are complete.
- [x] G-002 [status:verified] All findings are resolved or marked `accepted_risk` with rationale and owner.
- [x] G-003 [status:verified] Required validation suite has been rerun on the final code state.
- [x] G-004 [status:verified] Residual risks and follow-ups are documented.

## Rerun Matrix
- [x] G-010 [status:verified] Code changed after initial bug-report validations; affected validations were rerun on the final state.
- [x] G-011 [status:verified] Final sign-off only after a full validation pass completed after the last code edit.

## Audit Queue
- [x] Q-001 [status:verified] Create checklist and baseline scope.
- [x] Q-002 [status:verified] Complete discovery/audit of impacted systems.
- [x] Q-003 [status:verified] Implement required changes.
- [x] Q-004 [status:verified] Expand or update automated tests.
- [x] Q-005 [status:verified] Run full validation suite.
- [x] Q-006 [status:verified] Final code-quality pass and sign-off review.

## Findings Log
- [x] F-001 [status:verified] [P1] [confidence:0.96] Queue compaction preserved the oldest retained recent actions/errors and `readQueue()` trusted arbitrary localStorage payloads, reducing repro quality and making stale invalid queue entries survive into replay attempts.
  - Evidence: [/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/utils/bugReport.ts](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/utils/bugReport.ts) used `slice(0, 8)` / `slice(0, 4)` during compaction and parsed queue entries without schema validation.
  - Owner: Codex
  - Linked Fix: P-001

- [x] F-002 [status:verified] [P1] [confidence:0.90] The full-report endpoint returned the raw DB row, including internal `userId` and `deviceId`, and lacked dedicated read throttling and no-store response headers.
  - Evidence: [/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/routes.ts](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/routes.ts) returned `report` directly from storage before this pass.
  - Owner: Codex
  - Linked Fix: P-002

- [x] F-003 [status:verified] [P2] [confidence:0.94] The AI triage pack and webhook summaries were not optimized for copy/paste debugging: they omitted build/browser context and relied on whole-block truncation that could cut away the most useful later sections.
  - Evidence: [/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/bugReports.ts](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/bugReports.ts) previously truncated the entire pack in one call instead of compacting important sections deliberately.
  - Owner: Codex
  - Linked Fix: P-003

## Fix Log
- [x] P-001 [status:verified] Harden queue handling in [/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/utils/bugReport.ts](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/utils/bugReport.ts) and [/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/utils/__tests__/bugReport.test.ts](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/utils/__tests__/bugReport.test.ts).
  - Addresses: F-001
  - Evidence: queue compaction now keeps newest actions/errors, queued payloads are schema-validated on read, and tests cover both compaction and invalid stale queue entries.

- [x] P-002 [status:verified] Harden the report-view path in [/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/routes.ts](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/routes.ts), [/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/bugReports.ts](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/bugReports.ts), and [/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/storage.ts](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/storage.ts).
  - Addresses: F-002
  - Evidence: viewer responses are now sanitized, rate-limited, and sent with `Cache-Control: private, no-store`, `Pragma: no-cache`, and `X-Robots-Tag: noindex, nofollow`.

- [x] P-003 [status:verified] Improve webhook triage utility in [/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/bugReports.ts](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/bugReports.ts) and [/Users/davedixon/Documents/GitHub/NewGenPromisedLand/test/server/bugReports.test.ts](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/test/server/bugReports.test.ts).
  - Addresses: F-003
  - Evidence: AI triage packs now include build/browser context, use a compact bounded mode for Slack copy/paste, and keep detail/admin links plus diagnostics summary stable.

- [x] P-004 [status:verified] Improve device-id generation in [/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/lib/deviceId.ts](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/lib/deviceId.ts).
  - Addresses: none; opportunistic hardening inside the same bug-report attribution path.
  - Evidence: `crypto.randomUUID()` is now preferred for new device IDs when available.

## Validation Log
- [x] V-001 [status:verified] `npm run check`
  - Evidence: 2026-03-06 01:36 EST, pass.
- [x] V-002 [status:verified] `npm run lint`
  - Evidence: 2026-03-06 01:36 EST, pass with the same pre-existing warnings in [/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/hud/PlayerHUD.tsx](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/hud/PlayerHUD.tsx).
- [x] V-003 [status:verified] `npx vitest run test/BugReportDialog.test.tsx test/server/bugReports.test.ts client/src/utils/__tests__/bugReport.test.ts test/unit/GameplayAnalytics.unit.test.ts --reporter=dot`
  - Evidence: 2026-03-06 01:36 EST, pass (4 files, 22 tests).
- [x] V-004 [status:verified] `CI=1 npx playwright test test/e2e`
  - Evidence: 2026-03-06 01:37 EST, pass (9 tests).

## Residual Risks
- [x] R-001 [status:accepted_risk] Direct full-report links remain gated by a shared token rather than per-report signed URLs.
  - Rationale: acceptable for current operator workflow; links are optional, token-backed, rate-limited, and can be rotated if exposed.
  - Owner: project maintainer
  - Follow-up trigger/date: revisit if the report viewer becomes multi-user or externally shared.

- [x] R-002 [status:accepted_risk] Slack/Discord delivery and screenshot support still depend on deployment-side env/CORS configuration.
  - Rationale: these are infrastructure/runtime concerns, not code defects.
  - Owner: deployment agent
  - Follow-up trigger/date: during deployment and production smoke test.

- [x] R-003 [status:accepted_risk] [/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/hud/PlayerHUD.tsx](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/hud/PlayerHUD.tsx) still has two pre-existing hook-dependency lint warnings unrelated to bug reporting.
  - Rationale: outside this audit scope and unchanged by this work.
  - Owner: project maintainer
  - Follow-up trigger/date: next HUD cleanup pass.

## Change Log
- 2026-03-06T01:29:23-05:00: Checklist initialized.
- 2026-03-06T01:37:00-05:00: Discovery, fixes, tests, and sign-off recorded.
