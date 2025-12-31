import { GameState } from "../types/game";
import { Unit } from "../types/unit";
import { hexDistance } from "../utils/hex";
import { GAME_RULES } from "../data/gameRules";
import { getActiveModifiers } from "../data/modifiers";

export type CombatBlockReason =
  | "invalid_units"
  | "friendly_fire"
  | "already_attacked"
  | "out_of_range"
  | "stealthed_target"
  | "catapult_not_deployed"
  | "catapult_moved_this_turn"
  | "diplomacy_avoided";

export interface CombatResolution {
  success: boolean;
  canAttack: boolean;
  reason?: string;
  reasonCode?: CombatBlockReason;
  attackerDamage: number;
  defenderDamage: number;
  attackerHp: number;
  defenderHp: number;
  attackerKilled: boolean;
  defenderKilled: boolean;
  specialEffects: string[];
  modifiers: {
    attacker: string[];
    defender: string[];
  };
  message: string;
}

const ANTI_CAVALRY_BONUS = 3;
const LEADERSHIP_BONUS = 1;
const FORTIFY_DEFENSE_BONUS = 4;

const normalizeAbility = (abilityId: string) => abilityId.toUpperCase();
const getAbilitySet = (unit: Unit) =>
  new Set((unit.abilities || []).map(ability => normalizeAbility(String(ability))));

const hasAbility = (abilities: Set<string>, abilityId: string) =>
  abilities.has(normalizeAbility(abilityId));

const isFastUnit = (unit: Unit) => unit.movement >= 4 || unit.type === "scout";

const hasAdjacentLeader = (unit: Unit, state: GameState) =>
  state.units.some(other =>
    other.playerId === unit.playerId &&
    other.id !== unit.id &&
    hasAbility(getAbilitySet(other), "LEADERSHIP") &&
    hexDistance(other.coordinate, unit.coordinate) <= 1
  );

