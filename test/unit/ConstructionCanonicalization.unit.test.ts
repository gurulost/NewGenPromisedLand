import { describe, expect, it } from "vitest";

import { getUnitDefinition } from "../../shared/data/units";
import { resolveActionState } from "../../shared/logic/resolveAction";
import type { HexCoordinate } from "../../shared/types/coordinates";
import { GameActionSchema } from "../../shared/types/game";
import type { GameState, PlayerState, Tile } from "../../shared/types/game";
import type { Unit } from "../../shared/types/unit";

const makePlayer = (overrides: Partial<PlayerState> = {}): PlayerState => ({
  id: "p1",
  name: "Player 1",
  factionId: "NEPHITES",
  stars: 20,
  stats: { faith: 50, pride: 20, internalDissent: 0 },
  modifiers: [],
  researchedTechs: ["organization"],
  researchProgress: 0,
  researchInspiration: 0,
  citiesOwned: ["c1"],
  constructionQueue: [],
  visibilityMask: [],
  exploredTiles: [],
  isEliminated: false,
  turnOrder: 0,
  atWarWith: [],
  alliedWith: [],
  tradeRoutes: [],
  diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
  ...overrides,
});

const makeTile = (
  coordinate: HexCoordinate,
  terrain: Tile["terrain"] = "plains",
  overrides: Partial<Tile> = {}
): Tile => ({
  coordinate,
  terrain,
  resources: [],
  hasCity: false,
  exploredBy: ["p1"],
  ...overrides,
});

const makeWorker = (coordinate: HexCoordinate): Unit => {
  const def = getUnitDefinition("worker");
  return {
    id: "w1",
    type: "worker",
    playerId: "p1",
    coordinate,
    hp: def.baseStats.hp,
    maxHp: def.baseStats.hp,
    attack: def.baseStats.attack,
    defense: def.baseStats.defense,
    movement: def.baseStats.movement,
    remainingMovement: def.baseStats.movement,
    maxActions: def.baseStats.actions,
    actionsRemaining: def.baseStats.actions,
    status: "active",
    abilities: def.abilities || [],
    level: 1,
    experience: 0,
    visionRadius: def.baseStats.visionRadius,
    attackRange: def.baseStats.attackRange,
    hasAttacked: false,
  };
};

