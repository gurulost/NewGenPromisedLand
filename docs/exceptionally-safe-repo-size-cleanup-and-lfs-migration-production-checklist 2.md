# Exceptionally Safe Repo Size Cleanup and LFS Migration Checklist

Source of truth checklist for a large/intense task.

## Metadata
- Created: 2026-03-02T00:45:52
- Last Updated: 2026-03-02T00:58:54
- Workspace: /Users/davedixon/Documents/GitHub/NewGenPromisedLand
- Checklist Doc: /Users/davedixon/Documents/GitHub/NewGenPromisedLand/docs/exceptionally-safe-repo-size-cleanup-and-lfs-migration-production-checklist.md

## Scope
- [x] Q-000 [status:verified] Capture explicit scope, constraints, and success criteria.

## Sign-off Gate
- [ ] G-001 [status:open] All queued work, findings, fixes, and validations are complete.
- [ ] G-002 [status:open] All findings are resolved or marked `accepted_risk` with rationale and owner.
- [ ] G-003 [status:open] Required validation suite has been rerun on the final code state.
- [ ] G-004 [status:open] Residual risks and follow-ups are documented.

## Rerun Matrix
- [ ] G-010 [status:open] If code changes after any checked `V-*`, reset affected validation items to unchecked.
- [ ] G-011 [status:open] Final sign-off only after a full validation pass completed after the last code edit.

## Audit Queue
- [x] Q-001 [status:verified] Create checklist and baseline scope.
- [x] Q-002 [status:verified] Complete discovery/audit of impacted systems.
- [x] Q-003 [status:verified] Create rollback mirror + bundle backup artifacts.
- [x] Q-004 [status:verified] Capture baseline size/blob metrics in active workspace.
- [x] Q-005 [status:verified] Run local cleanup pass (`dist`, `node_modules`, `test-results`) and reinstall deps.
- [ ] Q-006 [status:in_progress] Run local full validation suite (typecheck, lint, vitest suites, build, e2e, lighthouse).
- [ ] Q-007 [status:open] Run cleanroom dry-run LFS migration and capture post-dry-run metrics.
- [ ] Q-008 [status:in_progress] Apply and validate persistent tracking updates (`.gitattributes`, CI LFS checkout).
- [ ] Q-009 [status:open] Run second cleanroom cutover migration and force-push rewritten refs + LFS objects.
- [ ] Q-010 [status:open] Verify remote health from fresh clone and publish collaborator recovery guidance.
- [ ] Q-011 [status:open] Final code-quality pass and sign-off review.

## Findings Log
- [x] F-001 [status:verified] [P2] [confidence:0.95] Existing repository contains severe size bloat from binary media history and local generated artifacts.
  - Evidence: `du -sh .git node_modules dist`, `git count-objects -vH`, and top blob/path analysis captured pre-implementation.
  - Owner: codex
  - Linked Fix: P-001
- [x] F-002 [status:accepted_risk] [P2] [confidence:0.99] Docker CLI is unavailable in this execution environment, so the exact ephemeral Postgres commands in plan cannot be executed verbatim.
  - Evidence: `/tmp/newgen-phase1-docker_rm_pre.log` and `/tmp/newgen-phase1-docker_run.log` (`rc=127`).
  - Owner: codex
  - Linked Fix: P-002
- [ ] F-003 [status:open] [P2] [confidence:0.95] Lighthouse CI assertions fail on performance thresholds (score 0.55, high FCP/LCP), blocking full validation sign-off.
  - Evidence: `/tmp/newgen-phase1-lhci-official.log`.
  - Owner: codex
  - Linked Fix: P-003

## Fix Log
- [ ] P-001 [status:in_progress] Execute phased cleanup + LFS migration plan without deleting tracked assets.
  - Addresses: F-001
  - Evidence: command transcripts, metric deltas, updated `.gitattributes`, updated CI checkout config, validation outcomes.
- [x] P-002 [status:verified] Use local-validation fallback when Docker-specific commands cannot run.
  - Addresses: F-002
  - Evidence: Full non-Docker gates executed; E2E executed directly and passed.
- [ ] P-003 [status:open] Investigate and resolve Lighthouse performance assertion failures, or explicitly accept risk per stakeholder decision.
  - Addresses: F-003
  - Evidence: pending

