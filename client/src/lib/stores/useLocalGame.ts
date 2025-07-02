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

    const gameState: GameState = {
      id: `local-${Date.now()}`,
      players,
      currentPlayerIndex: 0,
      turn: 1,
      phase: 'playing',
      map: generateMap(15, 10), // Generate 15x10 hex map
      units: [],
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
