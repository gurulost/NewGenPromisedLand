import { GameState, GameAction } from '../types/game';
import { executeAITurn } from './aiEngine';
import { getFactionAbilityAvailability } from '../logic/factionAbilityAvailability';
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

  const applyDecision = (decision: ReturnType<typeof executeAITurn>[number], playerId: string) => {
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
      case 'CAPTURE_CITY':
        if (decision.unitId && decision.cityId) {
          action = { type: 'CAPTURE_CITY', payload: { playerId, unitId: decision.unitId, cityId: decision.cityId } };
        }
        break;
      case 'START_CONSTRUCTION':
        if (decision.cityId && decision.buildingType) {
          action = {
            type: 'START_CONSTRUCTION',
            payload: {
              playerId,
              buildingType: decision.buildingType,
              cityId: decision.cityId,
              category: decision.constructionCategory ?? 'structures',
              ...(decision.targetCoordinate ? { coordinate: decision.targetCoordinate } : {}),
              ...(decision.builderUnitId ? { builderUnitId: decision.builderUnitId } : {}),
            },
          };
        }
        break;
      case 'CONQUER_VILLAGE':
        if (decision.unitId) {
          action = { type: 'CONQUER_VILLAGE', payload: { unitId: decision.unitId, playerId } };
        }
        break;
      case 'CONVERT_VILLAGE':
        if (decision.unitId) {
          action = { type: 'CONVERT_VILLAGE', payload: { unitId: decision.unitId, playerId } };
        }
        break;
      case 'EXPLORE_RUINS':
        if (decision.unitId && decision.targetCoordinate) {
          action = {
            type: 'EXPLORE_RUINS',
            payload: { unitId: decision.unitId, playerId, coordinate: decision.targetCoordinate },
          };
        }
        break;
      case 'WORLD_ELEMENT_HARVEST':
        if (decision.unitId && decision.elementId && decision.targetCoordinate) {
          action = {
            type: 'WORLD_ELEMENT_HARVEST',
            payload: {
              playerId,
              unitId: decision.unitId,
              elementId: decision.elementId,
              coordinate: decision.targetCoordinate,
            },
          };
        }
        break;
      case 'WORLD_ELEMENT_BUILD':
        if (decision.unitId && decision.elementId && decision.targetCoordinate) {
          action = {
            type: 'WORLD_ELEMENT_BUILD',
            payload: {
              playerId,
              unitId: decision.unitId,
              elementId: decision.elementId,
              coordinate: decision.targetCoordinate,
            },
          };
        }
        break;
      case 'USE_ABILITY':
        if (decision.abilityId) {
          const availability = getFactionAbilityAvailability(state, playerId, decision.abilityId);
          if (availability.available) {
            action = { type: 'USE_ABILITY', payload: { playerId, abilityId: decision.abilityId } };
          }
        }
        break;
      case 'HEAL_UNIT':
        if (decision.unitId) {
          action = { type: 'HEAL_UNIT', payload: { unitId: decision.unitId, playerId } };
        }
        break;
      case 'APPLY_STEALTH':
        if (decision.unitId) {
          action = { type: 'APPLY_STEALTH', payload: { unitId: decision.unitId, playerId } };
        }
        break;
      case 'FORMATION_FIGHTING':
        if (decision.unitId) {
          action = { type: 'FORMATION_FIGHTING', payload: { unitId: decision.unitId, playerId } };
        }
        break;
      case 'SIEGE_MODE':
        if (decision.unitId) {
          action = { type: 'SIEGE_MODE', payload: { unitId: decision.unitId, playerId } };
        }
        break;
      case 'RALLY_TROOPS':
        if (decision.unitId) {
          action = { type: 'RALLY_TROOPS', payload: { unitId: decision.unitId, playerId } };
        }
        break;
      case 'RESEARCH_TECH':
        if (decision.techId) {
          action = { type: 'RESEARCH_TECH', payload: { playerId, techId: decision.techId } };
        }
        break;
      case 'END_TURN':
        action = { type: 'END_TURN', payload: { playerId } };
        break;
      default:
        // Unsupported actions are skipped in the harness.
        break;
    }

    if (!action) return;
    const nextState = resolveActionState(state, action);
    if (nextState === state) return;
    state = nextState;
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
      const difficulty = currentPlayer.aiDifficulty || 'normal';
      const maxActionsPerTurn = difficulty === 'easy' ? 2 : difficulty === 'hard' ? 4 : 3;
      let actionsThisTurn = 0;

      while (actionsThisTurn < maxActionsPerTurn) {
        const refreshedPlayer = state.players[state.currentPlayerIndex];
        if (!refreshedPlayer || refreshedPlayer.id !== currentPlayer.id) {
          break;
        }

        const decisions = executeAITurn(state, refreshedPlayer);
        let appliedThisPass = false;
        for (const decision of decisions) {
          const beforeState = state;
          applyDecision(decision, refreshedPlayer.id);
          if (state !== beforeState) {
            actionsThisTurn += 1;
            appliedThisPass = true;
            break;
          }
        }

        if (!appliedThisPass) {
          break;
        }
      }
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
