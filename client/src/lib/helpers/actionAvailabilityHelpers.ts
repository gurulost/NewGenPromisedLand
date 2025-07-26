import type { GameState, PlayerState } from "@shared/types/game";
import type { Unit } from "@shared/types/unit";
import { getUnitDefinition } from "@shared/data/units";
import { getValidAttackTargets } from "@shared/logic/unitLogic";
import { getReachableTiles } from "@shared/logic/pathfinding";
import { hexNeighbors, hexDistance } from "@shared/utils/hex";

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
  const isPlayerTurn = unit.playerId === currentPlayer.id;
  const unitDef = getUnitDefinition(unit.type);

  // Movement availability
  const hasMovementPoints = unit.remainingMovement > 0;
  const reachableTiles = hasMovementPoints ? getReachableTiles(
    unit.coordinate, 
    unit.remainingMovement, 
    (coord) => gameState.map.tiles.some(tile => 
      tile.coordinate.q === coord.q && 
      tile.coordinate.r === coord.r &&
      tile.terrain !== 'water' // Basic passability check
    )
  ) : [];
  const hasValidMoves = reachableTiles.length > 0;
  
  const canMove = isPlayerTurn && hasMovementPoints && hasValidMoves;
  const movementReason = !isPlayerTurn 
    ? "Not your turn" 
    : !hasMovementPoints
      ? "No movement remaining"
      : !hasValidMoves
        ? "No valid moves available"
        : `${reachableTiles.length} tiles available`;

  // Attack availability
  const hasAttackCapability = unit.attack > 0;
  const hasNotAttacked = !unit.hasAttacked;
  const attackTargets = (isPlayerTurn && hasNotAttacked && hasAttackCapability) 
    ? getValidAttackTargets(unit, gameState) 
    : [];
  const hasValidTargets = attackTargets.length > 0;
  
  const canAttack = isPlayerTurn && hasNotAttacked && hasAttackCapability && hasValidTargets;
  const attackReason = !isPlayerTurn
    ? "Not your turn"
    : unit.hasAttacked
      ? "Already attacked this turn"
      : !hasAttackCapability
        ? "Unit cannot attack"
        : !hasValidTargets
          ? "No valid targets in range"
          : `${attackTargets.length} targets available`;

  // Abilities availability
  const hasAbilities = unitDef.abilities.length > 0;
  const canUseAbilities = isPlayerTurn && hasAbilities && getAbilityAvailability(unit, currentPlayer, gameState);
  const abilityReason = !isPlayerTurn
    ? "Not your turn"
    : !hasAbilities
      ? "No abilities available"
      : unit.hasAttacked
        ? "Already acted this turn"
        : !canUseAbilities
          ? "Insufficient resources"
          : `${unitDef.abilities.length} abilities available`;

  // Resource/building availability
  const currentTile = gameState.map.tiles.find(tile =>
    tile.coordinate.q === unit.coordinate.q &&
    tile.coordinate.r === unit.coordinate.r
  );
  const canHarvest = isPlayerTurn && currentTile?.resources && currentTile.resources.length > 0 && !unit.hasAttacked;
  const canBuild = isPlayerTurn && unit.type === 'worker' && currentTile && !currentTile.hasCity;

  return {
    canMove,
    canAttack,
    hasAbilities: canUseAbilities || false,
    canHarvest,
    canBuild,
    reachableTilesCount: reachableTiles.length,
    attackTargetsCount: attackTargets.length,
    isPlayerTurn,
    movementReason,
    attackReason,
    abilityReason
  };
}

function getAbilityAvailability(unit: Unit, player: PlayerState, gameState: GameState): boolean {
  switch (unit.type) {
    case 'missionary':
      return player.stats.faith >= 5;
    case 'commander':
      return player.stats.pride >= 5;
    case 'worker':
      return player.stars >= 3;
    case 'scout':
    case 'spearman':
    case 'catapult':
      return true;
    default:
      return false;
  }
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