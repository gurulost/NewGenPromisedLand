import type { GameState } from "@shared/types/game";
import type { Unit } from "@shared/types/unit";
import { getUnitRuleSummary } from "@shared/logic/ruleQueries";
import { getUnitDefinition } from "@shared/data/units";

/**
 * Comprehensive Action Availability Helper Functions
 * These functions determine what actions are available for units and provide
 * detailed feedback for UI state management (greying out unavailable actions)
 */

export interface ActionAvailability {
  canMove: boolean;
  canAttack: boolean;
  hasAbilities: boolean;
  canHarvest: boolean;
  canBuild: boolean;
  reachableTilesCount: number;
  attackTargetsCount: number;
  isPlayerTurn: boolean;
  movementReason: string;
  attackReason: string;
  abilityReason: string;
}

export function getActionAvailability(
  unit: Unit, 
  gameState: GameState
): ActionAvailability {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const stateForUnit = gameState.units.some(candidate => candidate.id === unit.id)
    ? {
      ...gameState,
      units: gameState.units.map(candidate => candidate.id === unit.id ? unit : candidate),
    }
    : gameState;
  const shared = getUnitRuleSummary(stateForUnit, unit.id, unit.playerId);
  const unitDef = getUnitDefinition(unit.type);
  const rawAbilityCount = ((unit.abilities && unit.abilities.length > 0) ? unit.abilities : unitDef?.abilities || []).length;
  const abilityCount = unit.type === "commander" ? 1 : rawAbilityCount;
  const isPlayerTurn = gameState.phase === 'playing' && currentPlayer?.id === unit.playerId;
  if (!shared) {
    return {
      canMove: false,
      canAttack: false,
      hasAbilities: false,
      canHarvest: false,
      canBuild: false,
      reachableTilesCount: 0,
      attackTargetsCount: 0,
      isPlayerTurn,
      movementReason: "Unit not found",
      attackReason: "Unit not found",
      abilityReason: "Unit not found",
    };
  }
  const movementReason =
    shared.canMove
      ? `${shared.reachableTilesCount} tiles available`
      : shared.actionReasons.move || "No valid moves available";
  const attackReason = unit.attack <= 0
    ? "Unit cannot attack"
    : shared.actionReasons.attack || "No valid targets in range";
  const abilityReason = shared.canUseAbilities
    ? `${abilityCount} abilities available`
    : shared.actionReasons.act || "No abilities available";

  return {
    canMove: shared.canMove,
    canAttack: shared.canAttack,
    hasAbilities: shared.canUseAbilities,
    canHarvest: shared.canHarvest,
    canBuild: shared.canBuild,
    reachableTilesCount: shared.reachableTilesCount,
    attackTargetsCount: shared.attackTargetsCount,
    isPlayerTurn,
    movementReason,
    attackReason,
    abilityReason
  };
}

export function getDetailedActionFeedback(
  actionType: 'move' | 'attack' | 'ability' | 'harvest' | 'build',
  availability: ActionAvailability
): { available: boolean; reason: string; count?: number } {
  switch (actionType) {
    case 'move':
      return {
        available: availability.canMove,
        reason: availability.movementReason,
        count: availability.reachableTilesCount
      };
    case 'attack':
      return {
        available: availability.canAttack,
        reason: availability.attackReason,
        count: availability.attackTargetsCount
      };
    case 'ability':
      return {
        available: availability.hasAbilities,
        reason: availability.abilityReason
      };
    case 'harvest':
      return {
        available: availability.canHarvest,
        reason: availability.canHarvest ? "Resources available" : "No resources on tile"
      };
    case 'build':
      return {
        available: availability.canBuild,
        reason: availability.canBuild ? "Can build on tile" : "Cannot build here"
      };
    default:
      return { available: false, reason: "Unknown action" };
  }
}
