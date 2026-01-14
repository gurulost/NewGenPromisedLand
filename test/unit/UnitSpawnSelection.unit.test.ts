import { describe, it, expect, vi } from 'vitest';
import { resolveActionState } from '../../shared/logic/resolveAction';
import type { GameState } from '../../shared/types/game';

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
});
