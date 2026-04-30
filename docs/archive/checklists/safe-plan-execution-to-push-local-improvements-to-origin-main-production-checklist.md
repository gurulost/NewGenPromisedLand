# Safe plan execution to push local improvements to origin main Checklist

Source of truth checklist for a large/intense task.

## Metadata
- Created: 2026-03-02T01:40:28
- Last Updated: 2026-03-02T01:46:00
- Workspace: /Users/davedixon/Documents/GitHub/NewGenPromisedLand
- Checklist Doc: /Users/davedixon/Documents/GitHub/NewGenPromisedLand/docs/safe-plan-execution-to-push-local-improvements-to-origin-main-production-checklist.md

## Scope
- [x] Q-000 [status:verified] Capture explicit scope, constraints, and success criteria.
  - Scope: Execute staged safe promotion of local unpushed improvements to `origin/main`.
  - Constraints: Keep backups intact, avoid direct pushes from diverged branches, isolate stash payloads, validate before mainline promotion.
  - Success: Docs and safe code improvements are committed and pushed to `origin/main` with validation evidence.

## Sign-off Gate
- [x] G-001 [status:verified] All queued work, findings, fixes, and validations are complete.
- [x] G-002 [status:verified] All findings are resolved or marked `accepted_risk` with rationale and owner.
- [x] G-003 [status:verified] Required validation suite has been rerun on the final code state.
- [x] G-004 [status:verified] Residual risks and follow-ups are documented.

## Rerun Matrix
- [x] G-010 [status:verified] If code changes after any checked `V-*`, reset affected validation items to unchecked.
- [x] G-011 [status:verified] Final sign-off only after a full validation pass completed after the last code edit.

## Audit Queue
- [x] Q-001 [status:verified] Create execution checklist and re-confirm baseline repo state.
- [x] Q-002 [status:verified] Promote docs-only local artifacts on isolated branch and push branch to origin.
- [x] Q-003 [status:verified] Integrate stash-0 payload on isolated branch, resolve conflicts safely, validate, and push branch.
- [x] Q-004 [status:verified] Attempt stash-1 integration on isolated branch and classify promotable deltas.
- [x] Q-005 [status:verified] Promote validated commits to `origin/main` in ordered sequence.
- [x] Q-006 [status:verified] Final code-quality pass and sign-off review.

## Findings Log
- [x] F-001 [status:verified] [P1] [confidence:0.99] Local docs improvements were untracked and not yet represented in remote history.
  - Evidence: `git status --short --branch` showed five untracked docs artifacts.
  - Owner: codex
  - Linked Fix: P-001
- [x] F-002 [status:verified] [P1] [confidence:0.98] Stash-0 contained meaningful logic/test deltas and three conflict files.
  - Evidence: `git apply --3way` reported conflicts in `Unit.tsx`, `PlayerHUD.tsx`, and `pathfindingClient.ts`; staged delta after safe resolution remained in 4 files.
  - Owner: codex
  - Linked Fix: P-002
- [x] F-003 [status:accepted_risk] [P2] [confidence:0.92] Stash-1 conflicted in 10 high-churn files and became a no-op under strict safe conflict policy (`ours` on conflicts).
  - Evidence: conflict list from `git apply --3way` on stash-1; after conflict resolution, `git status` showed no tracked changes.
  - Owner: repository maintainers
  - Linked Fix: P-003
- [x] F-004 [status:verified] [P1] [confidence:0.99] Backups needed to include stash payload patches in addition to worktree docs.
  - Evidence: backup artifacts created under `/Users/davedixon/Documents/GitHub/NewGenPromisedLand-local-work-backups/local-worktree-backup-20260302-012941/stashes` and documented in `docs/LOCAL_WORKTREE_BACKUP_2026-03-02.md`.
  - Owner: codex
  - Linked Fix: P-004

## Fix Log
- [x] P-001 [status:verified] Commit and push docs-only improvements on `codex/safe-docs-promote-20260302`.
  - Addresses: F-001
  - Evidence: commit `fe43591` pushed to `origin/codex/safe-docs-promote-20260302`; later promoted to `origin/main` as `f15589a`.
- [x] P-002 [status:verified] Integrate safe stash-0 deltas and validate before promotion.
  - Addresses: F-002
  - Evidence: branch `codex/safe-integrate-stash0-20260302` commit `a1d68db`; validations pass; promoted to `origin/main` as `3507a32`.
- [x] P-003 [status:accepted_risk] Keep stash-1 preserved but do not promote risky/manual unresolved payload.
  - Addresses: F-003
  - Evidence: branch `codex/safe-integrate-stash1-20260302` produced no promotable tracked diff after safe conflict policy.
- [x] P-004 [status:verified] Extend backup documentation and archive with explicit stash patch recovery path.
  - Addresses: F-004
  - Evidence: updated `docs/LOCAL_WORKTREE_BACKUP_2026-03-02.md`; archive `local-worktree-backup-20260302-012941-with-stashes.tar.gz` created.

## Validation Log
- [x] V-001 [status:verified] `git fetch --all --prune && git status --short --branch && git branch -vv && git stash list`
  - Evidence: 2026-03-02 01:40 EST pass; baseline confirmed.
- [x] V-002 [status:verified] Stash backup artifact generation/verification commands
  - Evidence: 2026-03-02 01:36 EST pass; stash patch/stat files created and listed.
- [x] V-003 [status:verified] Stash-0 branch validation: `npm run check`, `npm run lint`, `npx vitest run test/UnitReachableTiles.test.tsx --reporter=verbose`, `npm run build`
  - Evidence: 2026-03-02 01:42-01:43 EST pass.
- [x] V-004 [status:verified] Final pre-main-push validation on promotion branch: `npm run check`, `npm run lint`, `npx vitest run test/UnitReachableTiles.test.tsx --reporter=verbose`, `npm run build`
  - Evidence: 2026-03-02 01:44-01:45 EST pass.
- [x] V-005 [status:verified] Mainline promotion push checks: `git fetch origin main && git rev-list --left-right --count codex/push-chat-voice-notes...origin/main` and `git push origin codex/push-chat-voice-notes:main`
  - Evidence: 2026-03-02 01:45 EST pass; ahead/behind `1 0` before final push, then push accepted.

## Residual Risks
- [x] R-001 [status:accepted_risk] Stash-1 may still contain latent improvements requiring manual selective replay in future work.
  - Rationale: Strict safety policy avoided manual conflict merges across high-churn UI/server files in this pass.
  - Owner: repository maintainers
  - Follow-up trigger/date: Revisit only with dedicated feature branch + full regression matrix if those changes are still desired.
- [x] R-002 [status:accepted_risk] Diverged local `main` / `codex/local-wip-presync-2026-02-06` remain unsuitable for direct push.
  - Rationale: Heavy divergence and non-equivalent commit history remain high-risk.
  - Owner: repository maintainers
  - Follow-up trigger/date: Keep for forensic reference; extract only via targeted cherry-pick when explicitly needed.

## Change Log
- 2026-03-02T01:40:28: Checklist initialized.
- 2026-03-02T01:46:00: Completed safe execution: docs and validated stash-0 promoted to `origin/main`; stash-1 preserved but not promoted due safety constraints.
