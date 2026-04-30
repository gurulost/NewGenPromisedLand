# Exceptionally Safe Repo Size Cleanup and LFS Migration Checklist

Source of truth checklist for a large/intense task.

## Metadata
- Created: 2026-03-02T00:45:52
- Last Updated: 2026-04-30T13:45:26-04:00
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
- [x] Q-007 [status:verified] Run cleanroom dry-run LFS migration and capture post-dry-run metrics.
- [x] Q-008 [status:verified] Apply and validate persistent tracking updates (`.gitattributes`, CI LFS checkout).
- [x] Q-009 [status:verified] Run second cleanroom cutover migration and force-push rewritten refs + LFS objects.
- [x] Q-010 [status:verified] Verify remote health from fresh clone and publish collaborator recovery guidance.
- [ ] Q-011 [status:in_progress] Final code-quality pass and sign-off review.

## Findings Log
- [x] F-001 [status:verified] [P2] [confidence:0.95] Existing repository contains severe size bloat from binary media history and local generated artifacts.
  - Evidence: `du -sh .git node_modules dist`, `git count-objects -vH`, and top blob/path analysis captured pre-implementation.
  - Owner: codex
  - Linked Fix: P-001
- [x] F-002 [status:accepted_risk] [P2] [confidence:0.99] Docker CLI is unavailable in this execution environment, so the exact ephemeral Postgres commands in plan cannot be executed verbatim.
  - Evidence: `/tmp/newgen-phase1-docker_rm_pre.log` and `/tmp/newgen-phase1-docker_run.log` (`rc=127`).
  - Owner: codex
  - Linked Fix: P-002
- [x] F-003 [status:accepted_risk] [P2] [confidence:0.95] Lighthouse CI assertions fail on performance thresholds (score ~0.55, high FCP/LCP) in local/dry-run/cutover environments.
  - Evidence: `/tmp/newgen-phase1-lhci-official.log`, `/tmp/newgen-dryrun-lhci.log`, `/tmp/newgen-cutover-lhci.log`.
  - Owner: repository maintainers
  - Linked Fix: P-003
- [x] F-004 [status:verified] [P1] [confidence:0.99] Wildcard extension rules in `.gitattributes` are incompatible with the `>5MB` migration policy and caused non-pointer small media mismatch.
  - Evidence: cutover clone warnings and dirty state when wildcard rules were applied; resolved by switching to explicit LFS path entries (`43` lines).
  - Owner: codex
  - Linked Fix: P-004
- [x] F-005 [status:verified] [P1] [confidence:0.99] Post-rewrite working trees require explicit LFS hydration to avoid runtime loading pointer text as assets.
  - Evidence: Playwright failure with `Unexpected token 'v'` from `/models/city_level1.glb` pointer text before `git lfs pull`; rerun passed after hydration.
  - Owner: codex
  - Linked Fix: P-005
- [x] F-006 [status:verified] [P1] [confidence:0.98] CI asset hydration checks were duplicated inline and only searched for pointer text, leaving large unfiltered public assets and malformed hydrated GLBs outside the guardrail.
  - Evidence: April 30, 2026 CI review found five duplicated `grep -RIl "version https://git-lfs.github.com/spec/v1" client/public` steps across asset-dependent jobs; the local public asset set is 825.8 MiB with 67 GLBs and 36 public assets over 5 MiB.
  - Owner: test-infra
  - Linked Fix: P-006

## Fix Log
- [x] P-001 [status:verified] Execute phased cleanup + LFS migration plan without deleting tracked assets.
  - Addresses: F-001
  - Evidence: rollback artifacts created, local cleanup performed, dry-run and cutover rewrites completed, force-push + LFS push completed, fresh-clone verification passed.
- [x] P-002 [status:verified] Use local-validation fallback when Docker-specific commands cannot run.
  - Addresses: F-002
  - Evidence: Full non-Docker gates executed; E2E executed directly and passed.
- [x] P-003 [status:accepted_risk] Investigate and resolve Lighthouse performance assertion failures, or explicitly accept risk per stakeholder decision.
  - Addresses: F-003
  - Evidence: assertions fail consistently before/after migration; tracked as residual performance risk.
- [x] P-004 [status:verified] Replace wildcard LFS attribute rules with explicit migrated-path entries.
  - Addresses: F-004
  - Evidence: cutover commit amended; `.gitattributes` now has explicit LFS path lines from `git lfs ls-files`.
