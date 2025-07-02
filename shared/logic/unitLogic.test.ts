import { describe, it, expect, beforeEach } from 'vitest';
import { 
  isPassableForUnit, 
  calculateReachableTiles, 
  canSelectUnit, 
  canUnitReachCoordinate,
  getValidAttackTargets,
  canUnitAttackTarget,
  isUnitVisibleToPlayer,
  getVisibleUnits
} from './unitLogic';
import type { GameState, Unit, PlayerState } from '../types/game';
import type { HexCoordinate } from '../types/coordinates';

describe('Unit Logic', () => {
  let mockGameState: GameState;
  let testUnit: Unit;
  let enemyUnit: Unit;

  beforeEach(() => {
    testUnit = {
      id: 'unit1',
      type: 'warrior',
      playerId: 'player1',
      coordinate: { q: 0, r: 0, s: 0 },
      hp: 10,
      maxHp: 10,
      attack: 5,
      defense: 3,
      movement: 2,
      remainingMovement: 2,
      visionRadius: 2,
      attackRange: 1,
      status: 'active',
      experience: 0
    };

    enemyUnit = {
      id: 'enemy1',
      type: 'warrior',
      playerId: 'player2',
      coordinate: { q: 2, r: 0, s: -2 },
      hp: 8,
      maxHp: 10,
      attack: 4,
      defense: 2,
      movement: 2,
      remainingMovement: 2,
      visionRadius: 2,
      attackRange: 1,
      status: 'active',
      experience: 0
    };

    const mockPlayer: PlayerState = {
      id: 'player1',
      name: 'Test Player',
      factionId: 'nephites',
      isEliminated: false,
      stats: { faith: 50, pride: 30, internalDissent: 20 },
      stars: 100,
      researchedTechs: [],
      turnOrder: 0,
      visibilityMask: [],
      researchProgress: 0,
      citiesOwned: []
    };

    mockGameState = {
      map: {
        tiles: [
          { coordinate: { q: 0, r: 0, s: 0 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [] },
          { coordinate: { q: 1, r: 0, s: -1 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [] },
          { coordinate: { q: 0, r: 1, s: -1 }, terrain: 'mountain', resources: [], hasCity: false, exploredBy: [] },
          { coordinate: { q: 2, r: 0, s: -2 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [] },
          { coordinate: { q: -1, r: 0, s: 1 }, terrain: 'water', resources: [], hasCity: false, exploredBy: [] }
        ],
        width: 10,
        height: 10
      },
      players: [mockPlayer],
      units: [testUnit, enemyUnit],
      currentPlayerIndex: 0,
      turnNumber: 1,
      gamePhase: 'playing',
      winner: undefined,
      cities: []
    };
  });

  describe('isPassableForUnit', () => {
    it('should allow movement on plains', () => {
      expect(isPassableForUnit({ q: 1, r: 0, s: -1 }, mockGameState, testUnit)).toBe(true);
    });

    it('should allow movement on mountains', () => {
      expect(isPassableForUnit({ q: 0, r: 1, s: -1 }, mockGameState, testUnit)).toBe(true);
    });

    it('should block movement on water', () => {
      expect(isPassableForUnit({ q: -1, r: 0, s: 1 }, mockGameState, testUnit)).toBe(false);
    });

    it('should block movement to tiles with enemy units', () => {
      expect(isPassableForUnit({ q: 2, r: 0, s: -2 }, mockGameState, testUnit)).toBe(false);
    });

    it('should allow movement to tiles with friendly units', () => {
      const friendlyUnit: Unit = {
        ...enemyUnit,
        id: 'friendly1',
        playerId: 'player1'
      };
      mockGameState.units.push(friendlyUnit);

      expect(isPassableForUnit({ q: 2, r: 0, s: -2 }, mockGameState, testUnit)).toBe(true);
    });
  });

  describe('calculateReachableTiles', () => {
    it('should return tiles within movement range', () => {
      const reachableTiles = calculateReachableTiles(testUnit, mockGameState);
      
      expect(reachableTiles.length).toBeGreaterThan(0);
      
      // Should include adjacent tiles
      expect(reachableTiles).toContainEqual({ q: 1, r: 0, s: -1 });
      expect(reachableTiles).toContainEqual({ q: 0, r: 1, s: -1 });
    });

    it('should respect movement limitations', () => {
      const limitedUnit = { ...testUnit, remainingMovement: 1 };
      const reachableTiles = calculateReachableTiles(limitedUnit, mockGameState);
      
      // Should not reach tiles that are 2 moves away
      expect(reachableTiles).not.toContainEqual({ q: 2, r: 0, s: -2 });
    });

    it('should exclude impassable terrain', () => {
      const reachableTiles = calculateReachableTiles(testUnit, mockGameState);
      
      // Should not include water tiles
      expect(reachableTiles).not.toContainEqual({ q: -1, r: 0, s: 1 });
    });
  });

  describe('canSelectUnit', () => {
    it('should allow selecting own units', () => {
      expect(canSelectUnit(testUnit, mockGameState)).toBe(true);
    });

    it('should not allow selecting enemy units', () => {
      expect(canSelectUnit(enemyUnit, mockGameState)).toBe(false);
    });

    it('should not allow selecting units when not current player', () => {
      mockGameState.currentPlayerIndex = 1; // Switch to different player
      expect(canSelectUnit(testUnit, mockGameState)).toBe(false);
    });
  });

  describe('canUnitReachCoordinate', () => {
    it('should return true for coordinates within movement range', () => {
      expect(canUnitReachCoordinate(testUnit, { q: 1, r: 0, s: -1 }, mockGameState)).toBe(true);
    });

    it('should return false for coordinates beyond movement range', () => {
      expect(canUnitReachCoordinate(testUnit, { q: 3, r: 0, s: -3 }, mockGameState)).toBe(false);
    });

    it('should return false for impassable coordinates', () => {
      expect(canUnitReachCoordinate(testUnit, { q: -1, r: 0, s: 1 }, mockGameState)).toBe(false);
    });
  });

  describe('getValidAttackTargets', () => {
    it('should return enemy units within attack range', () => {
      // Move enemy unit within attack range
      enemyUnit.coordinate = { q: 1, r: 0, s: -1 };
      
      const targets = getValidAttackTargets(testUnit, mockGameState);
      
      expect(targets).toContain(enemyUnit);
    });

    it('should not return enemy units outside attack range', () => {
      // Enemy unit is at (2, 0, -2), which is 2 tiles away (outside range 1)
      const targets = getValidAttackTargets(testUnit, mockGameState);
      
      expect(targets).not.toContain(enemyUnit);
    });

    it('should not return friendly units', () => {
      const friendlyUnit: Unit = {
        ...enemyUnit,
        id: 'friendly1',
        playerId: 'player1',
        coordinate: { q: 1, r: 0, s: -1 } // Within attack range
      };
      mockGameState.units.push(friendlyUnit);
      
      const targets = getValidAttackTargets(testUnit, mockGameState);
      
      expect(targets).not.toContain(friendlyUnit);
    });
  });

  describe('canUnitAttackTarget', () => {
    it('should allow attacking enemy units within range', () => {
      enemyUnit.coordinate = { q: 1, r: 0, s: -1 };
      
      expect(canUnitAttackTarget(testUnit, enemyUnit, mockGameState)).toBe(true);
    });

    it('should not allow attacking units outside range', () => {
      expect(canUnitAttackTarget(testUnit, enemyUnit, mockGameState)).toBe(false);
    });

    it('should not allow attacking friendly units', () => {
      const friendlyUnit: Unit = {
        ...enemyUnit,
        id: 'friendly1',
        playerId: 'player1',
        coordinate: { q: 1, r: 0, s: -1 }
      };
      
      expect(canUnitAttackTarget(testUnit, friendlyUnit, mockGameState)).toBe(false);
    });
  });

  describe('isUnitVisibleToPlayer', () => {
    it('should see own units', () => {
      expect(isUnitVisibleToPlayer(testUnit, 'player1', mockGameState)).toBe(true);
    });

    it('should see enemy units within vision range', () => {
      enemyUnit.coordinate = { q: 1, r: 0, s: -1 }; // Within vision range
      
      expect(isUnitVisibleToPlayer(enemyUnit, 'player1', mockGameState)).toBe(true);
    });

    it('should not see enemy units outside vision range', () => {
      // Enemy unit is at (2, 0, -2), which is outside vision range
      expect(isUnitVisibleToPlayer(enemyUnit, 'player1', mockGameState)).toBe(false);
    });
  });

  describe('getVisibleUnits', () => {
    it('should return all own units', () => {
      const visibleUnits = getVisibleUnits(mockGameState, 'player1');
      
      expect(visibleUnits).toContain(testUnit);
    });

    it('should include enemy units within vision range', () => {
      enemyUnit.coordinate = { q: 1, r: 0, s: -1 }; // Within vision range
      
      const visibleUnits = getVisibleUnits(mockGameState, 'player1');
      
      expect(visibleUnits).toContain(enemyUnit);
    });

    it('should exclude enemy units outside vision range', () => {
      const visibleUnits = getVisibleUnits(mockGameState, 'player1');
      
      expect(visibleUnits).not.toContain(enemyUnit);
    });
  });
});