import { create } from "zustand";
import { GameState, PlayerState } from "@shared/types/game";
import { gameReducer } from "@shared/logic/gameReducer";
import { generateMap } from "../gameStorage";

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

    const map = generateMap(6, 6); // Generate smaller hex map for better visibility
    
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
    
    // Create some initial units for testing
    const units: any[] = [
      {
        id: 'unit-1',
        type: 'warrior',
        playerId: players[0].id,
        coordinate: { q: 0, r: 0, s: 0 },
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
        coordinate: { q: 2, r: -1, s: -1 },
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

    // Set initial visibility for starting units - explore more tiles around spawn
    const updatedPlayers = players.map((player, index) => {
      if (index === 0) {
        // Player 1 around origin
        return {
          ...player,
          visibilityMask: ['0,0', '1,0', '0,1', '-1,1', '-1,0', '0,-1', '1,-1']
        };
      } else {
        // Player 2 around their spawn
        return {
          ...player,
          visibilityMask: ['2,-1', '1,-1', '2,0', '1,0', '3,-1', '2,-2', '3,-2']
        };
      }
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
    
    set({ 
      gameState: newGameState,
      gamePhase: 'handoff'
    });
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
