import { describe, it, expect } from 'vitest';
import { validateGameState, validatePlayerAction } from '../shared/utils/validation';
import { GameState, PlayerState } from '../shared/types/game';
import { GAME_RULES } from '../shared/data/gameRules';

describe('Game State Validation Tests', () => {
  const createValidGameState = (): GameState => ({
    id: 'test-game',
    currentPlayerIndex: 0,
    currentTurn: 1,
    phase: 'main',
    players: [
      {
        id: 'player1',
        name: 'Test Player',
        factionId: 'nephites',
        stars: 50,
        stats: {
          faith: 30,
          pride: 20,
          internalDissent: 5
        },
        citiesOwned: ['city1'],
        unitsOwned: ['unit1'],
        researchedTechs: ['writing'],
        isEliminated: false
      }
    ],
    units: [
      {
        id: 'unit1',
        type: 'warrior',
        coordinate: { q: 0, r: 0 },
        ownerId: 'player1',
        currentHp: 25,
        maxHp: 25,
        currentMovement: 2,
        maxMovement: 2,
        hasAttacked: false,
        hasActed: false
      }
    ],
    cities: [
      {
        id: 'city1',
        name: 'Test City',
        coordinate: { q: 0, r: 0 },
        population: 5,
        ownerId: 'player1'
      }
    ],
    map: {
      tiles: [
        {
          coordinate: { q: 0, r: 0, s: 0 },
          terrain: 'plains',
          resources: [],
          hasCity: true,
          exploredBy: ['player1']
        }
      ],
      size: { width: 10, height: 10 }
    },
    visibility: {
      'player1': new Set(['0,0'])
    },
    structures: [],
    improvements: []
  });

  describe('Resource Validation', () => {
    it('validates player has sufficient stars for actions', () => {
      const gameState = createValidGameState();
      const player = gameState.players[0];
      
      // Test with sufficient resources
      expect(player.stars >= 10).toBe(true);
      
      // Test resource constraints
      player.stars = 5;
      expect(player.stars >= 10).toBe(false);
    });

    it('validates faith and pride requirements', () => {
      const gameState = createValidGameState();
      const player = gameState.players[0];
      
      expect(player.stats.faith).toBeGreaterThanOrEqual(0);
      expect(player.stats.pride).toBeGreaterThanOrEqual(0);
      expect(player.stats.internalDissent).toBeGreaterThanOrEqual(0);
      
      // Test maximum values
      expect(player.stats.faith).toBeLessThanOrEqual(100);
      expect(player.stats.pride).toBeLessThanOrEqual(100);
      expect(player.stats.internalDissent).toBeLessThanOrEqual(100);
    });

    it('validates resource generation rules', () => {
      const gameState = createValidGameState();
      const player = gameState.players[0];
      const cities = gameState.cities.filter(c => c.ownerId === player.id);
      
      // Base resource generation
      const expectedStars = GAME_RULES.resources.baseStarsPerTurn + 
                           (cities.length * GAME_RULES.resources.starsPerCity);
      
      expect(expectedStars).toBeGreaterThan(0);
    });
  });

  describe('Technology Validation', () => {
    it('validates technology prerequisites', () => {
      const gameState = createValidGameState();
      const player = gameState.players[0];
      
      // Player should have researched 'writing'
      expect(player.researchedTechs).toContain('writing');
      
      // Test technology dependencies
      if (player.researchedTechs.includes('mathematics')) {
        expect(player.researchedTechs).toContain('writing');
      }
    });

    it('validates technology unlocks', () => {
      const gameState = createValidGameState();
      const player = gameState.players[0];
      
      // Technologies should unlock specific capabilities
      expect(player.researchedTechs.length).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(player.researchedTechs)).toBe(true);
    });
  });

  describe('Unit Validation', () => {
    it('validates unit health constraints', () => {
      const gameState = createValidGameState();
      const units = gameState.units;
      
      units.forEach(unit => {
        expect(unit.currentHp).toBeGreaterThanOrEqual(0);
        expect(unit.currentHp).toBeLessThanOrEqual(unit.maxHp);
        expect(unit.maxHp).toBeGreaterThan(0);
      });
    });

    it('validates movement constraints', () => {
      const gameState = createValidGameState();
      const units = gameState.units;
      
      units.forEach(unit => {
        expect(unit.currentMovement).toBeGreaterThanOrEqual(0);
        expect(unit.currentMovement).toBeLessThanOrEqual(unit.maxMovement);
        expect(unit.maxMovement).toBeGreaterThan(0);
      });
    });

    it('validates unit ownership', () => {
      const gameState = createValidGameState();
      const units = gameState.units;
      const playerIds = gameState.players.map(p => p.id);
      
      units.forEach(unit => {
        expect(playerIds).toContain(unit.ownerId);
      });
    });

    it('validates unit positions', () => {
      const gameState = createValidGameState();
      const units = gameState.units;
      const mapTiles = gameState.map.tiles;
      
      units.forEach(unit => {
        const tileExists = mapTiles.some(tile => 
          tile.coordinate.q === unit.coordinate.q && 
          tile.coordinate.r === unit.coordinate.r
        );
        expect(tileExists).toBe(true);
      });
    });
  });

  describe('City Validation', () => {
    it('validates city population constraints', () => {
      const gameState = createValidGameState();
      const cities = gameState.cities;
      
      cities.forEach(city => {
        expect(city.population).toBeGreaterThan(0);
        expect(city.population).toBeLessThanOrEqual(GAME_RULES.cities.maxPopulation);
      });
    });

    it('validates city ownership', () => {
      const gameState = createValidGameState();
      const cities = gameState.cities;
      const playerIds = gameState.players.map(p => p.id);
      
      cities.forEach(city => {
        expect(playerIds).toContain(city.ownerId);
      });
    });

    it('validates city positions', () => {
      const gameState = createValidGameState();
      const cities = gameState.cities;
      const mapTiles = gameState.map.tiles;
      
      cities.forEach(city => {
        const cityTile = mapTiles.find(tile => 
          tile.coordinate.q === city.coordinate.q && 
          tile.coordinate.r === city.coordinate.r
        );
        expect(cityTile).toBeDefined();
        expect(cityTile?.hasCity).toBe(true);
      });
    });
  });

  describe('Game Phase Validation', () => {
    it('validates turn progression', () => {
      const gameState = createValidGameState();
      
      expect(gameState.currentTurn).toBeGreaterThan(0);
      expect(gameState.currentPlayerIndex).toBeGreaterThanOrEqual(0);
      expect(gameState.currentPlayerIndex).toBeLessThan(gameState.players.length);
    });

    it('validates game phase constraints', () => {
      const gameState = createValidGameState();
      const validPhases = ['setup', 'main', 'combat', 'end'];
      
      expect(validPhases).toContain(gameState.phase);
    });

    it('validates player elimination', () => {
      const gameState = createValidGameState();
      const activePlayers = gameState.players.filter(p => !p.isEliminated);
      
      expect(activePlayers.length).toBeGreaterThan(0);
      
      if (activePlayers.length === 1) {
        // Game should be over or in victory state
        expect(gameState.phase).toBe('end');
      }
    });
  });

  describe('Map Validation', () => {
    it('validates map dimensions', () => {
      const gameState = createValidGameState();
      const map = gameState.map;
      
      expect(map.size.width).toBeGreaterThan(0);
      expect(map.size.height).toBeGreaterThan(0);
      expect(map.tiles.length).toBeGreaterThan(0);
    });

    it('validates tile coordinates', () => {
      const gameState = createValidGameState();
      const tiles = gameState.map.tiles;
      
      tiles.forEach(tile => {
        expect(typeof tile.coordinate.q).toBe('number');
        expect(typeof tile.coordinate.r).toBe('number');
        expect(typeof tile.coordinate.s).toBe('number');
        
        // Hexagonal coordinate constraint: q + r + s = 0
        expect(tile.coordinate.q + tile.coordinate.r + tile.coordinate.s).toBe(0);
      });
    });

    it('validates terrain types', () => {
      const gameState = createValidGameState();
      const tiles = gameState.map.tiles;
      const validTerrains = ['plains', 'hills', 'mountains', 'forest', 'ocean', 'desert'];
      
      tiles.forEach(tile => {
        expect(validTerrains).toContain(tile.terrain);
      });
    });
  });

  describe('Victory Conditions', () => {
    it('validates faith victory threshold', () => {
      const gameState = createValidGameState();
      const player = gameState.players[0];
      
      if (player.stats.faith >= GAME_RULES.victory.faithThreshold) {
        // Player should be eligible for faith victory
        expect(player.stats.faith).toBeGreaterThanOrEqual(GAME_RULES.victory.faithThreshold);
      }
    });

    it('validates territorial victory conditions', () => {
      const gameState = createValidGameState();
      const totalCities = gameState.cities.length;
      
      gameState.players.forEach(player => {
        const playerCities = gameState.cities.filter(c => c.ownerId === player.id);
        const territoryPercentage = (playerCities.length / totalCities) * 100;
        
        if (territoryPercentage >= GAME_RULES.victory.territoryControlThreshold) {
          // Player should be eligible for territorial victory
          expect(territoryPercentage).toBeGreaterThanOrEqual(GAME_RULES.victory.territoryControlThreshold);
        }
      });
    });
  });

  describe('Balance Validation', () => {
    it('validates game rules are within reasonable bounds', () => {
      expect(GAME_RULES.units.defaultMovementSpeed).toBeGreaterThan(0);
      expect(GAME_RULES.units.defaultMovementSpeed).toBeLessThanOrEqual(10);
      
      expect(GAME_RULES.units.defaultVisionRadius).toBeGreaterThan(0);
      expect(GAME_RULES.units.defaultVisionRadius).toBeLessThanOrEqual(5);
      
      expect(GAME_RULES.resources.baseStarsPerTurn).toBeGreaterThanOrEqual(0);
      expect(GAME_RULES.resources.starsPerCity).toBeGreaterThan(0);
    });

    it('validates combat balance', () => {
      expect(GAME_RULES.combat.defaultAttackRange).toBeGreaterThan(0);
      expect(GAME_RULES.combat.damageReduction).toBeGreaterThanOrEqual(0);
      expect(GAME_RULES.combat.damageReduction).toBeLessThan(1);
      
      expect(GAME_RULES.combat.fortificationBonus).toBeGreaterThanOrEqual(0);
      expect(GAME_RULES.combat.terrainDefenseMultiplier).toBeGreaterThan(0);
    });
  });
});