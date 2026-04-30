import { describe, it, expect, beforeEach } from 'vitest';
import { resolveAction, resolveActionState } from './resolveAction';
import { GAME_EVENT_TYPES } from './actionResolution';
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
      citiesOwned: [],
      atWarWith: [],
      alliedWith: [],
      tradeRoutes: [],
      diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 }
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

      const newState = resolveActionState(mockGameState, moveAction);
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

      const newState = resolveActionState(mockGameState, moveAction);
      const unit = newState.units.find(u => u.id === 'unit1');
      
      // Unit should not have moved
      expect(unit?.coordinate).toEqual({ q: 0, r: 0, s: 0 });
      expect(unit?.remainingMovement).toBe(1);
    });

    it('should return a village encounter event for neutral villages', () => {
      mockGameState.map.tiles = mockGameState.map.tiles.map(tile =>
        tile.coordinate.q === 1 && tile.coordinate.r === 0
          ? { ...tile, feature: 'village' as const }
          : tile
      );

      const moveAction: GameAction = {
        type: 'MOVE_UNIT',
        payload: {
          unitId: 'unit1',
          targetCoordinate: { q: 1, r: 0, s: -1 }
        }
      };

      const result = resolveAction(mockGameState, moveAction);

      expect(result.events).toEqual([
        {
          type: GAME_EVENT_TYPES.villageEncounter,
          payload: {
            unitId: 'unit1',
            coordinate: { q: 1, r: 0, s: -1 }
          }
        }
      ]);
    });
  });

  describe('shared action events', () => {
    it('should return a ruins reward event when exploring ruins', () => {
      mockGameState.rngSeed = 1;
      mockGameState.map.tiles = mockGameState.map.tiles.map(tile =>
        tile.coordinate.q === 1 && tile.coordinate.r === 0
          ? { ...tile, feature: 'ruin' as const }
          : tile
      );

      const result = resolveAction(mockGameState, {
        type: 'EXPLORE_RUINS',
        payload: {
          unitId: 'unit1',
          playerId: 'player1',
          coordinate: { q: 1, r: 0, s: -1 }
        }
      } as any);

      expect(result.events).toHaveLength(1);
      expect(result.events[0]?.type).toBe(GAME_EVENT_TYPES.ruinsReward);
      expect((result.events[0]?.payload as any)?.coordinate).toEqual({ q: 1, r: 0, s: -1 });
    });

    it('should return a ruins reward event when harvesting Jaredite ruins', () => {
      mockGameState.rngSeed = 1;
      mockGameState.map.tiles = mockGameState.map.tiles.map(tile =>
        tile.coordinate.q === 0 && tile.coordinate.r === 0
          ? { ...tile, resources: ['jaredite_ruins'] }
          : tile
      );

      const result = resolveAction(mockGameState, {
        type: 'WORLD_ELEMENT_HARVEST',
        payload: {
          playerId: 'player1',
          unitId: 'unit1',
          elementId: 'jaredite_ruins',
          coordinate: { q: 0, r: 0, s: 0 }
        }
      } as any);

      expect(result.events).toHaveLength(1);
      expect(result.events[0]?.type).toBe(GAME_EVENT_TYPES.ruinsReward);
      expect((result.events[0]?.payload as any)?.coordinate).toEqual({ q: 0, r: 0, s: 0 });
    });
  });

  describe('ATTACK_UNIT action', () => {
    beforeEach(() => {
      const enemyPlayer: PlayerState = {
        ...mockPlayer,
        id: 'player2',
        name: 'Enemy Player',
        turnOrder: 1,
        atWarWith: ['player1'],
        alliedWith: [],
      };
      mockPlayer.atWarWith = ['player2'];
      mockGameState.players = [mockPlayer, enemyPlayer];

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

      const newState = resolveActionState(mockGameState, attackAction);
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

      const newState = resolveActionState(mockGameState, attackAction);
      const target = newState.units.find(u => u.id === 'enemy1');
      
      expect(target).toBeUndefined(); // Unit should be removed
    });
  });

  describe('CAPTURE_CITY action', () => {
    beforeEach(() => {
      mockPlayer.citiesOwned = ['capital1'];
      const enemyPlayer: PlayerState = {
        ...mockPlayer,
        id: 'player2',
        name: 'Enemy Player',
        turnOrder: 1,
        citiesOwned: ['city1'],
        atWarWith: ['player1']
      };

      mockPlayer.atWarWith = ['player2'];
      mockGameState.players = [mockPlayer, enemyPlayer];
      mockGameState.cities = [{
        id: 'city1',
        name: 'Enemy City',
        coordinate: { q: 1, r: 0, s: -1 },
        ownerId: 'player2',
        population: 1,
        maxPopulation: 4,
        level: 1,
        starProduction: 2,
        unrestTurns: 0,
        improvements: [],
        structures: [],
        harvestedResources: []
      }];
      mockGameState.map.tiles = mockGameState.map.tiles.map(tile =>
        tile.coordinate.q === 1 && tile.coordinate.r === 0
          ? { ...tile, hasCity: true, cityOwner: 'player2' }
          : tile
      );
    });

    it('should capture an adjacent enemy city on the active player turn', () => {
      const captureAction: GameAction = {
        type: 'CAPTURE_CITY',
        payload: {
          playerId: 'player1',
          unitId: 'unit1',
          cityId: 'city1'
        }
      };

      const newState = resolveActionState(mockGameState, captureAction);

      expect(newState.cities.find(city => city.id === 'city1')?.ownerId).toBe('player1');
      expect(newState.players.find(player => player.id === 'player1')?.citiesOwned).toContain('city1');
      expect(newState.players.find(player => player.id === 'player2')?.citiesOwned).not.toContain('city1');
      expect(newState.units.find(unit => unit.id === 'unit1')?.actionsRemaining).toBe(0);
    });

    it('should not capture a city when no player unit is adjacent', () => {
      mockGameState.units[0].coordinate = { q: -2, r: 0, s: 2 };

      const captureAction: GameAction = {
        type: 'CAPTURE_CITY',
        payload: {
          playerId: 'player1',
          unitId: 'unit1',
          cityId: 'city1'
        }
      };

      const newState = resolveActionState(mockGameState, captureAction);

      expect(newState.cities.find(city => city.id === 'city1')?.ownerId).toBe('player2');
      expect(newState.players.find(player => player.id === 'player1')?.citiesOwned).not.toContain('city1');
    });

    it('should not capture a city outside the active player turn', () => {
      mockGameState.currentPlayerIndex = 1;

      const captureAction: GameAction = {
        type: 'CAPTURE_CITY',
        payload: {
          playerId: 'player1',
          unitId: 'unit1',
          cityId: 'city1'
        }
      };

      const newState = resolveActionState(mockGameState, captureAction);

      expect(newState.cities.find(city => city.id === 'city1')?.ownerId).toBe('player2');
      expect(newState.players.find(player => player.id === 'player1')?.citiesOwned).not.toContain('city1');
    });

    it('should not capture a city with a civilian unit', () => {
      mockGameState.units[0] = {
        ...mockGameState.units[0],
        type: 'worker',
      };

      const captureAction: GameAction = {
        type: 'CAPTURE_CITY',
        payload: {
          playerId: 'player1',
          unitId: 'unit1',
          cityId: 'city1'
        }
      };

      const newState = resolveActionState(mockGameState, captureAction);

      expect(newState.cities.find(city => city.id === 'city1')?.ownerId).toBe('player2');
      expect(newState.players.find(player => player.id === 'player1')?.citiesOwned).not.toContain('city1');
    });

    it('should not capture an enemy city without a war declaration', () => {
      mockGameState.players = mockGameState.players.map(player =>
        player.id === 'player1'
          ? { ...player, atWarWith: [] }
          : player.id === 'player2'
            ? { ...player, atWarWith: [] }
            : player
      );

      const captureAction: GameAction = {
        type: 'CAPTURE_CITY',
        payload: {
          playerId: 'player1',
          unitId: 'unit1',
          cityId: 'city1'
        }
      };

      const newState = resolveActionState(mockGameState, captureAction);

      expect(newState.cities.find(city => city.id === 'city1')?.ownerId).toBe('player2');
      expect(newState.players.find(player => player.id === 'player1')?.citiesOwned).not.toContain('city1');
    });

    it('should not capture a city while a defending military garrison remains on the city tile', () => {
      mockGameState.units.push({
        id: 'enemy-garrison',
        type: 'guard',
        playerId: 'player2',
        coordinate: { q: 1, r: 0, s: -1 },
        hp: 10,
        maxHp: 10,
        attack: 4,
        defense: 6,
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
      });

      const captureAction: GameAction = {
        type: 'CAPTURE_CITY',
        payload: {
          playerId: 'player1',
          unitId: 'unit1',
          cityId: 'city1'
        }
      };

      const newState = resolveActionState(mockGameState, captureAction);

      expect(newState.cities.find(city => city.id === 'city1')?.ownerId).toBe('player2');
      expect(newState.players.find(player => player.id === 'player1')?.citiesOwned).not.toContain('city1');
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
      const result = resolveActionState(state, { type: 'END_TURN', payload: { playerId: 'player1' } });
      expect(result.phase).toBe('ended');
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
      const result = resolveActionState(state, { type: 'END_TURN', payload: { playerId: 'player1' } });
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
      const result = resolveActionState(state, { type: 'END_TURN', payload: { playerId: 'player1' } });
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
      const result = resolveActionState(state, { type: 'END_TURN', payload: { playerId: 'player1' } });
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
      const result = resolveActionState(state, { type: 'END_TURN', payload: { playerId: 'player1' } });
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
      const result = resolveActionState(state, { type: 'END_TURN', payload: { playerId: 'player2' } });
      expect(result.winner).toBe('player1');
      expect(result.victoryType).toBe('domination');
    });

    it('rejects gameplay actions after the game has ended', () => {
      const endedState: GameState = {
        ...mockGameState,
        phase: 'ended',
        winner: 'player1',
        victoryType: 'faith',
      };
      const moveAction: GameAction = {
        type: 'MOVE_UNIT',
        payload: {
          unitId: 'unit1',
          targetCoordinate: { q: 1, r: 0, s: -1 },
        },
      };

      const result = resolveActionState(endedState, moveAction);

      expect(result).toBe(endedState);
      expect(result.units[0]?.coordinate).toEqual({ q: 0, r: 0, s: 0 });
    });
  });

  describe('END_TURN action', () => {
    it('should advance to next player', () => {
      const player2: PlayerState = {
        ...mockPlayer,
        id: 'player2',
        name: 'Player 2',
        turnOrder: 1,
        citiesOwned: ['city2']
      };
      mockPlayer.citiesOwned = ['city1'];
      mockGameState.players.push(player2);

      const endTurnAction: GameAction = {
        type: 'END_TURN',
        payload: {
          playerId: 'player1'
        }
      };

      const newState = resolveActionState(mockGameState, endTurnAction);
      
      expect(newState.players[newState.currentPlayerIndex]?.id).toBe('player2');
    });

    it('skips eliminated players when advancing a 4-player turn order', () => {
      mockGameState.players = [
        {
          ...mockPlayer,
          id: 'player1',
          name: 'Player 1',
          turnOrder: 0,
          citiesOwned: ['city1'],
        },
        {
          ...mockPlayer,
          id: 'player2',
          name: 'Player 2',
          turnOrder: 1,
          citiesOwned: ['city2'],
        },
        {
          ...mockPlayer,
          id: 'player3',
          name: 'Player 3',
          turnOrder: 2,
          isEliminated: true,
          citiesOwned: [],
        },
        {
          ...mockPlayer,
          id: 'player4',
          name: 'Player 4',
          turnOrder: 3,
          citiesOwned: ['city4'],
        },
      ];
      mockGameState.currentPlayerIndex = 1;

      const endTurnAction: GameAction = {
        type: 'END_TURN',
        payload: {
          playerId: 'player2',
        },
      };

      const newState = resolveActionState(mockGameState, endTurnAction);

      expect(newState.currentPlayerIndex).toBe(3);
      expect(newState.players[newState.currentPlayerIndex]?.id).toBe('player4');
    });

    it('skips players with no cities even if isEliminated is stale', () => {
      mockGameState.players = [
        {
          ...mockPlayer,
          id: 'player1',
          name: 'Player 1',
          turnOrder: 0,
          citiesOwned: ['city1'],
        },
        {
          ...mockPlayer,
          id: 'player2',
          name: 'Player 2',
          turnOrder: 1,
          citiesOwned: [],
          isEliminated: false,
        },
        {
          ...mockPlayer,
          id: 'player3',
          name: 'Player 3',
          turnOrder: 2,
          citiesOwned: ['city3'],
        },
      ];
      mockGameState.currentPlayerIndex = 0;

      const endTurnAction: GameAction = {
        type: 'END_TURN',
        payload: {
          playerId: 'player1',
        },
      };

      const newState = resolveActionState(mockGameState, endTurnAction);

      expect(newState.currentPlayerIndex).toBe(2);
      expect(newState.players[newState.currentPlayerIndex]?.id).toBe('player3');
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

      const newState = resolveActionState(mockGameState, endTurnAction);
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

      const newState = resolveActionState(mockGameState, endTurnAction);

      expect(newState.currentPlayerIndex).toBe(0);
    });

    it('increments turn when cycling back to the first active player', () => {
      mockGameState.players = [
        {
          ...mockPlayer,
          id: 'player1',
          name: 'Player 1',
          turnOrder: 0,
          citiesOwned: [],
          isEliminated: true,
        },
        {
          ...mockPlayer,
          id: 'player2',
          name: 'Player 2',
          turnOrder: 1,
          citiesOwned: ['city2'],
        },
        {
          ...mockPlayer,
          id: 'player3',
          name: 'Player 3',
          turnOrder: 2,
          citiesOwned: ['city3'],
        },
      ];
      mockGameState.currentPlayerIndex = 2;
      mockGameState.turn = 5;

      const endTurnAction: GameAction = {
        type: 'END_TURN',
        payload: {
          playerId: 'player3',
        },
      };

      const newState = resolveActionState(mockGameState, endTurnAction);

      expect(newState.currentPlayerIndex).toBe(1);
      expect(newState.players[newState.currentPlayerIndex]?.id).toBe('player2');
      expect(newState.turn).toBe(6);
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

      const newState = resolveActionState(mockGameState, researchAction);
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

      const newState = resolveActionState(mockGameState, researchAction);
      const player = newState.players.find(p => p.id === 'player1');
      
      expect(player?.researchedTechs).not.toContain('agriculture');
      expect(player?.stars).toBe(5); // Stars should remain unchanged
    });

    it('should respect research inspiration discounts when spending stars', () => {
      mockGameState.players[0].stars = 7;
      mockGameState.players[0].researchedTechs = ['organization'];
      mockGameState.players[0].researchInspiration = 5;

      const researchAction: GameAction = {
        type: 'RESEARCH_TECH',
        payload: {
          playerId: 'player1',
          techId: 'agriculture'
        }
      };

      const newState = resolveActionState(mockGameState, researchAction);
      const player = newState.players.find(p => p.id === 'player1');

      expect(player?.researchedTechs).toContain('agriculture');
      expect(player?.stars).toBe(0);
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

      const newState = resolveActionState(mockGameState, moveAction);
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

      const newState = resolveActionState(mockGameState, attackAction);
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

      const newState = resolveActionState(mockGameState, moveAction);
      
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

      const newState = resolveActionState(mockGameState, endTurnAction);
      const player = newState.players.find(p => p.id === 'player1');
      
      // Stars should have increased based on city income
      expect(player?.stars).toBeGreaterThan(initialStars);
    });

    it('should reset unit movement for next player units', () => {
      // Add some units for player2 and exhaust their movement
      const player2: PlayerState = {
        ...mockPlayer,
        id: 'player2',
        name: 'Player 2',
        turnOrder: 1,
        citiesOwned: ['city2'],
      };
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
      mockPlayer.citiesOwned = ['city1'];
      mockGameState.players[0] = { ...mockPlayer };
      mockGameState.players.push(player2);

      const endTurnAction: GameAction = {
        type: 'END_TURN',
        payload: {
          playerId: 'player1'
        }
      };

      const newState = resolveActionState(mockGameState, endTurnAction);
      
      // Player2's units should have full movement restored (it's now their turn)
      newState.units.forEach(unit => {
        if (unit.playerId === 'player2') {
          expect(unit.remainingMovement).toBe(unit.movement);
        }
      });
    });

    it('should advance to next player correctly', () => {
      mockGameState.currentPlayerIndex = 0;
      mockPlayer.citiesOwned = ['city1'];
      mockGameState.players[0] = { ...mockPlayer };
      mockGameState.players.push({
        ...mockPlayer,
        id: 'player2',
        name: 'Player 2',
        turnOrder: 1,
        citiesOwned: ['city2'],
      });

      const endTurnAction: GameAction = {
        type: 'END_TURN',
        payload: {
          playerId: 'player1'
        }
      };

      const newState = resolveActionState(mockGameState, endTurnAction);
      
      expect(newState.players[newState.currentPlayerIndex]?.id).toBe('player2');
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
        citiesOwned: ['city2'],
        atWarWith: ['player1'],
        alliedWith: [],
        tradeRoutes: [],
        diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 }
      };
      mockPlayer.citiesOwned = ['city1'];
      mockGameState.players[0] = { ...mockPlayer, atWarWith: ['player2'] };
      
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
      
      let gameState = resolveActionState(stateWithTwoPlayers, moveAction);
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
      
      gameState = resolveActionState(gameState, attackAction);
      const enemy = gameState.units.find(u => u.id === 'enemy-combat');
      expect(enemy?.hp).toBeLessThan(5); // Should have taken damage
      
      // Step 3: End turn
      const endTurnAction: GameAction = {
        type: 'END_TURN',
        payload: {
          playerId: 'player1'
        }
      };
      
      gameState = resolveActionState(gameState, endTurnAction);
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

      const newState = resolveActionState(mockGameState, invalidMoveAction);
      const unit = newState.units.find(u => u.id === 'unit1');
      
      // Unit should not have moved
      expect(unit?.coordinate).toEqual({ q: 0, r: 0, s: 0 });
      expect(newState).toEqual(mockGameState); // State should be unchanged
    });

    it('should prevent multiple friendly units from occupying the same tile', () => {
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

      const newState = resolveActionState(mockGameState, moveAction);
      const unit1 = newState.units.find(u => u.id === 'unit1');
      
      // Single-occupancy tiles should reject the move.
      expect(unit1?.coordinate).toEqual({ q: 0, r: 0, s: 0 });
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
        players: [
          { ...mockPlayer, atWarWith: ['player2'] },
          {
            ...mockPlayer,
            id: 'player2',
            name: 'Enemy Player',
            turnOrder: 1,
            atWarWith: ['player1'],
            alliedWith: [],
          },
        ],
        units: [...mockGameState.units, weakEnemy]
      };
      
      const attackAction: GameAction = {
        type: 'ATTACK_UNIT',
        payload: {
          attackerId: 'unit1',
          targetId: 'weak-enemy'
        }
      };

      const newState = resolveActionState(stateWithWeakEnemy, attackAction);
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
      const newState = resolveActionState(mockGameState, moveAction);
      
      // Original state should be unchanged
      expect(mockGameState.units[0]).toEqual(originalUnit);
      
      // New state should be different object
      expect(newState).not.toBe(mockGameState);
      expect(newState.units).not.toBe(mockGameState.units);
    });
  });
});
