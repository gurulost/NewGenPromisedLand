import { describe, it, expect } from 'vitest';
import { gameReducer } from '../../shared/logic/gameReducer';
import type { GameState } from '../../shared/types/game';
import { vi } from 'vitest';

function makeState(researchedTechs: string[]): GameState {
  const playerId = 'p1';
  const cityAId = 'cityA';
  const cityBId = 'cityB';

  return {
    id: 'g1',
    currentPlayerIndex: 0,
    turn: 1,
    phase: 'playing',
    winner: undefined,
    visibility: undefined,
    map: {
      width: 5,
      height: 5,
      tiles: [
        { coordinate: { q: 0, r: 0, s: 0 }, terrain: 'plains', resources: [], hasCity: true, cityOwner: playerId, exploredBy: [playerId] },
        { coordinate: { q: 1, r: 0, s: -1 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [playerId] },
        { coordinate: { q: 2, r: 0, s: -2 }, terrain: 'plains', resources: [], hasCity: true, cityOwner: playerId, exploredBy: [playerId] },
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
        researchedTechs,
        turnOrder: 0,
        visibilityMask: [],
        exploredTiles: [],
        researchProgress: 0,
        citiesOwned: [cityAId, cityBId],
        constructionQueue: [],
        atWarWith: [],
        alliedWith: [],
        tradeRoutes: [],
        diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
      },
    ],
    cities: [
      {
        id: cityAId,
        name: 'A',
        coordinate: { q: 0, r: 0, s: 0 },
        ownerId: playerId,
        population: 1,
        maxPopulation: 4,
        level: 1,
        starProduction: 0,
        improvements: [],
        structures: [],
        harvestedResources: [],
      },
      {
        id: cityBId,
        name: 'B',
        coordinate: { q: 2, r: 0, s: -2 },
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
    improvements: [
      {
        id: 'road1',
        type: 'road',
        coordinate: { q: 1, r: 0, s: -1 },
        ownerId: playerId,
        starProduction: 0,
        cityId: cityAId,
        constructionTurns: 0,
      },
    ],
    structures: [],
  };
}

describe('Road-connected city bonus', () => {
  it('grants +1★/turn per extra connected city (no trade tech)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // prevent morale events from affecting deterministic income assertions
    const state = makeState([]);
    const after = gameReducer(state, { type: 'END_TURN', payload: { playerId: 'p1' } } as any);
    expect(after.players[0].stars).toBe(1);
  });

  it('doubles road bonus with trade tech', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const state = makeState(['trade']);
    const after = gameReducer(state, { type: 'END_TURN', payload: { playerId: 'p1' } } as any);
    expect(after.players[0].stars).toBe(2);
  });
});
