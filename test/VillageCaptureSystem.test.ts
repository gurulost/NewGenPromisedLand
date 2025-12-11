import { describe, it, expect, beforeEach } from 'vitest';
import { gameReducer } from '@shared/logic/gameReducer';
import { GameState, PlayerState } from '@shared/types/game';
import { Unit } from '@shared/types/unit';
import { HexCoordinate } from '@shared/utils/coordinates';

describe('Village Capture System', () => {
  let mockGameState: GameState;
  let mockPlayer: PlayerState;
  let mockUnit: Unit;
  let villageCoordinate: HexCoordinate;

  beforeEach(() => {
    villageCoordinate = { q: 0, r: 1, s: -1 };
    
    mockPlayer = {
      id: 'player1',
      name: 'Test Player',
      factionId: 'nephites',
      stars: 10,
      stats: {
        faith: 5,
        pride: 3,
        internalDissent: 1
      },
      modifiers: [],
      researchedTechs: [],
      researchProgress: 2,
      citiesOwned: [],
      visibilityMask: [],
      exploredTiles: [],
      isEliminated: false,
      turnOrder: 0,
      constructionQueue: []
    };

    mockUnit = {
      id: 'unit1',
      type: 'warrior',
      playerId: 'player1',
      coordinate: villageCoordinate,
      hp: 10,
      maxHp: 10,
      attack: 2,
      defense: 2,
      movement: 1,
      remainingMovement: 1,
      visionRadius: 2,
      status: 'active',
      hasAttacked: false,
      abilities: [],
      level: 1,
      experience: 0,
      attackRange: 1
    };

    mockGameState = {
      id: 'game1',
      players: [mockPlayer],
      units: [mockUnit],
      cities: [],
      map: {
        tiles: [
          {
            coordinate: villageCoordinate,
            terrain: 'plains',
            resources: [],
            hasCity: false,
            exploredBy: ['player1'],
            feature: 'village',
            cityOwner: undefined // Neutral village
          },
          {
            coordinate: { q: 1, r: 0, s: -1 },
            terrain: 'plains',
            resources: [],
            hasCity: false,
            exploredBy: ['player1']
          }
        ],
        width: 10,
        height: 10
      },
      currentPlayerIndex: 0,
      turnNumber: 1,
      phase: 'playing',
      structures: [],
      improvements: []
    };
  });

  describe('Village Capture Logic', () => {
    it('should successfully capture a neutral village', () => {
      const action = {
        type: 'CAPTURE_VILLAGE' as const,
        payload: {
          unitId: 'unit1',
          playerId: 'player1'
        }
      };

      const newState = gameReducer(mockGameState, action);

      // Check that village is now owned by player
      const villageTile = newState.map.tiles.find(tile => 
        tile.coordinate.q === villageCoordinate.q &&
        tile.coordinate.r === villageCoordinate.r &&
        tile.feature === 'village'
      );
      
      expect(villageTile?.cityOwner).toBe('player1');
      
      // Check that player received rewards
      const updatedPlayer = newState.players.find(p => p.id === 'player1');
      expect(updatedPlayer?.stars).toBe(15); // 10 + 5 reward
      expect(updatedPlayer?.researchProgress).toBe(3); // 2 + 1 boost
      
      // Check that unit is exhausted after capture
      const updatedUnit = newState.units.find(u => u.id === 'unit1');
      expect(updatedUnit?.remainingMovement).toBe(0);
      expect(updatedUnit?.hasAttacked).toBe(true);
    });

    it('should not capture village if unit is not on village tile', () => {
      // Move unit away from village
      mockGameState.units[0].coordinate = { q: 1, r: 0, s: -1 };
      
      const action = {
        type: 'CAPTURE_VILLAGE' as const,
        payload: {
          unitId: 'unit1',
          playerId: 'player1'
        }
      };

      const newState = gameReducer(mockGameState, action);

      // Village should remain neutral
      const villageTile = newState.map.tiles.find(tile => 
        tile.coordinate.q === villageCoordinate.q &&
        tile.coordinate.r === villageCoordinate.r &&
        tile.feature === 'village'
      );
      
      expect(villageTile?.cityOwner).toBeUndefined();
      
      // Player should not receive rewards
      const updatedPlayer = newState.players.find(p => p.id === 'player1');
      expect(updatedPlayer?.stars).toBe(10); // No change
      expect(updatedPlayer?.researchProgress).toBe(2); // No change
    });

    it('should not capture village if already owned by same player', () => {
      // Set village as already owned by player
      mockGameState.map.tiles[0].cityOwner = 'player1';
      
      const action = {
        type: 'CAPTURE_VILLAGE' as const,
        payload: {
          unitId: 'unit1',
          playerId: 'player1'
        }
      };

      const newState = gameReducer(mockGameState, action);

      // Player should not receive additional rewards
      const updatedPlayer = newState.players.find(p => p.id === 'player1');
      expect(updatedPlayer?.stars).toBe(10); // No change
      expect(updatedPlayer?.researchProgress).toBe(2); // No change
      
      // Unit should not be exhausted
      const updatedUnit = newState.units.find(u => u.id === 'unit1');
      expect(updatedUnit?.remainingMovement).toBe(1); // No change
      expect(updatedUnit?.hasAttacked).toBe(false); // No change
    });

    it('should capture village from another player', () => {
      // Set village as owned by another player
      mockGameState.map.tiles[0].cityOwner = 'player2';
      
      const action = {
        type: 'CAPTURE_VILLAGE' as const,
        payload: {
          unitId: 'unit1',
          playerId: 'player1'
        }
      };

      const newState = gameReducer(mockGameState, action);

      // Village should now be owned by capturing player
      const villageTile = newState.map.tiles.find(tile => 
        tile.coordinate.q === villageCoordinate.q &&
        tile.coordinate.r === villageCoordinate.r &&
        tile.feature === 'village'
      );
      
      expect(villageTile?.cityOwner).toBe('player1');
      
      // Player should receive rewards
      const updatedPlayer = newState.players.find(p => p.id === 'player1');
      expect(updatedPlayer?.stars).toBe(15);
      expect(updatedPlayer?.researchProgress).toBe(3);
    });

    it('should not capture with invalid unit ID', () => {
      const action = {
        type: 'CAPTURE_VILLAGE' as const,
        payload: {
          unitId: 'invalid_unit',
          playerId: 'player1'
        }
      };

      const newState = gameReducer(mockGameState, action);

      // State should remain unchanged
      expect(newState).toEqual(mockGameState);
    });

    it('should not capture with wrong player ID', () => {
      const action = {
        type: 'CAPTURE_VILLAGE' as const,
        payload: {
          unitId: 'unit1',
          playerId: 'wrong_player'
        }
      };

      const newState = gameReducer(mockGameState, action);

      // State should remain unchanged
      expect(newState).toEqual(mockGameState);
    });

    it('should properly update explored tiles when capturing', () => {
      // Village tile not yet explored by player
      mockGameState.map.tiles[0].exploredBy = [];
      
      const action = {
        type: 'CAPTURE_VILLAGE' as const,
        payload: {
          unitId: 'unit1',
          playerId: 'player1'
        }
      };

      const newState = gameReducer(mockGameState, action);

      // Village tile should now be explored by player
      const villageTile = newState.map.tiles.find(tile => 
        tile.coordinate.q === villageCoordinate.q &&
        tile.coordinate.r === villageCoordinate.r &&
        tile.feature === 'village'
      );
      
      expect(villageTile?.exploredBy).toContain('player1');
    });

    it('should not duplicate player in exploredBy array', () => {
      // Village already explored by player
      mockGameState.map.tiles[0].exploredBy = ['player1'];
      
      const action = {
        type: 'CAPTURE_VILLAGE' as const,
        payload: {
          unitId: 'unit1',
          playerId: 'player1'
        }
      };

      const newState = gameReducer(mockGameState, action);

      // Should only have one instance of player1
      const villageTile = newState.map.tiles.find(tile => 
        tile.coordinate.q === villageCoordinate.q &&
        tile.coordinate.r === villageCoordinate.r &&
        tile.feature === 'village'
      );
      
      const player1Count = villageTile?.exploredBy.filter(p => p === 'player1').length;
      expect(player1Count).toBe(1);
    });
  });

  describe('Village Rewards', () => {
    it('should give correct star reward amount', () => {
      const initialStars = mockPlayer.stars;
      
      const action = {
        type: 'CAPTURE_VILLAGE' as const,
        payload: {
          unitId: 'unit1',
          playerId: 'player1'
        }
      };

      const newState = gameReducer(mockGameState, action);
      const updatedPlayer = newState.players.find(p => p.id === 'player1');
      
      expect(updatedPlayer?.stars).toBe(initialStars + 5);
    });

    it('should give correct research progress boost', () => {
      const initialProgress = mockPlayer.researchProgress;
      
      const action = {
        type: 'CAPTURE_VILLAGE' as const,
        payload: {
          unitId: 'unit1',
          playerId: 'player1'
        }
      };

      const newState = gameReducer(mockGameState, action);
      const updatedPlayer = newState.players.find(p => p.id === 'player1');
      
      expect(updatedPlayer?.researchProgress).toBe(initialProgress + 1);
    });

    it('should work with high star counts', () => {
      mockPlayer.stars = 1000;
      
      const action = {
        type: 'CAPTURE_VILLAGE' as const,
        payload: {
          unitId: 'unit1',
          playerId: 'player1'
        }
      };

      const newState = gameReducer(mockGameState, action);
      const updatedPlayer = newState.players.find(p => p.id === 'player1');
      
      expect(updatedPlayer?.stars).toBe(1005);
    });
  });

  describe('Unit State After Capture', () => {
    it('should exhaust unit movement after capture', () => {
      mockUnit.remainingMovement = 2;
      
      const action = {
        type: 'CAPTURE_VILLAGE' as const,
        payload: {
          unitId: 'unit1',
          playerId: 'player1'
        }
      };

      const newState = gameReducer(mockGameState, action);
      const updatedUnit = newState.units.find(u => u.id === 'unit1');
      
      expect(updatedUnit?.remainingMovement).toBe(0);
    });

    it('should mark unit as having attacked', () => {
      mockUnit.hasAttacked = false;
      
      const action = {
        type: 'CAPTURE_VILLAGE' as const,
        payload: {
          unitId: 'unit1',
          playerId: 'player1'
        }
      };

      const newState = gameReducer(mockGameState, action);
      const updatedUnit = newState.units.find(u => u.id === 'unit1');
      
      expect(updatedUnit?.hasAttacked).toBe(true);
    });

    it('should not affect other unit properties', () => {
      const action = {
        type: 'CAPTURE_VILLAGE' as const,
        payload: {
          unitId: 'unit1',
          playerId: 'player1'
        }
      };

      const newState = gameReducer(mockGameState, action);
      const updatedUnit = newState.units.find(u => u.id === 'unit1');
      
      expect(updatedUnit?.hp).toBe(mockUnit.hp);
      expect(updatedUnit?.coordinate).toEqual(mockUnit.coordinate);
      expect(updatedUnit?.type).toBe(mockUnit.type);
    });
  });
});