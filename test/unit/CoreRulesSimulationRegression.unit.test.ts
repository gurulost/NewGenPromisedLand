import { describe, expect, it } from 'vitest';

import { resolveAction, resolveActionState } from '../../shared/logic/resolveAction';
import { arePlayersHostile, resolveCombat } from '../../shared/logic/combatResolver';
import { GameStateSchema, VictoryTypeSchema, type GameState, type PlayerState } from '../../shared/types/game';
import type { Unit } from '../../shared/types/unit';

const player = (id: string, overrides: Partial<PlayerState> = {}): PlayerState => ({
  id,
  name: id,
  factionId: 'NEPHITES',
  isAI: false,
  aiDifficulty: undefined,
  stars: 20,
  stats: { faith: 80, pride: 20, internalDissent: 0 },
  modifiers: [],
  researchedTechs: [],
  currentResearch: undefined,
  researchProgress: 0,
  researchInspiration: 0,
  abilityCooldowns: {},
  citiesOwned: [`${id}-city`],
  constructionQueue: [],
  visibilityMask: [],
  exploredTiles: [],
  isEliminated: false,
  turnOrder: id === 'p1' ? 0 : 1,
  atWarWith: [],
  alliedWith: [],
  tradeRoutes: [],
  diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
  ...overrides,
});

const unit = (id: string, playerId: string, overrides: Partial<Unit> = {}): Unit => ({
  id,
  type: 'warrior',
  playerId,
  coordinate: { q: 0, r: 0, s: 0 },
  hp: 20,
  maxHp: 20,
  attack: 6,
  defense: 2,
  movement: 2,
  remainingMovement: 2,
  maxActions: 1,
  actionsRemaining: 1,
  visionRadius: 2,
  attackRange: 1,
  status: 'active',
  hasAttacked: false,
  abilities: [],
  level: 1,
  experience: 0,
  ...overrides,
});

