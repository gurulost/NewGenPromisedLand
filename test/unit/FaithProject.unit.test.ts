import { describe, expect, it } from 'vitest';
import { resolveAction, resolveActionState } from '../../shared/logic/resolveAction';
import { GAME_RULES } from '../../shared/data/gameRules';
import { GameStateSchema, type GameState, type PlayerState } from '../../shared/types/game';
import type { City, Structure } from '../../shared/types/city';
import type { Unit } from '../../shared/types/unit';
import type { HexCoordinate } from '../../shared/types/coordinates';

const coord = (q: number, r: number): HexCoordinate => ({ q, r, s: -q - r });

const makePlayer = (overrides: Partial<PlayerState> & { id: string; turnOrder?: number }): PlayerState => ({
  id: overrides.id,
  name: overrides.name ?? overrides.id,
  factionId: overrides.factionId ?? 'NEPHITES',
  isAI: overrides.isAI ?? false,
  stars: overrides.stars ?? 100,
  stats: overrides.stats ?? { faith: 100, pride: 0, internalDissent: 0 },
  modifiers: [],
  researchedTechs: [],
  researchProgress: 0,
  researchInspiration: 0,
  abilityCooldowns: {},
  citiesOwned: overrides.citiesOwned ?? [],
  constructionQueue: [],
  visibilityMask: [],
  exploredTiles: [],
  isEliminated: false,
  turnOrder: overrides.turnOrder ?? 0,
  atWarWith: overrides.atWarWith ?? [],
  alliedWith: [],
  tradeRoutes: [],
  diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
  faithProject: overrides.faithProject ?? null,
  ...overrides,
});

const makeCity = (id: string, ownerId: string | undefined, coordinate: HexCoordinate): City => ({
  id,
  name: id,
  ownerId,
  coordinate,
  population: 2,
  maxPopulation: 4,
  level: 1,
  starProduction: 2,
  unrestTurns: 0,
  improvements: [],
  structures: [],
  harvestedResources: [],
});

const makeStructure = (id: string, type: Structure['type'], cityId: string, ownerId: string): Structure => ({
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
});

const makeUnit = (
  id: string,
  type: Unit['type'],
  playerId: string,
  coordinate: HexCoordinate,
  hp = 10,
): Unit => ({
  id,
  type,
  playerId,
  coordinate,
  hp,
  maxHp: Math.max(1, hp),
  attack: type === 'warrior' ? 6 : 1,
  defense: type === 'warrior' ? 4 : 1,
  movement: 3,
  remainingMovement: 3,
  maxActions: 1,
  actionsRemaining: 1,
  status: 'active',
  abilities: [],
  level: 1,
  experience: 0,
  visionRadius: 2,
  attackRange: 1,
  hasAttacked: false,
});

function makeFaithProjectState(overrides: Partial<GameState> = {}): GameState {
  const cities = [
    makeCity('c1', 'p1', coord(0, 0)),
    makeCity('c2', 'p1', coord(1, 0)),
    makeCity('c3', 'p1', coord(0, 1)),
    makeCity('c4', 'p2', coord(3, 0)),
  ];
  const players = [
    makePlayer({ id: 'p1', citiesOwned: ['c1', 'c2', 'c3'], stats: { faith: 100, pride: 0, internalDissent: 0 } }),
    makePlayer({ id: 'p2', turnOrder: 1, citiesOwned: ['c4'], stats: { faith: 20, pride: 0, internalDissent: 0 } }),
  ];
  return {
    id: 'faith-project-test',
    rngSeed: 1,
    players,
    currentPlayerIndex: 0,
    turn: GAME_RULES.victory.faithVictory.minTurnToStart,
    phase: 'playing',
    map: {
      width: 8,
      height: 8,
      tiles: cities.map(city => ({
        coordinate: city.coordinate,
        terrain: 'plains',
        resources: [],
        hasCity: true,
        cityOwner: city.ownerId,
        exploredBy: ['p1', 'p2'],
      })),
    },
    units: [],
    cities,
    improvements: [],
    structures: [
      makeStructure('t1', 'temple', 'c1', 'p1'),
      makeStructure('t2', 'temple', 'c2', 'p1'),
      makeStructure('t3', 'temple', 'c3', 'p1'),
      makeStructure('cat1', 'cathedral', 'c1', 'p1'),
    ],
    activeEffects: [],
    ...overrides,
  };
}

const startProject = (state: GameState) =>
  resolveAction(state, {
    type: 'START_FAITH_PROJECT',
    payload: { playerId: 'p1', holyCityIds: ['c1', 'c2', 'c3'] },
  });

