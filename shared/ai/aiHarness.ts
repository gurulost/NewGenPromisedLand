import { GameState, GameAction } from '../types/game';
import { executeAITurn } from './aiEngine';
import { resolveActionState } from '../logic/resolveAction';

type SimulationResult = {
  turnsSimulated: number;
  actionsApplied: number;
  errors: Array<{ turn: number; playerId: string; error: string }>;
  finalState: GameState;
};

/**
  * Lightweight bot-vs-bot harness for debugging AI decisions.
  * It steps the reducer with the supported AI decisions and records errors instead of throwing.
  * This is meant for offline tuning and smoke testing, not production gameplay.
  */
export function simulateAITurns(initialState: GameState, maxTurns = 10): SimulationResult {
  let state: GameState = JSON.parse(JSON.stringify(initialState));
  const errors: SimulationResult['errors'] = [];
  let actionsApplied = 0;

  const applyDecision = (decision: ReturnType<typeof executeAITurn>[number]) => {
    let action: GameAction | null = null;
    switch (decision.type) {
      case 'MOVE_UNIT':
        if (decision.unitId && decision.targetCoordinate) {
          action = { type: 'MOVE_UNIT', payload: { unitId: decision.unitId, targetCoordinate: decision.targetCoordinate } };
        }
        break;
      case 'ATTACK_UNIT':
        if (decision.unitId && decision.targetId) {
          action = { type: 'ATTACK_UNIT', payload: { attackerId: decision.unitId, targetId: decision.targetId } };
        }
        break;
      case 'USE_ABILITY':
        if (decision.abilityId) {
          action = { type: 'USE_ABILITY', payload: { playerId: state.players[state.currentPlayerIndex].id, abilityId: decision.abilityId } };
        }
        break;
      case 'RESEARCH_TECH':
        if (decision.techId) {
          action = { type: 'RESEARCH_TECH', payload: { playerId: state.players[state.currentPlayerIndex].id, techId: decision.techId } };
        }
        break;
      case 'END_TURN':
        action = { type: 'END_TURN', payload: { playerId: state.players[state.currentPlayerIndex].id } };
        break;
      default:
        // Unsupported actions (builds/abilities not in reducer) are skipped in the harness
        break;
    }

    if (!action) return;
    state = resolveActionState(state, action);
    actionsApplied += 1;
  };

  for (let turn = 0; turn < maxTurns; turn++) {
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (!currentPlayer?.isAI || currentPlayer.isEliminated) {
      // Advance to next player/end turn
      state = resolveActionState(state, { type: 'END_TURN', payload: { playerId: currentPlayer?.id || '' } });
      continue;
    }

    try {
      const decisions = executeAITurn(state, currentPlayer);
      decisions.forEach(applyDecision);
    } catch (err) {
      errors.push({
        turn,
        playerId: currentPlayer.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Always end the AI turn to avoid getting stuck
    state = resolveActionState(state, { type: 'END_TURN', payload: { playerId: currentPlayer.id } });
  }

  return {
    turnsSimulated: maxTurns,
    actionsApplied,
    errors,
    finalState: state,
  };
}
