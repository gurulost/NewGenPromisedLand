import {
  getExpectedActorId,
  getExpectedActorIdFromSnapshot,
  getNextExpectedActorId,
  getPlayersInTurnOrder,
  needsSnapshotCatchup,
} from "@shared/logic/multiplayerSync";

describe("multiplayerSync helpers", () => {
  it("returns players ordered by turnOrder", () => {
    const ordered = getPlayersInTurnOrder({
      players: [
        { playerId: "p3", turnOrder: 2 },
        { playerId: "p1", turnOrder: 0 },
        { playerId: "p2", turnOrder: 1 },
      ],
    });

    expect(ordered.map((player) => player.playerId)).toEqual(["p1", "p2", "p3"]);
  });

  it("prefers explicit expectedActorId when present", () => {
    expect(
      getExpectedActorId({
        expectedActorId: "p2",
        players: [{ playerId: "p1", turnOrder: 0 }, { playerId: "p2", turnOrder: 1 }],
      }),
    ).toBe("p2");
  });

  it("falls back to first turn-order player when expectedActorId missing", () => {
    expect(
      getExpectedActorId({
        players: [{ playerId: "p2", turnOrder: 1 }, { playerId: "p1", turnOrder: 0 }],
      }),
    ).toBe("p1");
  });

  it("extracts expected actor from snapshot currentPlayerIndex", () => {
    expect(
      getExpectedActorIdFromSnapshot({
        currentPlayerIndex: 1,
        players: [{ id: "p1" }, { id: "p2" }],
      }),
    ).toBe("p2");
  });

  it("returns null when snapshot currentPlayerIndex is invalid", () => {
    expect(
      getExpectedActorIdFromSnapshot({
        currentPlayerIndex: 3,
        players: [{ id: "p1" }, { id: "p2" }],
      }),
    ).toBeNull();
  });

  it("advances expected actor in turn order and wraps", () => {
    const lobbyState = {
      players: [
        { playerId: "p1", turnOrder: 0 },
        { playerId: "p2", turnOrder: 1 },
        { playerId: "p3", turnOrder: 2 },
      ],
    };

    expect(getNextExpectedActorId(lobbyState, "p1")).toBe("p2");
    expect(getNextExpectedActorId(lobbyState, "p3")).toBe("p1");
  });

  it("requests snapshot catchup when client since version is below log base", () => {
    expect(needsSnapshotCatchup(8, 10)).toBe(true);
    expect(needsSnapshotCatchup(10, 10)).toBe(false);
    expect(needsSnapshotCatchup(12, 10)).toBe(false);
  });
});
