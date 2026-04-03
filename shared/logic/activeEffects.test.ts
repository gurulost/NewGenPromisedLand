import { describe, expect, it } from "vitest";
import { resolveActionState } from "./resolveAction";
import { computeEffectiveStats } from "./computeEffectiveStats";
import { applyStatusEffect } from "./statusEffects";
import { calculatePlayerFaithGeneration, calculatePlayerStarIncome } from "./actions/turns";
import type { GameState, PlayerState } from "../types/game";
import type { Unit } from "../types/unit";

const coord = (q: number, r: number) => ({ q, r, s: -q - r });

function makePlayer(id: string, factionId: string, overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id,
    name: id,
    factionId,
    isEliminated: false,
    stars: 0,
    stats: {
      faith: 0,
      pride: 0,
      internalDissent: 0,
    },
    modifiers: [],
    researchedTechs: [],
    researchProgress: 0,
    abilityCooldowns: {},
    citiesOwned: [],
    constructionQueue: [],
    visibilityMask: [],
    exploredTiles: [],
    turnOrder: 0,
    atWarWith: [],
    alliedWith: [],
    tradeRoutes: [],
    diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
    ...overrides,
  };
}

function makeUnit(id: string, playerId: string, q: number, r: number, overrides: Partial<Unit> = {}): Unit {
  return {
    id,
    type: "warrior",
    playerId,
    coordinate: coord(q, r),
    hp: 10,
    maxHp: 10,
    attack: 10,
    defense: 10,
    movement: 2,
    remainingMovement: 2,
    maxActions: 1,
    actionsRemaining: 1,
    status: "active",
    abilities: [],
    level: 1,
    experience: 0,
    visionRadius: 2,
    attackRange: 1,
    hasAttacked: false,
    ...overrides,
  };
}

function makeState(
  players: PlayerState[],
  units: Unit[],
  extras: Partial<GameState> = {}
): GameState {
  const cityCoordinates = (extras.cities || []).map(city => city.coordinate);
  const tileCoordinates = [...units.map(unit => unit.coordinate), ...cityCoordinates];
  const uniqueCoordinates = Array.from(
    new Map(tileCoordinates.map(coordinate => [`${coordinate.q},${coordinate.r}`, coordinate])).values()
  );

  return {
    id: "effect-test",
    rngSeed: 0,
    players,
    currentPlayerIndex: 0,
    turn: 1,
    phase: "playing",
    map: {
      width: 10,
      height: 10,
      tiles: uniqueCoordinates.map(coordinate => ({
        coordinate,
        terrain: "plains" as const,
        resources: [],
        hasCity: false,
        exploredBy: [],
      })),
    },
    units,
    cities: [],
    improvements: [],
    structures: [],
    activeEffects: [],
    ...extras,
  };
}

describe("active faction effects", () => {
  it("applies Title of Liberty as a radius-limited timed aura with status immunity", () => {
    const player1 = makePlayer("player1", "NEPHITES", {
      stats: { faith: 90, pride: 20, internalDissent: 10 },
      turnOrder: 0,
    });
    const player2 = makePlayer("player2", "LAMANITES", {
      stats: { faith: 30, pride: 70, internalDissent: 10 },
      turnOrder: 1,
    });

    const banner = makeUnit("banner", "player1", 0, 0);
    const allyNear = makeUnit("ally-near", "player1", 2, 0);
    const allyFar = makeUnit("ally-far", "player1", 5, 0);

    const state = makeState([player1, player2], [banner, allyNear, allyFar]);
    const castState = resolveActionState(state, {
      type: "ACTIVATE_FACTION_ABILITY",
      payload: {
        playerId: "player1",
        abilityId: "TITLE_OF_LIBERTY",
        targetId: "banner",
      },
    });

    expect(castState.activeEffects).toHaveLength(1);
    expect(castState.units.find(unit => unit.id === "ally-near")?.attack).toBe(10);
    expect(castState.units.find(unit => unit.id === "ally-near")?.defense).toBe(10);

    const nearAttack = computeEffectiveStats(
      castState.units.find(unit => unit.id === "ally-near")!,
      castState,
      { role: "attacker" }
    );
    const nearDefense = computeEffectiveStats(
      castState.units.find(unit => unit.id === "ally-near")!,
      castState,
      { role: "defender" }
    );
    const farAttack = computeEffectiveStats(
      castState.units.find(unit => unit.id === "ally-far")!,
      castState,
      { role: "attacker" }
    );

    expect(nearAttack.attack).toBe(13);
    expect(nearDefense.defense).toBe(13);
    expect(farAttack.attack).toBe(10);

    const protectedUnit = castState.units.find(unit => unit.id === "ally-near")!;
    const unprotectedUnit = castState.units.find(unit => unit.id === "ally-far")!;
    expect(applyStatusEffect(protectedUnit, { type: "INTIMIDATED", turnsRemaining: 1 }, castState)).toBeNull();
    expect(applyStatusEffect(unprotectedUnit, { type: "INTIMIDATED", turnsRemaining: 1 }, castState)).not.toBeNull();

    let expiredState = castState;
    for (let i = 0; i < 3; i += 1) {
      expiredState = resolveActionState(expiredState, {
        type: "END_TURN",
        payload: { playerId: "player1" },
      });
      expiredState = resolveActionState(expiredState, {
        type: "END_TURN",
        payload: { playerId: "player2" },
      });
    }

    const expiredAttack = computeEffectiveStats(
      expiredState.units.find(unit => unit.id === "ally-near")!,
      expiredState,
      { role: "attacker" }
    );

    expect(expiredState.activeEffects).toHaveLength(0);
    expect(expiredAttack.attack).toBe(10);
  });

  it("applies Rameumptom as a timed income modifier and dissent spike", () => {
    const player = makePlayer("zoramite", "ZORAMITES", {
      stats: { faith: 10, pride: 80, internalDissent: 5 },
      turnOrder: 0,
      citiesOwned: ["city1"],
    });

    const city = {
      id: "city1",
      name: "City 1",
      coordinate: coord(0, 0),
      ownerId: "zoramite",
      population: 1,
      maxPopulation: 4,
      level: 1,
      starProduction: 6,
      unrestTurns: 0,
      improvements: [],
      structures: [],
      harvestedResources: [],
    };

    const temple = {
      id: "temple1",
      type: "temple",
      coordinate: coord(0, 0),
      ownerId: "zoramite",
      cityId: "city1",
      constructionTurns: 0,
      effects: {
        starProduction: 0,
        unitProduction: 0,
        defenseBonus: 0,
        populationGrowth: 0,
        faithProduction: 3,
      },
    };

    const baseState = makeState([player], [], {
      cities: [city],
      structures: [temple],
    });

    const castState = resolveActionState(baseState, {
      type: "ACTIVATE_FACTION_ABILITY",
      payload: {
        playerId: "zoramite",
        abilityId: "RAMEUMPTOM",
      },
    });

    const basePlayer = baseState.players[0];
    const boostedPlayer = castState.players[0];

    expect(boostedPlayer.stats.internalDissent).toBe(25);
    expect(boostedPlayer.stats.pride).toBe(80);
    expect(castState.activeEffects).toHaveLength(1);
    expect(castState.activeEffects[0].turnsRemaining).toBe(5);

    expect(calculatePlayerStarIncome(baseState, basePlayer)).toBe(6);
    expect(calculatePlayerStarIncome(castState, boostedPlayer)).toBe(12);

    expect(calculatePlayerFaithGeneration(castState, boostedPlayer)).toBe(
      calculatePlayerFaithGeneration(baseState, basePlayer) * 2
    );
  });
});
