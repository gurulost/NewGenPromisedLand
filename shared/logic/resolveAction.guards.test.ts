import { describe, expect, it } from "vitest";
import { resolveActionState } from "./resolveAction";
import type { GameState, PlayerState } from "../types/game";
import type { Unit } from "../types/unit";
import type { HexCoordinate } from "../types/coordinates";

function createPlayer(
  id: string,
  turnOrder: number,
  overrides: Partial<PlayerState> = {},
): PlayerState {
  return {
    id,
    name: id,
    factionId: "nephites",
    isEliminated: false,
    stars: 100,
    stats: {
      faith: 50,
      pride: 30,
      internalDissent: 20,
    },
    researchedTechs: [],
    turnOrder,
    visibilityMask: [],
    exploredTiles: [],
    researchProgress: 0,
    citiesOwned: [],
    ...overrides,
  };
}

function createUnit(
  id: string,
  playerId: string,
  coordinate: HexCoordinate,
  overrides: Partial<Unit> = {},
): Unit {
  return {
    id,
    type: "warrior",
    playerId,
    coordinate,
    hp: 10,
    maxHp: 10,
    attack: 5,
    defense: 3,
    movement: 2,
    remainingMovement: 2,
    maxActions: 1,
    actionsRemaining: 1,
    visionRadius: 2,
    attackRange: 1,
    status: "active",
    experience: 0,
    abilities: [],
    level: 1,
    ...overrides,
  };
}

function createBaseState(overrides: Partial<GameState> = {}): GameState {
  const player1 = createPlayer("p1", 0);
  const player2 = createPlayer("p2", 1);

  return {
    id: "guard-test",
    map: {
      tiles: [
        { coordinate: { q: 0, r: 0, s: 0 }, terrain: "plains", resources: [], hasCity: false, exploredBy: [] },
        { coordinate: { q: 0, r: -1, s: 1 }, terrain: "plains", resources: [], hasCity: true, cityOwner: "p1", exploredBy: ["p1"] },
        { coordinate: { q: 2, r: 0, s: -2 }, terrain: "plains", resources: [], hasCity: true, cityOwner: "p2", exploredBy: ["p2"] },
        { coordinate: { q: 2, r: 1, s: -3 }, terrain: "forest", resources: [], hasCity: false, exploredBy: ["p2"] },
        { coordinate: { q: 3, r: 0, s: -3 }, terrain: "plains", resources: [], hasCity: false, exploredBy: ["p2"] },
      ],
      width: 6,
      height: 6,
    },
    players: [player1, player2],
    units: [],
    currentPlayerIndex: 0,
    turn: 1,
    phase: "playing",
    winner: undefined,
    cities: [
      {
        id: "city1",
        name: "Alpha",
        coordinate: { q: 0, r: -1, s: 1 },
        ownerId: "p1",
        population: 1,
        maxPopulation: 4,
        level: 1,
        starProduction: 2,
        unrestTurns: 0,
        improvements: [],
        structures: [],
        harvestedResources: [],
      },
      {
        id: "city2",
        name: "Beta",
        coordinate: { q: 2, r: 0, s: -2 },
        ownerId: "p2",
        population: 1,
        maxPopulation: 4,
        level: 1,
        starProduction: 2,
        unrestTurns: 0,
        improvements: [],
        structures: [],
        harvestedResources: [],
      },
    ],
    improvements: [],
    structures: [],
    ...overrides,
  };
}

describe("resolveAction canonical guards", () => {
  it("rejects off-turn player-scoped actions before handler dispatch", () => {
    const state = createBaseState({
      players: [
        createPlayer("p1", 0),
        createPlayer("p2", 1, { stars: 100, researchedTechs: [] }),
      ],
    });

    const after = resolveActionState(state, {
      type: "RESEARCH_TECH",
      payload: { playerId: "p2", techId: "organization" },
    });

    expect(after).toBe(state);
    expect(after.players[1].researchedTechs).toEqual([]);
  });

  it("rejects off-turn unit actions even when the payload has no playerId", () => {
    const state = createBaseState({
      players: [
        createPlayer("p1", 0, { citiesOwned: ["city1"] }),
        createPlayer("p2", 1, { citiesOwned: ["city2"], researchedTechs: ["forestry"] }),
      ],
      units: [createUnit("u2", "p2", { q: 3, r: 0, s: -3 })],
    });

    const after = resolveActionState(state, {
      type: "HARVEST_RESOURCE",
      payload: {
        unitId: "u2",
        resourceCoordinate: { q: 2, r: 1, s: -3 },
        cityId: "city2",
      },
    });

    expect(after).toBe(state);
    expect(after.cities.find((city) => city.id === "city2")?.harvestedResources).toEqual([]);
    expect(after.units.find((unit) => unit.id === "u2")?.actionsRemaining).toBe(1);
  });

  it("rejects city-bound actions when the acting player does not own the referenced city", () => {
    const state = createBaseState({
      players: [
        createPlayer("p1", 0, { citiesOwned: ["city1"], researchedTechs: ["organization"] }),
        createPlayer("p2", 1, { citiesOwned: ["city2"] }),
      ],
      units: [
        createUnit("worker1", "p1", { q: 0, r: 0, s: 0 }, { type: "worker" }),
      ],
    });

    const after = resolveActionState(state, {
      type: "START_CONSTRUCTION",
      payload: {
        playerId: "p1",
        buildingType: "farm",
        category: "improvements",
        coordinate: { q: 0, r: 0, s: 0 },
        cityId: "city2",
        builderUnitId: "worker1",
      },
    });

    expect(after).toBe(state);
    expect(after.improvements).toEqual([]);
  });

  it("rejects further actions after the game has already ended", () => {
    const state = createBaseState({
      players: [
        createPlayer("p1", 0, { citiesOwned: ["city1"] }),
        createPlayer("p2", 1, { citiesOwned: ["city2"] }),
      ],
      phase: "ended",
      winner: "p1",
    });

    const after = resolveActionState(state, {
      type: "END_TURN",
      payload: { playerId: "p1" },
    });

    expect(after).toBe(state);
    expect(after.turn).toBe(1);
    expect(after.currentPlayerIndex).toBe(0);
  });
});
