import { describe, it, expect, vi, afterEach } from 'vitest';
import { gameReducer } from '../../shared/logic/gameReducer';
import type { GameState } from '../../shared/types/game';
import { GAME_RULES } from '../../shared/data/gameRules';

describe('Missionary unit conversion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('converts an adjacent enemy unit, costs faith, and consumes the missionary action', () => {
    const state: GameState = {
      id: 'g1',
      rngSeed: 12345,
      currentPlayerIndex: 0,
      turn: 1,
      phase: 'playing',
      map: { width: 3, height: 3, tiles: [] },
      players: [
        {
          id: 'p1',
          name: 'P1',
          factionId: 'NEPHITES',
          isEliminated: false,
          stats: { faith: 100, pride: 10, internalDissent: 0 },
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
          id: 'p2',
          name: 'P2',
          factionId: 'LAMANITES',
          isEliminated: false,
          stats: { faith: 0, pride: 80, internalDissent: 50 },
          stars: 0,
          researchedTechs: [],
          turnOrder: 1,
          visibilityMask: [],
          exploredTiles: [],
          researchProgress: 0,
          citiesOwned: [],
          constructionQueue: [],
          atWarWith: [],
          alliedWith: [],
          tradeRoutes: [],
          diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
        }
      ],
      cities: [],
      units: [
        {
          id: 'm1',
          type: 'missionary',
          playerId: 'p1',
          coordinate: { q: 0, r: 0, s: 0 },
          hp: 18,
          maxHp: 18,
          attack: 1,
          defense: 2,
          movement: 3,
          remainingMovement: 3,
          maxActions: 1,
          actionsRemaining: 1,
          visionRadius: 2,
          attackRange: 1,
          status: 'active',
          experience: 0,
          abilities: ['heal', 'convert'],
          level: 1,
          hasAttacked: false,
        } as any,
        {
          id: 'e1',
          type: 'warrior',
          playerId: 'p2',
          coordinate: { q: 1, r: 0, s: -1 },
          hp: 25,
          maxHp: 25,
          attack: 6,
          defense: 4,
          movement: 3,
          remainingMovement: 3,
          maxActions: 1,
          actionsRemaining: 1,
          visionRadius: 2,
          attackRange: 1,
          status: 'active',
          experience: 0,
          abilities: [],
          level: 1,
          hasAttacked: false,
        } as any
      ],
      improvements: [],
      structures: [],
      winner: undefined,
      visibility: undefined,
    };

    const after = gameReducer(state, {
      type: 'CONVERT_UNIT',
      payload: { playerId: 'p1', unitId: 'm1', targetUnitId: 'e1' }
    } as any);

    const expectedNextSeed = (Math.imul((state.rngSeed ?? 0) >>> 0, 1664525) + 1013904223) >>> 0;
    expect(after.players.find(p => p.id === 'p1')?.stats.faith).toBe(100 - GAME_RULES.conversion.costs.unit);
    expect(after.rngSeed).toBe(expectedNextSeed);
    expect(after.units.find(u => u.id === 'm1')?.hasAttacked).toBe(true);
    expect(after.units.find(u => u.id === 'm1')?.actionsRemaining).toBe(0);
    expect(after.units.find(u => u.id === 'e1')?.playerId).toBe('p1');
    expect((after.lastAction as any)?.type).toBe('CONVERT_UNIT');
  });

  it('can fail conversion while still costing faith', () => {
    const state: GameState = {
      id: 'g1',
      rngSeed: 999999,
      currentPlayerIndex: 0,
      turn: 1,
      phase: 'playing',
      map: { width: 3, height: 3, tiles: [] },
      players: [
        {
          id: 'p1',
          name: 'P1',
          factionId: 'NEPHITES',
          isEliminated: false,
          stats: { faith: 50, pride: 10, internalDissent: 0 },
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
          id: 'p2',
          name: 'P2',
          factionId: 'LAMANITES',
          isEliminated: false,
          stats: { faith: 100, pride: 0, internalDissent: 0 },
          stars: 0,
          researchedTechs: [],
          turnOrder: 1,
          visibilityMask: [],
          exploredTiles: [],
          researchProgress: 0,
          citiesOwned: [],
          constructionQueue: [],
          atWarWith: [],
          alliedWith: [],
          tradeRoutes: [],
          diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
        }
      ],
      cities: [],
      units: [
        {
          id: 'm1',
          type: 'missionary',
          playerId: 'p1',
          coordinate: { q: 0, r: 0, s: 0 },
          hp: 18,
          maxHp: 18,
          attack: 1,
          defense: 2,
          movement: 3,
          remainingMovement: 3,
          maxActions: 1,
          actionsRemaining: 1,
          visionRadius: 2,
          attackRange: 1,
          status: 'active',
          experience: 0,
          abilities: ['heal', 'convert'],
          level: 1,
          hasAttacked: false,
        } as any,
        {
          id: 'e1',
          type: 'warrior',
          playerId: 'p2',
          coordinate: { q: 1, r: 0, s: -1 },
          hp: 25,
          maxHp: 25,
          attack: 6,
          defense: 4,
          movement: 3,
          remainingMovement: 3,
          maxActions: 1,
          actionsRemaining: 1,
          visionRadius: 2,
          attackRange: 1,
          status: 'active',
          experience: 0,
          abilities: [],
          level: 1,
          hasAttacked: false,
        } as any
      ],
      improvements: [],
      structures: [],
      winner: undefined,
      visibility: undefined,
    };

    const after = gameReducer(state, {
      type: 'CONVERT_UNIT',
      payload: { playerId: 'p1', unitId: 'm1', targetUnitId: 'e1' }
    } as any);

    const expectedNextSeed = (Math.imul((state.rngSeed ?? 0) >>> 0, 1664525) + 1013904223) >>> 0;
    expect(after.players.find(p => p.id === 'p1')?.stats.faith).toBe(50 - GAME_RULES.conversion.costs.unit);
    expect(after.rngSeed).toBe(expectedNextSeed);
    expect(after.units.find(u => u.id === 'e1')?.playerId).toBe('p2');
  });

  it('does not advance rngSeed on invalid attempts (out of range)', () => {
    const state: GameState = {
      id: 'g1',
      rngSeed: 7,
      currentPlayerIndex: 0,
      turn: 1,
      phase: 'playing',
      map: { width: 3, height: 3, tiles: [] },
      players: [
        {
          id: 'p1',
          name: 'P1',
          factionId: 'NEPHITES',
          isEliminated: false,
          stats: { faith: 100, pride: 10, internalDissent: 0 },
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
          id: 'p2',
          name: 'P2',
          factionId: 'LAMANITES',
          isEliminated: false,
          stats: { faith: 0, pride: 80, internalDissent: 50 },
          stars: 0,
          researchedTechs: [],
          turnOrder: 1,
          visibilityMask: [],
          exploredTiles: [],
          researchProgress: 0,
          citiesOwned: [],
          constructionQueue: [],
          atWarWith: [],
          alliedWith: [],
          tradeRoutes: [],
          diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
        }
      ],
      cities: [],
      units: [
        {
          id: 'm1',
          type: 'missionary',
          playerId: 'p1',
          coordinate: { q: 0, r: 0, s: 0 },
          hp: 18,
          maxHp: 18,
          attack: 1,
          defense: 2,
          movement: 3,
          remainingMovement: 3,
          maxActions: 1,
          actionsRemaining: 1,
          visionRadius: 2,
          attackRange: 1,
          status: 'active',
          experience: 0,
          abilities: ['heal', 'convert'],
          level: 1,
          hasAttacked: false,
        } as any,
        {
          id: 'e1',
          type: 'warrior',
          playerId: 'p2',
          coordinate: { q: 5, r: 0, s: -5 },
          hp: 25,
          maxHp: 25,
          attack: 6,
          defense: 4,
          movement: 3,
          remainingMovement: 3,
          maxActions: 1,
          actionsRemaining: 1,
          visionRadius: 2,
          attackRange: 1,
          status: 'active',
          experience: 0,
          abilities: [],
          level: 1,
          hasAttacked: false,
        } as any
      ],
      improvements: [],
      structures: [],
      winner: undefined,
      visibility: undefined,
    };

    const after = gameReducer(state, {
      type: 'CONVERT_UNIT',
      payload: { playerId: 'p1', unitId: 'm1', targetUnitId: 'e1' }
    } as any);

    expect(after.rngSeed).toBe(7);
    expect(after.units.find(u => u.id === 'e1')?.playerId).toBe('p2');
  });
});
