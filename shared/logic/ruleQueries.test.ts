import { describe, expect, it } from "vitest";
import type { GameAction, GameState, PlayerState } from "../types/game";
import { GAME_RULES } from "../data/gameRules";
import type { City, Structure, StructureType } from "../types/city";
import type { HexCoordinate } from "../types/coordinates";
import type { Unit } from "../types/unit";
import {
  explainAction,
  getAICandidateActions,
  getCombatRulePreview,
  getConstructionModePreview,
  getLegalCityActions,
  getLegalPlayerActions,
  getLegalUnitActions,
  getTechnologyRuleSummary,
  getUnitMovementPreview,
} from "./ruleQueries";
import { resolveActionState } from "./resolveAction";

function player(id: string, turnOrder: number, overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id,
    name: id,
    factionId: "nephites",
    isEliminated: false,
    stars: 100,
    stats: { faith: 70, pride: 30, internalDissent: 10 },
    researchedTechs: ["organization"],
    turnOrder,
    visibilityMask: [],
    exploredTiles: [],
    researchProgress: 0,
    citiesOwned: [],
    ...overrides,
  };
}

function unit(id: string, playerId: string, coordinate: HexCoordinate, overrides: Partial<Unit> = {}): Unit {
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

function baseState(overrides: Partial<GameState> = {}): GameState {
  const p1 = player("p1", 0, { citiesOwned: ["city1"] });
  const p2 = player("p2", 1);
  return {
    id: "rule-query-test",
    rngSeed: 1,
    players: [p1, p2],
    currentPlayerIndex: 0,
    turn: 3,
    phase: "playing",
    map: {
      width: 5,
      height: 5,
      tiles: [
        { coordinate: { q: 0, r: 0, s: 0 }, terrain: "plains", resources: [], hasCity: true, cityOwner: "p1", exploredBy: ["p1"] },
        { coordinate: { q: 1, r: 0, s: -1 }, terrain: "plains", resources: [], hasCity: false, exploredBy: ["p1"] },
        { coordinate: { q: 0, r: 1, s: -1 }, terrain: "plains", resources: [], hasCity: false, exploredBy: ["p1"] },
        { coordinate: { q: 2, r: 0, s: -2 }, terrain: "forest", resources: [], hasCity: false, exploredBy: ["p1"] },
      ],
    },
    units: [unit("u1", "p1", { q: 0, r: 1, s: -1 })],
    cities: [{
      id: "city1",
      name: "Alpha",
      coordinate: { q: 0, r: 0, s: 0 },
      ownerId: "p1",
      population: 2,
      maxPopulation: 4,
      level: 1,
      starProduction: 2,
      unrestTurns: 0,
      improvements: [],
      structures: [],
      harvestedResources: [],
    }],
    improvements: [],
    structures: [],
    ...overrides,
  };
}

function city(id: string, ownerId: string, coordinate: HexCoordinate): City {
  return {
    id,
    name: id,
    coordinate,
    ownerId,
    population: 2,
    maxPopulation: 4,
    level: 1,
    starProduction: 2,
    unrestTurns: 0,
    improvements: [],
    structures: [],
    harvestedResources: [],
  };
}

function structure(id: string, type: StructureType, cityId: string, ownerId: string): Structure {
  return {
    id,
    type,
    cityId,
    ownerId,
    constructionTurns: 0,
    effects: {
      starProduction: 0,
      unitProduction: 0,
      defenseBonus: 0,
      populationGrowth: 0,
      faithProduction: 0,
    },
  };
}

function faithProjectRuleState(): GameState {
  const cities = [
    city("c1", "p1", { q: 0, r: 0, s: 0 }),
    city("c2", "p1", { q: 1, r: 0, s: -1 }),
    city("c3", "p1", { q: 0, r: 1, s: -1 }),
    city("c4", "p1", { q: 1, r: 1, s: -2 }),
  ];

  return baseState({
    turn: GAME_RULES.victory.faithVictory.minTurnToStart,
    players: [
      player("p1", 0, {
        stars: 100,
        stats: { faith: 100, pride: 0, internalDissent: 0 },
        citiesOwned: cities.map((candidate) => candidate.id),
      }),
      player("p2", 1),
    ],
    units: [],
    cities,
    structures: [
      structure("t1", "temple", "c1", "p1"),
      structure("t2", "temple", "c2", "p1"),
      structure("t3", "temple", "c3", "p1"),
      structure("t4", "temple", "c4", "p1"),
      structure("cat4", "cathedral", "c4", "p1"),
    ],
    map: {
      width: 5,
      height: 5,
      tiles: cities.map((candidate) => ({
        coordinate: candidate.coordinate,
        terrain: "plains",
        resources: [],
        hasCity: true,
        cityOwner: candidate.ownerId,
        exploredBy: ["p1"],
      })),
    },
  });
}

describe("canonical rule queries", () => {
  it("uses the same canonical preconditions as the resolver", () => {
    const state = baseState();
    const action: GameAction = {
      type: "RESEARCH_TECH",
      payload: { playerId: "p2", techId: "agriculture" },
    };

    const check = explainAction(state, action);
    expect(check).toMatchObject({ legal: false, reason: "wrong_turn" });
    expect(resolveActionState(state, action)).toBe(state);
  });

  it("returns legal unit options that can be sent directly to resolveAction", () => {
    const state = baseState();
    const move = getLegalUnitActions(state, "u1", "p1").find(option => option.action.type === "MOVE_UNIT");

    expect(move?.check.legal).toBe(true);
    const next = resolveActionState(state, move!.action);
    expect(next).not.toBe(state);
    expect(next.units.find(candidate => candidate.id === "u1")?.coordinate).toEqual(move!.action.payload.targetCoordinate);
  });

  it("returns legal city recruitment actions instead of UI-invented build legality", () => {
    const state = baseState();
    const recruit = getLegalCityActions(state, "city1", "p1")
      .find(option => option.action.type === "START_CONSTRUCTION" && option.action.payload.category === "units");

    expect(recruit?.check.legal).toBe(true);
    expect(recruit?.action.payload.cityId).toBe("city1");
    expect(resolveActionState(state, recruit!.action)).not.toBe(state);
  });

  it("returns legal player research actions with canonical costs", () => {
    const state = baseState();
    const research = getLegalPlayerActions(state, "p1")
      .find(option => option.action.type === "RESEARCH_TECH" && option.action.payload.techId === "agriculture");

    expect(research?.check.legal).toBe(true);
    expect(research?.costs?.stars).toBeGreaterThan(0);
    expect(resolveActionState(state, research!.action).players[0].researchedTechs).toContain("agriculture");
  });

  it("summarizes technology legality without UI re-deriving prerequisites or costs", () => {
    const state = baseState();
    const summary = getTechnologyRuleSummary(state, "p1", "agriculture");

    expect(summary).toMatchObject({
      techId: "agriculture",
      status: "available",
      prerequisitesMet: true,
      canAfford: true,
    });
    expect(summary.finalCost).toBeGreaterThan(0);
    expect(summary.check.legal).toBe(true);
  });

  it("returns combat and movement previews backed by shared action checks", () => {
    const state = baseState({
      units: [
        unit("u1", "p1", { q: 0, r: 1, s: -1 }),
        unit("u2", "p2", { q: 1, r: 0, s: -1 }),
      ],
      players: [
        player("p1", 0, { citiesOwned: ["city1"], atWarWith: ["p2"] }),
        player("p2", 1, { atWarWith: ["p1"] }),
      ],
    });

    const movement = getUnitMovementPreview(state, "u1", "p1");
    expect(movement.canMove).toBe(true);
    expect(movement.reachableTilesCount).toBeGreaterThan(0);

    const combat = getCombatRulePreview(state, "u1", "u2", "p1");
    expect(combat.check.legal).toBe(true);
    expect(combat.preview?.canAttack).toBe(true);
    expect(combat.resolution?.canAttack).toBe(true);
  });

  it("returns construction-mode options by tile instead of component-side validation", () => {
    const state = baseState();
    const preview = getConstructionModePreview(state, "p1", {
      buildingType: "warrior",
      category: "units",
      cityId: "city1",
      selectedCoordinate: { q: 1, r: 0, s: -1 },
    });

    expect(preview.validTileKeys).toContain("1,0");
    expect(preview.selectedTileOptions.some(option =>
      option.action.type === "START_CONSTRUCTION" &&
      option.action.payload.category === "units" &&
      option.action.payload.buildingType === "warrior"
    )).toBe(true);
  });

  it("returns AI candidate actions that all pass shared legality", () => {
    const state = baseState();
    const candidates = getAICandidateActions(state, "p1");

    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      expect(explainAction(state, candidate.action, { actorId: "p1" }).legal).toBe(true);
    }
  });

  it("reports Faith Project start costs from canonical game rules", () => {
    const state = faithProjectRuleState();
    const action = {
      type: "START_FAITH_PROJECT",
      payload: { playerId: "p1", holyCityIds: ["c1", "c2", "c4"] },
    } as const;

    const check = explainAction(state, action);
    expect(check).toMatchObject({
      legal: true,
      costs: {
        stars: GAME_RULES.victory.faithVictory.startStarsCost,
        faith: GAME_RULES.victory.faithVictory.startFaithCost,
      },
    });

    const next = resolveActionState(state, action);
    expect(next.players[0].stars).toBe(state.players[0].stars - check.costs!.stars!);
    expect(next.players[0].stats.faith).toBe(state.players[0].stats.faith - check.costs!.faith!);
  });

  it("returns every valid Faith Project holy-city combination in stable order", () => {
    const state = faithProjectRuleState();
    const faithProjectOptions = getLegalPlayerActions(state, "p1")
      .filter(option => option.action.type === "START_FAITH_PROJECT");

    expect(faithProjectOptions.map(option => option.id)).toEqual([
      "faith-project:c1:c2:c4",
      "faith-project:c1:c3:c4",
      "faith-project:c2:c3:c4",
    ]);
    expect(faithProjectOptions.map(option => option.action.payload.holyCityIds)).toEqual([
      ["c1", "c2", "c4"],
      ["c1", "c3", "c4"],
      ["c2", "c3", "c4"],
    ]);
    expect(faithProjectOptions.map(option => option.costs)).toEqual([
      { stars: GAME_RULES.victory.faithVictory.startStarsCost, faith: GAME_RULES.victory.faithVictory.startFaithCost },
      { stars: GAME_RULES.victory.faithVictory.startStarsCost, faith: GAME_RULES.victory.faithVictory.startFaithCost },
      { stars: GAME_RULES.victory.faithVictory.startStarsCost, faith: GAME_RULES.victory.faithVictory.startFaithCost },
    ]);
    expect(faithProjectOptions.some(option => option.id === "faith-project:c1:c2:c3")).toBe(false);
  });
});
