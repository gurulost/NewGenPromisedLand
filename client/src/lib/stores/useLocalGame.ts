import { create } from "zustand";
import { GameState, PlayerState, HexCoordinate, TerrainType } from "@shared/types/game";
import { gameReducer } from "@shared/logic/gameReducer";
import { MapGenerator } from "@shared/utils/mapGenerator";
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
  }>) => void;
  endTurn: (playerId: string) => void;
  moveUnit: (unitId: string, targetCoordinate: any) => void;
  attackUnit: (attackerId: string, targetId: string) => void;
  useAbility: (playerId: string, abilityId: string) => void;
  resetGame: () => void;
}

export const useLocalGame = create<LocalGameStore>((set, get) => ({
  gamePhase: 'menu',
  gameState: null,
  
  setGamePhase: (phase) => set({ gamePhase: phase }),
  
  startLocalGame: (playerSetup) => {
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
    }));

    // Generate balanced map with strategic resource distribution
    const map = MapGenerator.generateBalancedMap(players.length, Date.now());
    
    // Mark starting tiles as explored
    const exploredTiles = new Set([
      '0,0', '1,0', '0,1', '-1,1', '-1,0', '0,-1', '1,-1', // Player 1 area
      '2,-1', '1,-1', '2,0', '1,0', '3,-1', '2,-2', '3,-2'  // Player 2 area
    ]);
    
    map.tiles = map.tiles.map(tile => {
      const tileKey = `${tile.coordinate.q},${tile.coordinate.r}`;
      if (exploredTiles.has(tileKey)) {
        const explorerId = tileKey.startsWith('0,') || tileKey.startsWith('1,') || tileKey.startsWith('-1,') ? players[0].id : players[1].id;
        return {
          ...tile,
          exploredBy: [explorerId]
        };
      }
      return tile;
    });
    
    // Find suitable starting positions (not water or mountain)
    const findValidSpawnPosition = (startQ: number, startR: number): HexCoordinate => {
      const candidates = [
        { q: startQ, r: startR, s: -startQ - startR },
        { q: startQ + 1, r: startR, s: -startQ - startR - 1 },
        { q: startQ, r: startR + 1, s: -startQ - startR - 1 },
        { q: startQ - 1, r: startR + 1, s: -startQ - startR },
        { q: startQ - 1, r: startR, s: -startQ - startR + 1 },
        { q: startQ, r: startR - 1, s: -startQ - startR + 1 },
      ];
      
      for (const coord of candidates) {
        const tile = map.tiles.find(t => 
          t.coordinate.q === coord.q && t.coordinate.r === coord.r
        );
        if (tile && tile.terrain !== 'water' && tile.terrain !== 'mountain') {
          return coord;
        }
      }
      
      // Fallback - force create a plains tile at this position
      return { q: startQ, r: startR, s: -startQ - startR };
    };

    const player1Start = findValidSpawnPosition(0, 0);
    const player2Start = findValidSpawnPosition(3, -2);

    // Ensure spawn positions have valid terrain
    map.tiles = map.tiles.map(tile => {
      if ((tile.coordinate.q === player1Start.q && tile.coordinate.r === player1Start.r) ||
          (tile.coordinate.q === player2Start.q && tile.coordinate.r === player2Start.r)) {
        return { ...tile, terrain: 'plains' as TerrainType };
      }
      return tile;
    });

    // Create some initial units for testing
    const units: any[] = [
      {
        id: 'unit-1',
        type: 'warrior',
        playerId: players[0].id,
        coordinate: player1Start,
        hp: 25,
        maxHp: 25,
        attack: 6,
        defense: 4,
        movement: 3,
        remainingMovement: 3,
        status: 'active',
        abilities: [],
        level: 1,
        experience: 0,
      },
      {
        id: 'unit-2', 
        type: 'missionary',
        playerId: players[1].id,
        coordinate: player2Start,
        hp: 18,
        maxHp: 18,
        attack: 1,
        defense: 2,
        movement: 3,
        remainingMovement: 3,
        status: 'active',
        abilities: [],
        level: 1,
        experience: 0,
      }
    ];

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

    const updatedPlayers = players.map((player, index) => {
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
  
  resetGame: () => {
    set({
      gamePhase: 'menu',
      gameState: null,
    });
  },
}));
