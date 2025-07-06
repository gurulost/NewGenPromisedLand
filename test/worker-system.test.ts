import { describe, it, expect, beforeEach } from 'vitest';
import { gameReducer } from '../shared/logic/gameReducer';
import { executeUnitAction } from '../shared/logic/unitActions';
import { GameState, PlayerState, Tile } from '../shared/types/game';
import { getUnitDefinition } from '../shared/data/units';

describe('Worker System Comprehensive Tests', () => {
  let mockGameState: GameState;
  let mockPlayer: PlayerState;
  let mockWorker: Unit;

  beforeEach(() => {
    // Create a minimal game state for testing
    mockPlayer = {
      id: 'player1',
      name: 'Test Player',
      faction: 'nephites',
      isHuman: true,
      stars: 50,
      faith: 10,
      pride: 5,
      internalDissent: 0,
      researchedTechs: ['organization'], // Worker requires organization tech
      currentResearch: null,
      researchProgress: 0,
      visibleTiles: [],
      exploredTiles: [],
      units: [],
      constructionQueue: []
    };

    mockWorker = {
      id: 'worker1',
      type: 'worker',
      playerId: 'player1',
      coordinate: { q: 0, r: 0, s: 0 },
      status: 'active',
      hp: 10,
      maxHp: 10,
      attack: 1,
      defense: 1,
      movement: 2,
      visionRadius: 2,
      attackRange: 1,
      remainingMovement: 2,
      hasAttacked: false
    };

    const tiles: Tile[] = [
      // Worker's current position - plains
      {
        coordinate: { q: 0, r: 0, s: 0 },
        terrain: 'plains',
        resources: [],
        exploredBy: ['player1'],
        visibleTo: ['player1']
      },
      // Adjacent forest tile for clearing
      {
        coordinate: { q: 1, r: 0, s: -1 },
        terrain: 'forest',
        resources: [],
        exploredBy: ['player1'],
        visibleTo: ['player1']
      },
      // Adjacent mountain with resources for harvesting
      {
        coordinate: { q: 0, r: 1, s: -1 },
        terrain: 'mountain',
        resources: ['stone'],
        exploredBy: ['player1'],
        visibleTo: ['player1']
      },
      // Adjacent plains for road building
      {
        coordinate: { q: -1, r: 0, s: 1 },
        terrain: 'plains',
        resources: [],
        exploredBy: ['player1'],
        visibleTo: ['player1']
      },
      // Water tile (should not allow road building)
      {
        coordinate: { q: 0, r: -1, s: 1 },
        terrain: 'water',
        resources: [],
        exploredBy: ['player1'],
        visibleTo: ['player1']
      }
    ];

    mockGameState = {
      currentPlayerIndex: 0,
      players: [mockPlayer],
      units: [mockWorker],
      cities: [{
        id: 'city1',
        name: 'Test City',
        coordinate: { q: 1, r: 1, s: -2 },
        ownerId: 'player1',
        population: 3,
        level: 1,
        maxPopulation: 5,
        starProduction: 2,
        structures: [],
        harvestedResources: []
      }],
      improvements: [],
      map: {
        width: 10,
        height: 10,
        tiles
      },
      turn: 1,
      gamePhase: 'playing',
      winner: null
    };
  });

  describe('Worker Unit Definition', () => {
    it('should have correct base stats', () => {
      const workerDef = getUnitDefinition('worker');
      
      expect(workerDef.type).toBe('worker');
      expect(workerDef.name).toBe('Worker');
      expect(workerDef.cost).toBe(5);
      expect(workerDef.baseStats.hp).toBe(10);
      expect(workerDef.baseStats.movement).toBe(2);
      expect(workerDef.requiredTechnology).toBe('organization');
    });

    it('should have all required abilities', () => {
      const workerDef = getUnitDefinition('worker');
      
      expect(workerDef.abilities).toContain('BUILD');
      expect(workerDef.abilities).toContain('HARVEST');
      expect(workerDef.abilities).toContain('CLEAR_FOREST');
      expect(workerDef.abilities).toContain('BUILD_ROAD');
    });
  });

  describe('BUILD_ROAD Action', () => {
    it('should successfully build road on valid terrain', () => {
      const targetCoordinate = { q: -1, r: 0, s: 1 }; // Plains tile
      
      const result = executeUnitAction(
        mockGameState,
        mockWorker.id,
        'BUILD_ROAD',
        undefined,
        targetCoordinate
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Road built');
      expect(result.newState).toBeDefined();
      
      if (result.newState) {
        // Check that stars were deducted
        const updatedPlayer = result.newState.players[0];
        expect(updatedPlayer.stars).toBe(47); // 50 - 3 stars

        // Check that road improvement was created
        expect(result.newState.improvements).toHaveLength(1);
        const road = result.newState.improvements[0];
        expect(road.type).toBe('road');
        expect(road.coordinate).toEqual(targetCoordinate);
        expect(road.playerId).toBe('player1');
      }
    });

    it('should fail when insufficient stars', () => {
      // Set player stars to less than required
      mockGameState.players[0].stars = 2;
      
      const result = executeUnitAction(
        mockGameState,
        mockWorker.id,
        'BUILD_ROAD',
        undefined,
        { q: -1, r: 0, s: 1 }
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Need 3 stars');
    });

    it('should fail on water terrain', () => {
      const result = executeUnitAction(
        mockGameState,
        mockWorker.id,
        'BUILD_ROAD',
        undefined,
        { q: 0, r: -1, s: 1 } // Water tile
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Cannot build roads on water');
    });

    it('should fail when road already exists', () => {
      const targetCoordinate = { q: -1, r: 0, s: 1 };
      
      // Add existing road to game state
      mockGameState.improvements = [{
        id: 'existing_road',
        type: 'road',
        coordinate: targetCoordinate,
        playerId: 'player1',
        cityId: '',
        starsPerTurn: 0
      }];

      const result = executeUnitAction(
        mockGameState,
        mockWorker.id,
        'BUILD_ROAD',
        undefined,
        targetCoordinate
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Road already exists');
    });
  });

  describe('CLEAR_FOREST Action', () => {
    it('should successfully clear forest', () => {
      const targetCoordinate = { q: 1, r: 0, s: -1 }; // Forest tile
      
      const result = executeUnitAction(
        mockGameState,
        mockWorker.id,
        'CLEAR_FOREST',
        undefined,
        targetCoordinate
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Forest cleared');
      expect(result.newState).toBeDefined();
      
      if (result.newState) {
        // Check that stars were deducted
        const updatedPlayer = result.newState.players[0];
        expect(updatedPlayer.stars).toBe(45); // 50 - 5 stars

        // Check that terrain was converted
        const updatedTile = result.newState.map.tiles.find(
          t => t.coordinate.q === 1 && t.coordinate.r === 0
        );
        expect(updatedTile?.terrain).toBe('plains');
      }
    });

    it('should fail when insufficient stars', () => {
      mockGameState.players[0].stars = 3; // Less than 5 required
      
      const result = executeUnitAction(
        mockGameState,
        mockWorker.id,
        'CLEAR_FOREST',
        undefined,
        { q: 1, r: 0, s: -1 }
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Need 5 stars');
    });

    it('should fail on non-forest terrain', () => {
      const result = executeUnitAction(
        mockGameState,
        mockWorker.id,
        'CLEAR_FOREST',
        undefined,
        { q: -1, r: 0, s: 1 } // Plains tile
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Can only clear forest');
    });
  });

  describe('HARVEST Action', () => {
    it('should successfully harvest mountain resource', () => {
      const targetCoordinate = { q: 0, r: 1, s: -1 }; // Mountain with stone
      
      const result = executeUnitAction(
        mockGameState,
        mockWorker.id,
        'HARVEST',
        undefined,
        targetCoordinate
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Harvested mountain');
      expect(result.newState).toBeDefined();
      
      if (result.newState) {
        // Check that terrain was converted and resource removed
        const updatedTile = result.newState.map.tiles.find(
          t => t.coordinate.q === 0 && t.coordinate.r === 1
        );
        expect(updatedTile?.terrain).toBe('plains');
        expect(updatedTile?.resource).toBeUndefined();
      }
    });

    it('should provide population boost to nearest city', () => {
      const targetCoordinate = { q: 0, r: 1, s: -1 }; // Mountain with stone
      
      const result = executeUnitAction(
        mockGameState,
        mockWorker.id,
        'HARVEST',
        undefined,
        targetCoordinate
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('gained');
      
      if (result.newState) {
        const updatedCity = result.newState.cities![0];
        expect(updatedCity.population).toBeGreaterThan(3); // Should have increased
      }
    });
  });

  describe('Game Reducer Integration', () => {
    it('should handle BUILD_ROAD action through reducer', () => {
      const action = {
        type: 'BUILD_ROAD' as const,
        payload: {
          unitId: 'worker1',
          targetCoordinate: { q: -1, r: 0, s: 1 },
          playerId: 'player1'
        }
      };

      const newState = gameReducer(mockGameState, action);
      
      // Check that state was updated correctly
      expect(newState.players[0].stars).toBe(47); // 50 - 3
      expect(newState.improvements).toHaveLength(1);
      expect(newState.improvements[0].type).toBe('road');
      
      // Check that unit was exhausted
      const updatedWorker = newState.units.find(u => u.id === 'worker1');
      expect(updatedWorker?.remainingMovement).toBe(0);
    });

    it('should handle CLEAR_FOREST action through reducer', () => {
      const action = {
        type: 'CLEAR_FOREST' as const,
        payload: {
          unitId: 'worker1',
          targetCoordinate: { q: 1, r: 0, s: -1 },
          playerId: 'player1'
        }
      };

      const newState = gameReducer(mockGameState, action);
      
      expect(newState.players[0].stars).toBe(45); // 50 - 5
      
      const updatedTile = newState.map.tiles.find(
        t => t.coordinate.q === 1 && t.coordinate.r === 0
      );
      expect(updatedTile?.terrain).toBe('plains');
    });
  });

  describe('Action Validation', () => {
    it('should require adjacency for all actions', () => {
      const distantCoordinate = { q: 5, r: 5, s: -10 };
      
      const roadResult = executeUnitAction(
        mockGameState,
        mockWorker.id,
        'BUILD_ROAD',
        undefined,
        distantCoordinate
      );
      expect(roadResult.success).toBe(false);

      const forestResult = executeUnitAction(
        mockGameState,
        mockWorker.id,
        'CLEAR_FOREST',
        undefined,
        distantCoordinate
      );
      expect(forestResult.success).toBe(false);
    });

    it('should exhaust unit movement after successful actions', () => {
      const result = executeUnitAction(
        mockGameState,
        mockWorker.id,
        'BUILD_ROAD',
        undefined,
        { q: -1, r: 0, s: 1 }
      );

      expect(result.success).toBe(true);
      if (result.newState) {
        const updatedWorker = result.newState.units.find(u => u.id === 'worker1');
        expect(updatedWorker?.remainingMovement).toBe(0);
      }
    });

    it('should validate player ownership', () => {
      // Change worker to different player
      mockWorker.playerId = 'player2';
      
      const result = executeUnitAction(
        mockGameState,
        mockWorker.id,
        'BUILD_ROAD',
        undefined,
        { q: -1, r: 0, s: 1 }
      );

      expect(result.success).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing target coordinate', () => {
      const result = executeUnitAction(
        mockGameState,
        mockWorker.id,
        'BUILD_ROAD'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid');
    });

    it('should handle non-existent tiles', () => {
      const result = executeUnitAction(
        mockGameState,
        mockWorker.id,
        'BUILD_ROAD',
        undefined,
        { q: 100, r: 100, s: -200 }
      );

      expect(result.success).toBe(false);
    });

    it('should handle worker without required technology', () => {
      mockGameState.players[0].researchedTechs = []; // Remove organization tech
      
      const result = executeUnitAction(
        mockGameState,
        mockWorker.id,
        'BUILD_ROAD',
        undefined,
        { q: -1, r: 0, s: 1 }
      );

      // Should still work as the unit exists (tech is checked at recruitment)
      expect(result.success).toBe(true);
    });
  });
});