- [x] P-005 [status:verified] Hydrate LFS objects in cutover/verify clones before runtime validation.
  - Addresses: F-005
  - Evidence: `git lfs pull` + `git lfs checkout` executed; E2E rerun passed (40 passed, 2 skipped).
- [x] P-006 [status:verified] Add a reusable public asset verifier and make it part of the blocking CI pipeline.
  - Addresses: F-005, F-006
  - Evidence: `scripts/verify-public-assets.mjs` verifies no public LFS pointers, validates GLB v2 headers and declared lengths, and enforces Git LFS filtering for public assets over 5 MiB. `.github/workflows/ci.yml` adds a blocking `asset-integrity` job with `git lfs fsck` plus `npm run assets:verify`, replaces duplicated pointer-grep checks in asset-dependent jobs, and adds an explicit `performance-tests` job.

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
- [ ] V-014 [status:blocked] Dry-run clone full validation parity pass.
  - Evidence: 2026-03-02 01:04 EST core suite PASS (`/tmp/newgen-dryrun-*.log`), E2E had one failure (`/tmp/newgen-dryrun-playwright_e2e.log`), LHCI threshold FAIL (`/tmp/newgen-dryrun-lhci.log`)
- [x] V-015 [status:verified] Post-cutover fresh-clone smoke (`npm ci && npm run build && npm run check`).
  - Evidence: 2026-03-02 01:22 EST PASS in fresh clone `/Users/davedixon/Documents/GitHub/NewGenPromisedLand-postcutover-verify-20260302-012208` (`/tmp/newgen-postcutover-*.log`)
- [x] V-016 [status:verified] `git lfs status`
  - Evidence: 2026-04-30 clean LFS object status; no GLB/model/audio objects pending commit or unstaged.
- [x] V-017 [status:verified] `git lfs fsck`
  - Evidence: 2026-04-30 pass (`Git LFS fsck OK`).
- [x] V-018 [status:verified] `npm run assets:verify`
  - Evidence: 2026-04-30 pass; 153 files scanned, 825.8 MiB total, 67 GLBs validated, 36 large LFS-filtered assets verified.
- [x] V-019 [status:verified] `npm run test:performance`
  - Evidence: 2026-04-30 pass (1 file, 12 tests).
- [x] V-020 [status:verified] `npm run check`
  - Evidence: 2026-04-30 pass; no repository hygiene regressions.
- [x] V-021 [status:verified] `npm run lint`
  - Evidence: 2026-04-30 pass.
- [x] V-022 [status:verified] `npm run build`
  - Evidence: 2026-04-30 pass; production build completed without stale Browserslist or chunk-size warnings.

## Residual Risks
- [ ] R-001 [status:open] Force-push rewrite can disrupt collaborators with stale local histories.
  - Rationale: History rewrite is intentionally destructive to commit graph identity.
  - Owner: repository maintainers
  - Follow-up trigger/date: Publish recovery instructions immediately at cutover and keep rollback window open through one full CI cycle.
- [x] R-002 [status:accepted_risk] GitHub LFS service availability and repository LFS quota remain external dependencies.
  - Rationale: CI cannot prove hydration if checkout cannot fetch LFS objects; the policy is to fail the blocking `asset-integrity` gate and not ship until the LFS checkout and verifier pass.
  - Owner: repository maintainers
  - Follow-up trigger/date: Any failed `asset-integrity`, build, E2E, or Lighthouse checkout/asset verification run.

## Backup Notes
- Local worktree backup directory: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand-local-work-backups/local-worktree-backup-20260302-012941`
- Local worktree backup tarball: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand-local-work-backups/local-worktree-backup-20260302-012941.tar.gz`
- Local backup documentation: `docs/LOCAL_WORKTREE_BACKUP_2026-03-02.md`

## Change Log
- 2026-03-02T00:45:52: Checklist initialized.
- 2026-03-02T00:47:17: Expanded checklist for phased cleanup + LFS migration implementation.
- 2026-03-02T00:48:39: Completed rollback artifact creation and baseline metric capture; advanced to local cleanup.
- 2026-03-02T00:58:54: Completed local cleanup and primary validation pass; recorded Docker limitation and Lighthouse assertion failures.
- 2026-03-02T01:23:34: Completed dry-run migration, cutover force-push/LFS push, post-cutover fresh-clone verification, and final checklist reconciliation.
- 2026-03-02T01:30:55: Captured and documented local worktree backup artifacts before moving forward.
- 2026-04-30T13:45:26-04:00: Added blocking CI asset-integrity gate, reusable public asset verifier, explicit performance test job, and current local validation evidence for LFS/object hydration and build health.