## Validation Log
- [x] V-001 [status:verified] `npm run check`
  - Evidence: 2026-03-02 00:58 EST PASS (`/tmp/newgen-check.log`)
- [x] V-002 [status:verified] `npm run lint`
  - Evidence: 2026-03-02 00:58 EST PASS (`/tmp/newgen-lint.log`)
- [x] V-003 [status:verified] `npx vitest run test/unit --coverage --coverage.reporter=text --coverage.reporter=json-summary --reporter=verbose`
  - Evidence: 2026-03-02 00:58 EST PASS (`/tmp/newgen-vitest_unit.log`)
- [x] V-004 [status:verified] `npx vitest run test/a11y --reporter=verbose`
  - Evidence: 2026-03-02 00:58 EST PASS (`/tmp/newgen-vitest_a11y.log`)
- [x] V-005 [status:verified] `npx vitest run test/performance --reporter=verbose`
  - Evidence: 2026-03-02 00:58 EST PASS (`/tmp/newgen-vitest_performance.log`)
- [x] V-006 [status:verified] `npx vitest run test/visual --reporter=verbose`
  - Evidence: 2026-03-02 00:58 EST PASS (`/tmp/newgen-vitest_visual.log`)
- [x] V-007 [status:verified] `npx vitest run test/responsive --reporter=verbose`
  - Evidence: 2026-03-02 00:58 EST PASS (`/tmp/newgen-vitest_responsive.log`)
- [x] V-008 [status:verified] `npm run build`
  - Evidence: 2026-03-02 00:58 EST PASS (`/tmp/newgen-build.log`)
- [ ] V-009 [status:blocked] `DATABASE_URL=... SESSION_SECRET=... npm run db:push`
  - Evidence: 2026-03-02 00:58 EST ERROR output (`database "newgen" does not exist`) despite zero exit code (`/tmp/newgen-phase1-db_push.log`)
- [x] V-010 [status:verified] `npx playwright install --with-deps`
  - Evidence: 2026-03-02 00:58 EST PASS (`/tmp/newgen-phase1-playwright_install.log`)
- [x] V-011 [status:verified] `DATABASE_URL=... SESSION_SECRET=... npx playwright test test/e2e --reporter=html`
  - Evidence: 2026-03-02 00:58 EST PASS rerun (`/tmp/newgen-phase1-playwright_e2e-rerun.log`; 40 passed, 2 skipped)
- [x] V-012 [status:verified] `DATABASE_URL=... SESSION_SECRET=... npm start` + `npx wait-on http://localhost:5000 --timeout 120000`
  - Evidence: 2026-03-02 00:58 EST PASS with equivalent port override (`PORT=5050`) due external listener on 5000 (`/tmp/newgen-phase1-waiton.log`)
- [ ] V-013 [status:open] `npx lhci autorun --config=lighthouserc.json`
  - Evidence: 2026-03-02 00:58 EST FAIL on performance thresholds in official CLI run (`/tmp/newgen-phase1-lhci-official.log`)
- [ ] V-014 [status:open] Dry-run clone full validation parity pass.
  - Evidence: <YYYY-MM-DD HH:MM + pass/fail outcome>
- [ ] V-015 [status:open] Post-cutover fresh-clone smoke (`npm ci && npm run build && npm run check`).
  - Evidence: <YYYY-MM-DD HH:MM + pass/fail outcome>

## Residual Risks
- [ ] R-001 [status:open] Force-push rewrite can disrupt collaborators with stale local histories.
  - Rationale: History rewrite is intentionally destructive to commit graph identity.
  - Owner: repository maintainers
  - Follow-up trigger/date: Publish recovery instructions immediately at cutover and keep rollback window open through one full CI cycle.

## Change Log
- 2026-03-02T00:45:52: Checklist initialized.
- 2026-03-02T00:47:17: Expanded checklist for phased cleanup + LFS migration implementation.
- 2026-03-02T00:48:39: Completed rollback artifact creation and baseline metric capture; advanced to local cleanup.
- 2026-03-02T00:58:54: Completed local cleanup and primary validation pass; recorded Docker limitation and Lighthouse assertion failures.
