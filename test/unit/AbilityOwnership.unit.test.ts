import { describe, expect, it } from "vitest";

import { handleUseAbility } from "../../shared/logic/actions/abilities";
import { getFactionAbilityAvailability } from "../../shared/logic/factionAbilityAvailability";
import { resolveActionState } from "../../shared/logic/resolveAction";
import { subscribeTelemetry } from "../../shared/logic/telemetry";
import type { TelemetryEvent } from "../../shared/logic/telemetry";
import type { GameState, PlayerState } from "../../shared/types/game";
import type { Unit } from "../../shared/types/unit";

const createPlayer = (overrides: Partial<PlayerState> = {}): PlayerState => ({
  id: "player1",
  name: "Player One",
  factionId: "NEPHITES",
  isAI: false,
  aiDifficulty: undefined,
  stars: 10,
  stats: { faith: 90, pride: 20, internalDissent: 10 },
  modifiers: [],
  researchedTechs: [],
  currentResearch: undefined,
  researchProgress: 0,
  researchInspiration: 0,
  abilityCooldowns: {},
  citiesOwned: [],
  constructionQueue: [],
  visibilityMask: [],
  exploredTiles: [],
  isEliminated: false,
  turnOrder: 0,
  atWarWith: [],
  alliedWith: [],
  tradeRoutes: [],
  diplomaticCooldowns: {
    declareWar: 0,
    formAlliance: 0,
    breakAlliance: 0,
    requestTrade: 0,
  },
  ...overrides,
});

const createUnit = (overrides: Partial<Unit> = {}): Unit => ({
  id: "unit1",
  type: "missionary",
  playerId: "player1",
  coordinate: { q: 0, r: 0, s: 0 },
  hp: 18,
  currentHp: undefined,
  maxHp: 18,
  attack: 1,
  defense: 2,
  movement: 3,
  remainingMovement: 3,
  maxActions: 1,
  actionsRemaining: 1,
  status: "active",
  statusEffects: [],
  rallyBuff: undefined,
  tacticalCommand: undefined,
  abilities: ["heal", "convert"],
  level: 1,
  experience: 0,
  visionRadius: 2,
  attackRange: 1,
  upgrades: undefined,
  hasAttacked: false,
  ...overrides,
});

const createState = (players: PlayerState[], units: Unit[]): GameState => ({
  id: "ability-ownership-test",
  rngSeed: 1,
  players,
  currentPlayerIndex: 0,
  turn: 1,
  phase: "playing",
  map: {
    width: 4,
    height: 4,
    tiles: [
      { coordinate: { q: 0, r: 0, s: 0 }, terrain: "plains", resources: [], hasCity: false, exploredBy: ["player1"] },
      { coordinate: { q: 1, r: 0, s: -1 }, terrain: "plains", resources: [], hasCity: false, exploredBy: ["player1"] },
    ],
  },
  visibility: {},
  units,
  cities: [],
  improvements: [],
  structures: [],
  lastAction: undefined,
  winner: undefined,
  victoryType: undefined,
});

function collectTelemetry(run: () => GameState): { result: GameState; events: TelemetryEvent[] } {
  const events: TelemetryEvent[] = [];
  const unsubscribe = subscribeTelemetry((event) => events.push(event));

  try {
    return { result: run(), events };
  } finally {
    unsubscribe();
  }
}

