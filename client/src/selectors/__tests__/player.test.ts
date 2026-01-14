import { describe, it, expect } from 'vitest';
import { getPlayerStats } from '../player';
import { GameState } from '../../../../shared/types/game';
import { GameRuleHelpers } from '../../../../shared/data/gameRules';

describe('Player Selectors', () => {
  const mockGameState: GameState = {
    id: 'game-1',
    players: [
      {
        id: 'player1',
        name: 'Test Player',
        factionId: 'NEPHITES',
        stars: 15,
        stats: {
          faith: 8,
          pride: 3,
          internalDissent: 2,
        },
        modifiers: [],
        researchedTechs: [],
        researchProgress: 0,
        citiesOwned: [],
        constructionQueue: [],
        visibilityMask: [],
        exploredTiles: [],
        isEliminated: false,
        turnOrder: 0,
        atWarWith: [],
        alliedWith: [],
        tradeRoutes: [],
        diplomaticCooldowns: {
          declareWar: 0,
          formAlliance: 0,
          breakAlliance: 0,
          requestTrade: 0,
        },
      },
    ],
    currentPlayerIndex: 0,
    turn: 1,
    phase: 'playing',
    map: {
      width: 4,
      height: 4,
      tiles: [],
    },
    units: [],
    cities: [],
    improvements: [],
    structures: [],
  } as GameState;

  describe('getPlayerStats', () => {
    it('returns basic player statistics', () => {
      const player = mockGameState.players[0];
      const stats = getPlayerStats(player, mockGameState);
      
      expect(stats).toMatchObject({
        faithPercentage: 8,
        pridePercentage: 3,
        dissentPercentage: 2,
        cityCount: 0,
        techCount: 0,
      });
      const breakdownTotal = stats.starProductionBreakdown.reduce((sum, entry) => sum + entry.amount, 0);
      expect(stats.starProduction).toBe(breakdownTotal);
    });

    it('handles missing game state gracefully', () => {
      const player = mockGameState.players[0];
      const stats = getPlayerStats(player, null);
      
      const fallback = GameRuleHelpers.calculateStarIncome(player.citiesOwned?.length ?? 0);
      expect(stats).toMatchObject({
        faithPercentage: 8,
        pridePercentage: 3,
        dissentPercentage: 2,
        cityCount: 0,
        techCount: 0,
        starProduction: fallback,
      });
    });
  });

  describe('player stats validation', () => {
    it('validates player exists in game state', () => {
      const player = mockGameState.players.find(p => p.id === 'player1');
      expect(player).toBeDefined();
      expect(player?.name).toBe('Test Player');
    });

    it('handles player resource calculations', () => {
      const player = mockGameState.players[0];
      expect(player.stars).toBeGreaterThan(0);
      expect(player.stats.faith).toBeGreaterThanOrEqual(0);
      expect(player.citiesOwned.length).toBeGreaterThanOrEqual(0);
    });
  });
});
