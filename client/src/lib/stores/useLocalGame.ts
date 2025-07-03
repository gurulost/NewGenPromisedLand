import { create } from "zustand";
import { GameState, PlayerState, TerrainType, HexCoordinate } from "@shared/types/game";
import { hexDistance } from "@shared/utils/hex";
import { gameReducer } from "@shared/logic/gameReducer";
import { MapGenerator, MapSize, MAP_SIZE_CONFIGS } from "@shared/utils/mapGenerator";
import { useGameState } from "./useGameState";

type GamePhase = 'menu' | 'playerSetup' | 'handoff' | 'playing' | 'gameOver';

interface LocalGameStore {
  gamePhase: GamePhase;
  gameState: GameState | null;
  
  setGamePhase: (phase: GamePhase) => void;
  startLocalGame: (playerSetup: Array<{
    id: string;
    name: string;
    factionId: string;
    turnOrder: number;
  }>, mapSize?: MapSize) => void;
  endTurn: (playerId: string) => void;
  moveUnit: (unitId: string, targetCoordinate: any) => void;
  attackUnit: (attackerId: string, targetId: string) => void;
  useAbility: (playerId: string, abilityId: string) => void;
  dispatch: (action: any) => void;
  resetGame: () => void;
}

export const useLocalGame = create<LocalGameStore>((set, get) => ({
  gamePhase: 'menu',
  gameState: null,
  
  setGamePhase: (phase) => set({ gamePhase: phase }),
  
  startLocalGame: (playerSetup, mapSize = 'normal') => {
    // Create initial game state
    const players: PlayerState[] = playerSetup.map(setup => ({
      id: setup.id,
      name: setup.name,
      factionId: setup.factionId,
      stats: {
        faith: 50,
        pride: 30,
        internalDissent: 10,
      },
      visibilityMask: [],
      isEliminated: false,
      turnOrder: setup.turnOrder,
      stars: 10, // Starting currency
      researchedTechs: [], // No starting technologies
      researchProgress: 0,
      citiesOwned: [],
      currentResearch: undefined,
    }));

    // Extract faction IDs for terrain generation
    const playerFactions = playerSetup.map(p => p.factionId);
    
    // Get map configuration based on selected size
    const mapConfig = MAP_SIZE_CONFIGS[mapSize];
    
    // Generate balanced map with faction-biased terrain generation
    const mapGenerator = new MapGenerator({
      width: mapConfig.dimensions,
      height: mapConfig.dimensions,
      seed: Date.now(),
      playerCount: players.length,
      mapSize: mapSize,
      minResourceDistance: 2,
      maxResourcesPerPlayer: 3
    }, playerFactions);
    
    const map = mapGenerator.generateMap();
    
    // Find city tiles from the generated map for player starting positions
    const cityTiles = map.tiles.filter(tile => tile.hasCity);
    
    // Assign cities to players (first cities generated are best positioned for players)
    const cities = players.map((player, index) => {
      const cityTile = cityTiles[index] || cityTiles[0]; // Fallback to first city if not enough
      
      return {
        id: `city-${player.id}`,
        name: `${player.name}'s Capital`,
        coordinate: cityTile.coordinate,
        ownerId: player.id,
        population: 1,
        starProduction: 2,
        improvements: [],
        structures: [],
        level: 1,
      };
    });
    
    // Update player city ownership
    const playersWithCities = players.map((player, index) => ({
      ...player,
      citiesOwned: [cities[index].id],
    }));
    
    // Mark starting areas around player cities as explored
    const exploreAreaAroundCity = (cityCoord: HexCoordinate, playerId: string): void => {
      const exploreRadius = 2;
      
      for (const tile of map.tiles) {
        const distance = hexDistance(tile.coordinate, cityCoord);
        if (distance <= exploreRadius) {
          tile.exploredBy = [...(tile.exploredBy || []), playerId];
        }
      }
    };
    
    // Explore areas around each player's starting city
    cities.forEach((city, index) => {
      if (index < players.length) {
        exploreAreaAroundCity(city.coordinate, players[index].id);
      }
    });

    // Generate starting units for each player near their cities
    const units: any[] = players.flatMap((player, index) => {
      const city = cities[index];
      if (!city) return [];
      
      // Find suitable spawn position near the city (not on the city tile itself)
      const findUnitSpawnPosition = (cityCoord: HexCoordinate): HexCoordinate => {
        const adjacentTiles = [
          { q: cityCoord.q + 1, r: cityCoord.r, s: cityCoord.s - 1 },
          { q: cityCoord.q + 1, r: cityCoord.r - 1, s: cityCoord.s },
          { q: cityCoord.q, r: cityCoord.r - 1, s: cityCoord.s + 1 },
          { q: cityCoord.q - 1, r: cityCoord.r, s: cityCoord.s + 1 },
          { q: cityCoord.q - 1, r: cityCoord.r + 1, s: cityCoord.s },
          { q: cityCoord.q, r: cityCoord.r + 1, s: cityCoord.s - 1 },
        ];
        
        for (const coord of adjacentTiles) {
          const tile = map.tiles.find(t => 
            t.coordinate.q === coord.q && t.coordinate.r === coord.r
          );
          if (tile && tile.terrain !== 'water' && tile.terrain !== 'mountain' && !tile.hasCity) {
            return coord;
          }
        }
        
        // Fallback to city coordinate if no adjacent suitable tile found
        return cityCoord;
      };
      
      const unitPosition = findUnitSpawnPosition(city.coordinate);
      
      return [
        {
          id: `unit-${player.id}-1`,
          type: 'warrior' as const,
          playerId: player.id,
          coordinate: unitPosition,
          hp: 25,
          maxHp: 25,
          attack: 6,
          defense: 4,
          movement: 3,
          remainingMovement: 3,
          status: 'active' as const,
          abilities: [],
          level: 1,
          experience: 0,
          visionRadius: 2,
          attackRange: 1,
        }
      ];
    });

    // Set initial visibility for starting units - give vision radius around each unit
    const getVisionTiles = (centerQ: number, centerR: number, radius: number = 2) => {
      const tiles = [];
      for (let q = centerQ - radius; q <= centerQ + radius; q++) {
        for (let r = centerR - radius; r <= centerR + radius; r++) {
          const s = -q - r;
          const distance = Math.max(Math.abs(q - centerQ), Math.abs(r - centerR), Math.abs(s - (-centerQ - centerR)));
          if (distance <= radius) {
            tiles.push(`${q},${r}`);
          }
        }
      }
      return tiles;
    };

    const updatedPlayers = playersWithCities.map((player, index) => {
      const playerUnits = units.filter(unit => unit.playerId === player.id);
      const allVisibleTiles: string[] = [];
      
      // Add vision around each unit for this player
      playerUnits.forEach(unit => {
        const visionTiles = getVisionTiles(unit.coordinate.q, unit.coordinate.r, 2);
        allVisibleTiles.push(...visionTiles);
      });
      
      return {
        ...player,
        visibilityMask: Array.from(new Set(allVisibleTiles))
      };
    });

    const gameState: GameState = {
      id: `local-${Date.now()}`,
      players: updatedPlayers,
      currentPlayerIndex: 0,
      turn: 1,
      phase: 'playing',
      map,
      units,
      cities,
      improvements: [],
      structures: [],
      lastAction: undefined,
      winner: undefined,
    };

    set({ 
      gameState,
      gamePhase: 'handoff'
    });
  },
  
  endTurn: (playerId) => {
    const { gameState } = get();
    if (!gameState) return;

    const action = {
      type: 'END_TURN' as const,
      payload: { playerId }
    };

    const newGameState = gameReducer(gameState, action);
    
    // Clear selected unit when turn changes
    useGameState.getState().setSelectedUnit(null);
    
    set({ 
      gameState: newGameState,
      gamePhase: 'handoff'
    });
  },
  
  moveUnit: (unitId, targetCoordinate) => {
    const { gameState } = get();
    if (!gameState) return;

    console.log('Moving unit:', unitId, 'to:', targetCoordinate);

    const action = {
      type: 'MOVE_UNIT' as const,
      payload: { unitId, targetCoordinate }
    };

    const newGameState = gameReducer(gameState, action);
    console.log('Game state updated:', newGameState);
    set({ gameState: newGameState });
  },

  attackUnit: (attackerId: string, targetId: string) => {
    const { gameState } = get();
    if (!gameState) return;

    console.log('Unit attacking:', attackerId, 'target:', targetId);

    const action = {
      type: 'ATTACK_UNIT' as const,
      payload: { attackerId, targetId }
    };

    const newGameState = gameReducer(gameState, action);
    console.log('Combat result:', newGameState);
    set({ gameState: newGameState });
  },
  
  useAbility: (playerId, abilityId) => {
    const { gameState } = get();
    if (!gameState) return;

    const action = {
      type: 'USE_ABILITY' as const,
      payload: { playerId, abilityId }
    };

    const newGameState = gameReducer(gameState, action);
    set({ gameState: newGameState });
  },
  
  dispatch: (action) => {
    const { gameState } = get();
    if (!gameState) return;
    
    const newGameState = gameReducer(gameState, action);
    set({ gameState: newGameState });
  },
  
  resetGame: () => {
    set({
      gamePhase: 'menu',
      gameState: null,
    });
  },
}));
