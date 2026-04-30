# Local Worktree Backup (2026-03-02)

This backup captures local in-progress worktree state before further post-cutover operations.

## Backup Artifacts

- Directory backup:
  - `/Users/davedixon/Documents/GitHub/NewGenPromisedLand-local-work-backups/local-worktree-backup-20260302-012941`
- Compressed backup:
  - `/Users/davedixon/Documents/GitHub/NewGenPromisedLand-local-work-backups/local-worktree-backup-20260302-012941.tar.gz`
  - `/Users/davedixon/Documents/GitHub/NewGenPromisedLand-local-work-backups/local-worktree-backup-20260302-012941-with-stashes.tar.gz`

## Included Files Snapshot

- `docs/exceptionally-safe-repo-size-cleanup-and-lfs-migration-production-checklist.md`
- `docs/server-backed-sidecar-chat-transport-implementation-production-checklist.md`
- `docs/sidecar-chat-voice-notes-ui-hardening-audit-production-checklist.md`

## Included Stash Backups

- `stashes/stash-list.txt`
- `stashes/stash0-pre-sync-main-20260206-0342.patch`
- `stashes/stash0-pre-sync-main-20260206-0342.stat.txt`
- `stashes/stash1-wip-uiux-production-sync.patch`
- `stashes/stash1-wip-uiux-production-sync.stat.txt`

## Included Metadata

- `HEAD.txt`
- `status.porcelain.txt`
- `status.short.txt`
- `tracked.diff`
- `staged.diff`
- `tracked-files.txt`
- `untracked-files.txt`
- `files-to-copy.txt`

## Restore Guidance

1. Inspect backup metadata first.
2. Restore individual files from `files/` into repo root as needed.
3. If needed, extract the tarball:

```bash
tar -xzf /Users/davedixon/Documents/GitHub/NewGenPromisedLand-local-work-backups/local-worktree-backup-20260302-012941.tar.gz -C /Users/davedixon/Documents/GitHub/NewGenPromisedLand-local-work-backups
```

4. Copy back one file example:

```bash
cp /Users/davedixon/Documents/GitHub/NewGenPromisedLand-local-work-backups/local-worktree-backup-20260302-012941/files/docs/exceptionally-safe-repo-size-cleanup-and-lfs-migration-production-checklist.md /Users/davedixon/Documents/GitHub/NewGenPromisedLand/docs/
```

5. Recover a stash patch example:

```bash
git apply /Users/davedixon/Documents/GitHub/NewGenPromisedLand-local-work-backups/local-worktree-backup-20260302-012941/stashes/stash0-pre-sync-main-20260206-0342.patch
```
