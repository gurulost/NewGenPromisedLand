import { describe, expect, it } from "vitest";

import { createInitialGameState } from "../../shared/logic/initialGameState";
import { projectGameStateForPlayer } from "../../shared/logic/stateProjection";
import type { GameState } from "../../shared/types/game";

function createProjectionState(): {
  state: GameState;
  enemyCityId: string;
  enemyCoordinateKey: string;
} {
  const { gameState } = createInitialGameState({
    playerSetup: [
      { id: "player-1", name: "One", factionId: "NEPHITES", turnOrder: 0 },
      { id: "player-2", name: "Two", factionId: "LAMANITES", turnOrder: 1 },
    ],
    mapSize: "tiny",
    seed: 20260710,
    gameId: "projection-sensitive-state",
  });
  const enemyCity = gameState.cities.find((city) => city.ownerId === "player-2");
  expect(enemyCity).toBeTruthy();
  const enemyCoordinateKey = `${enemyCity!.coordinate.q},${enemyCity!.coordinate.r}`;

  return {
    enemyCityId: enemyCity!.id,
    enemyCoordinateKey,
    state: {
      ...gameState,
      rngSeed: 123456,
      visibility: {
        "player-1": { visible: ["viewer-coordinate"] },
        "player-2": { visible: ["secret-opponent-coordinate"] },
      },
      players: gameState.players.map((player) => {
        if (player.id === "player-1") {
          return {
            ...player,
            stars: 17,
            visibilityMask: [],
            exploredTiles: [enemyCoordinateKey],
          };
        }
        return {
          ...player,
          stars: 99,
          stats: { faith: 72, pride: 41, internalDissent: 13 },
          modifiers: [{ type: "secret-modifier", value: 5 }],
          researchedTechs: ["secret-technology"],
          currentResearch: "secret-research",
          researchProgress: 8,
          researchInspiration: 3,
          abilityCooldowns: { secretAbility: 4 },
          citiesOwned: [enemyCity!.id],
          constructionQueue: [{
            id: "secret-construction",
            type: "fortress",
            category: "structures" as const,
            cityId: enemyCity!.id,
            playerId: "player-2",
            turnsRemaining: 2,
            totalTurns: 3,
            cost: { stars: 12, faith: 4, pride: 1 },
          }],
          visibilityMask: [enemyCoordinateKey],
          exploredTiles: [enemyCoordinateKey],
          faithProject: {
            active: true,
            progress: 7,
            holyCityIds: [enemyCity!.id, "secret-holy-2", "secret-holy-3"] as [string, string, string],
            startedTurn: 2,
          },
          atWarWith: ["player-1"],
          alliedWith: ["secret-ally"],
          tradeRoutes: [{ fromCityId: enemyCity!.id, toCityId: "secret-destination", starsPerTurn: 4 }],
          diplomaticCooldowns: { declareWar: 5, formAlliance: 4, breakAlliance: 3, requestTrade: 2 },
        };
      }),
      map: {
        ...gameState.map,
        tiles: gameState.map.tiles.map((tile) => {
          const key = `${tile.coordinate.q},${tile.coordinate.r}`;
          if (key !== enemyCoordinateKey) return tile;
          return {
            ...tile,
            resources: ["ore"],
            hasCity: true,
            cityOwner: "player-2",
            exploredBy: ["player-1", "player-2"],
            feature: "ruin" as const,
            captureType: "conquered" as const,
            starBonus: 9,
          };
        }),
      },
      cities: gameState.cities.map((city) =>
        city.id === enemyCity!.id
          ? {
              ...city,
              population: 9,
              starProduction: 12,
              unrestTurns: 3,
              improvements: ["enemy-improvement"],
              structures: ["enemy-structure"],
              currentProduction: { type: "structure" as const, targetId: "fortress", progress: 5, totalCost: 12 },
              harvestedResources: ["secret-resource"],
            }
          : city,
      ),
      improvements: [{
        id: "enemy-improvement",
        type: "mine",
        coordinate: enemyCity!.coordinate,
        ownerId: "player-2",
        starProduction: 7,
        cityId: enemyCity!.id,
        constructionTurns: 2,
      }],
      structures: [{
        id: "enemy-structure",
        type: "fortress",
        coordinate: enemyCity!.coordinate,
        cityId: enemyCity!.id,
        ownerId: "player-2",
        constructionTurns: 2,
        effects: {
          starProduction: 3,
          unitProduction: 2,
          defenseBonus: 4,
          populationGrowth: 1,
          faithProduction: 5,
        },
      }],
    },
  };
}

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

  it("keeps only viewer exploration markers on visible tiles", () => {
    const { state, enemyCoordinateKey } = createProjectionState();
    const visibleState = {
      ...state,
      players: state.players.map((player) =>
        player.id === "player-1"
          ? { ...player, visibilityMask: [enemyCoordinateKey], exploredTiles: [enemyCoordinateKey] }
          : player,
      ),
    };

    const projected = projectGameStateForPlayer(visibleState, "player-1", { now: 1 });
    const tile = projected.map.tiles.find((candidate) =>
      `${candidate.coordinate.q},${candidate.coordinate.r}` === enemyCoordinateKey,
    );

    expect(tile?.exploredBy).toEqual(["player-1"]);
    expect(projected.cities.some((city) => city.ownerId === "player-2")).toBe(true);
    expect(projected.improvements.map((improvement) => improvement.id)).toContain("enemy-improvement");
    expect(projected.structures.map((structure) => structure.id)).toContain("enemy-structure");
  });

  it("retains explored terrain without exposing current off-screen enemy infrastructure", () => {
    const { state, enemyCityId, enemyCoordinateKey } = createProjectionState();
    const projected = projectGameStateForPlayer(state, "player-1", { now: 1 });
    const tile = projected.map.tiles.find((candidate) =>
      `${candidate.coordinate.q},${candidate.coordinate.r}` === enemyCoordinateKey,
    );

    expect(tile).toMatchObject({
      exploredBy: ["player-1"],
      resources: [],
      hasCity: false,
    });
    expect(tile?.feature).toBeUndefined();
    expect(tile?.cityOwner).toBeUndefined();
    expect(tile?.captureType).toBeUndefined();
    expect(tile?.starBonus).toBeUndefined();
    expect(projected.cities.map((city) => city.id)).not.toContain(enemyCityId);
    expect(projected.improvements.map((improvement) => improvement.id)).not.toContain("enemy-improvement");
    expect(projected.structures.map((structure) => structure.id)).not.toContain("enemy-structure");
  });

  it("does not reveal off-screen infrastructure changes after visibility is lost", () => {
    const { state, enemyCityId } = createProjectionState();
    const changedState = {
      ...state,
      cities: state.cities.map((city) =>
        city.id === enemyCityId
          ? { ...city, population: 99, starProduction: 99, unrestTurns: 0 }
          : city,
      ),
      improvements: state.improvements.map((improvement) => ({ ...improvement, constructionTurns: 0, starProduction: 99 })),
      structures: state.structures.map((structure) => ({
        ...structure,
        constructionTurns: 0,
        effects: { ...structure.effects, defenseBonus: 99 },
      })),
    };

    const before = projectGameStateForPlayer(state, "player-1", { now: 1 });
    const after = projectGameStateForPlayer(changedState, "player-1", { now: 2 });

    expect(before.improvements).toEqual([]);
    expect(after.improvements).toEqual([]);
    expect(before.structures).toEqual([]);
    expect(after.structures).toEqual([]);
    expect(before.cities.map((city) => city.id)).not.toContain(enemyCityId);
    expect(after.cities.map((city) => city.id)).not.toContain(enemyCityId);
  });

  it("allowlists opponent player metadata and preserves the controlled player state", () => {
    const { state } = createProjectionState();
    const projected = projectGameStateForPlayer(state, "player-1", { now: 1 });
    const controlled = projected.players.find((player) => player.id === "player-1");
    const opponent = projected.players.find((player) => player.id === "player-2");

    expect(controlled?.stars).toBe(17);
    expect(projected.rngSeed).toBeUndefined();
    expect(projected.visibility).toEqual({
      "player-1": { visible: ["viewer-coordinate"] },
    });
    expect(opponent).toEqual({
      id: "player-2",
      name: "Two",
      factionId: "LAMANITES",
      isAI: false,
      aiDifficulty: "normal",
      stars: 0,
      stats: { faith: 0, pride: 0, internalDissent: 0 },
      modifiers: [],
      researchedTechs: [],
      currentResearch: undefined,
      researchProgress: 0,
      researchInspiration: undefined,
      abilityCooldowns: {},
      citiesOwned: [],
      constructionQueue: [],
      visibilityMask: [],
      exploredTiles: [],
      isEliminated: false,
      turnOrder: 1,
      faithProject: null,
      atWarWith: [],
      alliedWith: [],
      tradeRoutes: [],
      diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
    });
  });
});
