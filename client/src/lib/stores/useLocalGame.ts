import { create } from "zustand";
import { GameState, PlayerState, TerrainType } from "@shared/types/game";
import { HexCoordinate } from "@shared/types/coordinates";
import { hexDistance } from "@shared/utils/hex";
import { gameReducer } from "@shared/logic/gameReducer";
import { MapGenerator, MapSize, MAP_SIZE_CONFIGS } from "@shared/utils/mapGenerator";
import { useGameState } from "./useGameState";
import { gameDebugger } from "../../utils/gameDebug";
import { audioService } from "../../services/AudioService";

type GamePhase = 'menu' | 'playerSetup' | 'handoff' | 'playing' | 'gameOver';

interface LocalGameStore {
  gamePhase: GamePhase;
  gameState: GameState | null;
  
  setGamePhase: (phase: GamePhase) => void;
  setGameState: (state: GameState | null) => void;
  startLocalGame: (playerSetup: Array<{
    id: string;
    name: string;
    factionId: string;
    turnOrder: number;
    isAI?: boolean;
    aiDifficulty?: 'easy' | 'normal' | 'hard';
  }>, mapSize?: MapSize) => void;
  endTurn: (playerId: string) => void;
  moveUnit: (unitId: string, targetCoordinate: any) => void;
  attackUnit: (attackerId: string, targetId: string) => void;
  useAbility: (playerId: string, abilityId: string) => void;
  dispatch: (action: any) => void;
  resetGame: () => void;
  loadGameState: (state: GameState) => void;
  harvestResource: (unitId: string, resourceCoordinate: any, cityId: string) => void;
}

export const useLocalGame = create<LocalGameStore>((set, get) => {
  return {
  gamePhase: 'menu',
  gameState: null,
  
  setGamePhase: (phase) => {
    gameDebugger.trackGamePhase(phase);
    gameDebugger.logUIInteraction(`Game phase changed to: ${phase}`, { phase });
    set({ gamePhase: phase });
  },
  
  setGameState: (state) => {
    gameDebugger.logUIInteraction(`Game state updated`, { hasState: !!state });
    set({ gameState: state });
  },
  
  startLocalGame: (playerSetup, mapSize = 'normal') => {
    // Create initial game state
    const players: PlayerState[] = playerSetup.map(setup => ({
      id: setup.id,
      name: setup.name,
      factionId: setup.factionId,
      isAI: setup.isAI || false,
      aiDifficulty: setup.aiDifficulty || 'normal',
      stats: {
        faith: 50,
        pride: 30,
        internalDissent: 10,
      },
      modifiers: [],
      constructionQueue: [],
      visibilityMask: [],
      exploredTiles: [],
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
    const capitalPositions = mapGenerator.getCapitalPositions();
    
    if (capitalPositions.length < players.length) {
      throw new Error(`Map generation failed: expected ${players.length} capital positions, but only ${capitalPositions.length} were generated`);
    }
    
    const playerCapitalTiles = players.map((player, index) => {
      const capitalCoordinate = capitalPositions[index];
      if (!capitalCoordinate) {
        throw new Error(`No capital coordinate generated for player index ${index}`);
      }
      
      const tile = map.tiles.find(t =>
        t.coordinate.q === capitalCoordinate.q &&
        t.coordinate.r === capitalCoordinate.r &&
        t.coordinate.s === capitalCoordinate.s
      );
      
      if (!tile || !tile.hasCity) {
        console.error(`❌ CRITICAL: Capital tile missing for player ${player.name}`, { capitalCoordinate });
        throw new Error(`Map generation failed: no capital city tile found for ${player.name}`);
      }
      
      return tile;
    });
    
    // Assign cities to players using their dedicated capital tiles
    const cities = players.map((player, index) => {
      const cityTile = playerCapitalTiles[index];
      return {
        id: `city-${player.id}`,
        name: `${player.name}'s Capital`,
        coordinate: cityTile.coordinate,
        ownerId: player.id,
        population: 1,
        maxPopulation: 4, // Population needed to level up
        level: 1,
        starProduction: 2, // Base star production
        improvements: [],
        structures: [],
        harvestedResources: [], // Track harvested resource tiles
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
          hasAttacked: false,
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
      
      const uniqueVisibleTiles = Array.from(new Set(allVisibleTiles));
      
      return {
        ...player,
        visibilityMask: uniqueVisibleTiles,
        exploredTiles: uniqueVisibleTiles // Initially, explored tiles are the same as visible tiles
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

    console.log('🔄 END_TURN called', {
      playerId,
      currentPlayerIndex: gameState.currentPlayerIndex,
      playerCount: gameState.players.length,
      players: gameState.players.map(p => ({ id: p.id, name: p.name }))
    });

    const action = {
      type: 'END_TURN' as const,
      payload: { playerId }
    };

    const newGameState = gameReducer(gameState, action);
    
    console.log('🔄 END_TURN completed', {
      oldPlayerIndex: gameState.currentPlayerIndex,
      newPlayerIndex: newGameState.currentPlayerIndex,
      playerCount: newGameState.players.length,
      currentPlayerName: newGameState.players[newGameState.currentPlayerIndex]?.name || 'UNDEFINED',
      turn: newGameState.turn
    });
    
    // Clear selected unit when turn changes
    useGameState.getState().setSelectedUnit(null);
    
    // Play audio feedback for ending turn
    audioService.onTurnEnd();
    
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
    
    // Play audio feedback for unit movement
    audioService.onUnitMove();
    
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
    
    // Play audio feedback for unit attack
    audioService.onUnitAttack();
    
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
    
    // Play audio feedback for ability use
    audioService.onNotification();
    
    set({ gameState: newGameState });
  },
  
  dispatch: (action) => {
    const { gameState } = get();
    if (!gameState) return;
    
    const newGameState = gameReducer(gameState, action);
    
    // Add audio feedback for various action types via generic dispatch
    switch (action.type) {
      case 'RESEARCH_TECH':
        audioService.onTechResearch();
        break;
      case 'BUILD_STRUCTURE':
      case 'START_CONSTRUCTION':
        audioService.onBuildingBuilt();
        break;
      case 'BUILD_UNIT':
        audioService.onUnitBuilt();
        break;
      case 'CAPTURE_VILLAGE':
        audioService.onVillageCapture();
        break;
      case 'CAPTURE_CITY':
        audioService.onCityCapture();
        break;
      case 'MOVE_UNIT':
        audioService.onUnitMove();
        break;
      case 'ATTACK_UNIT':
        audioService.onUnitAttack();
        break;
      case 'END_TURN':
        audioService.onTurnEnd();
        break;
      case 'HARVEST_RESOURCE':
      case 'WORLD_ELEMENT_HARVEST':
        audioService.onResourceCollect();
        break;
      default:
        // Generic notification for other actions
        audioService.onNotification();
        break;
    }
    
    set({ gameState: newGameState });
  },
  
  resetGame: () => {
    set({
      gamePhase: 'menu',
      gameState: null,
    });
  },

  loadGameState: (state: GameState) => {
    set({ 
      gameState: state,
      gamePhase: 'playing'
    });
  },
  
  harvestResource: (unitId, resourceCoordinate, cityId) => {
    const { gameState } = get();
    if (!gameState) return;

    const action = {
      type: 'HARVEST_RESOURCE' as const,
      payload: { unitId, resourceCoordinate, cityId }
    };

    const newGameState = gameReducer(gameState, action);
    
    // Play audio feedback for resource harvest
    audioService.onResourceCollect();
    
    set({ gameState: newGameState });
  },
}});
