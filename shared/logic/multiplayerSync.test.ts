import {
  getExpectedActorId,
  getNextExpectedActorId,
  needsSnapshotCatchup,
} from "./multiplayerSync";

describe("multiplayerSync", () => {
  it("prefers explicit expected actor id", () => {
    const state = {
      expectedActorId: "player-2",
      players: [
        { playerId: "player-1", turnOrder: 0 },
        { playerId: "player-2", turnOrder: 1 },
      ],
    };
    expect(getExpectedActorId(state)).toBe("player-2");
  });

  it("falls back to first player by turn order", () => {
    const state = {
      players: [
        { playerId: "player-3", turnOrder: 2 },
        { playerId: "player-1", turnOrder: 0 },
        { playerId: "player-2", turnOrder: 1 },
      ],
    };
    expect(getExpectedActorId(state)).toBe("player-1");
  });

  it("advances and wraps next expected actor", () => {
    const state = {
      players: [
        { playerId: "player-1", turnOrder: 0 },
        { playerId: "player-2", turnOrder: 1 },
        { playerId: "player-3", turnOrder: 2 },
      ],
    };
    expect(getNextExpectedActorId(state, "player-1")).toBe("player-2");
    expect(getNextExpectedActorId(state, "player-3")).toBe("player-1");
  });

  it("detects snapshot catch-up requirement", () => {
    expect(needsSnapshotCatchup(2, 5)).toBe(true);
    expect(needsSnapshotCatchup(5, 5)).toBe(false);
    expect(needsSnapshotCatchup(8, 5)).toBe(false);
  });
});
