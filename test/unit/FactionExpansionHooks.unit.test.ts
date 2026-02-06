import { describe, expect, it } from "vitest";

import type { HexCoordinate } from "../../shared/types/coordinates";
import type { GameState, PlayerState } from "../../shared/types/game";
import type { Unit, UnitType } from "../../shared/types/unit";
import { resolveActionState } from "../../shared/logic/resolveAction";
import { getUnitDefinition } from "../../shared/data/units";

const makePlayer = (
  id: string,
  factionId: string,
  researchedTechs: string[] = []
): PlayerState => ({
  id,
  name: id,
  factionId,
  stars: 0,
  stats: { faith: 40, pride: 20, internalDissent: 10 },
  modifiers: [],
  researchedTechs,
  researchProgress: 0,
  researchInspiration: 0,
  citiesOwned: ["city-1"],
  constructionQueue: [],
  visibilityMask: [],
  exploredTiles: [],
  isEliminated: false,
  turnOrder: id === "p1" ? 0 : 1,
  atWarWith: [],
  alliedWith: [],
  tradeRoutes: [],
  diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
});

const makeUnit = (
  id: string,
  type: UnitType,
  playerId: string,
  coordinate: HexCoordinate
): Unit => {
  const def = getUnitDefinition(type);
  return {
    id,
    type,
    playerId,
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
    visionRadius: def.baseStats.visionRadius,
    attackRange: def.baseStats.attackRange,
    level: 1,
    experience: 0,
  };
};

const makePortIncomeState = (factionId: string, researchedTechs: string[]): GameState => {
  const p1 = makePlayer("p1", factionId, researchedTechs);
  return {
    id: "g-port",
    rngSeed: 7130,
    currentPlayerIndex: 0,
    turn: 1,
    phase: "playing",
    winner: undefined,
    visibility: undefined,
    map: {
      width: 4,
      height: 4,
      tiles: [
        {
          coordinate: { q: 0, r: 0, s: 0 },
          terrain: "plains",
          resources: [],
          hasCity: true,
          cityOwner: "p1",
          exploredBy: ["p1"],
        },
        {
          coordinate: { q: 1, r: 0, s: -1 },
          terrain: "water",
          resources: [],
          hasCity: false,
          exploredBy: ["p1"],
        },
      ],
    },
    players: [p1],
    units: [],
    cities: [
      {
        id: "city-1",
        name: "Port City",
        coordinate: { q: 0, r: 0, s: 0 },
        ownerId: "p1",
        population: 1,
        maxPopulation: 4,
        level: 1,
        starProduction: 0,
        unrestTurns: 0,
        improvements: [],
        structures: [],
        harvestedResources: [],
      },
    ],
    improvements: [
      {
        id: "port-1",
        type: "port",
        coordinate: { q: 1, r: 0, s: -1 },
        ownerId: "p1",
        starProduction: 0,
        cityId: "city-1",
        constructionTurns: 0,
      },
    ],
    structures: [],
  };
};

describe("Faction expansion runtime hooks", () => {
  it("applies Hagoth port bonus without Seafaring and does not stack with Seafaring", () => {
    const baseline = resolveActionState(
      makePortIncomeState("NEPHITES", []),
      { type: "END_TURN", payload: { playerId: "p1" } } as any
    );
    expect(baseline.players[0].stars).toBe(0);

    const hagothNoSeafaring = resolveActionState(
      makePortIncomeState("HAGOTHS_MARINERS", []),
      { type: "END_TURN", payload: { playerId: "p1" } } as any
    );
    expect(hagothNoSeafaring.players[0].stars).toBe(1);

    const hagothWithSeafaring = resolveActionState(
      makePortIncomeState("HAGOTHS_MARINERS", ["seafaring"]),
      { type: "END_TURN", payload: { playerId: "p1" } } as any
    );
    expect(hagothWithSeafaring.players[0].stars).toBe(1);
  });

  it("applies taskmaster intimidation aura only to adjacent enemy military units", () => {
    const p1 = makePlayer("p1", "AMULONITES", []);
    const p2 = makePlayer("p2", "NEPHITES", []);
    p2.citiesOwned = ["city-2"];

    const taskmaster = makeUnit("t1", "taskmaster", "p1", { q: 0, r: 0, s: 0 });
    const enemyWarrior = makeUnit("e1", "warrior", "p2", { q: 1, r: 0, s: -1 });
    const enemyMissionary = makeUnit("e2", "missionary", "p2", { q: 0, r: 1, s: -1 });

    const state: GameState = {
      id: "g-aura",
      rngSeed: 7130,
      currentPlayerIndex: 0,
      turn: 1,
      phase: "playing",
      winner: undefined,
      visibility: undefined,
      map: {
        width: 5,
        height: 5,
        tiles: [
          { coordinate: { q: 0, r: 0, s: 0 }, terrain: "plains", resources: [], hasCity: true, cityOwner: "p1", exploredBy: ["p1", "p2"] },
          { coordinate: { q: 1, r: 0, s: -1 }, terrain: "plains", resources: [], hasCity: false, exploredBy: ["p1", "p2"] },
          { coordinate: { q: 0, r: 1, s: -1 }, terrain: "plains", resources: [], hasCity: false, exploredBy: ["p1", "p2"] },
        ],
      },
      players: [p1, p2],
      units: [taskmaster, enemyWarrior, enemyMissionary],
      cities: [
        {
          id: "city-1",
          name: "Amulon",
          coordinate: { q: 0, r: 0, s: 0 },
          ownerId: "p1",
          population: 1,
          maxPopulation: 4,
          level: 1,
          starProduction: 0,
          unrestTurns: 0,
          improvements: [],
          structures: [],
          harvestedResources: [],
        },
        {
          id: "city-2",
          name: "Zarahemla",
          coordinate: { q: 2, r: 0, s: -2 },
          ownerId: "p2",
          population: 1,
          maxPopulation: 4,
          level: 1,
          starProduction: 0,
          unrestTurns: 0,
          improvements: [],
          structures: [],
          harvestedResources: [],
        },
      ],
      improvements: [],
      structures: [],
    };

    const after = resolveActionState(
      state,
      { type: "END_TURN", payload: { playerId: "p1" } } as any
    );

    const warriorAfter = after.units.find(u => u.id === "e1");
    const missionaryAfter = after.units.find(u => u.id === "e2");
    expect(warriorAfter?.statusEffects?.some((e: any) => e.type === "INTIMIDATED")).toBe(true);
    expect(
      missionaryAfter?.statusEffects?.some((e: any) => e.type === "INTIMIDATED") ?? false
    ).toBe(false);

    const resolution = after.lastAction as any;
    expect(resolution?.type).toBe("END_TURN_RESOLUTION");
    const events: any[] = resolution?.payload?.events || [];
    const aura = events.find((e: any) => e?.type === "INTIMIDATION_AURA");
    expect(aura).toBeDefined();
    expect(aura.payload.attackPenalty).toBe(1);
    expect(aura.payload.durationTurns).toBe(1);
    const affectedForP2 = aura.payload.affected.find((entry: any) => entry.playerId === "p2");
    expect(affectedForP2.unitIds).toContain("e1");
    expect(affectedForP2.unitIds).not.toContain("e2");
  });
});
