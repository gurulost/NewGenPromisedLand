import { GameState } from "../types/game";
import { Unit } from "../types/unit";
import { HexCoordinate } from "../types/coordinates";
import { hexDistance } from "../utils/hex";
import { getUnitDefinition } from "../data/units";
import { GAME_RULES } from "../data/gameRules";
import { canAttemptUnitConversion, computeUnitConversionChance, getUnitConversionFaithCost } from "./conversion";

/**
 * Advanced Combat System - Handles all unit combat mechanics
 * Includes special unit abilities, terrain bonuses, and formation tactics
 */

export interface CombatResult {
  success: boolean;
  attackerDamage: number;
  defenderDamage: number;
  attackerHp: number;
  defenderHp: number;
  attackerKilled: boolean;
  defenderKilled: boolean;
  specialEffects: string[];
  message: string;
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
  const attackerDef = getUnitDefinition(attacker.type);
  const defenderDef = getUnitDefinition(defender.type);

  let attackerAttack = attacker.attack;
  let defenderDefense = defender.defense;
  const specialEffects: string[] = [];

  // === UNIT-SPECIFIC COMBAT BONUSES ===

  // Spearman vs Fast Units (Anti-Cavalry)
  if (attacker.type === 'spearman' && attackerDef.abilities.includes('ANTI_CAVALRY')) {
    if (defender.movement >= 4 || defender.type === 'scout') {
      attackerAttack += 4;
      specialEffects.push("Spearman anti-cavalry bonus (+4 attack)");
    }
  }

  // Formation Fighting (Spearmen near each other)
  if (attacker.type === 'spearman' && attackerDef.abilities.includes('FORMATION_FIGHTING')) {
    const nearbySpearmen = state.units.filter(u =>
      u.playerId === attacker.playerId &&
      u.type === 'spearman' &&
      u.id !== attacker.id &&
      hexDistance(u.coordinate, attacker.coordinate) === 1
    ).length;

    if (nearbySpearmen > 0) {
      const formationBonus = nearbySpearmen * 2;
      attackerAttack += formationBonus;
      specialEffects.push(`Formation fighting bonus (+${formationBonus} attack)`);
    }
  }

  // Catapult Siege Warfare
  if (attacker.type === 'catapult' && attackerDef.abilities.includes('SIEGE_WEAPON')) {
    // Must be setup (defending status) to attack
    if (attacker.status !== 'defending') {
      return {
        success: false,
        attackerDamage: 0,
        defenderDamage: 0,
        attackerHp: attacker.hp,
        defenderHp: defender.hp,
        attackerKilled: false,
        defenderKilled: false,
        specialEffects: [],
        message: "Catapult must be setup before attacking"
      };
    }

    // Extra damage to structures and cities
    if (defender.type === 'guard') { // Representing city defenders
      attackerAttack *= 2;
      specialEffects.push("Siege weapon vs fortification (double damage)");
    }
  }

  // Scout Stealth Advantage
  if (attacker.type === 'scout' && attackerDef.abilities.includes('STEALTH')) {
    if (attacker.status === 'defending') { // Stealth mode
      attackerAttack += 3;
      specialEffects.push("Stealth attack bonus (+3 attack)");
    }
  }

  // Commander Leadership Bonus
  if (attacker.type === 'commander' && attackerDef.abilities.includes('LEADERSHIP')) {
    attackerAttack += 2;
    specialEffects.push("Commander leadership (+2 attack)");
  }

  // Missionary Peaceful Nature (reduced combat effectiveness)
  if (attacker.type === 'missionary') {
    attackerAttack = Math.max(1, attackerAttack - 2);
    specialEffects.push("Missionary peaceful nature (-2 attack)");
  }

  // === DEFENSIVE BONUSES ===

  // Guard Defensive Stance
  if (defender.type === 'guard' && defenderDef.abilities.includes('FORTIFY')) {
    if (defender.status === 'defending') {
      defenderDefense += 4;
      specialEffects.push("Guard fortified defense (+4 defense)");
    }
  }

  // Terrain Defense Bonuses
  if (terrain) {
    const terrainBonus = GAME_RULES.terrain.defenseBonus[terrain] || 0;
    if (terrainBonus > 0) {
      defenderDefense += terrainBonus;
      specialEffects.push(`Terrain defense bonus (+${terrainBonus} from ${terrain})`);
    }
  }

  // === FACTION-SPECIFIC BONUSES ===
  const attackerPlayer = state.players.find(p => p.id === attacker.playerId);
  const defenderPlayer = state.players.find(p => p.id === defender.playerId);

  // Faith-based combat bonuses (tiered system)
  if (attackerPlayer) {
    const { lowThreshold, highThreshold, lowDefenseBonus, highAttackBonus, highDefenseBonus } = GAME_RULES.faithBonuses;
    const attackerFaith = attackerPlayer.stats.faith;

    if (attackerFaith >= highThreshold) {
      // High faith: +2 attack AND +1 defense
      attackerAttack += highAttackBonus;
      specialEffects.push(`High faith combat bonus (+${highAttackBonus} attack)`);
      // Note: defense bonus applies to attacker when defending in counterattack
    } else if (attackerFaith >= lowThreshold) {
      // Moderate faith: +1 defense only (applied to attack calculation as morale)
      specialEffects.push(`Moderate faith morale (+${lowDefenseBonus} defense)`);
    }
  }

  // Defender faith-based defense bonuses
  if (defenderPlayer) {
    const { lowThreshold, highThreshold, lowDefenseBonus, highDefenseBonus } = GAME_RULES.faithBonuses;
    const defenderFaith = defenderPlayer.stats.faith;

    if (defenderFaith >= highThreshold) {
      defenderDefense += highDefenseBonus;
      specialEffects.push(`Defender high faith (+${highDefenseBonus} defense)`);
    } else if (defenderFaith >= lowThreshold) {
      defenderDefense += lowDefenseBonus;
      specialEffects.push(`Defender faith bonus (+${lowDefenseBonus} defense)`);
    }
  }

  // Pride-based combat bonuses
  if (attackerPlayer && attackerPlayer.stats.pride >= 70) {
    attackerAttack += 1;
    specialEffects.push("High pride combat bonus (+1 attack)");
  }

  // Calculate final damage
  const attackerDamage = Math.max(1, attackerAttack - defenderDefense);
  const defenderDamage = Math.max(1, defender.attack - attacker.defense);

  // Apply damage
  const newDefenderHp = Math.max(0, defender.hp - attackerDamage);
  const newAttackerHp = Math.max(0, attacker.hp - defenderDamage);

  const defenderKilled = newDefenderHp <= 0;
  const attackerKilled = newAttackerHp <= 0;

  // Generate combat message
  let message = `${attacker.type} attacks ${defender.type}`;
  if (defenderKilled) {
    message += ` and destroys it!`;
  } else if (attackerKilled) {
    message += ` but is destroyed in the counterattack!`;
  } else {
    message += ` (${attackerDamage} damage dealt, ${defenderDamage} received)`;
  }

  return {
    success: true,
    attackerDamage,
    defenderDamage,
    attackerHp: newAttackerHp,
    defenderHp: newDefenderHp,
    attackerKilled,
    defenderKilled,
    specialEffects,
    message
  };
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
