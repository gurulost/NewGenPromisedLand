import { describe, it, expect, vi, afterEach } from 'vitest';
import { executeElementHarvest } from '../../shared/logic/worldElementActions';
import type { GameState } from '../../shared/types/game';

describe('Jaredite ruins exploration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not spawn ancient giants before turn 20', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999); // would pick the rarest option if available

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
        tiles: [{ coordinate: { q: 0, r: 0, s: 0 }, terrain: 'plains', resources: ['jaredite_ruins'], hasCity: false, exploredBy: ['p1'] }],
      },
      players: [
        {
          id: 'p1',
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
      ],
      cities: [],
      units: [],
      improvements: [],
      structures: [],
    };

    const result = executeElementHarvest(state, 'p1', 'jaredite_ruins', { q: 0, r: 0, s: 0 });
    expect(result.success).toBe(true);
    expect(result.newState?.units.some(u => u.type === 'ancient_giant')).toBe(false);
  });

  it('can spawn an ancient giant after turn 20 (rare)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999); // pick last-weight option (giant when eligible)

    const state: GameState = {
      id: 'g1',
      currentPlayerIndex: 0,
      turn: 25,
      phase: 'playing',
      winner: undefined,
      visibility: undefined,
      map: {
        width: 5,
        height: 5,
        tiles: [{ coordinate: { q: 0, r: 0, s: 0 }, terrain: 'plains', resources: ['jaredite_ruins'], hasCity: false, exploredBy: ['p1'] }],
      },
      players: [
        {
          id: 'p1',
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
      ],
      cities: [],
      units: [],
      improvements: [],
      structures: [],
    };

    const result = executeElementHarvest(state, 'p1', 'jaredite_ruins', { q: 0, r: 0, s: 0 });
    expect(result.success).toBe(true);
    expect(result.newState?.units.some(u => u.type === 'ancient_giant')).toBe(true);
  });
});