export function resolveCombat(
  attacker: Unit,
  defender: Unit,
  state: GameState,
  options?: { terrainOverride?: string }
): CombatResolution {
  if (!attacker || !defender) {
    return {
      success: false,
      canAttack: false,
      reason: "Invalid units",
      reasonCode: "invalid_units",
      attackerDamage: 0,
      defenderDamage: 0,
      attackerHp: attacker?.hp ?? 0,
      defenderHp: defender?.hp ?? 0,
      attackerKilled: false,
      defenderKilled: false,
      specialEffects: [],
      modifiers: { attacker: [], defender: [] },
      message: "Combat failed: invalid units"
    };
  }

  if (attacker.playerId === defender.playerId) {
    return {
      success: false,
      canAttack: false,
      reason: "Cannot attack friendly units",
      reasonCode: "friendly_fire",
      attackerDamage: 0,
      defenderDamage: 0,
      attackerHp: attacker.hp,
      defenderHp: defender.hp,
      attackerKilled: false,
      defenderKilled: false,
      specialEffects: [],
      modifiers: { attacker: [], defender: [] },
      message: "Combat blocked: friendly fire"
    };
  }

  if (attacker.hasAttacked) {
    return {
      success: false,
      canAttack: false,
      reason: "Unit has already attacked this turn",
      reasonCode: "already_attacked",
      attackerDamage: 0,
      defenderDamage: 0,
      attackerHp: attacker.hp,
      defenderHp: defender.hp,
      attackerKilled: false,
      defenderKilled: false,
      specialEffects: [],
      modifiers: { attacker: [], defender: [] },
      message: "Combat blocked: already attacked"
    };
  }

  const distance = hexDistance(attacker.coordinate, defender.coordinate);
  if (distance > attacker.attackRange) {
    return {
      success: false,
      canAttack: false,
      reason: "Target out of range",
      reasonCode: "out_of_range",
      attackerDamage: 0,
      defenderDamage: 0,
      attackerHp: attacker.hp,
      defenderHp: defender.hp,
      attackerKilled: false,
      defenderKilled: false,
      specialEffects: [],
      modifiers: { attacker: [], defender: [] },
      message: "Combat blocked: out of range"
    };
  }

  if (defender.status === "stealthed" && distance > 1) {
    return {
      success: false,
      canAttack: false,
      reason: "Target is hidden (stealth)",
      reasonCode: "stealthed_target",
      attackerDamage: 0,
      defenderDamage: 0,
      attackerHp: attacker.hp,
      defenderHp: defender.hp,
      attackerKilled: false,
      defenderKilled: false,
      specialEffects: [],
      modifiers: { attacker: [], defender: [] },
      message: "Combat blocked: target hidden"
    };
  }

  const attackerAbilities = getAbilitySet(attacker);
  const defenderAbilities = getAbilitySet(defender);

  const attackerHasBombardment =
    hasAbility(attackerAbilities, "SIEGE") ||
    hasAbility(attackerAbilities, "BOMBARDMENT");

  if (attackerHasBombardment && distance > 1 && attacker.status !== "siege_mode") {
    return {
      success: false,
      canAttack: false,
      reason: "Artillery must deploy (Siege Mode) to fire at range",
      reasonCode: "catapult_not_deployed",
      attackerDamage: 0,
      defenderDamage: 0,
      attackerHp: attacker.hp,
      defenderHp: defender.hp,
      attackerKilled: false,
      defenderKilled: false,
      specialEffects: [],
      modifiers: { attacker: [], defender: [] },
      message: "Combat blocked: catapult not deployed"
    };
  }

  if (attackerHasBombardment && distance > 1 && attacker.remainingMovement !== attacker.movement) {
    return {
      success: false,
      canAttack: false,
      reason: "Artillery must be stationary to fire at range",
      reasonCode: "catapult_moved_this_turn",
      attackerDamage: 0,
      defenderDamage: 0,
      attackerHp: attacker.hp,
      defenderHp: defender.hp,
      attackerKilled: false,
      defenderKilled: false,
      specialEffects: [],
      modifiers: { attacker: [], defender: [] },
      message: "Combat blocked: catapult moved this turn"
    };
  }

  const attackerPlayer = state.players.find(p => p.id === attacker.playerId);
  const defenderPlayer = state.players.find(p => p.id === defender.playerId);
  if (hasAbility(defenderAbilities, "DIPLOMACY") && (defenderPlayer?.stats.faith ?? 0) >= 80) {
    return {
      success: false,
      canAttack: false,
      reason: "Diplomacy prevents combat (high enemy faith)",
      reasonCode: "diplomacy_avoided",
      attackerDamage: 0,
      defenderDamage: 0,
      attackerHp: attacker.hp,
      defenderHp: defender.hp,
      attackerKilled: false,
      defenderKilled: false,
      specialEffects: [],
      modifiers: { attacker: [], defender: [] },
      message: "Combat avoided: diplomacy"
    };
  }

  const attackerModifiers: string[] = [];
  const defenderModifiers: string[] = [];
  const specialEffects: string[] = [];

  let attackerAttack = attacker.attack;
  let attackerDefense = attacker.defense;
  let defenderAttack = defender.attack;
  let defenderDefense = defender.defense;

  // Testimony pressure: temporary attack penalty (applied via statusEffects).
  const testimonyPressurePenalty = (() => {
    const effects = Array.isArray((attacker as any).statusEffects) ? (attacker as any).statusEffects : [];
    const pressure = effects.find((e: any) => e?.type === "TESTIMONY_PRESSURE");
    return typeof pressure?.attackPenalty === "number" ? pressure.attackPenalty : 0;
  })();
  if (testimonyPressurePenalty > 0) {
    attackerAttack = Math.max(0, attackerAttack - testimonyPressurePenalty);
    attackerModifiers.push(`-${testimonyPressurePenalty} Attack (Testimony Pressure)`);
  }

  // Status effects (rally/siege/formation).
  if (attacker.status === "rallied") {
    attackerAttack += 2;
    attackerModifiers.push("+2 Attack (Rallied)");
  }
  if (attacker.status === "siege_mode") {
    attackerAttack += 3;
    attackerModifiers.push("+3 Attack (Siege Mode)");
  }
  if (defender.status === "formation") {
    defenderDefense += 2;
    defenderModifiers.push("+2 Defense (Formation)");
  }

  // Anti-cavalry bonus (spearmen vs fast units).
  if (hasAbility(attackerAbilities, "ANTI_CAVALRY") && isFastUnit(defender)) {
    attackerAttack += ANTI_CAVALRY_BONUS;
    attackerModifiers.push(`+${ANTI_CAVALRY_BONUS} Attack (Anti-Cavalry)`);
    specialEffects.push("Anti-cavalry bonus");
  }

  // Leadership aura (adjacent commander grants +1 attack/defense).
  if (hasAdjacentLeader(attacker, state)) {
    attackerAttack += LEADERSHIP_BONUS;
    attackerDefense += LEADERSHIP_BONUS;
    attackerModifiers.push(`+${LEADERSHIP_BONUS} Attack (Leadership)`);
    attackerModifiers.push(`+${LEADERSHIP_BONUS} Defense (Leadership)`);
    specialEffects.push("Leadership bonus");
  }
  if (hasAdjacentLeader(defender, state)) {
    defenderAttack += LEADERSHIP_BONUS;
    defenderDefense += LEADERSHIP_BONUS;
    defenderModifiers.push(`+${LEADERSHIP_BONUS} Attack (Leadership)`);
    defenderModifiers.push(`+${LEADERSHIP_BONUS} Defense (Leadership)`);
    specialEffects.push("Leadership bonus");
  }

  // Fortify stance
  if (hasAbility(defenderAbilities, "FORTIFY") && (defender.status === "defending" || defender.status === "fortified")) {
    defenderDefense += FORTIFY_DEFENSE_BONUS;
    defenderModifiers.push(`+${FORTIFY_DEFENSE_BONUS} Defense (Fortify)`);
    specialEffects.push("Fortify defense");
  }

  // Player modifiers
  if (attackerPlayer) {
    const attackModifiers = getActiveModifiers(attackerPlayer, "on_attack");
    for (const modifier of attackModifiers) {
      for (const effect of modifier.effect) {
        if (effect.stat === "attack" && effect.target === "self") {
          attackerAttack += effect.value;
          attackerModifiers.push(`${effect.value >= 0 ? "+" : ""}${effect.value} Attack (${modifier.name})`);
        }
      }
    }
  }
  if (defenderPlayer) {
    const defenseModifiers = getActiveModifiers(defenderPlayer, "on_defend");
    for (const modifier of defenseModifiers) {
      for (const effect of modifier.effect) {
        if (effect.stat === "defense" && effect.target === "self") {
          defenderDefense += effect.value;
          defenderModifiers.push(`${effect.value >= 0 ? "+" : ""}${effect.value} Defense (${modifier.name})`);
        }
      }
    }
  }

  // Faith synergy combat bonuses (tiered)
  const faithCfg = GAME_RULES.faithBonuses;
  if (attackerPlayer && attackerPlayer.stats.faith >= faithCfg.highThreshold) {
    attackerAttack += faithCfg.highAttackBonus;
    attackerModifiers.push(`+${faithCfg.highAttackBonus} Attack (High Faith)`);
  }
  if (defenderPlayer) {
    const defenderFaith = defenderPlayer.stats.faith;
    if (defenderFaith >= faithCfg.highThreshold) {
      defenderDefense += faithCfg.highDefenseBonus;
      defenderModifiers.push(`+${faithCfg.highDefenseBonus} Defense (High Faith)`);
    } else if (defenderFaith >= faithCfg.lowThreshold) {
      defenderDefense += faithCfg.lowDefenseBonus;
      defenderModifiers.push(`+${faithCfg.lowDefenseBonus} Defense (Faith)`);
    }
  }

  // Terrain defense bonus
  const terrain = options?.terrainOverride ??
    state.map.tiles.find(tile =>
      tile.coordinate.q === defender.coordinate.q &&
      tile.coordinate.r === defender.coordinate.r
    )?.terrain;
  if (terrain) {
    const terrainBonus = GAME_RULES.terrain.defenseBonus[terrain] || 0;
    if (terrainBonus > 0) {
      defenderDefense += terrainBonus;
      defenderModifiers.push(`+${terrainBonus} Defense (Terrain)`);
      specialEffects.push("Terrain defense bonus");
    }
  }

  // Calculate final damage
  let attackerDamage = Math.max(1, attackerAttack - defenderDefense);

  // Protective aura: allied guardian adjacent to defender reduces incoming damage.
  const hasProtectiveAura = state.units.some(u =>
    u.playerId === defender.playerId &&
    u.id !== defender.id &&
    hasAbility(getAbilitySet(u), "PROTECTIVE_AURA") &&
    hexDistance(u.coordinate, defender.coordinate) <= 1
  );
  if (hasProtectiveAura) {
    attackerDamage = Math.max(1, attackerDamage - 1);
    defenderModifiers.push("-1 Damage Taken (Protective Aura)");
  }

  const defenderHpAfter = Math.max(0, defender.hp - attackerDamage);
  const defenderCanCounter =
    defenderHpAfter > 0 &&
    distance <= defender.attackRange &&
    defenderAttack > 0;
  const defenderDamage = defenderCanCounter
    ? Math.max(1, defenderAttack - attackerDefense)
    : 0;
  const attackerHpAfter = Math.max(0, attacker.hp - defenderDamage);

  const defenderKilled = defenderHpAfter <= 0;
  const attackerKilled = attackerHpAfter <= 0;

  let message = `${attacker.type} attacks ${defender.type}`;
  if (defenderKilled) {
    message += " and destroys it!";
  } else if (attackerKilled) {
    message += " but is destroyed in the counterattack!";
  } else {
    message += ` (${attackerDamage} damage dealt, ${defenderDamage} received)`;
  }

  return {
    success: true,
    canAttack: true,
    attackerDamage,
    defenderDamage,
    attackerHp: attackerHpAfter,
    defenderHp: defenderHpAfter,
    attackerKilled,
    defenderKilled,
    specialEffects,
    modifiers: {
      attacker: attackerModifiers,
      defender: defenderModifiers
    },
    message
  };
}