describe("Ability ownership enforcement", () => {
  it("blocks faction abilities that are not on the player's faction definition", () => {
    const state = createState([createPlayer()], []);

    const { result, events } = collectTelemetry(() =>
      resolveActionState(state, {
        type: "ACTIVATE_FACTION_ABILITY",
        payload: { playerId: "player1", abilityId: "RAMEUMPTOM" },
      })
    );

    expect(result).toBe(state);
    expect(
      events.some(
        (event) =>
          event.channel === "ability" &&
          event.status === "blocked" &&
          event.abilityId === "RAMEUMPTOM" &&
          event.reason === "not_owned"
      )
    ).toBe(true);
  });

  it("blocks passive faction abilities from manual activation", () => {
    const state = createState([createPlayer()], []);

    const { result, events } = collectTelemetry(() =>
      resolveActionState(state, {
        type: "ACTIVATE_FACTION_ABILITY",
        payload: { playerId: "player1", abilityId: "RIGHTEOUS_DEFENSE" },
      })
    );

    expect(result).toBe(state);
    expect(
      events.some(
        (event) =>
          event.channel === "ability" &&
          event.status === "blocked" &&
          event.abilityId === "RIGHTEOUS_DEFENSE" &&
          event.reason === "passive_only"
      )
    ).toBe(true);
  });

  it("blocks design-pending active faction abilities before resolver side effects", () => {
    const player = createPlayer({
      factionId: "MULEKITES",
      stats: { faith: 90, pride: 10, internalDissent: 5 },
    });
    const state = createState([player], []);

    const availability = getFactionAbilityAvailability(state, "player1", "CULTURAL_RECLAMATION");
    expect(availability.available).toBe(false);
    if (!availability.available) {
      expect(availability.reason).toBe("design_pending");
    }

    const { result, events } = collectTelemetry(() =>
      resolveActionState(state, {
        type: "USE_ABILITY",
        payload: { playerId: "player1", abilityId: "CULTURAL_RECLAMATION" },
      })
    );

    expect(result).toBe(state);
    expect(result.players[0].abilityCooldowns?.CULTURAL_RECLAMATION).toBeUndefined();
    expect(
      events.some(
        (event) =>
          event.channel === "ability" &&
          event.status === "blocked" &&
          event.abilityId === "CULTURAL_RECLAMATION" &&
          event.reason === "design_pending"
      )
    ).toBe(true);
  });

  it("blocks Missionary Zeal until a missionary source and enemy military target exist", () => {
    const player = createPlayer({
      factionId: "ANTI_NEPHI_LEHIES",
      stats: { faith: 90, pride: 10, internalDissent: 5 },
    });

    const noSourceState = createState([player], []);
    const noSource = getFactionAbilityAvailability(noSourceState, "player1", "MISSIONARY_ZEAL");
    expect(noSource.available).toBe(false);
    if (!noSource.available) {
      expect(noSource.reason).toBe("no_valid_source");
    }

    const noTargetState = createState([player], [createUnit({ id: "missionary1", type: "missionary" })]);
    const noTarget = getFactionAbilityAvailability(noTargetState, "player1", "MISSIONARY_ZEAL");
    expect(noTarget.available).toBe(false);
    if (!noTarget.available) {
      expect(noTarget.reason).toBe("no_valid_targets");
    }

    const hiddenTargetState = createState([
      createPlayer({
        factionId: "ANTI_NEPHI_LEHIES",
        stats: { faith: 90, pride: 10, internalDissent: 5 },
        visibilityMask: ["0,0"],
      }),
      createPlayer({
        id: "player2",
        name: "Player Two",
        factionId: "LAMANITES",
        turnOrder: 1,
      }),
    ], [
      createUnit({ id: "missionary1", type: "missionary" }),
      createUnit({ id: "enemy1", type: "warrior", playerId: "player2", coordinate: { q: 1, r: 0, s: -1 } }),
    ]);
    const hiddenTarget = getFactionAbilityAvailability(hiddenTargetState, "player1", "MISSIONARY_ZEAL");
    expect(hiddenTarget.available).toBe(false);
    if (!hiddenTarget.available) {
      expect(hiddenTarget.reason).toBe("no_valid_targets");
    }

    const alliedTargetState = createState([
      createPlayer({
        factionId: "ANTI_NEPHI_LEHIES",
        stats: { faith: 90, pride: 10, internalDissent: 5 },
        alliedWith: ["player2"],
      }),
      createPlayer({
        id: "player2",
        name: "Player Two",
        factionId: "LAMANITES",
        turnOrder: 1,
        alliedWith: ["player1"],
      }),
    ], [
      createUnit({ id: "missionary1", type: "missionary" }),
      createUnit({ id: "ally1", type: "warrior", playerId: "player2", coordinate: { q: 1, r: 0, s: -1 } }),
    ]);
    const alliedTarget = getFactionAbilityAvailability(alliedTargetState, "player1", "MISSIONARY_ZEAL");
    expect(alliedTarget.available).toBe(false);
    if (!alliedTarget.available) {
      expect(alliedTarget.reason).toBe("no_valid_targets");
    }
  });

  it("blocks active faction abilities outside the owning player's turn", () => {
    const state = createState([
      createPlayer({ id: "player1", turnOrder: 0 }),
      createPlayer({
        id: "player2",
        name: "Player Two",
        factionId: "ZORAMITES",
        stats: { faith: 20, pride: 80, internalDissent: 5 },
        turnOrder: 1,
      }),
    ], []);

    const availability = getFactionAbilityAvailability(state, "player2", "RAMEUMPTOM");
    expect(availability.available).toBe(false);
    if (!availability.available) {
      expect(availability.reason).toBe("not_current_turn");
    }
  });

  it("blocks unit abilities that the acting unit does not own", () => {
    const unit = createUnit({ id: "missionary1" });
    const state = createState([createPlayer()], [unit]);

    const { result, events } = collectTelemetry(() =>
      handleUseAbility(state, {
        playerId: "player1",
        unitId: "missionary1",
        abilityId: "DIVINE_WARD",
      })
    );

    expect(result).toBe(state);
    expect(
      events.some(
        (event) =>
          event.channel === "ability" &&
          event.status === "blocked" &&
          event.abilityId === "DIVINE_WARD" &&
          event.reason === "not_owned"
      )
    ).toBe(true);
  });

  it("blocks passive unit abilities from manual activation", () => {
    const commander = createUnit({
      id: "commander1",
      type: "commander",
      abilities: ["rally_troops", "NAVAL_COMMAND", "LEADERSHIP"],
    });
    const state = createState([createPlayer()], [commander]);

    const { result, events } = collectTelemetry(() =>
      handleUseAbility(state, {
        playerId: "player1",
        unitId: "commander1",
        abilityId: "LEADERSHIP",
      })
    );

    expect(result).toBe(state);
    expect(
      events.some(
        (event) =>
          event.channel === "ability" &&
          event.status === "blocked" &&
          event.abilityId === "LEADERSHIP" &&
          event.reason === "passive_only"
      )
    ).toBe(true);
  });
});
