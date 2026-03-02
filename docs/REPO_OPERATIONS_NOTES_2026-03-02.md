# Repo Operations Notes (2026-03-02)

This note captures the current safe baseline and branch/backup guardrails after the March 2, 2026 cleanup and promotion pass.

## Safe Baseline

- `origin/main` baseline commit: `c7c97f0`
- Safety tag: `post-safe-cleanup-2026-03-02`
- CI run for baseline: [CI/CD Pipeline #22564652658](https://github.com/gurulost/NewGenPromisedLand/actions/runs/22564652658)
- Manual smoke status at baseline: passed (`/__health` returned `{"ok":true}`, root returned HTTP 200)

## Branch Policy

- Start all new work from `origin/main`.
- Do not push directly from archive/diverged branches.
- Avoid using these branches as merge bases:
  - `codex/archive-main-diverged-20260302`
  - `codex/local-wip-presync-2026-02-06`
- If you need old work from diverged history, extract it with targeted cherry-picks or patch application in a fresh branch based on `origin/main`.

## Backup And Stash Locations

- Local backup directory:
  - `/Users/davedixon/Documents/GitHub/NewGenPromisedLand-local-work-backups/local-worktree-backup-20260302-012941`
- Backup tarballs:
  - `/Users/davedixon/Documents/GitHub/NewGenPromisedLand-local-work-backups/local-worktree-backup-20260302-012941.tar.gz`
  - `/Users/davedixon/Documents/GitHub/NewGenPromisedLand-local-work-backups/local-worktree-backup-20260302-012941-with-stashes.tar.gz`
- Stash patch backups:
  - `/Users/davedixon/Documents/GitHub/NewGenPromisedLand-local-work-backups/local-worktree-backup-20260302-012941/stashes/stash0-pre-sync-main-20260206-0342.patch`
  - `/Users/davedixon/Documents/GitHub/NewGenPromisedLand-local-work-backups/local-worktree-backup-20260302-012941/stashes/stash1-wip-uiux-production-sync.patch`
- Live stashes retained in local git:
  - `stash@{0}` `On main: pre-sync-main-20260206-0342`
  - `stash@{1}` `On (no branch): wip/uiux-production-sync`

## Quick Recovery Commands

```bash
# Check out the safe tagged baseline in an isolated branch
git fetch --all --prune
git switch -c codex/recover-safe-baseline post-safe-cleanup-2026-03-02

# Re-apply a backed-up stash patch in a throwaway branch
git switch -c codex/replay-stash0-from-backup origin/main
git apply /Users/davedixon/Documents/GitHub/NewGenPromisedLand-local-work-backups/local-worktree-backup-20260302-012941/stashes/stash0-pre-sync-main-20260206-0342.patch
```
