import { describe, it, expect } from 'vitest';
import { gameReducer } from '../../shared/logic/gameReducer';
import type { GameState } from '../../shared/types/game';

describe('Trade routes', () => {
  it('establishes a persistent route once and pays per-turn (no spam)', () => {
    const playerId = 'p1';
    const cityAId = 'cityA';
    const cityBId = 'cityB';

    const baseState: GameState = {
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
          stars: 100,
          researchedTechs: ['trade'],
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

    const established = gameReducer(baseState, {
      type: 'ESTABLISH_TRADE_ROUTE',
      payload: { playerId, fromCityId: cityAId, toCityId: cityBId },
    } as any);

    const pAfter = established.players[0];
    expect(pAfter.tradeRoutes.length).toBe(1);
    expect(pAfter.tradeRoutes[0].starsPerTurn).toBeGreaterThan(0);
    expect(pAfter.stars).toBeLessThan(100);

    // Immediate spam attempt should fail (cooldown and duplicate checks).
    const spamAttempt = gameReducer(established, {
      type: 'ESTABLISH_TRADE_ROUTE',
      payload: { playerId, fromCityId: cityAId, toCityId: cityBId },
    } as any);

    expect(spamAttempt.players[0].tradeRoutes.length).toBe(1);
    expect(spamAttempt.players[0].stars).toBe(pAfter.stars);

    // End turn should add per-turn income from the route.
    const afterIncome = gameReducer(established, {
      type: 'END_TURN',
      payload: { playerId },
    } as any);

    const pAfterIncome = afterIncome.players[0];
    expect(pAfterIncome.stars).toBeGreaterThan(pAfter.stars);
    // Should include at least the trade route's starsPerTurn.
    expect(pAfterIncome.stars - pAfter.stars).toBeGreaterThanOrEqual(pAfter.tradeRoutes[0].starsPerTurn);
  });
});
