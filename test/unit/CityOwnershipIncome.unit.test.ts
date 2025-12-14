import { describe, it, expect } from 'vitest';
import { gameReducer } from '../../shared/logic/gameReducer';
import type { GameState } from '../../shared/types/game';

describe('City capture/conversion income', () => {
  it('capturing a city updates ownerId and grants its starProduction on end turn', () => {
    const p1 = 'p1';
    const p2 = 'p2';
    const cityId = 'c1';

    const state: GameState = {
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
          { coordinate: { q: 0, r: 0, s: 0 }, terrain: 'plains', resources: [], hasCity: true, cityOwner: p2, exploredBy: [p1, p2] },
          { coordinate: { q: 1, r: 0, s: -1 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [p1, p2] },
        ],
      },
      players: [
        {
          id: p1,
          name: 'P1',
          factionId: 'NEPHITES',
          isEliminated: false,
          stats: { faith: 50, pride: 30, internalDissent: 10 },
          stars: 0,
          researchedTechs: [],
          turnOrder: 0,
          visibilityMask: [],
          exploredTiles: [],
          researchProgress: 0,
          citiesOwned: [],
          constructionQueue: [],
          atWarWith: [],
          alliedWith: [],
          tradeRoutes: [],
          diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
        },
        {
          id: p2,
          name: 'P2',
          factionId: 'NEPHITES',
          isEliminated: false,
          stats: { faith: 50, pride: 30, internalDissent: 10 },
          stars: 0,
          researchedTechs: [],
          turnOrder: 1,
          visibilityMask: [],
          exploredTiles: [],
          researchProgress: 0,
          citiesOwned: [cityId],
          constructionQueue: [],
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
          coordinate: { q: 0, r: 0, s: 0 },
          ownerId: p2,
          population: 1,
          maxPopulation: 4,
          level: 1,
          starProduction: 3,
          improvements: [],
          structures: [],
          harvestedResources: [],
        },
      ],
      units: [
        {
          id: 'u1',
          type: 'warrior',
          playerId: p1,
          coordinate: { q: 1, r: 0, s: -1 }, // adjacent so capture is allowed
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
          hasAttacked: false,
        } as any,
      ],
      improvements: [],
      structures: [],
    };

    const captured = gameReducer(state, { type: 'CAPTURE_CITY', payload: { playerId: p1, cityId } } as any);
    expect(captured.cities.find(c => c.id === cityId)?.ownerId).toBe(p1);
    expect(captured.players.find(p => p.id === p1)?.citiesOwned.includes(cityId)).toBe(true);
    expect(captured.players.find(p => p.id === p2)?.citiesOwned.includes(cityId)).toBe(false);

    const afterIncome = gameReducer(captured, { type: 'END_TURN', payload: { playerId: p1 } } as any);
    expect(afterIncome.players.find(p => p.id === p1)?.stars).toBe(3);
  });

  it('converting a city updates ownerId and grants its starProduction on end turn', () => {
    const p1 = 'p1';
    const p2 = 'p2';
    const cityId = 'c1';

    const state: GameState = {
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
          { coordinate: { q: 0, r: 0, s: 0 }, terrain: 'plains', resources: [], hasCity: true, cityOwner: p2, exploredBy: [p1, p2] },
          { coordinate: { q: 1, r: 0, s: -1 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [p1, p2] },
        ],
      },
      players: [
        {
          id: p1,
          name: 'P1',
          factionId: 'NEPHITES',
          isEliminated: false,
          stats: { faith: 50, pride: 30, internalDissent: 10 },
          stars: 0,
          researchedTechs: [],
          turnOrder: 0,
          visibilityMask: [],
          exploredTiles: [],
          researchProgress: 0,
          citiesOwned: [],
          constructionQueue: [],
          atWarWith: [],
          alliedWith: [],
          tradeRoutes: [],
          diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
        },
        {
          id: p2,
          name: 'P2',
          factionId: 'NEPHITES',
          isEliminated: false,
          stats: { faith: 50, pride: 30, internalDissent: 10 },
          stars: 0,
          researchedTechs: [],
          turnOrder: 1,
          visibilityMask: [],
          exploredTiles: [],
          researchProgress: 0,
          citiesOwned: [cityId],
          constructionQueue: [],
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
          coordinate: { q: 0, r: 0, s: 0 },
          ownerId: p2,
          population: 1,
          maxPopulation: 4,
          level: 1,
          starProduction: 3,
          improvements: [],
          structures: [],
          harvestedResources: [],
        },
      ],
      units: [
        {
          id: 'm1',
          type: 'missionary',
          playerId: p1,
          coordinate: { q: 1, r: 0, s: -1 }, // within conversion radius
          hp: 18,
          maxHp: 18,
          attack: 1,
          defense: 2,
          movement: 3,
          remainingMovement: 3,
          visionRadius: 2,
          attackRange: 1,
          status: 'active',
          experience: 0,
          abilities: ['convert'],
          level: 1,
          hasAttacked: false,
        } as any,
      ],
      improvements: [],
      structures: [],
    };

    const converted = gameReducer(state, { type: 'CONVERT_CITY', payload: { playerId: p1, cityId, conversionType: 'faith' } } as any);
    expect(converted.cities.find(c => c.id === cityId)?.ownerId).toBe(p1);
    expect(converted.players.find(p => p.id === p1)?.citiesOwned.includes(cityId)).toBe(true);
    expect(converted.players.find(p => p.id === p2)?.citiesOwned.includes(cityId)).toBe(false);

    const afterIncome = gameReducer(converted, { type: 'END_TURN', payload: { playerId: p1 } } as any);
    expect(afterIncome.players.find(p => p.id === p1)?.stars).toBe(3);
  });
});

