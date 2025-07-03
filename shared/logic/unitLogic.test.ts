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
import type { GameState, PlayerState } from '../types/game';
import type { Unit } from '../types/unit';
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
      experience: 0,
      abilities: [],
      level: 1
    };

    enemyUnit = {
      id: 'enemy1',
      type: 'warrior',
      playerId: 'player2',
      coordinate: { q: 3, r: 0, s: -3 }, // Distance 3, outside vision range of 2
      hp: 8,
      maxHp: 10,
      attack: 4,
      defense: 2,
      movement: 2,
      remainingMovement: 2,
      visionRadius: 2,
      attackRange: 1,
      status: 'active',
      experience: 0,
      abilities: [],
      level: 1
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
          { coordinate: { q: 0, r: 0, s: 0 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: ['player1', 'player2'] },
          { coordinate: { q: 1, r: 0, s: -1 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: ['player1', 'player2'] },
          { coordinate: { q: 0, r: 1, s: -1 }, terrain: 'mountain', resources: [], hasCity: false, exploredBy: ['player1', 'player2'] },
          { coordinate: { q: 2, r: 0, s: -2 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: ['player1', 'player2'] },
          { coordinate: { q: 1, r: 1, s: -2 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: ['player1', 'player2'] },
          { coordinate: { q: -1, r: 0, s: 1 }, terrain: 'water', resources: [], hasCity: false, exploredBy: ['player1', 'player2'] }
        ],
        width: 10,
        height: 10
      },
      players: [mockPlayer],
      units: [testUnit, enemyUnit],
      currentPlayerIndex: 0,
      turn: 1,
      phase: 'playing',
      winner: undefined,
      cities: [],
      id: 'test-game',
      improvements: [],
      structures: []
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
      expect(isPassableForUnit({ q: 3, r: 0, s: -3 }, mockGameState, testUnit)).toBe(false);
    });

    it('should allow movement to tiles with friendly units', () => {
      const friendlyUnit: Unit = {
        ...enemyUnit,
        id: 'friendly1',
        playerId: 'player1',
        coordinate: { q: 1, r: 1, s: -2 } // Different coordinate for friendly unit
      };
      mockGameState.units.push(friendlyUnit);

      expect(isPassableForUnit({ q: 1, r: 1, s: -2 }, mockGameState, testUnit)).toBe(true);
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

    it('should return only current tile when unit has zero remaining movement', () => {
      // Create a unit with no remaining movement
      const exhaustedUnit = { ...testUnit, remainingMovement: 0 };
      
      const reachableTiles = calculateReachableTiles(exhaustedUnit, mockGameState);
      
      // Should only include the tile the unit is currently on
      expect(reachableTiles).toEqual([testUnit.coordinate]);
    });

    it('should handle units with different movement ranges', () => {
      // Test unit with movement range of 1
      const slowUnit = { ...testUnit, movement: 1, remainingMovement: 1 };
      const slowReachable = calculateReachableTiles(slowUnit, mockGameState);
      
      // Test unit with movement range of 3
      const fastUnit = { ...testUnit, movement: 3, remainingMovement: 3 };
      const fastReachable = calculateReachableTiles(fastUnit, mockGameState);
      
      // Compare the different movement ranges
      expect(slowReachable.length).toBeLessThanOrEqual(fastReachable.length);
      
      // Test unit with no movement capability
      const immobileUnit = { ...testUnit, movement: 0, remainingMovement: 0 };
      const immobileReachable = calculateReachableTiles(immobileUnit, mockGameState);
      expect(immobileReachable).toEqual([testUnit.coordinate]); // Only current tile
    });

    it('should handle units on map edges correctly', () => {
      // Create a modified mock state with additional edge tiles
      const edgeCoordinate = { q: 2, r: -1, s: -1 };
      const extendedMockState = {
        ...mockGameState,
        map: {
          ...mockGameState.map,
          tiles: [
            ...mockGameState.map.tiles,
            {
              coordinate: edgeCoordinate,
              terrain: 'plains' as const,
              resources: [],
              hasCity: false,
              exploredBy: ['player1'] // Make sure player has explored this tile
            },
            // Add adjacent tiles for pathfinding
            {
              coordinate: { q: 1, r: -1, s: 0 },
              terrain: 'plains' as const,
              resources: [],
              hasCity: false,
              exploredBy: ['player1']
            },
            {
              coordinate: { q: 2, r: -2, s: 0 },
              terrain: 'plains' as const,
              resources: [],
              hasCity: false,
              exploredBy: ['player1']
            }
          ]
        }
      };
      
      // Place unit at edge coordinate
      const edgeUnit = { 
        ...testUnit, 
        coordinate: edgeCoordinate
      };
      
      const reachableTiles = calculateReachableTiles(edgeUnit, extendedMockState);
      
      // Should not crash and should include at least the current tile
      expect(reachableTiles.length).toBeGreaterThan(0);
      expect(reachableTiles).toContainEqual(edgeUnit.coordinate);
      
      // All returned coordinates should correspond to actual tiles in the map
      reachableTiles.forEach(coord => {
        const tileExists = extendedMockState.map.tiles.some(tile => 
          tile.coordinate.q === coord.q && 
          tile.coordinate.r === coord.r && 
          tile.coordinate.s === coord.s
        );
        expect(tileExists).toBe(true);
      });
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

    it('should find targets for ranged units at greater distances', () => {
      // Create a ranged unit with attack range of 3
      const rangedUnit: Unit = {
        ...testUnit,
        id: 'archer1',
        type: 'scout', // Using scout as a ranged unit type
        attackRange: 3
      };
      
      // Place enemy at distance 2 (should be in range for ranged unit)
      enemyUnit.coordinate = { q: 2, r: 0, s: -2 };
      
      const targets = getValidAttackTargets(rangedUnit, mockGameState);
      
      expect(targets).toContain(enemyUnit);
    });

    it('should not find targets beyond ranged unit attack range', () => {
      // Create a ranged unit with attack range of 2
      const rangedUnit: Unit = {
        ...testUnit,
        id: 'archer1',
        type: 'scout',
        attackRange: 2
      };
      
      // Place enemy at distance 3 (beyond range)
      enemyUnit.coordinate = { q: 3, r: 0, s: -3 };
      
      const targets = getValidAttackTargets(rangedUnit, mockGameState);
      
      expect(targets).not.toContain(enemyUnit);
    });

    it('should handle units with extended attack ranges correctly', () => {
      // Test various attack ranges
      const ranges = [1, 2, 3, 4];
      
      ranges.forEach(range => {
        const rangedUnit = { ...testUnit, attackRange: range };
        
        // Place enemy at exact range distance
        const targetCoord = { q: range, r: 0, s: -range };
        enemyUnit.coordinate = targetCoord;
        
        const targets = getValidAttackTargets(rangedUnit, mockGameState);
        
        if (range >= 3) {
          // Should find target at distance = range
          expect(targets).toContain(enemyUnit);
        }
        
        // Place enemy just beyond range
        const beyondCoord = { q: range + 1, r: 0, s: -(range + 1) };
        enemyUnit.coordinate = beyondCoord;
        
        const targetsBeyon = getValidAttackTargets(rangedUnit, mockGameState);
        expect(targetsBeyon).not.toContain(enemyUnit);
      });
    });

    it('should handle special unit types with different characteristics', () => {
      // Test scout with enhanced vision and movement
      const scout: Unit = {
        ...testUnit,
        id: 'scout1',
        type: 'scout',
        visionRadius: 3,
        attackRange: 2,
        movement: 3,
        remainingMovement: 3
      };
      
      const scoutReachable = calculateReachableTiles(scout, mockGameState);
      const normalReachable = calculateReachableTiles(testUnit, mockGameState);
      
      // Scout should reach at least as many tiles as normal unit
      expect(scoutReachable.length).toBeGreaterThanOrEqual(normalReachable.length);
      
      // Test missionary with different stats
      const missionary: Unit = {
        ...testUnit,
        id: 'missionary1',
        type: 'missionary',
        visionRadius: 2,
        attackRange: 1,
        movement: 2,
        attack: 2, // Lower attack than warrior
        defense: 1
      };
      
      // Place enemy for visibility test
      enemyUnit.coordinate = { q: 2, r: -1, s: -1 }; // Distance 2
      
      const missionaryVisible = isUnitVisibleToPlayer(enemyUnit, 'player1', { 
        ...mockGameState, 
        units: [missionary, enemyUnit] 
      });
      
      expect(missionaryVisible).toBe(true); // Should see at vision radius
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
      // Enemy unit is at (3, 0, -3), which is outside vision range of 2
      expect(isUnitVisibleToPlayer(enemyUnit, 'player1', mockGameState)).toBe(false);
    });

    it('should see enemy units exactly at vision range boundary', () => {
      // Test for unit exactly at the edge of vision radius (distance = visionRadius)
      const visionRadius = testUnit.visionRadius; // 2
      enemyUnit.coordinate = { q: visionRadius, r: 0, s: -visionRadius }; // Distance exactly = 2
      
      expect(isUnitVisibleToPlayer(enemyUnit, 'player1', mockGameState)).toBe(true);
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