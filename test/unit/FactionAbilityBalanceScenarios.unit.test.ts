import { describe, expect, it } from 'vitest';

import { IMPLEMENTED_ACTIVE_FACTION_ABILITY_IDS } from '../../shared/data/factionAbilitySpecs';
import { GAME_RULES } from '../../shared/data/gameRules';
import { getUnitDefinition } from '../../shared/data/units';
import { calculatePlayerStarIncome } from '../../shared/logic/actions/turns';
import { computeEffectiveStats } from '../../shared/logic/computeEffectiveStats';
import { computeUnitConversionChance } from '../../shared/logic/conversion';
import { getFactionAbilityAvailability, type FactionAbilityAvailabilityReason } from '../../shared/logic/factionAbilityAvailability';
import { resolveActionState } from '../../shared/logic/resolveAction';
import type { FactionId } from '../../shared/types/factionId';
import type { GameState, PlayerState } from '../../shared/types/game';
import type { Unit, UnitType } from '../../shared/types/unit';

type AbilityScenario = {
  state: GameState;
  expectedBlockReason?: FactionAbilityAvailabilityReason;
  assert: (before: GameState, after: GameState) => void;
};

type AbilityScenarioSet = {
  ideal: () => AbilityScenario;
  blocked: () => AbilityScenario;
  marginal: () => AbilityScenario;
};

const ACTIVE_ABILITY_IDS = [
  'ANCIENT_MIGHT',
  'COVENANT_OF_PEACE',
  'CULTURAL_RECLAMATION',
  'MISSIONARY_ZEAL',
  'RAMEUMPTOM',
  'TITLE_OF_LIBERTY',
  'WARRIOR_RAGE',
  'lamanite_guerrilla_tactics',
].sort();

