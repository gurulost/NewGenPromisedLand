import { describe, expect, it } from "vitest";

import { createInitialGameState } from "../../shared/logic/initialGameState";
import { projectGameStateForPlayer } from "../../shared/logic/stateProjection";

describe("projectGameStateForPlayer", () => {
  it("keeps owned units while hiding enemy units outside current visibility", () => {
    const { gameState } = createInitialGameState({
      playerSetup: [
        { id: "player-1", name: "One", factionId: "NEPHITES", turnOrder: 0 },
        { id: "player-2", name: "Two", factionId: "LAMANITES", turnOrder: 1 },
      ],
      mapSize: "tiny",
      seed: 20260517,
      gameId: "projection-test",
    });

    const hiddenEnemy = gameState.units.find((unit) => unit.playerId === "player-2");
    expect(hiddenEnemy).toBeTruthy();
    const state = {
      ...gameState,
      players: gameState.players.map((player) =>
        player.id === "player-1"
          ? { ...player, visibilityMask: [], exploredTiles: [] }
          : player,
      ),
      map: {
        ...gameState.map,
        tiles: gameState.map.tiles.map((tile) => ({
          ...tile,
          exploredBy: (tile.exploredBy ?? []).filter((playerId) => playerId !== "player-1"),
        })),
      },
    };

    const projected = projectGameStateForPlayer(state, "player-1", { now: 1 });

    expect(projected.projection.playerIds).toEqual(["player-1"]);
    expect(projected.units.every((unit) => unit.playerId !== "player-2")).toBe(true);
    expect(projected.units.some((unit) => unit.playerId === "player-1")).toBe(true);
    expect(projected.players.find((player) => player.id === "player-2")?.stars).toBe(0);
  });

  it("reveals enemy units on visible tiles", () => {
    const { gameState } = createInitialGameState({
      playerSetup: [
        { id: "player-1", name: "One", factionId: "NEPHITES", turnOrder: 0 },
        { id: "player-2", name: "Two", factionId: "LAMANITES", turnOrder: 1 },
      ],
      mapSize: "tiny",
      seed: 20260518,
      gameId: "projection-visible-test",
    });
    const enemy = gameState.units.find((unit) => unit.playerId === "player-2");
    expect(enemy).toBeTruthy();
    const key = `${enemy!.coordinate.q},${enemy!.coordinate.r}`;
    const state = {
      ...gameState,
      players: gameState.players.map((player) =>
        player.id === "player-1"
          ? { ...player, visibilityMask: [key], exploredTiles: [key] }
          : player,
      ),
    };

    const projected = projectGameStateForPlayer(state, "player-1", { now: 1 });

    expect(projected.units.some((unit) => unit.id === enemy!.id)).toBe(true);
  });
});
