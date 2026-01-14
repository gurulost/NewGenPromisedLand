import { describe, it, expect } from 'vitest';
import { resolveActionState } from '../../shared/logic/resolveAction';
import type { GameState } from '../../shared/types/game';

describe('Morale events (Pride/Dissent)', () => {
  it('does not allow desertion below dissent floor', () => {
    const state: GameState = {
      id: 'g1',
      rngSeed: 1972, // forces a bad event roll in deterministic PRNG
      currentPlayerIndex: 0,
      turn: 10,
      phase: 'playing',
      winner: undefined,
      visibility: undefined,
      map: { width: 3, height: 3, tiles: [] },
      players: [
        {
          id: 'p1',
          name: 'P1',
          factionId: 'NEPHITES',
          isEliminated: false,
          stats: { faith: 50, pride: 80, internalDissent: 54 },
          stars: 50,
          researchedTechs: [],
          turnOrder: 0,
          visibilityMask: [],
          exploredTiles: [],
          researchProgress: 0,
          citiesOwned: ['c1'],
          constructionQueue: [],
          atWarWith: ['p2'],
          alliedWith: [],
          tradeRoutes: [],
          diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
        },
      ],
      cities: [
        {
          id: 'c1',
          name: 'City',
          coordinate: { q: 0, r: 0, s: 0 },
          ownerId: 'p1',
          population: 1,
          maxPopulation: 4,
          level: 1,
          starProduction: 2,
          unrestTurns: 0,
          improvements: [],
          structures: [],
          harvestedResources: [],
        },
      ],
      units: [
        {
          id: 'u1',
          type: 'warrior',
          playerId: 'p1',
          coordinate: { q: 0, r: 1, s: -1 },
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

    const after = resolveActionState(state, { type: 'END_TURN', payload: { playerId: 'p1' } } as any);
    expect(after.units.length).toBe(1); // no desertion possible
  });

  it('can cause desertion when dissent is high', () => {
    const state: GameState = {
      id: 'g1',
      rngSeed: 7135, // bad event + desertion selection + pick first deserter
      currentPlayerIndex: 0,
      turn: 30,
      phase: 'playing',
      winner: undefined,
      visibility: undefined,
      map: { width: 3, height: 3, tiles: [] },
      players: [
        {
          id: 'p1',
          name: 'P1',
          factionId: 'NEPHITES',
          isEliminated: false,
          stats: { faith: 50, pride: 70, internalDissent: 60 },
          stars: 50,
          researchedTechs: [],
          turnOrder: 0,
          visibilityMask: [],
          exploredTiles: [],
          researchProgress: 0,
          citiesOwned: ['c1'],
          constructionQueue: [],
          atWarWith: ['p2'],
          alliedWith: [],
          tradeRoutes: [],
          diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
        },
      ],
      cities: [
        {
          id: 'c1',
          name: 'City',
          coordinate: { q: 0, r: 0, s: 0 },
          ownerId: 'p1',
          population: 1,
          maxPopulation: 4,
          level: 1,
          starProduction: 2,
          unrestTurns: 0,
          improvements: [],
          structures: [],
          harvestedResources: [],
        },
      ],
      units: [
        {
          id: 'u1',
          type: 'warrior',
          playerId: 'p1',
          coordinate: { q: 0, r: 1, s: -1 },
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
        {
          id: 'u2',
          type: 'spearman',
          playerId: 'p1',
          coordinate: { q: 1, r: 0, s: -1 },
          hp: 20,
          maxHp: 20,
          attack: 7,
          defense: 5,
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

    const after = resolveActionState(state, { type: 'END_TURN', payload: { playerId: 'p1' } } as any);
    expect(after.units.some(u => u.id === 'u1')).toBe(false);
    expect(after.units.length).toBe(1);
  });

  it('rebellion can apply unrestTurns to a city', () => {
    const state: GameState = {
      id: 'g1',
      rngSeed: 1972, // bad event roll + rebellion selection
      currentPlayerIndex: 0,
      turn: 30,
      phase: 'playing',
      winner: undefined,
      visibility: undefined,
      map: { width: 3, height: 3, tiles: [] },
      players: [
        {
          id: 'p1',
          name: 'P1',
          factionId: 'NEPHITES',
          isEliminated: false,
          stats: { faith: 50, pride: 70, internalDissent: 70 },
          stars: 50,
          researchedTechs: [],
          turnOrder: 0,
          visibilityMask: [],
          exploredTiles: [],
          researchProgress: 0,
          citiesOwned: ['c1'],
          constructionQueue: [],
          atWarWith: ['p2'],
          alliedWith: [],
          tradeRoutes: [],
          diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
        },
      ],
      cities: [
        {
          id: 'c1',
          name: 'City',
          coordinate: { q: 0, r: 0, s: 0 },
          ownerId: 'p1',
          population: 1,
          maxPopulation: 4,
          level: 1,
          starProduction: 2,
          unrestTurns: 0,
          improvements: [],
          structures: [],
          harvestedResources: [],
        },
      ],
      units: [],
      improvements: [],
      structures: [],
    };

    const after = resolveActionState(state, { type: 'END_TURN', payload: { playerId: 'p1' } } as any);
    expect(after.cities.find(c => c.id === 'c1')?.unrestTurns).toBe(3);
  });
});
