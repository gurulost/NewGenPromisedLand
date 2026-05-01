import { describe, expect, it } from 'vitest';

import { evaluateAIFactionAbilityUsage } from '../../shared/ai/factionAbilityHeuristics';
import { IMPLEMENTED_ACTIVE_FACTION_ABILITY_IDS } from '../../shared/data/factionAbilitySpecs';
import type { FactionId } from '../../shared/types/factionId';
import type { GameState, PlayerState } from '../../shared/types/game';
import type { Unit, UnitType } from '../../shared/types/unit';

type AbilityScenario = {
  player: PlayerState;
  state: GameState;
};

type AIAbilityScenario = {
  use: () => AbilityScenario;
  skip: () => AbilityScenario;
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
  name: 'AI Player',
  factionId: 'MULEKITES',
  isAI: true,
  aiDifficulty: 'normal',
  stars: 20,
  stats: { faith: 90, pride: 40, internalDissent: 10 },
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
  coordinate = { q: 0, r: 0, s: 0 }
): NonNullable<GameState['cities']>[number] => ({
  id: 'city1',
  name: 'Capital',
  coordinate,
  ownerId,
  population: 1,
  maxPopulation: 4,
  level: 1,
  starProduction: 2,
  improvements: [],
  structures: [],
});

const makeState = (
  player: PlayerState,
  units: Unit[],
  overrides: Partial<GameState> = {}
): GameState => ({
  id: 'ai-faction-ability-heuristics',
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

const playerFor = (
  factionId: FactionId,
  stats: PlayerState['stats'],
  overrides: Partial<PlayerState> = {}
) => makePlayer({ factionId, stats, ...overrides });

const ownUnit = (id: string, type: UnitType = 'warrior', q = 0, r = 0) =>
  makeUnit({ id, type, playerId: 'player1', coordinate: { q, r, s: -q - r } });

const enemyUnit = (id: string, q: number, r: number, overrides: Partial<Unit> = {}) =>
  makeUnit({
    id,
    playerId: 'player2',
    coordinate: { q, r, s: -q - r },
    ...overrides,
  });

const hasDecision = (scenario: AbilityScenario, abilityId: string): boolean =>
  evaluateAIFactionAbilityUsage(scenario.state, scenario.player)
    .some(decision => decision.abilityId === abilityId);

const AI_ABILITY_SCENARIOS: Record<string, AIAbilityScenario> = {
  TITLE_OF_LIBERTY: {
    use: () => {
      const player = playerFor('NEPHITES', { faith: 90, pride: 20, internalDissent: 10 });
      const state = makeState(player, [
        ownUnit('n1'),
        ownUnit('n2', 'warrior', 1, 0),
        ownUnit('n3', 'warrior', 0, 1),
        enemyUnit('enemy1', 2, 0),
      ]);
      return { player, state };
    },
    skip: () => {
      const player = playerFor('NEPHITES', { faith: 69, pride: 20, internalDissent: 10 });
      const state = makeState(player, [
        ownUnit('n1'),
        ownUnit('n2', 'warrior', 1, 0),
        ownUnit('n3', 'warrior', 0, 1),
        enemyUnit('enemy1', 2, 0),
      ]);
      return { player, state };
    },
  },
  WARRIOR_RAGE: {
    use: () => {
      const player = playerFor('LAMANITES', { faith: 20, pride: 70, internalDissent: 10 });
      const state = makeState(player, [
        ownUnit('l1'),
        ownUnit('l2', 'warrior', 1, 0),
        enemyUnit('enemy1', 2, 0),
      ]);
      return { player, state };
    },
    skip: () => {
      const player = playerFor('LAMANITES', { faith: 20, pride: 59, internalDissent: 10 });
      const state = makeState(player, [
        ownUnit('l1'),
        ownUnit('l2', 'warrior', 1, 0),
        enemyUnit('enemy1', 2, 0),
      ]);
      return { player, state };
    },
  },
  lamanite_guerrilla_tactics: {
    use: () => {
      const player = playerFor('LAMANITES', { faith: 20, pride: 45, internalDissent: 10 });
      const state = makeState(player, [ownUnit('hunter', 'wilderness_hunter')], {
        map: {
          width: 4,
          height: 4,
          tiles: [makeTile(0, 0, { terrain: 'forest' }), makeTile(1, 0)],
        },
      });
      return { player, state };
    },
    skip: () => {
      const player = playerFor('LAMANITES', { faith: 20, pride: 45, internalDissent: 10 });
      const state = makeState(player, [ownUnit('hunter', 'wilderness_hunter')]);
      return { player, state };
    },
  },
  COVENANT_OF_PEACE: {
    use: () => {
      const player = playerFor('ANTI_NEPHI_LEHIES', { faith: 85, pride: 10, internalDissent: 5 });
      const state = makeState(player, [
        ownUnit('missionary', 'missionary'),
        enemyUnit('enemy1', 1, 0, { hp: 8 }),
      ]);
      return { player, state };
    },
    skip: () => {
      const player = playerFor('ANTI_NEPHI_LEHIES', { faith: 20, pride: 10, internalDissent: 5 });
      const opponent = makePlayer({
        id: 'player2',
        name: 'Opponent',
        factionId: 'LAMANITES',
        isAI: false,
        stats: { faith: 15, pride: 40, internalDissent: 20 },
        turnOrder: 1,
      });
      const state = makeState(player, [
        ownUnit('missionary', 'missionary'),
        enemyUnit('enemy1', 1, 0, { hp: 8 }),
      ], { players: [player, opponent] });
      return { player, state };
    },
  },
  MISSIONARY_ZEAL: {
    use: () => {
      const player = playerFor('ANTI_NEPHI_LEHIES', { faith: 95, pride: 10, internalDissent: 5 });
      const state = makeState(player, [
        ownUnit('missionary', 'missionary'),
        enemyUnit('enemy1', 1, 0),
        enemyUnit('enemy2', 2, 0),
      ]);
      return { player, state };
    },
    skip: () => {
      const player = playerFor('ANTI_NEPHI_LEHIES', { faith: 95, pride: 10, internalDissent: 5 });
      const state = makeState(player, [
        ownUnit('warrior'),
        enemyUnit('enemy1', 1, 0),
        enemyUnit('enemy2', 2, 0),
      ]);
      return { player, state };
    },
  },
  CULTURAL_RECLAMATION: {
    use: () => {
      const player = playerFor('MULEKITES', { faith: 70, pride: 20, internalDissent: 5 });
      const state = makeState(player, [
        enemyUnit('enemy1', 1, 0),
        enemyUnit('enemy2', 2, 0, { hp: 10 }),
      ]);
      return { player, state };
    },
    skip: () => {
      const player = playerFor('MULEKITES', { faith: 39, pride: 20, internalDissent: 5 });
      const state = makeState(player, [
        enemyUnit('enemy1', 1, 0),
        enemyUnit('enemy2', 2, 0, { hp: 10 }),
      ]);
      return { player, state };
    },
  },
  RAMEUMPTOM: {
    use: () => {
      const player = playerFor('ZORAMITES', { faith: 20, pride: 80, internalDissent: 20 }, { stars: 16 });
      const state = makeState(player, []);
      return { player, state };
    },
    skip: () => {
      const player = playerFor('ZORAMITES', { faith: 20, pride: 80, internalDissent: 80 }, { stars: 16 });
      const state = makeState(player, []);
      return { player, state };
    },
  },
  ANCIENT_MIGHT: {
    use: () => {
      const player = playerFor('JAREDITES', { faith: 25, pride: 70, internalDissent: 10 }, { atWarWith: ['player2'] });
      const state = makeState(player, [
        ownUnit('j1'),
        ownUnit('j2', 'warrior', 1, 0),
        ownUnit('j3', 'warrior', 0, 1),
        enemyUnit('enemy1', 2, 0),
      ]);
      return { player, state };
    },
    skip: () => {
      const player = playerFor('JAREDITES', { faith: 25, pride: 90, internalDissent: 10 }, { atWarWith: ['player2'] });
      const state = makeState(player, [
        ownUnit('j1'),
        ownUnit('j2', 'warrior', 1, 0),
        ownUnit('j3', 'warrior', 0, 1),
        enemyUnit('enemy1', 2, 0),
      ]);
      return { player, state };
    },
  },
};

describe('AI faction ability heuristics', () => {
  it('keeps use and skip scenarios for every implemented active faction ability', () => {
    expect(Object.keys(AI_ABILITY_SCENARIOS).sort()).toEqual(ACTIVE_ABILITY_IDS);
    expect([...IMPLEMENTED_ACTIVE_FACTION_ABILITY_IDS].sort()).toEqual(ACTIVE_ABILITY_IDS);
  });

  it.each(Object.entries(AI_ABILITY_SCENARIOS))('selects %s in its intended AI use scenario', (abilityId, scenario) => {
    expect(hasDecision(scenario.use(), abilityId)).toBe(true);
  });

  it.each(Object.entries(AI_ABILITY_SCENARIOS))('skips %s when its AI use rule or availability is not satisfied', (abilityId, scenario) => {
    expect(hasDecision(scenario.skip(), abilityId)).toBe(false);
  });
});
