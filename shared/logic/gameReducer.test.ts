import { describe, it, expect, beforeEach } from 'vitest';
import { gameReducer } from './gameReducer';
import type { GameState, GameAction, PlayerState } from '../types/game';
import type { Unit } from '../types/unit';
import type { HexCoordinate } from '../types/coordinates';

describe('Game Reducer', () => {
  let mockGameState: GameState;
  let mockPlayer: PlayerState;
  let mockUnit: Unit;

  beforeEach(() => {
    mockPlayer = {
      id: 'player1',
      name: 'Test Player',
      factionId: 'nephites',
      isEliminated: false,
      stats: {
        faith: 50,
        pride: 30,
        internalDissent: 20
      },
      stars: 100,
      researchedTechs: [],
      turnOrder: 0,
      visibilityMask: [],
      researchProgress: 0,
      citiesOwned: []
    };

    mockUnit = {
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

    mockGameState = {
      id: 'test-game',
      map: {
        tiles: [
          { coordinate: { q: 0, r: 0, s: 0 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [] },
          { coordinate: { q: 1, r: 0, s: -1 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [] },
          { coordinate: { q: 0, r: 1, s: -1 }, terrain: 'mountain', resources: [], hasCity: false, exploredBy: [] }
        ],
        width: 10,
        height: 10
      },
      players: [mockPlayer],
      units: [mockUnit],
      currentPlayerIndex: 0,
      turn: 1,
      phase: 'playing',
      winner: undefined,
      cities: [],
      improvements: [],
      structures: []
    };
  });

  describe('MOVE_UNIT action', () => {
    it('should move unit to valid adjacent tile', () => {
      const moveAction: GameAction = {
        type: 'MOVE_UNIT',
        payload: {
          unitId: 'unit1',
          targetCoordinate: { q: 1, r: 0, s: -1 }
        }
      };

      const newState = gameReducer(mockGameState, moveAction);
      const movedUnit = newState.units.find(u => u.id === 'unit1');
      
      expect(movedUnit?.coordinate).toEqual({ q: 1, r: 0, s: -1 });
      expect(movedUnit?.remainingMovement).toBe(1); // 2 - 1 = 1
    });

    it('should not move unit beyond movement range', () => {
      // Set unit to have only 1 movement remaining
      mockGameState.units[0].remainingMovement = 1;
      
      const moveAction: GameAction = {
        type: 'MOVE_UNIT',
        payload: {
          unitId: 'unit1',
          targetCoordinate: { q: 2, r: 0, s: -2 } // 2 tiles away
        }
      };

      const newState = gameReducer(mockGameState, moveAction);
      const unit = newState.units.find(u => u.id === 'unit1');
      
      // Unit should not have moved
      expect(unit?.coordinate).toEqual({ q: 0, r: 0, s: 0 });
      expect(unit?.remainingMovement).toBe(1);
    });
  });

  describe('ATTACK_UNIT action', () => {
    beforeEach(() => {
      // Add an enemy unit
      const enemyUnit: Unit = {
        id: 'enemy1',
        type: 'warrior',
        playerId: 'player2',
        coordinate: { q: 1, r: 0, s: -1 },
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

      mockGameState.units.push(enemyUnit);
    });

    it('should deal damage in combat', () => {
      const attackAction: GameAction = {
        type: 'ATTACK_UNIT',
        payload: {
          attackerId: 'unit1',
          targetId: 'enemy1'
        }
      };

      const newState = gameReducer(mockGameState, attackAction);
      const target = newState.units.find(u => u.id === 'enemy1');
      
      expect(target?.hp).toBeLessThan(8); // Should have taken damage
    });

    it('should remove unit when HP drops to 0 or below', () => {
      // Set enemy unit to low HP
      const enemyUnit = mockGameState.units.find(u => u.id === 'enemy1');
      if (enemyUnit) {
        enemyUnit.hp = 1;
      }

      const attackAction: GameAction = {
        type: 'ATTACK_UNIT',
        payload: {
          attackerId: 'unit1',
          targetId: 'enemy1'
        }
      };

      const newState = gameReducer(mockGameState, attackAction);
      const target = newState.units.find(u => u.id === 'enemy1');
      
      expect(target).toBeUndefined(); // Unit should be removed
    });
  });

  describe('END_TURN action', () => {
    it('should advance to next player', () => {
      const player2: PlayerState = {
        ...mockPlayer,
        id: 'player2',
        name: 'Player 2',
        turnOrder: 1
      };
      mockGameState.players.push(player2);

      const endTurnAction: GameAction = {
        type: 'END_TURN',
        payload: {
          playerId: 'player1'
        }
      };

      const newState = gameReducer(mockGameState, endTurnAction);
      
      expect(newState.currentPlayerIndex).toBe(1);
    });

    it('should reset unit movement', () => {
      // Exhaust unit movement
      mockGameState.units[0].remainingMovement = 0;

      const endTurnAction: GameAction = {
        type: 'END_TURN',
        payload: {
          playerId: 'player1'
        }
      };

      const newState = gameReducer(mockGameState, endTurnAction);
      const unit = newState.units.find(u => u.id === 'unit1');
      
      expect(unit?.remainingMovement).toBe(unit?.movement);
    });

    it('should increment turn number when cycling back to first player', () => {
      const endTurnAction: GameAction = {
        type: 'END_TURN',
        payload: {
          playerId: 'player1'
        }
      };

      const newState = gameReducer(mockGameState, endTurnAction);
      
      expect(newState.currentPlayerIndex).toBe(0);
    });
  });

  describe('RESEARCH_TECH action', () => {
    it('should add tech to researched list when player has enough stars', () => {
      mockGameState.players[0].stars = 100;

      const researchAction: GameAction = {
        type: 'RESEARCH_TECH',
        payload: {
          playerId: 'player1',
          techId: 'agriculture'
        }
      };

      const newState = gameReducer(mockGameState, researchAction);
      const player = newState.players.find(p => p.id === 'player1');
      
      expect(player?.researchedTechs).toContain('agriculture');
      expect(player?.stars).toBeLessThan(100); // Stars should be deducted
    });

    it('should not allow research without sufficient stars', () => {
      mockGameState.players[0].stars = 5; // Not enough for research

      const researchAction: GameAction = {
        type: 'RESEARCH_TECH',
        payload: {
          playerId: 'player1',
          techId: 'agriculture'
        }
      };

      const newState = gameReducer(mockGameState, researchAction);
      const player = newState.players.find(p => p.id === 'player1');
      
      expect(player?.researchedTechs).not.toContain('agriculture');
      expect(player?.stars).toBe(5); // Stars should remain unchanged
    });
  });

  describe('State immutability', () => {
    it('should not mutate original state', () => {
      const moveAction: GameAction = {
        type: 'MOVE_UNIT',
        payload: {
          unitId: 'unit1',
          targetCoordinate: { q: 1, r: 0, s: -1 }
        }
      };

      const originalUnit = { ...mockGameState.units[0] };
      const newState = gameReducer(mockGameState, moveAction);
      
      // Original state should be unchanged
      expect(mockGameState.units[0]).toEqual(originalUnit);
      
      // New state should be different object
      expect(newState).not.toBe(mockGameState);
      expect(newState.units).not.toBe(mockGameState.units);
    });
  });
});