const makePlayer = (overrides: Partial<PlayerState> = {}): PlayerState => ({
  id: 'player1',
  name: 'Player One',
  factionId: 'NEPHITES',
  isAI: false,
  aiDifficulty: undefined,
  stars: 20,
  stats: { faith: 90, pride: 20, internalDissent: 10 },
  modifiers: [],
  researchedTechs: [],
  researchInspiration: 0,
  abilityCooldowns: {},
  citiesOwned: ['city1'],
  constructionQueue: [],
  visibilityMask: ['0,0', '1,0', '2,0', '0,1', '1,1'],
  exploredTiles: ['0,0', '1,0', '2,0', '0,1', '1,1'],
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

const playerFor = (
  factionId: FactionId,
  stats: PlayerState['stats'],
  overrides: Partial<PlayerState> = {}
) => makePlayer({ factionId, stats, ...overrides });

const makeUnit = (overrides: Partial<Unit> = {}): Unit => ({
  id: 'unit1',
  type: 'warrior',
  playerId: 'player1',
  coordinate: { q: 0, r: 0, s: 0 },
  hp: 25,
  maxHp: 25,
  attack: 6,
  defense: 4,
  movement: 3,
  remainingMovement: 3,
  visionRadius: 2,
  attackRange: 1,
  status: 'active',
  experience: 0,
  abilities: [],
  level: 1,
  temporaryEffects: [],
  ...overrides,
});

const ownUnit = (id: string, type: UnitType = 'warrior', q = 0, r = 0) =>
  makeUnit({ id, type, playerId: 'player1', coordinate: { q, r, s: -q - r } });

const enemyUnit = (id: string, q: number, r: number, overrides: Partial<Unit> = {}) =>
  makeUnit({
    id,
    playerId: 'player2',
    coordinate: { q, r, s: -q - r },
    ...overrides,
  });

const makeTile = (
  q: number,
  r: number,
  options: Partial<GameState['map']['tiles'][number]> = {}
): GameState['map']['tiles'][number] => ({
  coordinate: { q, r, s: -q - r },
  terrain: 'plains',
  resources: [],
  hasCity: q === 0 && r === 0,
  cityOwner: q === 0 && r === 0 ? 'player1' : undefined,
  exploredBy: ['player1'],
  ...options,
});

const makeCity = (
  ownerId: string,
  coordinate = { q: 0, r: 0, s: 0 },
  starProduction = 6
): NonNullable<GameState['cities']>[number] => ({
  id: 'city1',
  name: 'Capital',
  coordinate,
  ownerId,
  population: 1,
  maxPopulation: 4,
  level: 1,
  starProduction,
  improvements: [],
  structures: [],
});

const makeState = (
  player: PlayerState,
  units: Unit[],
  overrides: Partial<GameState> = {}
): GameState => ({
  id: 'faction-ability-balance-scenario',
  rngSeed: 1,
  players: [
    player,
    makePlayer({
      id: 'player2',
      name: 'Opponent',
      factionId: 'LAMANITES',
      isAI: false,
      aiDifficulty: undefined,
      stats: { faith: 30, pride: 45, internalDissent: 20 },
      citiesOwned: [],
      visibilityMask: [],
      exploredTiles: [],
      turnOrder: 1,
      atWarWith: [player.id],
    }),
  ],
  units,
  currentPlayerIndex: 0,
  turn: 1,
  phase: 'playing',
  map: {
    width: 4,
    height: 4,
    tiles: [
      makeTile(0, 0),
      makeTile(1, 0),
      makeTile(2, 0),
      makeTile(0, 1),
      makeTile(1, 1),
    ],
  },
  cities: [makeCity(player.id)],
  improvements: [],
  structures: [],
  lastAction: undefined,
  winner: undefined,
  ...overrides,
});

const useAbility = (state: GameState, abilityId: string): GameState =>
  resolveActionState(state, {
    type: 'USE_ABILITY',
    payload: { playerId: 'player1', abilityId },
  });

const findPlayer = (state: GameState) => state.players.find(player => player.id === 'player1')!;
const findUnit = (state: GameState, id: string) => state.units.find(unit => unit.id === id)!;

const expectCooldown = (state: GameState, abilityId: string, cooldown: number) => {
  expect(findPlayer(state).abilityCooldowns?.[abilityId]).toBe(cooldown);
};

const hasActiveEffect = (state: GameState, abilityId: string): boolean =>
  Boolean(state.activeEffects?.some(effect => effect.source.abilityId === abilityId));

const expectStatusEffect = (unit: Unit, type: string) => {
  expect((unit.statusEffects ?? []).some(effect => effect?.type === type)).toBe(true);
};

const titleState = (faith: number, unitCount = 3) => {
  const player = playerFor('NEPHITES', { faith, pride: 20, internalDissent: 10 });
  const units = [
    ownUnit('n1'),
    ...(unitCount >= 2 ? [ownUnit('n2', 'warrior', 1, 0)] : []),
    ...(unitCount >= 3 ? [ownUnit('n3', 'warrior', 0, 1)] : []),
  ];
  return makeState(player, units);
};

const rageState = (pride: number, unitCount = 2) => {
  const player = playerFor('LAMANITES', { faith: 20, pride, internalDissent: 10 });
  const units = [
    ownUnit('l1'),
    ...(unitCount >= 2 ? [ownUnit('l2', 'warrior', 1, 0)] : []),
  ];
  return makeState(player, units);
};

const guerrillaState = (inForest: boolean) => {
  const player = playerFor('LAMANITES', { faith: 20, pride: 45, internalDissent: 10 });
  return makeState(player, [
    ownUnit('hunter', 'wilderness_hunter'),
  ], {
    map: {
      width: 4,
      height: 4,
      tiles: [makeTile(0, 0, { terrain: inForest ? 'forest' : 'plains' }), makeTile(1, 0)],
    },
  });
};

const covenantState = (faith: number, enemyFaith: number) => {
  const player = playerFor('ANTI_NEPHI_LEHIES', { faith, pride: 10, internalDissent: 5 });
  const opponent = makePlayer({
    id: 'player2',
    name: 'Opponent',
    factionId: 'LAMANITES',
    isAI: false,
    stats: { faith: enemyFaith, pride: 45, internalDissent: 20 },
    citiesOwned: [],
    turnOrder: 1,
  });
  return makeState(player, [
    ownUnit('missionary', 'missionary'),
    enemyUnit('enemy1', 1, 0, { hp: 8 }),
  ], { players: [player, opponent] });
};

const missionaryZealState = (faith: number, hasMissionary = true, enemyCount = 2) => {
  const player = playerFor('ANTI_NEPHI_LEHIES', { faith, pride: 10, internalDissent: 5 });
  return makeState(player, [
    hasMissionary ? ownUnit('missionary', 'missionary') : ownUnit('warrior'),
    enemyUnit('enemy1', 1, 0),
    ...(enemyCount >= 2 ? [enemyUnit('enemy2', 2, 0)] : []),
  ]);
};

const culturalState = (faith: number, enemyCount = 2) => {
  const player = playerFor('MULEKITES', { faith, pride: 20, internalDissent: 5 });
  const opponent = makePlayer({
    id: 'player2',
    name: 'Opponent',
    factionId: 'LAMANITES',
    isAI: false,
    stats: { faith: 65, pride: 45, internalDissent: 20 },
    citiesOwned: [],
    turnOrder: 1,
    atWarWith: [player.id],
  });
  return makeState(player, [
    ...(enemyCount >= 1 ? [enemyUnit('enemy1', 1, 0)] : []),
    ...(enemyCount >= 2 ? [enemyUnit('enemy2', 2, 0, { hp: 10 })] : []),
  ], { players: [player, opponent] });
};

const rameumptomState = (pride: number, dissent = 20) => {
  const player = playerFor('ZORAMITES', { faith: 20, pride, internalDissent: dissent }, { stars: 16 });
  return makeState(player, []);
};

const ancientMightState = (pride: number, unitCount = 3) => {
  const player = playerFor('JAREDITES', { faith: 25, pride, internalDissent: 10 });
  const units = [
    ...(unitCount >= 1 ? [ownUnit('j1')] : []),
    ...(unitCount >= 2 ? [ownUnit('j2', 'warrior', 1, 0)] : []),
    ...(unitCount >= 3 ? [ownUnit('j3', 'warrior', 0, 1)] : []),
  ];
  return makeState(player, units);
};

const BALANCE_SCENARIOS: Record<string, AbilityScenarioSet> = {
  TITLE_OF_LIBERTY: {
    ideal: () => ({
      state: titleState(90),
      assert: (before, after) => {
        expect(hasActiveEffect(after, 'TITLE_OF_LIBERTY')).toBe(true);
        expect(findPlayer(after).stats.faith).toBe(findPlayer(before).stats.faith - 50);
        expectCooldown(after, 'TITLE_OF_LIBERTY', 8);
        expect(computeEffectiveStats(findUnit(after, 'n1'), after, { role: 'attacker' }).attack).toBeGreaterThan(findUnit(before, 'n1').attack);
        expect(computeEffectiveStats(findUnit(after, 'n1'), after, { role: 'defender' }).defense).toBeGreaterThan(findUnit(before, 'n1').defense);
      },
    }),
    blocked: () => ({
      state: titleState(69),
      expectedBlockReason: 'requirements',
      assert: (_before, after) => {
        expect(findPlayer(after).abilityCooldowns?.TITLE_OF_LIBERTY).toBeUndefined();
      },
    }),
    marginal: () => ({
      state: titleState(70, 1),
      assert: (_before, after) => {
        expect(hasActiveEffect(after, 'TITLE_OF_LIBERTY')).toBe(true);
        expect(findPlayer(after).stats.faith).toBe(20);
      },
    }),
  },
  WARRIOR_RAGE: {
    ideal: () => ({
      state: rageState(70),
      assert: (before, after) => {
        const beforeDefense = computeEffectiveStats(findUnit(before, 'l1'), before, { role: 'defender' }).defense;
        expect(hasActiveEffect(after, 'WARRIOR_RAGE')).toBe(true);
        expectCooldown(after, 'WARRIOR_RAGE', 6);
        expect(computeEffectiveStats(findUnit(after, 'l1'), after, { role: 'attacker' }).attack).toBe(findUnit(before, 'l1').attack + 3);
        expect(computeEffectiveStats(findUnit(after, 'l1'), after, { role: 'defender' }).defense).toBe(beforeDefense - 1);
      },
    }),
    blocked: () => ({
      state: rageState(59),
      expectedBlockReason: 'requirements',
      assert: (_before, after) => {
        expect(findPlayer(after).abilityCooldowns?.WARRIOR_RAGE).toBeUndefined();
      },
    }),
    marginal: () => ({
      state: rageState(60, 1),
      assert: (_before, after) => {
        expect(hasActiveEffect(after, 'WARRIOR_RAGE')).toBe(true);
      },
    }),
  },
  lamanite_guerrilla_tactics: {
    ideal: () => ({
      state: guerrillaState(true),
      assert: (before, after) => {
        const baseDefense = getUnitDefinition('wilderness_hunter').baseStats.defense;
        expect(findUnit(after, 'hunter').defense).toBe(baseDefense + GAME_RULES.abilities.attackBonuses.guerrillaBonus);
        expect(findUnit(after, 'hunter').defense).toBeGreaterThan(findUnit(before, 'hunter').defense);
      },
    }),
    blocked: () => ({
      state: guerrillaState(false),
      expectedBlockReason: 'no_valid_targets',
      assert: (_before, after) => {
        expect(findPlayer(after).abilityCooldowns?.lamanite_guerrilla_tactics).toBeUndefined();
      },
    }),
    marginal: () => ({
      state: guerrillaState(true),
      assert: (_before, after) => {
        const rebuffed = useAbility(after, 'lamanite_guerrilla_tactics');
        expect(findUnit(rebuffed, 'hunter').defense).toBe(findUnit(after, 'hunter').defense);
      },
    }),
  },
  COVENANT_OF_PEACE: {
    ideal: () => ({
      state: covenantState(85, 40),
      assert: (before, after) => {
        expect(findUnit(after, 'enemy1').playerId).toBe('player1');
        expect(findPlayer(after).stats.faith).toBe(findPlayer(before).stats.faith - GAME_RULES.abilities.resourceCosts.covenantOfPeace);
        expectCooldown(after, 'COVENANT_OF_PEACE', 6);
      },
    }),
    blocked: () => ({
      state: covenantState(15, 10),
      expectedBlockReason: 'no_valid_targets',
      assert: (_before, after) => {
        expect(findUnit(after, 'enemy1').playerId).toBe('player2');
      },
    }),
    marginal: () => ({
      state: covenantState(55, 45),
      assert: (_before, after) => {
        expect(findUnit(after, 'enemy1').playerId).toBe('player1');
        expect(findPlayer(after).stats.faith).toBe(40);
      },
    }),
  },
  MISSIONARY_ZEAL: {
    ideal: () => ({
      state: missionaryZealState(95),
      assert: (before, after) => {
        expectStatusEffect(findUnit(after, 'enemy1'), 'TESTIMONY_PRESSURE');
        expectStatusEffect(findUnit(after, 'enemy2'), 'TESTIMONY_PRESSURE');
        expect(findPlayer(after).stats.faith).toBe(findPlayer(before).stats.faith - 40);
        expectCooldown(after, 'MISSIONARY_ZEAL', 7);
      },
    }),
    blocked: () => ({
      state: missionaryZealState(95, false),
      expectedBlockReason: 'no_valid_source',
      assert: (_before, after) => {
        expect(findUnit(after, 'enemy1').statusEffects ?? []).toHaveLength(0);
      },
    }),
    marginal: () => ({
      state: missionaryZealState(80, true, 1),
      assert: (_before, after) => {
        expectStatusEffect(findUnit(after, 'enemy1'), 'TESTIMONY_PRESSURE');
        expect(findPlayer(after).stats.faith).toBe(40);
      },
    }),
  },
  CULTURAL_RECLAMATION: {
    ideal: () => ({
      state: culturalState(70),
      assert: (before, after) => {
        const beforeChance = computeUnitConversionChance(findPlayer(before), before.players[1], findUnit(before, 'enemy1'));
        const pressureOnlyChance = computeUnitConversionChance(findPlayer(before), before.players[1], findUnit(after, 'enemy1'));
        const immediatePostCostChance = computeUnitConversionChance(findPlayer(after), after.players[1], findUnit(after, 'enemy1'));
        expectStatusEffect(findUnit(after, 'enemy1'), 'CULTURAL_PRESSURE');
        expectStatusEffect(findUnit(after, 'enemy2'), 'CULTURAL_PRESSURE');
        expect(pressureOnlyChance).toBeGreaterThan(beforeChance);
        expect(immediatePostCostChance).toBeGreaterThan(0);
        expect(findPlayer(after).stats.faith).toBe(findPlayer(before).stats.faith - GAME_RULES.abilities.factionActive.culturalReclamation.faithCost);
        expectCooldown(after, 'CULTURAL_RECLAMATION', GAME_RULES.abilities.factionActive.culturalReclamation.cooldown);
      },
    }),
    blocked: () => ({
      state: culturalState(40, 0),
      expectedBlockReason: 'no_valid_targets',
      assert: (_before, after) => {
        expect(findPlayer(after).abilityCooldowns?.CULTURAL_RECLAMATION).toBeUndefined();
      },
    }),
    marginal: () => ({
      state: culturalState(40, 1),
      assert: (_before, after) => {
        expectStatusEffect(findUnit(after, 'enemy1'), 'CULTURAL_PRESSURE');
        expect(findPlayer(after).stats.faith).toBe(10);
      },
    }),
  },
  RAMEUMPTOM: {
    ideal: () => ({
      state: rameumptomState(80),
      assert: (before, after) => {
        expect(hasActiveEffect(after, 'RAMEUMPTOM')).toBe(true);
        expect(findPlayer(after).stats.internalDissent).toBe(findPlayer(before).stats.internalDissent + 20);
        expect(calculatePlayerStarIncome(after, findPlayer(after))).toBeGreaterThan(calculatePlayerStarIncome(before, findPlayer(before)));
        expectCooldown(after, 'RAMEUMPTOM', 12);
      },
    }),
    blocked: () => ({
      state: rameumptomState(69),
      expectedBlockReason: 'requirements',
      assert: (_before, after) => {
        expect(findPlayer(after).abilityCooldowns?.RAMEUMPTOM).toBeUndefined();
      },
    }),
    marginal: () => ({
      state: rameumptomState(70, 80),
      assert: (_before, after) => {
        expect(hasActiveEffect(after, 'RAMEUMPTOM')).toBe(true);
        expect(findPlayer(after).stats.internalDissent).toBe(100);
      },
    }),
  },
  ANCIENT_MIGHT: {
    ideal: () => ({
      state: ancientMightState(70),
      assert: (before, after) => {
        expect(hasActiveEffect(after, 'ANCIENT_MIGHT')).toBe(true);
        expect(computeEffectiveStats(findUnit(after, 'j1'), after, { role: 'attacker' }).attack).toBe(findUnit(before, 'j1').attack + GAME_RULES.abilities.factionActive.ancientMight.attackBonus);
        expect(computeEffectiveStats(findUnit(after, 'j1'), after, { role: 'defender' }).defense).toBe(findUnit(before, 'j1').defense + GAME_RULES.abilities.factionActive.ancientMight.defenseBonus);
        expect(findPlayer(after).stats.pride).toBe(findPlayer(before).stats.pride + GAME_RULES.abilities.factionActive.ancientMight.immediatePride);
        expectCooldown(after, 'ANCIENT_MIGHT', GAME_RULES.abilities.factionActive.ancientMight.cooldown);
      },
    }),
    blocked: () => ({
      state: ancientMightState(60, 0),
      expectedBlockReason: 'no_valid_targets',
      assert: (_before, after) => {
        expect(findPlayer(after).abilityCooldowns?.ANCIENT_MIGHT).toBeUndefined();
      },
    }),
    marginal: () => ({
      state: ancientMightState(60, 1),
      assert: (_before, after) => {
        expect(hasActiveEffect(after, 'ANCIENT_MIGHT')).toBe(true);
        expect(findPlayer(after).stats.pride).toBe(70);
      },
    }),
  },
};

describe('Faction ability deterministic balance scenarios', () => {
  it('keeps ideal, blocked, and marginal scenarios for every implemented active faction ability', () => {
    expect(Object.keys(BALANCE_SCENARIOS).sort()).toEqual(ACTIVE_ABILITY_IDS);
    expect([...IMPLEMENTED_ACTIVE_FACTION_ABILITY_IDS].sort()).toEqual(ACTIVE_ABILITY_IDS);
  });

  it.each(Object.entries(BALANCE_SCENARIOS))('%s has an ideal-use scenario with a deterministic effect', (abilityId, scenarios) => {
    const scenario = scenarios.ideal();
    const after = useAbility(scenario.state, abilityId);

    expect(after).not.toBe(scenario.state);
    scenario.assert(scenario.state, after);
  });

  it.each(Object.entries(BALANCE_SCENARIOS))('%s has a blocked-use scenario that cannot sneak through', (abilityId, scenarios) => {
    const scenario = scenarios.blocked();
    const availability = getFactionAbilityAvailability(scenario.state, 'player1', abilityId);

    expect(availability.available).toBe(false);
    if (!availability.available && scenario.expectedBlockReason) {
      expect(availability.reason).toBe(scenario.expectedBlockReason);
    }

    const after = useAbility(scenario.state, abilityId);
    expect(after).toBe(scenario.state);
    scenario.assert(scenario.state, after);
  });

  it.each(Object.entries(BALANCE_SCENARIOS))('%s has a marginal-use scenario at its minimum useful threshold', (abilityId, scenarios) => {
    const scenario = scenarios.marginal();
    const availability = getFactionAbilityAvailability(scenario.state, 'player1', abilityId);

    expect(availability.available).toBe(true);

    const after = useAbility(scenario.state, abilityId);
    expect(after).not.toBe(scenario.state);
    scenario.assert(scenario.state, after);
  });
});
