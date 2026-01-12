import { describe, it, expect, beforeEach } from 'vitest';
import { gameReducer } from './gameReducer';
import { GAME_RULES } from '../data/gameRules';
import { TECHNOLOGIES } from '../data/technologies';
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
      exploredTiles: [],
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
      maxActions: 1,
      actionsRemaining: 1,
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
        maxActions: 1,
        actionsRemaining: 1,
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

  describe('Victory conditions', () => {
    const makePlayer = (overrides: Partial<PlayerState> = {}): PlayerState => ({
      id: overrides.id ?? 'player1',
      name: overrides.name ?? 'Player',
      factionId: overrides.factionId ?? 'nephites',
      isEliminated: overrides.isEliminated ?? false,
      stats: overrides.stats ?? { faith: 0, pride: 0, internalDissent: 0 },
      stars: overrides.stars ?? 0,
      researchedTechs: overrides.researchedTechs ?? [],
      turnOrder: overrides.turnOrder ?? 0,
      visibilityMask: overrides.visibilityMask ?? [],
      exploredTiles: overrides.exploredTiles ?? [],
      researchProgress: overrides.researchProgress ?? 0,
      citiesOwned: overrides.citiesOwned ?? []
    });

    const makeCity = (id: string, ownerId: string, overrides: Partial<HexCoordinate> & Partial<{ population: number; starProduction: number }> = {}) => ({
      id,
      name: id,
      coordinate: { q: overrides.q ?? 0, r: overrides.r ?? 0, s: overrides.s ?? 0 },
      ownerId,
      population: overrides.population ?? 1,
      maxPopulation: 4,
      level: 1,
      starProduction: overrides.starProduction ?? 0,
      unrestTurns: 0,
      improvements: [],
      structures: [],
      harvestedResources: []
    });

    const makeState = (players: PlayerState[], cities: any[]): GameState => ({
      id: 'victory-test',
      rngSeed: 0,
      players,
      currentPlayerIndex: 0,
      turn: 1,
      phase: 'playing',
      map: { width: 5, height: 5, tiles: [] },
      units: [],
      cities,
      improvements: [],
      structures: [],
      winner: undefined,
      victoryType: undefined,
    });

    it('awards faith victory when threshold and dissent are met', () => {
      const player1 = makePlayer({
        id: 'player1',
        stats: { faith: 95, pride: 0, internalDissent: 0 },
        citiesOwned: ['city1']
      });
      const player2 = makePlayer({
        id: 'player2',
        turnOrder: 1,
        stats: { faith: 10, pride: 0, internalDissent: 0 },
        citiesOwned: ['city2']
      });
      const state = makeState([player1, player2], [
        makeCity('city1', 'player1', { q: 0, r: 0, s: 0 }),
        makeCity('city2', 'player2', { q: 1, r: 0, s: -1 })
      ]);
      const result = gameReducer(state, { type: 'END_TURN', payload: { playerId: 'player1' } });
      expect(result.winner).toBe('player1');
      expect(result.victoryType).toBe('faith');
    });

    it('awards economic victory when income, treasury, and techs meet thresholds', () => {
      const allTechs = Object.keys(TECHNOLOGIES);
      const player1 = makePlayer({
        id: 'player1',
        stats: { faith: 0, pride: 0, internalDissent: 0 },
        stars: 200,
        researchedTechs: allTechs,
        citiesOwned: ['city1']
      });
      const player2 = makePlayer({
        id: 'player2',
        turnOrder: 1,
        stats: { faith: 0, pride: 0, internalDissent: 0 },
        citiesOwned: ['city2']
      });
      const state = makeState([player1, player2], [
        makeCity('city1', 'player1', { q: 0, r: 0, s: 0, starProduction: 30 }),
        makeCity('city2', 'player2', { q: 1, r: 0, s: -1 })
      ]);
      const result = gameReducer(state, { type: 'END_TURN', payload: { playerId: 'player1' } });
      expect(result.winner).toBe('player1');
      expect(result.victoryType).toBe('economic');
    });

    it('awards cultural victory when population, sites, and dissent meet thresholds', () => {
      const player1 = makePlayer({
        id: 'player1',
        stats: { faith: 0, pride: 0, internalDissent: 0 },
        citiesOwned: ['city1']
      });
      const player2 = makePlayer({
        id: 'player2',
        turnOrder: 1,
        stats: { faith: 0, pride: 0, internalDissent: 0 },
        citiesOwned: ['city2']
      });
      const state = makeState([player1, player2], [
        makeCity('city1', 'player1', { q: 0, r: 0, s: 0, population: 100 }),
        makeCity('city2', 'player2', { q: 1, r: 0, s: -1 })
      ]);
      state.structures = [
        { id: 's1', type: 'temple', ownerId: 'player1', cityId: 'city1', constructionTurns: 0, effects: { starProduction: 0, unitProduction: 0, defenseBonus: 0, populationGrowth: 0, faithProduction: 0 } },
        { id: 's2', type: 'cathedral', ownerId: 'player1', cityId: 'city1', constructionTurns: 0, effects: { starProduction: 0, unitProduction: 0, defenseBonus: 0, populationGrowth: 0, faithProduction: 0 } },
        { id: 's3', type: 'library', ownerId: 'player1', cityId: 'city1', constructionTurns: 0, effects: { starProduction: 0, unitProduction: 0, defenseBonus: 0, populationGrowth: 0, faithProduction: 0 } },
        { id: 's4', type: 'academy', ownerId: 'player1', cityId: 'city1', constructionTurns: 0, effects: { starProduction: 0, unitProduction: 0, defenseBonus: 0, populationGrowth: 0, faithProduction: 0 } },
        { id: 's5', type: 'temple', ownerId: 'player1', cityId: 'city1', constructionTurns: 0, effects: { starProduction: 0, unitProduction: 0, defenseBonus: 0, populationGrowth: 0, faithProduction: 0 } },
      ];
      const result = gameReducer(state, { type: 'END_TURN', payload: { playerId: 'player1' } });
      expect(result.winner).toBe('player1');
      expect(result.victoryType).toBe('cultural');
    });

    it('awards territorial victory when city control reaches threshold', () => {
      const player1 = makePlayer({
        id: 'player1',
        stats: { faith: 0, pride: 0, internalDissent: 0 },
        citiesOwned: ['city1', 'city2', 'city3', 'city4']
      });
      const player2 = makePlayer({
        id: 'player2',
        turnOrder: 1,
        stats: { faith: 0, pride: 0, internalDissent: 0 },
        citiesOwned: ['city5']
      });
      const state = makeState([player1, player2], [
        makeCity('city1', 'player1', { q: 0, r: 0, s: 0 }),
        makeCity('city2', 'player1', { q: 1, r: 0, s: -1 }),
        makeCity('city3', 'player1', { q: 2, r: 0, s: -2 }),
        makeCity('city4', 'player1', { q: 3, r: 0, s: -3 }),
        makeCity('city5', 'player2', { q: 4, r: 0, s: -4 })
      ]);
      const result = gameReducer(state, { type: 'END_TURN', payload: { playerId: 'player1' } });
      expect(result.winner).toBe('player1');
      expect(result.victoryType).toBe('territorial');
    });

    it('awards elimination victory when only one player has cities', () => {
      const player1 = makePlayer({
        id: 'player1',
        stats: { faith: 0, pride: 0, internalDissent: 0 },
        citiesOwned: ['city1']
      });
      const player2 = makePlayer({
        id: 'player2',
        turnOrder: 1,
        stats: { faith: 0, pride: 0, internalDissent: 0 },
        citiesOwned: []
      });
      const state = makeState([player1, player2], [
        makeCity('city1', 'player1', { q: 0, r: 0, s: 0 })
      ]);
      const result = gameReducer(state, { type: 'END_TURN', payload: { playerId: 'player1' } });
      expect(result.winner).toBe('player1');
      expect(result.victoryType).toBe('elimination');
    });

    it('awards domination victory when max turns are reached', () => {
      const player1 = makePlayer({
        id: 'player1',
        stats: { faith: 0, pride: 0, internalDissent: 0 },
        citiesOwned: ['city1', 'city2']
      });
      const player2 = makePlayer({
        id: 'player2',
        turnOrder: 1,
        stats: { faith: 0, pride: 0, internalDissent: 0 },
        citiesOwned: ['city3']
      });
      const state = makeState([player1, player2], [
        makeCity('city1', 'player1', { q: 0, r: 0, s: 0 }),
        makeCity('city2', 'player1', { q: 1, r: 0, s: -1 }),
        makeCity('city3', 'player2', { q: 2, r: 0, s: -2 })
      ]);
      state.turn = GAME_RULES.turns.maxTurnsPerGame - 1;
      state.currentPlayerIndex = 1;
      const result = gameReducer(state, { type: 'END_TURN', payload: { playerId: 'player2' } });
      expect(result.winner).toBe('player1');
      expect(result.victoryType).toBe('domination');
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
      mockGameState.players[0].researchedTechs = ['organization']; // Add prerequisite

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
      mockGameState.players[0].stars = 5; // Not enough for research (agriculture costs 10)
      mockGameState.players[0].researchedTechs = ['organization']; // Add prerequisite

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

  describe('Invalid Actions', () => {
    it('should not allow moving unit that does not belong to current player', () => {
      const enemyUnit: Unit = {
        id: 'enemy-unit',
        status: 'active',
        type: 'warrior',
        playerId: 'player2',
        coordinate: { q: 2, r: 0, s: -2 },
        hp: 10,
        maxHp: 10,
        movement: 2,
        remainingMovement: 2,
        maxActions: 1,
        actionsRemaining: 1,
        attack: 5,
        defense: 2,
        visionRadius: 2,
        attackRange: 1,
        abilities: [],
        level: 1,
        experience: 0
      };
      
      mockGameState.units.push(enemyUnit);
      mockGameState.currentPlayerIndex = 0; // player1's turn

      const moveAction: GameAction = {
        type: 'MOVE_UNIT',
        payload: {
          unitId: 'enemy-unit',
          targetCoordinate: { q: 3, r: 0, s: -3 }
        }
      };

      const newState = gameReducer(mockGameState, moveAction);
      const unit = newState.units.find(u => u.id === 'enemy-unit');
      
      // Unit should not have moved
      expect(unit?.coordinate).toEqual({ q: 2, r: 0, s: -2 });
    });

    it('should not allow attacking friendly units', () => {
      const friendlyUnit: Unit = {
        id: 'friendly-unit',
        status: 'active',
        type: 'warrior',
        playerId: 'player1',
        coordinate: { q: 1, r: 0, s: -1 },
        hp: 10,
        maxHp: 10,
        movement: 2,
        remainingMovement: 2,
        maxActions: 1,
        actionsRemaining: 1,
        attack: 5,
        defense: 2,
        visionRadius: 2,
        attackRange: 1,
        abilities: [],
        level: 1,
        experience: 0
      };
      
      mockGameState.units.push(friendlyUnit);

      const attackAction: GameAction = {
        type: 'ATTACK_UNIT',
        payload: {
          attackerId: 'unit1',
          targetId: 'friendly-unit'
        }
      };

      const newState = gameReducer(mockGameState, attackAction);
      const target = newState.units.find(u => u.id === 'friendly-unit');
      
      // Friendly unit should not take damage
      expect(target?.hp).toBe(10);
    });

    it('should handle actions for non-existent units gracefully', () => {
      const moveAction: GameAction = {
        type: 'MOVE_UNIT',
        payload: {
          unitId: 'non-existent-unit',
          targetCoordinate: { q: 1, r: 0, s: -1 }
        }
      };

      const newState = gameReducer(mockGameState, moveAction);
      
      // State should be unchanged
      expect(newState).toEqual(mockGameState);
    });
  });

  describe('Enhanced END_TURN tests', () => {
    beforeEach(() => {
      // Add a second player for turn cycling tests
      if (mockGameState.players.length === 1) {
        mockGameState.players.push({
          id: 'player2',
          name: 'Player 2',
          factionId: 'LAMANITES',
          stats: {
            faith: 0,
            pride: 0,
            internalDissent: 0
          },
          visibilityMask: [],
          exploredTiles: [],
          isEliminated: false,
          turnOrder: 1,
          stars: 50,
          researchedTechs: [],
          researchProgress: 0,
          citiesOwned: []
        });
      }
    });

    it('should calculate and add star income correctly', () => {
      // Add a city to the game state and link it to player
      const testCity = {
        id: 'city1',
        name: 'Test City',
        coordinate: { q: 2, r: 0, s: -2 },
        level: 1,
        population: 1,
        starProduction: 2,
        improvements: [],
        structures: [],
        ownerId: 'player1'
      };
      
      mockGameState.cities = [testCity];
      mockGameState.players[0].citiesOwned = ['city1'];

      const initialStars = mockGameState.players[0].stars;

      const endTurnAction: GameAction = {
        type: 'END_TURN',
        payload: {
          playerId: 'player1'
        }
      };

      const newState = gameReducer(mockGameState, endTurnAction);
      const player = newState.players.find(p => p.id === 'player1');
      
      // Stars should have increased based on city income
      expect(player?.stars).toBeGreaterThan(initialStars);
    });

    it('should reset unit movement for next player units', () => {
      // Add some units for player2 and exhaust their movement
      const player2Unit: Unit = {
        id: 'player2-unit',
        status: 'active',
        type: 'warrior',
        playerId: 'player2',
        coordinate: { q: 3, r: 0, s: -3 },
        hp: 10,
        maxHp: 10,
        movement: 2,
        remainingMovement: 0, // Exhausted movement
        maxActions: 1,
        actionsRemaining: 0,
        attack: 5,
        defense: 2,
        visionRadius: 2,
        attackRange: 1,
        abilities: [],
        level: 1,
        experience: 0
      };
      
      mockGameState.units.push(player2Unit);

      const endTurnAction: GameAction = {
        type: 'END_TURN',
        payload: {
          playerId: 'player1'
        }
      };

      const newState = gameReducer(mockGameState, endTurnAction);
      
      // Player2's units should have full movement restored (it's now their turn)
      newState.units.forEach(unit => {
        if (unit.playerId === 'player2') {
          expect(unit.remainingMovement).toBe(unit.movement);
        }
      });
    });

    it('should advance to next player correctly', () => {
      mockGameState.currentPlayerIndex = 0;

      const endTurnAction: GameAction = {
        type: 'END_TURN',
        payload: {
          playerId: 'player1'
        }
      };

      const newState = gameReducer(mockGameState, endTurnAction);
      
      expect(newState.currentPlayerIndex).toBe(1);
    });
  });

  describe('Complex Game Scenarios', () => {
    it('should handle full turn cycle with movement and combat', () => {
      // Setup: Add a second player and enemy unit for combat
      const player2 = {
        id: 'player2',
        name: 'Player 2',
        factionId: 'LAMANITES' as const,
        stats: { faith: 0, pride: 0, internalDissent: 0 },
        visibilityMask: [],
        exploredTiles: [],
        isEliminated: false,
        turnOrder: 1,
        stars: 10,
        researchedTechs: [],
        researchProgress: 0,
        citiesOwned: []
      };
      
      const enemyUnit: Unit = {
        id: 'enemy-combat',
        status: 'active',
        type: 'warrior',
        playerId: 'player2',
        coordinate: { q: 2, r: 0, s: -2 },
        hp: 5,
        maxHp: 10,
        movement: 2,
        remainingMovement: 2,
        maxActions: 1,
        actionsRemaining: 1,
        attack: 3,
        defense: 1,
        visionRadius: 2,
        attackRange: 1,
        abilities: [],
        level: 1,
        experience: 0
      };
      
      // Modify the mock state to include second player
      const stateWithTwoPlayers = {
        ...mockGameState,
        players: [...mockGameState.players, player2],
        units: [...mockGameState.units, enemyUnit],
        map: {
          ...mockGameState.map,
          tiles: [
            ...mockGameState.map.tiles,
            { coordinate: { q: 2, r: 0, s: -2 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [] }
          ]
        }
      };
      
      // Step 1: Move unit closer to enemy
      const moveAction: GameAction = {
        type: 'MOVE_UNIT',
        payload: {
          unitId: 'unit1',
          targetCoordinate: { q: 1, r: 0, s: -1 }
        }
      };
      
      let gameState = gameReducer(stateWithTwoPlayers, moveAction);
      let unit = gameState.units.find(u => u.id === 'unit1');
      expect(unit?.coordinate).toEqual({ q: 1, r: 0, s: -1 });
      expect(unit?.remainingMovement).toBeLessThan(2);
      
      // Step 2: Attack enemy unit
      const attackAction: GameAction = {
        type: 'ATTACK_UNIT',
        payload: {
          attackerId: 'unit1',
          targetId: 'enemy-combat'
        }
      };
      
      gameState = gameReducer(gameState, attackAction);
      const enemy = gameState.units.find(u => u.id === 'enemy-combat');
      expect(enemy?.hp).toBeLessThan(5); // Should have taken damage
      
      // Step 3: End turn
      const endTurnAction: GameAction = {
        type: 'END_TURN',
        payload: {
          playerId: 'player1'
        }
      };
      
      gameState = gameReducer(gameState, endTurnAction);
      expect(gameState.currentPlayerIndex).toBe(1); // Should advance to next player
    });

    it('should reject invalid moves at reducer level', () => {
      // Try to move unit to a coordinate that's too far away
      const invalidMoveAction: GameAction = {
        type: 'MOVE_UNIT',
        payload: {
          unitId: 'unit1',
          targetCoordinate: { q: 5, r: 0, s: -5 } // Way too far
        }
      };

      const newState = gameReducer(mockGameState, invalidMoveAction);
      const unit = newState.units.find(u => u.id === 'unit1');
      
      // Unit should not have moved
      expect(unit?.coordinate).toEqual({ q: 0, r: 0, s: 0 });
      expect(newState).toEqual(mockGameState); // State should be unchanged
    });

    it('should handle multiple units and coordinate conflicts', () => {
      // Add another friendly unit
      const unit2: Unit = {
        id: 'unit2',
        status: 'active',
        type: 'warrior',
        playerId: 'player1',
        coordinate: { q: 1, r: 0, s: -1 },
        hp: 10,
        maxHp: 10,
        movement: 2,
        remainingMovement: 2,
        maxActions: 1,
        actionsRemaining: 1,
        attack: 5,
        defense: 2,
        visionRadius: 2,
        attackRange: 1,
        abilities: [],
        level: 1,
        experience: 0
      };
      
      mockGameState.units.push(unit2);
      
      // Try to move first unit to same coordinate as second unit
      const moveAction: GameAction = {
        type: 'MOVE_UNIT',
        payload: {
          unitId: 'unit1',
          targetCoordinate: { q: 1, r: 0, s: -1 }
        }
      };

      const newState = gameReducer(mockGameState, moveAction);
      const unit1 = newState.units.find(u => u.id === 'unit1');
      
      // Should allow movement to tile with friendly unit
      expect(unit1?.coordinate).toEqual({ q: 1, r: 0, s: -1 });
    });

    it('should handle unit death and removal correctly', () => {
      // Create a very weak enemy unit
      const weakEnemy: Unit = {
        id: 'weak-enemy',
        status: 'active',
        type: 'warrior',
        playerId: 'player2',
        coordinate: { q: 1, r: 0, s: -1 },
        hp: 1,
        maxHp: 10,
        movement: 2,
        remainingMovement: 2,
        maxActions: 1,
        actionsRemaining: 1,
        attack: 1,
        defense: 0,
        visionRadius: 2,
        attackRange: 1,
        abilities: [],
        level: 1,
        experience: 0
      };
      
      const stateWithWeakEnemy = {
        ...mockGameState,
        units: [...mockGameState.units, weakEnemy]
      };
      
      const attackAction: GameAction = {
        type: 'ATTACK_UNIT',
        payload: {
          attackerId: 'unit1',
          targetId: 'weak-enemy'
        }
      };

      const newState = gameReducer(stateWithWeakEnemy, attackAction);
      const deadUnit = newState.units.find(u => u.id === 'weak-enemy');
      
      // Unit should be completely removed from game state
      expect(deadUnit).toBeUndefined();
      expect(newState.units.length).toBe(stateWithWeakEnemy.units.length - 1); // One less unit than before
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
