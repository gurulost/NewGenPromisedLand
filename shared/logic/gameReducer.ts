import { GameAction, GameState } from "../types/game";
import { resolveActionState } from "./resolveAction";

/**
 * Thin reducer wrapper (legacy compatibility).
 * All rules live in resolveAction/handlers.
 */
export function gameReducer(state: GameState, action: GameAction): GameState {
  return resolveActionState(state, action);
}

// Re-export legacy handlers/utilities for existing imports.
export * from "./legacyHandlers";
