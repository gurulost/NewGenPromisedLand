import { describe, it, expect, beforeEach } from 'vitest';
import { getActionAvailability, getDetailedActionFeedback } from '../actionAvailabilityHelpers';
import type { GameState, PlayerState } from '@shared/types/game';
import type { Unit } from '@shared/types/unit';
import type { HexCoordinate, MapTile } from '@shared/types/game';

describe('ActionAvailabilityHelpers', () => {
  let mockGameState: GameState;
  let mockUnit: Unit;
  let mockPlayer: PlayerState;

  beforeEach(() => {
    const mockCoordinate: HexCoordinate = { q: 0, r: 0, s: 0 };
    
    mockPlayer = {
      id: 'player1',
      name: 'Test Player',
      faction: 'nephites',
      stars: 10,
      stats: { faith: 8, pride: 6, dissent: 2 },
      researchedTechs: ['organization'],
      cities: [],
      isEliminated: false
    };

    mockUnit = {
      id: 'unit1',
      type: 'warrior',
      playerId: 'player1',
      coordinate: mockCoordinate,
      hp: 10,
      maxHp: 10,
      attack: 5,
      defense: 3,
      movement: 2,
      remainingMovement: 2,
      hasAttacked: false,
      vision: 2,
      statusEffects: [],
      abilities: [],
      attackRange: 1
    };

    const mockTile: MapTile = {
      coordinate: mockCoordinate,
      terrain: 'plains',
      resources: [],
      hasCity: false,
      exploredBy: ['player1']
    };

    mockGameState = {
      id: 'game1',
      status: 'playing',
      currentPlayerIndex: 0,
      turnNumber: 1,
      players: [mockPlayer],
      units: [mockUnit],
      map: {
        width: 10,
        height: 10,
        tiles: [mockTile]
      },
      gameRules: {
        maxPlayers: 6,
        turnTimeLimit: 300,
        victoryConditions: ['domination']
      }
    };
  });

  describe('getActionAvailability', () => {
    it('should return correct availability for player turn', () => {
      const availability = getActionAvailability(mockUnit, mockGameState);
      
      expect(availability.isPlayerTurn).toBe(true);
      expect(availability.canMove).toBe(true);
      expect(availability.reachableTilesCount).toBeGreaterThan(0);
      expect(availability.movementReason).toContain('tiles available');
    });

    it('should disable actions when not player turn', () => {
      // Switch to different player
      mockGameState.currentPlayerIndex = 1;
      mockGameState.players.push({
        ...mockPlayer,
        id: 'player2',
        name: 'Other Player'
      });

      const availability = getActionAvailability(mockUnit, mockGameState);
      
      expect(availability.isPlayerTurn).toBe(false);
      expect(availability.canMove).toBe(false);
      expect(availability.canAttack).toBe(false);
      expect(availability.movementReason).toBe("Not your turn");
      expect(availability.attackReason).toBe("Not your turn");
    });

    it('should handle exhausted movement', () => {
      mockUnit.remainingMovement = 0;
      
      const availability = getActionAvailability(mockUnit, mockGameState);
      
      expect(availability.canMove).toBe(false);
      expect(availability.movementReason).toBe("No movement remaining");
    });

    it('should handle used attack', () => {
      mockUnit.hasAttacked = true;
      
      const availability = getActionAvailability(mockUnit, mockGameState);
      
      expect(availability.canAttack).toBe(false);
      expect(availability.attackReason).toBe("Already attacked this turn");
    });

    it('should check worker abilities correctly', () => {
      mockUnit.type = 'worker';
      mockPlayer.stars = 2; // Not enough for road building
      
      const availability = getActionAvailability(mockUnit, mockGameState);
      
      expect(availability.canBuild).toBe(true); // Can build on plains tile
    });

    it('should handle tile with resources for harvesting', () => {
      mockUnit.type = 'worker';
      mockGameState.map.tiles[0].resources = ['grain'];
      
      const availability = getActionAvailability(mockUnit, mockGameState);
      
      expect(availability.canHarvest).toBe(true);
    });

    it('should prevent building on city tiles', () => {
      mockUnit.type = 'worker';
      mockGameState.map.tiles[0].hasCity = true;
      
      const availability = getActionAvailability(mockUnit, mockGameState);
      
      expect(availability.canBuild).toBe(false);
    });
  });

  describe('getDetailedActionFeedback', () => {
    it('should provide detailed move feedback', () => {
      const availability = getActionAvailability(mockUnit, mockGameState);
      const feedback = getDetailedActionFeedback('move', availability);
      
      expect(feedback.available).toBe(true);
      expect(feedback.reason).toContain('tiles available');
      expect(feedback.count).toBeGreaterThan(0);
    });

    it('should provide detailed attack feedback', () => {
      const availability = getActionAvailability(mockUnit, mockGameState);
      const feedback = getDetailedActionFeedback('attack', availability);
      
      expect(feedback.available).toBe(false); // No targets
      expect(feedback.reason).toBe("No valid targets in range");
      expect(feedback.count).toBe(0);
    });

    it('should handle unknown action type', () => {
      const availability = getActionAvailability(mockUnit, mockGameState);
      const feedback = getDetailedActionFeedback('unknown' as any, availability);
      
      expect(feedback.available).toBe(false);
      expect(feedback.reason).toBe("Unknown action");
    });
  });

  describe('Edge Cases', () => {
    it('should handle unit with no attack capability', () => {
      mockUnit.attack = 0;
      
      const availability = getActionAvailability(mockUnit, mockGameState);
      
      expect(availability.canAttack).toBe(false);
      expect(availability.attackReason).toBe("Unit cannot attack");
    });

    it('should handle missionary abilities with insufficient faith', () => {
      mockUnit.type = 'missionary';
      mockPlayer.stats.faith = 2; // Less than required 5
      
      const availability = getActionAvailability(mockUnit, mockGameState);
      
      expect(availability.hasAbilities).toBe(false);
      expect(availability.abilityReason).toBe("Insufficient resources");
    });

    it('should handle commander abilities with sufficient pride', () => {
      mockUnit.type = 'commander';
      mockPlayer.stats.pride = 10; // More than required 5
      
      const availability = getActionAvailability(mockUnit, mockGameState);
      
      expect(availability.hasAbilities).toBe(true);
      expect(availability.abilityReason).toBe("1 abilities available");
    });
  });
});