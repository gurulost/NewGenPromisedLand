import { describe, it, expect, vi } from 'vitest';
import { resolveActionState } from '../../shared/logic/resolveAction';
import type { GameState } from '../../shared/types/game';
import type { Unit } from '../../shared/types/unit';

function makeState(): GameState {
  const playerId = 'p1';
  const cityId = 'city1';
  const cityCoord = { q: 0, r: 0, s: 0 };
  const preferredSpawn = { q: 1, r: 0, s: -1 };

  return {
    id: 'g1',
    currentPlayerIndex: 0,
    turn: 1,
    phase: 'playing',
    winner: undefined,
    visibility: undefined,
    rngSeed: 1,
    map: {
      width: 4,
      height: 4,
      tiles: [
        { coordinate: cityCoord, terrain: 'plains', resources: [], hasCity: true, cityOwner: playerId, exploredBy: [playerId] },
        { coordinate: preferredSpawn, terrain: 'plains', resources: [], hasCity: false, exploredBy: [playerId] },
        { coordinate: { q: 0, r: 1, s: -1 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [playerId] },
      ],
    },
    players: [
      {
        id: playerId,
        name: 'Player',
        factionId: 'NEPHITES',
        isEliminated: false,
        stats: { faith: 50, pride: 30, internalDissent: 10 },
        stars: 0,
        researchedTechs: [],
        turnOrder: 0,
        visibilityMask: [],
        exploredTiles: [],
        researchProgress: 0,
        citiesOwned: [cityId],
        constructionQueue: [
          {
            id: 'cq1',
            type: 'warrior',
            category: 'units',
            coordinate: preferredSpawn,
            cityId,
            playerId,
            turnsRemaining: 1,
            totalTurns: 1,
            cost: { stars: 2, faith: 0, pride: 0 },
          },
        ],
        atWarWith: [],
        alliedWith: [],
        tradeRoutes: [],
        diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
      },
    ],
    cities: [
      {
        id: cityId,
        name: 'City',
        coordinate: cityCoord,
        ownerId: playerId,
        population: 1,
        maxPopulation: 4,
        level: 1,
        starProduction: 0,
        improvements: [],
        structures: [],
        harvestedResources: [],
      },
    ],
    units: [],
    improvements: [],
    structures: [],
  };
}

describe('Unit spawn selection', () => {
  it('spawns completed unit at the preferred coordinate when available', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const state = makeState();
    const after = resolveActionState(state, { type: 'END_TURN', payload: { playerId: 'p1' } } as any);
    const spawned = after.units.find(u => u.playerId === 'p1' && u.type === 'warrior');
    expect(spawned?.coordinate).toEqual({ q: 1, r: 0, s: -1 });
  });

  it('does not start unit construction on an occupied spawn tile', () => {
    const state = makeState();
    state.players[0].constructionQueue = [];
    state.players[0].stars = 10;
    state.units.push({
      id: 'blocker',
      type: 'warrior',
      playerId: 'p1',
      coordinate: { q: 1, r: 0, s: -1 },
      hp: 10,
      maxHp: 10,
      attack: 2,
      defense: 2,
      movement: 2,
      remainingMovement: 2,
      maxActions: 1,
      actionsRemaining: 1,
      visionRadius: 2,
      attackRange: 1,
      status: 'active',
      experience: 0,
      abilities: [],
      level: 1,
    } satisfies Unit);

    const after = resolveActionState(
      state,
      {
        type: 'START_CONSTRUCTION',
        payload: {
          playerId: 'p1',
          buildingType: 'warrior',
          category: 'units',
          cityId: 'city1',
          coordinate: { q: 1, r: 0, s: -1 },
        },
      } as any
    );

    expect(after.players[0].stars).toBe(10);
    expect(after.players[0].constructionQueue || []).toHaveLength(0);
  });

  it('falls back to the nearest empty spawn tile when the preferred tile becomes occupied', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const state = makeState();
    state.units.push({
      id: 'blocker',
      type: 'warrior',
      playerId: 'p1',
      coordinate: { q: 1, r: 0, s: -1 },
      hp: 10,
      maxHp: 10,
      attack: 2,
      defense: 2,
      movement: 2,
      remainingMovement: 2,
      maxActions: 1,
      actionsRemaining: 1,
      visionRadius: 2,
      attackRange: 1,
      status: 'active',
      experience: 0,
      abilities: [],
      level: 1,
    } satisfies Unit);

    const after = resolveActionState(state, { type: 'END_TURN', payload: { playerId: 'p1' } } as any);
    const spawned = after.units.find(u => u.playerId === 'p1' && u.type === 'warrior' && u.id !== 'blocker');

    expect(spawned?.coordinate).toEqual({ q: 0, r: 0, s: 0 });
  });
});
