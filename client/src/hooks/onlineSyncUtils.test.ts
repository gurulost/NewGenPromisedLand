import {
  applyCommittedEntriesSequentially,
  getCursorFromSnapshotVersion,
  getInitialActionVersionFromLobbyConfig,
} from "./onlineSyncUtils";

describe("onlineSyncUtils", () => {
  it("initializes action version from snapshot version when snapshot exists", () => {
    const version = getInitialActionVersionFromLobbyConfig({
      snapshot: { id: "snapshot" },
      snapshotVersion: 5,
    });
    expect(version).toBe(5);
  });

  it("initializes action version to zero with no snapshot", () => {
    const version = getInitialActionVersionFromLobbyConfig({});
    expect(version).toBe(0);
  });

  it("normalizes snapshot cursor values", () => {
    expect(getCursorFromSnapshotVersion(4)).toBe(4);
    expect(getCursorFromSnapshotVersion(undefined)).toBe(0);
    expect(getCursorFromSnapshotVersion(-3)).toBe(0);
    expect(getCursorFromSnapshotVersion("7")).toBe(7);
  });

  it("applies committed actions in strict version order", () => {
    const applied: unknown[] = [];
    const result = applyCommittedEntriesSequentially(
      [
        { version: 3, action: { type: "B" } },
        { version: 2, action: { type: "A" } },
      ],
      1,
      (action) => {
        applied.push(action);
        return true;
      },
    );
    expect(result.needsResync).toBe(false);
    expect(result.nextVersion).toBe(3);
    expect(applied).toEqual([{ type: "A" }, { type: "B" }]);
  });

  it("flags version gaps for resync", () => {
    const result = applyCommittedEntriesSequentially(
      [{ version: 4, action: { type: "A" } }],
      2,
      () => true,
    );
    expect(result.needsResync).toBe(true);
    expect(result.reason).toBe("version_gap");
  });

  it("flags apply failures for resync", () => {
    const result = applyCommittedEntriesSequentially(
      [{ version: 2, action: { type: "A" } }],
      1,
      () => false,
    );
    expect(result.needsResync).toBe(true);
    expect(result.reason).toBe("apply_failed");
  });
});
