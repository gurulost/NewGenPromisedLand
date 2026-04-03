import { GameState } from "../types/game";
import { Unit } from "../types/unit";
import { HexCoordinate } from "../types/coordinates";

/**
 * Deprecated: Unit action logic now lives in resolveAction + handlers.
 * This module is kept as a thin stub to avoid split-brain rules.
 */
export interface UnitActionResult {
  success: boolean;
  message: string;
  newState?: GameState;
  effects?: {
    healing?: number;
    conversion?: string[];
    construction?: boolean;
    transport?: boolean;
    areaEffect?: boolean;
    range?: number;
    areaRadius?: number;
    centerDamage?: number;
    areaDamage?: number;
  };
}

const deprecated = (actionName: string): UnitActionResult => ({
  success: false,
  message: `Deprecated: ${actionName} has been removed. Use resolveAction instead.`,
});

export function executeWorkerAction(
  _state: GameState,
  _unit: Unit,
  _action: 'START_CONSTRUCTION' | 'REPAIR' | 'HARVEST' | 'CLEAR_FOREST' | 'BUILD_ROAD',
  _target?: HexCoordinate,
  _buildingType?: string
): UnitActionResult {
  return deprecated('executeWorkerAction');
}

export function executeScoutAction(
  _state: GameState,
  _unit: Unit,
  _action: 'STEALTH' | 'REVEAL_AREA',
  _target?: HexCoordinate
): UnitActionResult {
  return deprecated('executeScoutAction');
}

export function executeSpearmanAction(
  _state: GameState,
  _unit: Unit,
  _action: 'FORMATION' | 'ANTI_CAVALRY_STANCE'
): UnitActionResult {
  return deprecated('executeSpearmanAction');
}

export function executeBoatAction(
  _state: GameState,
  _unit: Unit,
  _action: 'TRANSPORT' | 'COASTAL_EXPLORE',
  _target?: HexCoordinate
): UnitActionResult {
  return deprecated('executeBoatAction');
}

export function executeCatapultAction(
  _state: GameState,
  _unit: Unit,
  _action: 'SIEGE_ATTACK' | 'BOMBARDMENT',
  _target?: HexCoordinate
): UnitActionResult {
  return deprecated('executeCatapultAction');
}

export function executeMissionaryAction(
  _state: GameState,
  _unit: Unit,
  _action: 'HEAL' | 'CONVERT' | 'CONVERT_CITY',
  _target?: HexCoordinate | Unit
): UnitActionResult {
  return deprecated('executeMissionaryAction');
}

export function executeCommanderAction(
  _state: GameState,
  _unit: Unit,
  _action: 'RALLY',
  _target?: HexCoordinate
): UnitActionResult {
  return deprecated('executeCommanderAction');
}

export function executeUnitAction(
  _state: GameState,
  _unit: Unit,
  _actionType: string,
  _parameters?: any
): UnitActionResult {
  return deprecated('executeUnitAction');
}
