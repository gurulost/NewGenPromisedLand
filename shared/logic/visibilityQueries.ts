import type { GameState } from "../types/game";
import type { Unit } from "../types/unit";
import {
  getVisibleUnits as getVisibleUnitsFromUnitLogic,
  isUnitVisibleToPlayer as isUnitVisibleToPlayerFromUnitLogic,
} from "./unitLogic";

/**
 * Rendering-only visibility query layer.
 *
 * Command legality belongs in ruleQueries.ts. These helpers are intentionally
 * limited to fog-of-war/rendering visibility so client renderers do not import
 * unit rule helpers directly.
 */
export function getVisibleUnitsForRendering(gameState: GameState, playerId?: string): Unit[] {
  return getVisibleUnitsFromUnitLogic(gameState, playerId);
}

export function isUnitVisibleForRendering(unit: Unit, playerId: string, gameState: GameState): boolean {
  return isUnitVisibleToPlayerFromUnitLogic(unit, playerId, gameState);
}