const baseState = (overrides: Partial<GameState> = {}): GameState => ({
  id: 'rules-regression',
  rngSeed: 1,
  players: [player('p1'), player('p2')],
  currentPlayerIndex: 0,
  turn: 1,
  phase: 'playing',
  winner: undefined,
  visibility: undefined,
  map: {
    width: 5,
    height: 5,
    tiles: [
      { coordinate: { q: -1, r: 0, s: 1 }, terrain: 'plains', resources: [], hasCity: true, cityOwner: 'p1', exploredBy: ['p1', 'p2'] },
      { coordinate: { q: 0, r: 0, s: 0 }, terrain: 'plains', resources: [], hasCity: true, cityOwner: 'p2', exploredBy: ['p1', 'p2'] },
      { coordinate: { q: 1, r: 0, s: -1 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: ['p1', 'p2'] },
      { coordinate: { q: 2, r: 0, s: -2 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: ['p1', 'p2'] },
    ],
  },
  units: [],
  cities: [
    {
      id: 'p1-city',
      name: 'Home',
      coordinate: { q: -1, r: 0, s: 1 },
      ownerId: 'p1',
      population: 1,
      maxPopulation: 4,
      level: 1,
      starProduction: 2,
      improvements: [],
      structures: [],
      harvestedResources: [],
    },
    {
      id: 'p2-city',
      name: 'Target',
      coordinate: { q: 0, r: 0, s: 0 },
      ownerId: 'p2',
      population: 1,
      maxPopulation: 4,
      level: 1,
      starProduction: 2,
      improvements: ['farm-1'],
      structures: ['temple-1'],
      harvestedResources: [],
    },
  ],
  improvements: [],
  structures: [],
  activeEffects: [],
  lastAction: undefined,
  ...overrides,
});

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe('core rules simulation regressions', () => {
  it('requires declared hostility before unit combat can resolve', () => {
    const attacker = unit('attacker', 'p1');
    const defender = unit('defender', 'p2', { coordinate: { q: 1, r: 0, s: -1 } });
    const neutralState = baseState({ units: [attacker, defender] });

    expect(arePlayersHostile(neutralState, 'p1', 'p2')).toBe(false);
    expect(resolveCombat(attacker, defender, neutralState).reasonCode).toBe('not_hostile');

    const alliedState = baseState({
      players: [
        player('p1', { alliedWith: ['p2'] }),
        player('p2', { alliedWith: ['p1'] }),
      ],
      units: [attacker, defender],
    });
    expect(resolveCombat(attacker, defender, alliedState).reasonCode).toBe('not_hostile');

    const warState = baseState({
      players: [
        player('p1', { atWarWith: ['p2'] }),
        player('p2', { atWarWith: ['p1'] }),
      ],
      units: [attacker, defender],
    });
    const result = resolveCombat(attacker, defender, warState);
    expect(arePlayersHostile(warState, 'p1', 'p2')).toBe(true);
    expect(result.canAttack).toBe(true);
    expect(result.defenderHp).toBeLessThan(defender.hp);
  });

  it('applies city capture artifact transfer semantics to city conversion', () => {
    const common = baseState({
      players: [
        player('p1', { atWarWith: ['p2'] }),
        player('p2', { atWarWith: ['p1'] }),
      ],
      structures: [{
        id: 'temple-1',
        type: 'temple',
        cityId: 'p2-city',
        ownerId: 'p2',
        constructionTurns: 0,
        effects: { starProduction: 0, unitProduction: 0, defenseBonus: 0, populationGrowth: 0, faithProduction: 1 },
      }],
      improvements: [{
        id: 'farm-1',
        type: 'farm',
        coordinate: { q: 1, r: 0, s: -1 },
        ownerId: 'p2',
        cityId: 'p2-city',
        starProduction: 1,
        constructionTurns: 0,
      }],
    });

    const captured = resolveActionState({
      ...clone(common),
      units: [unit('warrior', 'p1', { coordinate: { q: 1, r: 0, s: -1 } })],
    }, {
      type: 'CAPTURE_CITY',
      payload: { playerId: 'p1', unitId: 'warrior', cityId: 'p2-city' },
    });

    const converted = resolveActionState({
      ...clone(common),
      units: [unit('missionary', 'p1', {
        type: 'missionary',
        attack: 1,
        abilities: ['convert'],
        coordinate: { q: 1, r: 0, s: -1 },
      })],
    }, {
      type: 'CONVERT_CITY',
      payload: { playerId: 'p1', unitId: 'missionary', cityId: 'p2-city', conversionType: 'faith' },
    });

    expect(converted.cities.find(city => city.id === 'p2-city')?.ownerId).toBe('p1');
    expect(converted.structures).toEqual(captured.structures);
    expect(converted.improvements).toEqual(captured.improvements);
  });

  it('blocks village and legacy ruins actions when the acting unit is exhausted', () => {
    const exhausted = unit('u1', 'p1', {
      actionsRemaining: 0,
      hasAttacked: true,
      coordinate: { q: 0, r: 0, s: 0 },
    });
    const villageState = baseState({
      players: [player('p1')],
      units: [exhausted],
      map: {
        width: 3,
        height: 3,
        tiles: [{ coordinate: { q: 0, r: 0, s: 0 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: ['p1'], feature: 'village' }],
      },
      cities: [],
    });

    const conquered = resolveActionState(villageState, {
      type: 'CONQUER_VILLAGE',
      payload: { playerId: 'p1', unitId: 'u1' },
    });
    expect(conquered.map.tiles[0].cityOwner).toBeUndefined();
    expect(conquered.players[0].stars).toBe(20);

    const converted = resolveActionState(villageState, {
      type: 'CONVERT_VILLAGE',
      payload: { playerId: 'p1', unitId: 'u1' },
    });
    expect(converted.map.tiles[0].cityOwner).toBeUndefined();
    expect(converted.players[0].stats.faith).toBe(80);

    const ruinsState = {
      ...villageState,
      map: {
        ...villageState.map,
        tiles: [{ ...villageState.map.tiles[0], feature: 'ruin' as const }],
      },
    };
    const ruins = resolveAction(ruinsState, {
      type: 'EXPLORE_RUINS',
      payload: { playerId: 'p1', unitId: 'u1', coordinate: { q: 0, r: 0, s: 0 } },
    });
    expect(ruins.events).toEqual([]);
    expect(ruins.state.map.tiles[0].feature).toBe('ruin');
  });

  it('uses the normalized active player in movement and attack handlers', () => {
    const movable = unit('u2', 'p2', { coordinate: { q: 1, r: 0, s: -1 } });
    const state = baseState({
      currentPlayerIndex: 99,
      players: [
        player('p1', { isEliminated: true, citiesOwned: [] }),
        player('p2', { citiesOwned: ['p2-city'] }),
      ],
      units: [movable],
    });

    const moved = resolveActionState(state, {
      type: 'MOVE_UNIT',
      payload: { unitId: 'u2', targetCoordinate: { q: 2, r: 0, s: -2 } },
    });

    expect(moved.units.find(candidate => candidate.id === 'u2')?.coordinate).toEqual({ q: 2, r: 0, s: -2 });

    const attacker = unit('attacker', 'p2', { coordinate: { q: 1, r: 0, s: -1 } });
    const defender = unit('defender', 'p1', { coordinate: { q: 2, r: 0, s: -2 } });
    const attackState = baseState({
      currentPlayerIndex: 99,
      players: [
        player('p1', { atWarWith: ['p2'] }),
        player('p2', { atWarWith: ['p1'] }),
      ],
      units: [attacker, defender],
    });

    const attacked = resolveActionState(attackState, {
      type: 'ATTACK_UNIT',
      payload: { attackerId: 'attacker', targetId: 'defender' },
    });

    expect(attacked.units.find(candidate => candidate.id === 'defender')?.hp).toBeLessThan(defender.hp);
  });

  it('accepts territorial victory through both victory schemas', () => {
    expect(VictoryTypeSchema.safeParse('territorial').success).toBe(true);
    expect(GameStateSchema.safeParse({
      ...baseState(),
      victoryType: 'territorial',
    }).success).toBe(true);
  });

  it('ends immediately when city capture eliminates the last opponent', () => {
    const captured = resolveActionState({
      ...baseState({
        players: [
          player('p1', { atWarWith: ['p2'] }),
          player('p2', { atWarWith: ['p1'] }),
        ],
      }),
      units: [unit('warrior', 'p1', { coordinate: { q: 1, r: 0, s: -1 } })],
    }, {
      type: 'CAPTURE_CITY',
      payload: { playerId: 'p1', unitId: 'warrior', cityId: 'p2-city' },
    });

    expect(captured.phase).toBe('ended');
    expect(captured.winner).toBe('p1');
    expect(captured.victoryType).toBe('elimination');
  });

  it('ends immediately when city conversion eliminates the last opponent', () => {
    const converted = resolveActionState({
      ...baseState({
        players: [
          player('p1'),
          player('p2'),
        ],
      }),
      units: [unit('missionary', 'p1', {
        type: 'missionary',
        attack: 1,
        abilities: ['convert'],
        coordinate: { q: 1, r: 0, s: -1 },
      })],
    }, {
      type: 'CONVERT_CITY',
      payload: { playerId: 'p1', unitId: 'missionary', cityId: 'p2-city', conversionType: 'faith' },
    });

    expect(converted.phase).toBe('ended');
    expect(converted.winner).toBe('p1');
    expect(converted.victoryType).toBe('elimination');
  });
});
