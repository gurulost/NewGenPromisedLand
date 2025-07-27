import { describe, it, expect } from 'vitest';
import { getPlayerStats } from '../player';
import { GameState } from '../../../../shared/types/game';

describe('Player Selectors', () => {
  const mockGameState: GameState = {
    players: [
      {
        id: 'player1',
        name: 'Test Player',
        faction: 'nephites',
        stars: 15,
        faith: 8,
        pride: 3,
        dissent: 2,
        population: 10,
        cities: [
          {
            id: 'city1',
            name: 'Test City',
            ownerId: 'player1',
            coordinate: { q: 0, r: 0, s: 0 },
            population: 5,
            structures: [],
            improvements: [],
          },
        ],
      },
    ],
    currentTurn: 1,
    currentPlayerId: 'player1',
  } as GameState;

  describe('getPlayerStats', () => {
    it('returns basic player statistics', () => {
      const stats = getPlayerStats(mockGameState, 'player1');
      
      expect(stats).toEqual({
        stars: 15,
        faith: 8,
        pride: 3,
        dissent: 2,
        population: 10,
      });
    });

    it('handles missing player gracefully', () => {
      const stats = getPlayerStats(mockGameState, 'nonexistent');
      
      expect(stats).toEqual({
        stars: 0,
        faith: 0,
        pride: 0,
        dissent: 0,
        population: 0,
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
      expect(player.faith).toBeGreaterThanOrEqual(0);
      expect(player.population).toBeGreaterThan(0);
    });
  });
});