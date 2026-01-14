import { GameState } from "../types/game";
import { Unit } from "../types/unit";
import { HexCoordinate } from "../types/coordinates";
import { resolveCombat } from "./combatResolver";

/**
 * Deprecated: combat rules live in combatResolver + computeEffectiveStats.
 * This module only keeps thin wrappers to avoid split-brain logic.
 */
export interface CombatResult {
  success: boolean;
  canAttack?: boolean;
  reason?: string;
  reasonCode?: string;
  attackerDamage: number;
  defenderDamage: number;
  attackerHp: number;
  defenderHp: number;
  attackerKilled: boolean;
  defenderKilled: boolean;
  specialEffects: string[];
  message: string;
  modifiers?: {
    attacker: string[];
    defender: string[];
  };
}

const deprecated = (actionName: string): never => {
  throw new Error(`Deprecated combat helper: ${actionName}. Use resolveCombat instead.`);
};

export function calculateCombatDamage(
  attacker: Unit,
  defender: Unit,
  state: GameState,
  terrain?: string
): CombatResult {
  return resolveCombat(attacker, defender, state, { terrainOverride: terrain });
}

export function calculateRangedAttack(
  _attacker: Unit,
  _targetCoordinate: HexCoordinate,
  _state: GameState
): {
  success: boolean;
  affectedUnits: Unit[];
  damage: number;
  message: string;
  specialEffects: string[];
} {
  return deprecated('calculateRangedAttack');
}

export function calculateHealing(_healer: Unit, _state: GameState): {
  success: boolean;
  healedUnits: Unit[];
  healingAmount: number;
  message: string;
} {
  return deprecated('calculateHealing');
}

export function calculateConversion(
  _converter: Unit,
  _target: Unit,
  _state: GameState
): {
  success: boolean;
  converted: boolean;
  message: string;
  faithCost: number;
} {
  return deprecated('calculateConversion');
}

export function resolveMeleeCombat(
  _attacker: Unit,
  _defender: Unit,
  _state: GameState
): CombatResult {
  return deprecated('resolveMeleeCombat');
}