describe('Faith Project victory', () => {
  it('does not award old threshold faith victories from banked Faith alone', () => {
    const state = makeFaithProjectState();
    const result = resolveActionState(state, { type: 'END_TURN', payload: { playerId: 'p1' } });
    expect(result.winner).toBeUndefined();
    expect(result.victoryType).toBeUndefined();
  });

  it('starts only with three Temple cities including a Cathedral and deducts start costs', () => {
    const state = makeFaithProjectState();
    const result = startProject(state);

    expect(result.events[0]?.type).toBe('FAITH_PROJECT_STARTED');
    expect(result.state.lastAction).toMatchObject({
      type: 'ACTION_RESOLUTION',
      payload: {
        action: { type: 'START_FAITH_PROJECT' },
        events: [expect.objectContaining({ type: 'FAITH_PROJECT_STARTED' })],
      },
    });
    expect(GameStateSchema.safeParse(result.state).success).toBe(true);
    const player = result.state.players.find(p => p.id === 'p1');
    expect(player?.stars).toBe(80);
    expect(player?.stats.faith).toBe(80);
    expect(player?.faithProject).toMatchObject({
      active: true,
      progress: 0,
      holyCityIds: ['c1', 'c2', 'c3'],
    });
  });

  it('rejects starting without the Cathedral coverage', () => {
    const state = makeFaithProjectState({
      structures: [
        makeStructure('t1', 'temple', 'c1', 'p1'),
        makeStructure('t2', 'temple', 'c2', 'p1'),
        makeStructure('t3', 'temple', 'c3', 'p1'),
      ],
    });
    const result = startProject(state);

    expect(result.state).toBe(state);
    expect(result.events).toHaveLength(0);
  });

  it('pays upkeep at the player turn end and wins after three progress ticks', () => {
    let state = startProject(makeFaithProjectState()).state;

    state = resolveActionState(state, { type: 'END_TURN', payload: { playerId: 'p1' } });
    expect(state.players[0].faithProject?.progress).toBe(1);
    expect(state.players[0].stats.faith).toBe(76);
    expect(state.players[0].stars).toBe(81);

    state = resolveActionState(state, { type: 'END_TURN', payload: { playerId: 'p2' } });
    state = resolveActionState(state, { type: 'END_TURN', payload: { playerId: 'p1' } });
    expect(state.players[0].faithProject?.progress).toBe(2);
    expect(state.phase).toBe('playing');

    state = resolveActionState(state, { type: 'END_TURN', payload: { playerId: 'p2' } });
    state = resolveActionState(state, { type: 'END_TURN', payload: { playerId: 'p1' } });
    expect(state.phase).toBe('ended');
    expect(state.winner).toBe('p1');
    expect(state.victoryType).toBe('faith');
  });

  it('pauses without upkeep when war contests the project', () => {
    const started = startProject(makeFaithProjectState({
      players: [
        makePlayer({ id: 'p1', citiesOwned: ['c1', 'c2', 'c3'], stats: { faith: 100, pride: 0, internalDissent: 0 }, atWarWith: ['p2'] }),
        makePlayer({ id: 'p2', turnOrder: 1, citiesOwned: ['c4'], stats: { faith: 20, pride: 0, internalDissent: 0 }, atWarWith: ['p1'] }),
      ],
    })).state;

    const result = resolveActionState(started, { type: 'END_TURN', payload: { playerId: 'p1' } });
    expect(result.players[0].faithProject?.progress).toBe(0);
    expect(result.players[0].faithProject?.pausedReason).toBe('At war.');
    expect(result.players[0].stats.faith).toBe(86);
    expect(result.players[0].stars).toBe(86);
  });

  it('applies missionary death Faith shock', () => {
    const state = makeFaithProjectState({
      currentPlayerIndex: 1,
      players: [
        makePlayer({ id: 'p1', citiesOwned: ['c1', 'c2', 'c3'], stats: { faith: 70, pride: 0, internalDissent: 0 }, atWarWith: ['p2'] }),
        makePlayer({ id: 'p2', turnOrder: 1, citiesOwned: ['c4'], stats: { faith: 20, pride: 0, internalDissent: 0 }, atWarWith: ['p1'] }),
      ],
      units: [
        makeUnit('attacker', 'warrior', 'p2', coord(1, 0), 20),
        makeUnit('missionary', 'missionary', 'p1', coord(0, 0), 1),
      ],
    });

    const result = resolveAction(state, { type: 'ATTACK_UNIT', payload: { attackerId: 'attacker', targetId: 'missionary' } });
    expect(result.events).toEqual([
      expect.objectContaining({ type: 'FAITH_LOSS_SHOCK' }),
    ]);
    expect(result.state.lastAction).toMatchObject({
      type: 'ACTION_RESOLUTION',
      payload: {
        action: { type: 'ATTACK_UNIT' },
        events: [expect.objectContaining({ type: 'FAITH_LOSS_SHOCK' })],
      },
    });
    expect(result.state.players.find(p => p.id === 'p1')?.stats.faith).toBe(67);
    expect(result.state.units.some(unit => unit.id === 'missionary')).toBe(false);
  });

  it('interrupts an active project when a missionary death drops Faith below maintenance', () => {
    const state = makeFaithProjectState({
      currentPlayerIndex: 1,
      players: [
        makePlayer({
          id: 'p1',
          citiesOwned: ['c1', 'c2', 'c3'],
          stats: { faith: 52, pride: 0, internalDissent: 0 },
          atWarWith: ['p2'],
          faithProject: {
            active: true,
            progress: 1,
            holyCityIds: ['c1', 'c2', 'c3'],
            startedTurn: GAME_RULES.victory.faithVictory.minTurnToStart,
            pausedReason: null,
          },
        }),
        makePlayer({ id: 'p2', turnOrder: 1, citiesOwned: ['c4'], stats: { faith: 20, pride: 0, internalDissent: 0 }, atWarWith: ['p1'] }),
      ],
      units: [
        makeUnit('attacker', 'warrior', 'p2', coord(1, 0), 20),
        makeUnit('missionary', 'missionary', 'p1', coord(0, 0), 1),
      ],
    });

    const result = resolveAction(state, { type: 'ATTACK_UNIT', payload: { attackerId: 'attacker', targetId: 'missionary' } });
    expect(result.events.map(event => event.type)).toEqual(['FAITH_LOSS_SHOCK', 'FAITH_PROJECT_INTERRUPTED']);
    expect(result.state.players.find(p => p.id === 'p1')?.stats.faith).toBe(49);
    expect(result.state.players.find(p => p.id === 'p1')?.faithProject).toBeNull();
  });

  it('applies holy building city-loss shock and interrupts active projects', () => {
    const started = startProject(makeFaithProjectState({
      currentPlayerIndex: 0,
      units: [makeUnit('captor', 'warrior', 'p2', coord(1, 0), 20)],
    })).state;
    const readyToCapture: GameState = {
      ...started,
      currentPlayerIndex: 1,
      players: started.players.map(player =>
        player.id === 'p1'
          ? { ...player, atWarWith: ['p2'] }
          : { ...player, atWarWith: ['p1'] }
      ),
    };

    const result = resolveAction(readyToCapture, {
      type: 'CAPTURE_CITY',
      payload: { playerId: 'p2', unitId: 'captor', cityId: 'c1' },
    });

    expect(result.events.map(event => event.type)).toEqual(['FAITH_LOSS_SHOCK', 'FAITH_PROJECT_INTERRUPTED']);
    expect(result.state.lastAction).toMatchObject({
      type: 'ACTION_RESOLUTION',
      payload: {
        action: { type: 'CAPTURE_CITY' },
        events: [
          expect.objectContaining({ type: 'FAITH_LOSS_SHOCK' }),
          expect.objectContaining({ type: 'FAITH_PROJECT_INTERRUPTED' }),
        ],
      },
    });
    const formerOwner = result.state.players.find(p => p.id === 'p1');
    expect(formerOwner?.stats.faith).toBe(65);
    expect(formerOwner?.faithProject).toBeNull();
  });

  it('applies the same holy city-loss shock when conversion takes an active holy city', () => {
    const started = startProject(makeFaithProjectState({
      currentPlayerIndex: 0,
      units: [makeUnit('converter', 'missionary', 'p2', coord(1, 0), 20)],
    })).state;
    const readyToConvert: GameState = {
      ...started,
      currentPlayerIndex: 1,
      players: started.players.map(player =>
        player.id === 'p2'
          ? { ...player, stats: { ...player.stats, faith: 30 } }
          : player
      ),
    };

    const result = resolveAction(readyToConvert, {
      type: 'CONVERT_CITY',
      payload: { playerId: 'p2', unitId: 'converter', cityId: 'c1', conversionType: 'faith' },
    });

    expect(result.events.map(event => event.type)).toEqual(['FAITH_LOSS_SHOCK', 'FAITH_PROJECT_INTERRUPTED']);
    expect(result.state.players.find(p => p.id === 'p1')?.stats.faith).toBe(65);
    expect(result.state.players.find(p => p.id === 'p1')?.faithProject).toBeNull();
  });

  it('does not emit city-loss Faith events for same-owner or unowned city conversion', () => {
    const sameOwnerStarted = startProject(makeFaithProjectState({
      units: [makeUnit('same-owner-converter', 'missionary', 'p1', coord(1, 0), 20)],
    })).state;
    const sameOwnerResult = resolveAction(sameOwnerStarted, {
      type: 'CONVERT_CITY',
      payload: { playerId: 'p1', unitId: 'same-owner-converter', cityId: 'c1', conversionType: 'peace' },
    });
    expect(sameOwnerResult.events).toEqual([]);
    expect(sameOwnerResult.state.players.find(p => p.id === 'p1')?.faithProject?.active).toBe(true);

    const neutralCity = makeCity('c5', undefined, coord(2, 0));
    const unownedState = makeFaithProjectState({
      units: [makeUnit('neutral-converter', 'missionary', 'p1', coord(2, -1), 20)],
      cities: [...makeFaithProjectState().cities, neutralCity],
    });
    const unownedResult = resolveAction(unownedState, {
      type: 'CONVERT_CITY',
      payload: { playerId: 'p1', unitId: 'neutral-converter', cityId: 'c5', conversionType: 'peace' },
    });
    expect(unownedResult.events).toEqual([]);
    expect(unownedResult.state.cities.find(city => city.id === 'c5')?.ownerId).toBe('p1');
  });
});
