export type LobbyGameConfigLike = {
  snapshot?: unknown;
  snapshotVersion?: number;
  actionVersion?: number;
};

export type MultiplayerAuthorityModeLike = "private_demo_hosted" | "public_authoritative";

export type CommittedActionLike = {
  id?: string;
  version?: number;
  action?: unknown;
};

export type ApplyCommittedEntriesResult = {
  nextVersion: number;
  appliedCount: number;
  needsResync: boolean;
  reason: "none" | "version_gap" | "invalid_version" | "apply_failed";
};

export function getInitialActionVersionFromLobbyConfig(config: LobbyGameConfigLike): number {
  if (config.snapshot) {
    const actionVersion = Number(config.actionVersion ?? config.snapshotVersion ?? 0);
    return Number.isFinite(actionVersion) && actionVersion >= 0 ? actionVersion : 0;
  }
  return 0;
}

export function getCursorFromSnapshotVersion(snapshotVersion: unknown): number {
  const parsed = Number(snapshotVersion ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function shouldIncludePeriodicHostStatus(authorityMode?: MultiplayerAuthorityModeLike): boolean {
  return authorityMode !== "public_authoritative";
}

export function applyCommittedEntriesSequentially(
  entries: CommittedActionLike[],
  currentVersion: number,
  applyAction: (action: unknown, entry: CommittedActionLike) => boolean,
): ApplyCommittedEntriesResult {
  if (!entries.length) {
    return { nextVersion: currentVersion, appliedCount: 0, needsResync: false, reason: "none" };
  }

  const ordered = [...entries].sort((left, right) => Number(left.version ?? 0) - Number(right.version ?? 0));
  let expectedVersion = currentVersion + 1;
  let appliedCount = 0;

  for (const entry of ordered) {
    const entryVersion = Number(entry.version);
    if (!Number.isFinite(entryVersion) || entryVersion <= 0) {
      return {
        nextVersion: currentVersion,
        appliedCount,
        needsResync: true,
        reason: "invalid_version",
      };
    }
    if (entryVersion !== expectedVersion) {
      return {
        nextVersion: currentVersion,
        appliedCount,
        needsResync: true,
        reason: "version_gap",
      };
    }
    if (!applyAction(entry.action, entry)) {
      return {
        nextVersion: currentVersion,
        appliedCount,
        needsResync: true,
        reason: "apply_failed",
      };
    }
    currentVersion = entryVersion;
    expectedVersion += 1;
    appliedCount += 1;
  }

  return { nextVersion: currentVersion, appliedCount, needsResync: false, reason: "none" };
}