const makeState = (overrides: Partial<GameState> = {}): GameState => ({
  id: "g1",
  rngSeed: 1,
  currentPlayerIndex: 0,
  turn: 1,
  phase: "playing",
  map: {
    width: 6,
    height: 6,
    tiles: [
      makeTile({ q: 0, r: 0, s: 0 }, "plains", { hasCity: true, cityOwner: "p1" }),
      makeTile({ q: 1, r: 0, s: -1 }),
      makeTile({ q: 2, r: 0, s: -2 }),
      makeTile({ q: 3, r: 0, s: -3 }),
      makeTile({ q: 4, r: 0, s: -4 }, "plains", { hasCity: true, cityOwner: "p1" }),
    ],
  },
  players: [makePlayer()],
  units: [],
  cities: [
    {
      id: "c1",
      name: "Alpha",
      coordinate: { q: 0, r: 0, s: 0 },
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
  ],
  improvements: [],
  structures: [],
  visibility: undefined,
  winner: undefined,
  victoryType: undefined,
  lastAction: undefined,
  ...overrides,
});

describe("construction action canonicalization", () => {
  it("rejects legacy construction action types at the schema boundary", () => {
    expect(
      GameActionSchema.safeParse({
        type: "BUILD_IMPROVEMENT",
        payload: {
          playerId: "p1",
          unitId: "w1",
          coordinate: { q: 1, r: 0, s: -1 },
          improvementType: "farm",
          cityId: "c1",
        },
      }).success
    ).toBe(false);

    expect(
      GameActionSchema.safeParse({
        type: "BUILD_STRUCTURE",
        payload: {
          playerId: "p1",
          cityId: "c1",
          structureType: "temple",
          coordinate: { q: 1, r: 0, s: -1 },
        },
      }).success
    ).toBe(false);

    expect(
      GameActionSchema.safeParse({
        type: "BUILD_UNIT",
        payload: {
          playerId: "p1",
          unitType: "worker",
          coordinate: { q: 0, r: 0, s: 0 },
        },
      }).success
    ).toBe(false);

    expect(
      GameActionSchema.safeParse({
        type: "RECRUIT_UNIT",
        payload: {
          playerId: "p1",
          cityId: "c1",
          unitType: "worker",
        },
      }).success
    ).toBe(false);
  });

  it("queues worker improvements through START_CONSTRUCTION instead of creating them instantly", () => {
    const workerCoordinate = { q: 1, r: 0, s: -1 };
    const state = makeState({
      units: [makeWorker(workerCoordinate)],
    });

    const beforeActions = state.units[0].actionsRemaining;
    const after = resolveActionState(
      state,
      {
        type: "START_CONSTRUCTION",
        payload: {
          playerId: "p1",
          buildingType: "farm",
          category: "improvements",
          coordinate: workerCoordinate,
          cityId: "c1",
          builderUnitId: "w1",
        },
      } as any
    );

    expect(after.improvements).toHaveLength(0);
    expect(after.players[0].constructionQueue).toHaveLength(1);
    expect(after.players[0].constructionQueue[0]).toEqual(
      expect.objectContaining({
        type: "farm",
        category: "improvements",
        cityId: "c1",
        coordinate: workerCoordinate,
      })
    );
    expect(after.units[0].actionsRemaining).toBe(beforeActions - 1);
    expect(after.players[0].stars).toBe(state.players[0].stars - 5);
  });

  it("allows a worker on a coastal land tile to queue a port on an adjacent water tile (within builder radius)", () => {
    const workerCoordinate = { q: 1, r: 0, s: -1 };
    const portCoordinate = { q: 2, r: 0, s: -2 };
    const state = makeState({
      players: [makePlayer({ researchedTechs: ["organization", "sailing"] })],
      map: {
        width: 6,
        height: 6,
        tiles: [
          makeTile({ q: 0, r: 0, s: 0 }, "plains", { hasCity: true, cityOwner: "p1" }),
          makeTile(workerCoordinate, "plains"),
          makeTile(portCoordinate, "water"),
          makeTile({ q: 3, r: 0, s: -3 }, "water"),
        ],
      },
      units: [makeWorker(workerCoordinate)],
    });

    const after = resolveActionState(
      state,
      {
        type: "START_CONSTRUCTION",
        payload: {
          playerId: "p1",
          buildingType: "port",
          category: "improvements",
          coordinate: portCoordinate,
          cityId: "c1",
          builderUnitId: "w1",
        },
      } as any
    );

    expect(after.players[0].constructionQueue).toHaveLength(1);
    expect(after.players[0].constructionQueue[0]).toEqual(
      expect.objectContaining({
        type: "port",
        category: "improvements",
        cityId: "c1",
        coordinate: portCoordinate,
      })
    );
  });

  it("rejects queueing a port when the worker is farther than the builder radius (3+ tiles away)", () => {
    const workerCoordinate = { q: 0, r: 0, s: 0 };
    const portCoordinate = { q: 3, r: 0, s: -3 };
    const state = makeState({
      players: [makePlayer({ researchedTechs: ["organization", "sailing"] })],
      map: {
        width: 6,
        height: 6,
        tiles: [
          makeTile({ q: 0, r: 0, s: 0 }, "plains", { hasCity: true, cityOwner: "p1" }),
          makeTile({ q: 1, r: 0, s: -1 }, "plains"),
          makeTile({ q: 2, r: 0, s: -2 }, "water"),
          makeTile(portCoordinate, "water"),
        ],
      },
      units: [makeWorker(workerCoordinate)],
    });

    const after = resolveActionState(
      state,
      {
        type: "START_CONSTRUCTION",
        payload: {
          playerId: "p1",
          buildingType: "port",
          category: "improvements",
          coordinate: portCoordinate,
          cityId: "c1",
          builderUnitId: "w1",
        },
      } as any
    );

    expect(after).toBe(state);
    expect(after.players[0].constructionQueue).toHaveLength(0);
  });

  it("rejects queued improvements whose coordinate is not legitimately tied to the provided city", () => {
    const state = makeState({
      players: [makePlayer({ citiesOwned: ["c1", "c2"] })],
      cities: [
        {
          id: "c1",
          name: "Alpha",
          coordinate: { q: 0, r: 0, s: 0 },
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
          id: "c2",
          name: "Beta",
          coordinate: { q: 4, r: 0, s: -4 },
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
      ],
    });

    const after = resolveActionState(
      state,
      {
        type: "START_CONSTRUCTION",
        payload: {
          playerId: "p1",
          buildingType: "farm",
          category: "improvements",
          coordinate: { q: 3, r: 0, s: -3 },
          cityId: "c1",
        },
      } as any
    );

    expect(after).toBe(state);
    expect(after.players[0].constructionQueue).toHaveLength(0);
    expect(after.players[0].stars).toBe(state.players[0].stars);
  });
});
