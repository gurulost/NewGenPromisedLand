# Local unpushed changes audit and safe push plan to origin main Checklist

Source of truth checklist for a large/intense task.

## Metadata
- Created: 2026-03-02T01:34:11
- Last Updated: 2026-03-02T01:37:00
- Workspace: /Users/davedixon/Documents/GitHub/NewGenPromisedLand
- Checklist Doc: /Users/davedixon/Documents/GitHub/NewGenPromisedLand/docs/local-unpushed-changes-audit-and-safe-push-plan-to-origin-main-production-checklist.md

## Scope
- [x] Q-000 [status:verified] Capture explicit scope, constraints, and success criteria.
  - Scope: Audit all local work not yet in `origin/main` and produce a zero-regression push plan.
  - Constraints: Do not discard or rewrite user-created local work; avoid direct pushes from diverged branches; keep backup/rollback coverage explicit.
  - Success: Enumerated local-only changes, preserved backups (including stashes), and documented a safe promotion path to `origin/main`.

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
- [x] Q-002 [status:verified] Audit local refs, branch divergence, stashes, and untracked files.
- [x] Q-003 [status:verified] Preserve local-only stash payloads with explicit backup artifacts.
- [x] Q-004 [status:verified] Classify push-safe vs high-risk local changes.
- [x] Q-005 [status:verified] Produce safe push-to-`origin/main` execution plan.
- [x] Q-006 [status:verified] Final code-quality pass and sign-off review.

## Findings Log
- [x] F-001 [status:verified] [P1] [confidence:0.99] Current working tree has no tracked code deltas on active branch; pending local work is represented by untracked docs and stash entries.
  - Evidence: `git status --short --branch` showed only untracked `docs/*.md` files.
  - Owner: codex
  - Linked Fix: P-001
- [x] F-002 [status:verified] [P1] [confidence:0.99] Local branches `main` and `codex/local-wip-presync-2026-02-06` are heavily diverged from remotes and unsafe for direct push.
  - Evidence: `git rev-list --left-right --count main...origin/main` -> `743 744`; `git rev-list --left-right --count codex/local-wip-presync-2026-02-06...origin/codex/local-wip-presync-2026-02-06` -> `732 732`.
  - Owner: codex
  - Linked Fix: P-003
- [x] F-003 [status:verified] [P1] [confidence:0.98] Two stashes contain unpushed implementation work across gameplay logic and broad UI/server/package surfaces.
  - Evidence: `git stash show --stat stash@{0}` (7 files, logic/gameplay) and `git stash show --stat stash@{1}` (46 files including `server/routes.ts`, `package*.json`).
  - Owner: codex
  - Linked Fix: P-002
- [x] F-004 [status:verified] [P2] [confidence:0.97] Existing local backup doc did not yet include stash payload backup artifacts.
  - Evidence: initial `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/docs/LOCAL_WORKTREE_BACKUP_2026-03-02.md` listed only untracked docs snapshot.
  - Owner: codex
  - Linked Fix: P-002
- [x] F-005 [status:accepted_risk] [P2] [confidence:0.90] Patch-equivalence checks show many non-equivalent commits on diverged local branches (mostly visual/media era), so force-pushing or merging these branches could reintroduce storage/history risk.
  - Evidence: `git cherry origin/main main` includes many `+` commits; `git cherry` output maps to visual/media commit messages from 2025-07 through 2026-01.
  - Owner: repository maintainers
  - Linked Fix: P-004

## Fix Log
- [x] P-001 [status:verified] Run a full local-state audit and inventory all non-pushed work classes (branches/stashes/untracked docs).
  - Addresses: F-001
  - Evidence: executed and captured outputs for `git fetch`, `git status`, `git branch -vv`, `git stash list`, `git for-each-ref`, and range logs.
- [x] P-002 [status:verified] Create stash patch backups and document them in backup guidance.
  - Addresses: F-003, F-004
  - Evidence: created `/Users/davedixon/Documents/GitHub/NewGenPromisedLand-local-work-backups/local-worktree-backup-20260302-012941/stashes/*` and updated `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/docs/LOCAL_WORKTREE_BACKUP_2026-03-02.md`.
- [x] P-003 [status:verified] Define a safe promotion plan that avoids direct push from diverged branches and uses isolated integration branches from `origin/main`.
  - Addresses: F-002
  - Evidence: final plan includes branch isolation, stash branch extraction, selective cherry-pick/apply, full validation gates, and PR-first merge to `origin/main`.
- [x] P-004 [status:accepted_risk] Defer direct integration of stash payloads until each stash is replayed on dedicated branches and revalidated.
  - Addresses: F-005
  - Evidence: explicitly retained stashes + patch backups; no direct apply to mainline during this audit turn.

## Validation Log
- [x] V-001 [status:verified] `git fetch --all --prune`
  - Evidence: 2026-03-02 01:34 EST pass.
- [x] V-002 [status:verified] `git status --short --branch && git branch -vv && git stash list`
  - Evidence: 2026-03-02 01:35 EST pass; identified active sync branch, diverged branches, and two stashes.
- [x] V-003 [status:verified] `git rev-list --left-right --count ...` and `git log ... origin/main..main`
  - Evidence: 2026-03-02 01:35 EST pass; quantified divergence and sampled local-only ranges.
- [x] V-004 [status:verified] `git cherry ...` / `git log --left-right --cherry-pick ...`
  - Evidence: 2026-03-02 01:36 EST pass; confirmed many non-equivalent commits on diverged legacy branches.
- [x] V-005 [status:verified] Stash backup creation and backup artifact verification commands
  - Evidence: 2026-03-02 01:36 EST pass; stash patches/stats created and listed under backup directory.
- [x] V-006 [status:accepted_risk] Runtime test suite rerun after this audit-only change set
  - Evidence: 2026-03-02 01:37 EST skipped intentionally (docs + backup artifact changes only; no runtime source edits).

## Residual Risks
- [x] R-001 [status:accepted_risk] Stash payloads are preserved but not yet promoted; applying them may surface conflicts against current `origin/main`.
  - Rationale: Stashes are from 2026-02-06 pre-sync state and touch high-churn UI/gameplay/server files.
  - Owner: repository maintainers
  - Follow-up trigger/date: Resolve by replaying each stash in dedicated integration branches before final promotion.
- [x] R-002 [status:accepted_risk] Local diverged branches remain as forensic references and should not be pushed directly.
  - Rationale: Their commit graph predates/straddles history rewrite and is not safe to promote wholesale.
  - Owner: repository maintainers
  - Follow-up trigger/date: Revisit only for targeted cherry-pick extraction if a specific missing improvement is identified.

## Change Log
- 2026-03-02T01:34:11: Checklist initialized.
- 2026-03-02T01:37:00: Completed local unpushed-work audit, added stash backups/documentation, and finalized safe push plan sign-off.
