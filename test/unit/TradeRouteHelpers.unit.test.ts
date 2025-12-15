import { describe, it, expect } from 'vitest';
import type { GameState } from '../../shared/types/game';
import { areCitiesConnectedByRoad, calculateTradeRouteStarsPerTurn, calculateTradeRouteEstablishCostStars } from '../../shared/logic/tradeRoutes';

describe('tradeRoutes helpers', () => {
  it('calculateTradeRouteStarsPerTurn returns 0 if either city is not owned by player', () => {
    const state: GameState = {
      id: 'g1',
      currentPlayerIndex: 0,
      turn: 1,
      phase: 'playing',
      map: { width: 5, height: 5, tiles: [] },
      players: [
        {
          id: 'p1',
          name: 'P1',
          factionId: 'NEPHITES',
          isEliminated: false,
          stats: { faith: 50, pride: 10, internalDissent: 0 },
          stars: 0,
          researchedTechs: ['trade'],
          turnOrder: 0,
          visibilityMask: [],
          exploredTiles: [],
          researchProgress: 0,
          citiesOwned: ['a'],
          constructionQueue: [],
          atWarWith: [],
          alliedWith: [],
          tradeRoutes: [],
          diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
        },
        {
          id: 'p2',
          name: 'P2',
          factionId: 'LAMANITES',
          isEliminated: false,
          stats: { faith: 50, pride: 10, internalDissent: 0 },
          stars: 0,
          researchedTechs: [],
          turnOrder: 1,
          visibilityMask: [],
          exploredTiles: [],
          researchProgress: 0,
          citiesOwned: ['b'],
          constructionQueue: [],
          atWarWith: [],
          alliedWith: [],
          tradeRoutes: [],
          diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
        },
      ],
      cities: [
        { id: 'a', name: 'A', coordinate: { q: 0, r: 0, s: 0 }, ownerId: 'p1', population: 1, maxPopulation: 4, level: 2, starProduction: 0, unrestTurns: 0, improvements: [], structures: [], harvestedResources: [] },
        { id: 'b', name: 'B', coordinate: { q: 2, r: 0, s: -2 }, ownerId: 'p2', population: 1, maxPopulation: 4, level: 4, starProduction: 0, unrestTurns: 0, improvements: [], structures: [], harvestedResources: [] },
      ],
      units: [],
      improvements: [],
      structures: [],
      winner: undefined,
      visibility: undefined,
    };

    expect(calculateTradeRouteStarsPerTurn(state, 'p1', 'a', 'b')).toBe(0);
    expect(calculateTradeRouteStarsPerTurn(state, 'p2', 'a', 'b')).toBe(0);
  });

  it('areCitiesConnectedByRoad is false without a road chain touching both city endpoints', () => {
    const playerId = 'p1';
    const state: GameState = {
      id: 'g1',
      currentPlayerIndex: 0,
      turn: 1,
      phase: 'playing',
      map: { width: 5, height: 5, tiles: [] },
      players: [
        {
          id: playerId,
          name: 'P1',
          factionId: 'NEPHITES',
          isEliminated: false,
          stats: { faith: 50, pride: 10, internalDissent: 0 },
          stars: 0,
          researchedTechs: ['trade'],
          turnOrder: 0,
          visibilityMask: [],
          exploredTiles: [],
          researchProgress: 0,
          citiesOwned: ['a', 'b'],
          constructionQueue: [],
          atWarWith: [],
          alliedWith: [],
          tradeRoutes: [],
          diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
        },
      ],
      cities: [
        { id: 'a', name: 'A', coordinate: { q: 0, r: 0, s: 0 }, ownerId: playerId, population: 1, maxPopulation: 4, level: 1, starProduction: 0, unrestTurns: 0, improvements: [], structures: [], harvestedResources: [] },
        { id: 'b', name: 'B', coordinate: { q: 3, r: 0, s: -3 }, ownerId: playerId, population: 1, maxPopulation: 4, level: 1, starProduction: 0, unrestTurns: 0, improvements: [], structures: [], harvestedResources: [] },
      ],
      units: [],
      improvements: [
        // road exists but does not touch both endpoints
        { id: 'r1', type: 'road', coordinate: { q: 1, r: 0, s: -1 }, ownerId: playerId, starProduction: 0, cityId: 'a', constructionTurns: 0 },
      ],
      structures: [],
      winner: undefined,
      visibility: undefined,
    };

    expect(areCitiesConnectedByRoad(state, playerId, 'a', 'b')).toBe(false);
  });

  it('areCitiesConnectedByRoad is true with a contiguous road chain between two owned cities', () => {
    const playerId = 'p1';
    const state: GameState = {
      id: 'g1',
      currentPlayerIndex: 0,
      turn: 1,
      phase: 'playing',
      map: { width: 5, height: 5, tiles: [] },
      players: [
        {
          id: playerId,
          name: 'P1',
          factionId: 'NEPHITES',
          isEliminated: false,
          stats: { faith: 50, pride: 10, internalDissent: 0 },
          stars: 0,
          researchedTechs: ['trade'],
          turnOrder: 0,
          visibilityMask: [],
          exploredTiles: [],
          researchProgress: 0,
          citiesOwned: ['a', 'b'],
          constructionQueue: [],
          atWarWith: [],
          alliedWith: [],
          tradeRoutes: [],
          diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
        },
      ],
      cities: [
        { id: 'a', name: 'A', coordinate: { q: 0, r: 0, s: 0 }, ownerId: playerId, population: 1, maxPopulation: 4, level: 1, starProduction: 0, unrestTurns: 0, improvements: [], structures: [], harvestedResources: [] },
        { id: 'b', name: 'B', coordinate: { q: 2, r: 0, s: -2 }, ownerId: playerId, population: 1, maxPopulation: 4, level: 1, starProduction: 0, unrestTurns: 0, improvements: [], structures: [], harvestedResources: [] },
      ],
      units: [],
      improvements: [
        { id: 'r1', type: 'road', coordinate: { q: 1, r: 0, s: -1 }, ownerId: playerId, starProduction: 0, cityId: 'a', constructionTurns: 0 },
      ],
      structures: [],
      winner: undefined,
      visibility: undefined,
    };

    expect(areCitiesConnectedByRoad(state, playerId, 'a', 'b')).toBe(true);
  });

  it('establish cost scales with per-turn income', () => {
    expect(calculateTradeRouteEstablishCostStars(1)).toBe(8);
    expect(calculateTradeRouteEstablishCostStars(2)).toBe(10);
    expect(calculateTradeRouteEstablishCostStars(5)).toBe(25);
  });
});

