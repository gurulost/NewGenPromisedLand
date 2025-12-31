import { GameState } from "../types/game";
import { Unit } from "../types/unit";
import { HexCoordinate } from "../types/coordinates";
import { hexDistance } from "../utils/hex";
import { getUnitDefinition } from "../data/units";
import { GAME_RULES } from "../data/gameRules";
import { canAttemptUnitConversion, computeUnitConversionChance, getUnitConversionFaithCost } from "./conversion";
import { resolveCombat } from "./combatResolver";

/**
 * Advanced Combat System - Handles all unit combat mechanics
 * Includes special unit abilities, terrain bonuses, and formation tactics
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

/**
 * Calculate damage with unit-specific bonuses and abilities
 */
export function calculateCombatDamage(
  attacker: Unit,
  defender: Unit,
  state: GameState,
  terrain?: string
): CombatResult {
  return resolveCombat(attacker, defender, state, { terrainOverride: terrain });
}

/**
 * Handle special ranged attacks (Catapult bombardment, etc.)
 */
export function calculateRangedAttack(
  attacker: Unit,
  targetCoordinate: HexCoordinate,
  state: GameState
): {
  success: boolean;
  affectedUnits: Unit[];
  damage: number;
  message: string;
  specialEffects: string[];
} {
  const attackerDef = getUnitDefinition(attacker.type);

  if (attacker.type === 'catapult' && attackerDef.abilities.includes('LONG_RANGE_BOMBARDMENT')) {
    // Area of effect attack
    const bombardmentRadius = 1;
    const baseDamage = attacker.attack;

    // Find all units in bombardment area
    const affectedUnits = state.units.filter(unit =>
      unit.playerId !== attacker.playerId &&
      hexDistance(unit.coordinate, targetCoordinate) <= bombardmentRadius
    );

    return {
      success: true,
      affectedUnits,
      damage: baseDamage,
      message: `Catapult bombardment affects ${affectedUnits.length} units`,
      specialEffects: ["Area bombardment attack"]
    };
  }

  return {
    success: false,
    affectedUnits: [],
    damage: 0,
    message: "Unit cannot perform ranged attacks",
    specialEffects: []
  };
}

/**
 * Handle unit healing abilities
 */
export function calculateHealing(
  healer: Unit,
  targetArea: HexCoordinate,
  state: GameState
): {
  success: boolean;
  healedUnits: Unit[];
  healingAmount: number;
  message: string;
  faithCost: number;
} {
  const healerDef = getUnitDefinition(healer.type);
  const player = state.players.find(p => p.id === healer.playerId);

  if (!player) {
    return {
      success: false,
      healedUnits: [],
      healingAmount: 0,
      message: "Player not found",
      faithCost: 0
    };
  }

  // Missionary healing
  if (healer.type === 'missionary' && healerDef.abilities.includes('HEAL')) {
    const healingRange = 2;
    const healingAmount = GAME_RULES.units.healingAmount;
    const faithCost = 20;

    if (player.stats.faith < faithCost) {
      return {
        success: false,
        healedUnits: [],
        healingAmount: 0,
        message: `Insufficient faith for healing (need ${faithCost})`,
        faithCost: 0
      };
    }

    const healedUnits = state.units.filter(unit =>
      unit.playerId === healer.playerId &&
      unit.id !== healer.id &&
      hexDistance(unit.coordinate, targetArea) <= healingRange &&
      unit.hp < unit.maxHp
    );

    return {
      success: true,
      healedUnits,
      healingAmount,
      message: `Missionary heals ${healedUnits.length} nearby allies`,
      faithCost
    };
  }

  return {
    success: false,
    healedUnits: [],
    healingAmount: 0,
    message: "Unit cannot heal",
    faithCost: 0
  };
}

/**
 * Handle unit conversion abilities
 */
export function calculateConversion(
  converter: Unit,
  target: Unit,
  state: GameState
): {
  success: boolean;
  conversionChance: number;
  message: string;
  faithCost: number;
} {
  const converterPlayer = state.players.find(p => p.id === converter.playerId);
  const targetPlayer = state.players.find(p => p.id === target.playerId);

  if (!converterPlayer || !targetPlayer) {
    return {
      success: false,
      conversionChance: 0,
      message: "Player not found",
      faithCost: 0
    };
  }

  const eligibility = canAttemptUnitConversion(state, converter, target, { ignoreTurn: true });
  if (!eligibility.ok) {
    const faithCost = getUnitConversionFaithCost();
    const message =
      eligibility.reason === 'same_player' ? 'Cannot convert allied units' :
        eligibility.reason === 'out_of_range' ? `Target too far for conversion (range ${GAME_RULES.abilities.conversionRadius})` :
          eligibility.reason === 'exhausted' ? 'Unit has already acted this turn' :
            eligibility.reason === 'invalid_caster' ? 'Unit cannot convert enemies' :
              'Conversion attempt is not valid';
    return { success: false, conversionChance: 0, message, faithCost: 0 };
  }

  const faithCost = getUnitConversionFaithCost();
  if (converterPlayer.stats.faith < faithCost) {
    return {
      success: false,
      conversionChance: 0,
      message: `Insufficient faith for conversion (need ${faithCost})`,
      faithCost: 0
    };
  }

  const conversionChance = computeUnitConversionChance(converterPlayer, targetPlayer, target);
  return {
    success: true,
    conversionChance,
    message: `${Math.round(conversionChance * 100)}% chance to convert ${target.type}`,
    faithCost
  };

  return {
    success: false,
    conversionChance: 0,
    message: "Unit cannot convert enemies",
    faithCost: 0
  };
}

export function resolveMeleeCombat(
  attacker: Unit,
  defender: Unit,
  state: GameState,
  terrain?: string
): CombatResult {
  return calculateCombatDamage(attacker, defender, state, terrain);
}
