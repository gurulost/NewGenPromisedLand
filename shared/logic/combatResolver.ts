import { GameState } from "../types/game";
import { Unit } from "../types/unit";
import { hexDistance } from "../utils/hex";
import { GAME_RULES } from "../data/gameRules";
import { getEffectiveAttackRange, getUnitActionsRemaining, isUnitVisibleToPlayer } from "./unitLogic";
import { computeEffectiveStats } from "./computeEffectiveStats";
import { onAfterAttack, onBeforeAttack } from "./effects";

export type CombatBlockReason =
  | "invalid_units"
  | "friendly_fire"
  | "already_attacked"
  | "out_of_range"
  | "stealthed_target"
  | "target_not_visible"
  | "not_hostile"
  | "catapult_min_range"
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

const normalizeAbility = (abilityId: string) => abilityId.toUpperCase();
const getAbilitySet = (unit: Unit) =>
  new Set((unit.abilities || []).map(ability => normalizeAbility(String(ability))));

const hasAbility = (abilities: Set<string>, abilityId: string) =>
  abilities.has(normalizeAbility(abilityId));

export function arePlayersHostile(
  state: GameState,
  attackerPlayerId: string,
  defenderPlayerId: string
): boolean {
  if (attackerPlayerId === defenderPlayerId) return false;

  const attackerPlayer = state.players.find(p => p.id === attackerPlayerId);
  const defenderPlayer = state.players.find(p => p.id === defenderPlayerId);
  if (!attackerPlayer || !defenderPlayer) return false;

  return Boolean(
    attackerPlayer.atWarWith?.includes(defenderPlayerId) ||
    defenderPlayer.atWarWith?.includes(attackerPlayerId)
  );
}

/**
 * Check if an attack is "ranged" - distance > 1 AND within attack range
 */
export const isRangedAttack = (unit: Unit, targetDistance: number): boolean => {
  if (targetDistance <= 1) return false;
  const effectiveRange = getEffectiveAttackRange(unit);
  return effectiveRange >= targetDistance;
};

const isDefenderProtectedByFortress = (defender: Unit, state: GameState) => {
  const city = state.cities.find(
    c => c.coordinate.q === defender.coordinate.q && c.coordinate.r === defender.coordinate.r
  );
  if (!city) return false;

  return state.structures.some(
    structure =>
      structure.cityId === city.id &&
      structure.type === "fortress" &&
      (structure.constructionTurns ?? 0) <= 0
  );
};

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

  if (!arePlayersHostile(state, attacker.playerId, defender.playerId)) {
    return {
      success: false,
      canAttack: false,
      reason: "Cannot attack non-hostile units",
      reasonCode: "not_hostile",
      attackerDamage: 0,
      defenderDamage: 0,
      attackerHp: attacker.hp,
      defenderHp: defender.hp,
      attackerKilled: false,
      defenderKilled: false,
      specialEffects: [],
      modifiers: { attacker: [], defender: [] },
      message: "Combat blocked: diplomacy"
    };
  }

  if (getUnitActionsRemaining(attacker) <= 0) {
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
  const getTerrainAt = (coordinate: { q: number; r: number }) =>
    state.map.tiles.find(
      tile => tile.coordinate.q === coordinate.q && tile.coordinate.r === coordinate.r
    )?.terrain;
  const attackerTerrain = getTerrainAt(attacker.coordinate);
  const defenderTerrain = options?.terrainOverride ?? getTerrainAt(defender.coordinate);
  const attackerRange = getEffectiveAttackRange(attacker);
  if (distance > attackerRange) {
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

  const attackerAbilities = getAbilitySet(attacker);
  const defenderAbilities = getAbilitySet(defender);

  const attackerHasBombardment =
    hasAbility(attackerAbilities, "SIEGE") ||
    hasAbility(attackerAbilities, "BOMBARDMENT");
  const defenderHasBombardment =
    hasAbility(defenderAbilities, "SIEGE") ||
    hasAbility(defenderAbilities, "BOMBARDMENT");

  if (attackerHasBombardment && distance <= 1) {
    return {
      success: false,
      canAttack: false,
      reason: "Artillery cannot fire at adjacent targets",
      reasonCode: "catapult_min_range",
      attackerDamage: 0,
      defenderDamage: 0,
      attackerHp: attacker.hp,
      defenderHp: defender.hp,
      attackerKilled: false,
      defenderKilled: false,
      specialEffects: [],
      modifiers: { attacker: [], defender: [] },
      message: "Combat blocked: catapult minimum range"
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

  if (!isUnitVisibleToPlayer(defender, attacker.playerId, state)) {
    return {
      success: false,
      canAttack: false,
      reason: "Target not visible",
      reasonCode: "target_not_visible",
      attackerDamage: 0,
      defenderDamage: 0,
      attackerHp: attacker.hp,
      defenderHp: defender.hp,
      attackerKilled: false,
      defenderKilled: false,
      specialEffects: [],
      modifiers: { attacker: [], defender: [] },
      message: "Combat blocked: target not visible"
    };
  }

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

  onBeforeAttack(attacker, defender, state);

  const attackerStats = computeEffectiveStats(attacker, state, {
    role: "attacker",
    opponent: defender,
    distance,
    terrain: attackerTerrain
  });
  const defenderStats = computeEffectiveStats(defender, state, {
    role: "defender",
    opponent: attacker,
    distance,
    terrain: defenderTerrain
  });

  const attackerModifiers = attackerStats.modifiers;
  const defenderModifiers = defenderStats.modifiers;
  const specialEffects = Array.from(new Set([
    ...attackerStats.specialEffects,
    ...defenderStats.specialEffects
  ]));

  const attackerAttack = attackerStats.attack;
  const attackerDefense = attackerStats.defense;
  const defenderAttack = defenderStats.attack;
  const defenderDefense = defenderStats.defense;

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

  const isRanged = isRangedAttack(attacker, distance);
  if (isRanged && defenderTerrain === "forest") {
    attackerDamage = Math.max(1, attackerDamage - 1);
    defenderModifiers.push("-1 Ranged Damage (Forest Cover)");
    specialEffects.push("Forest cover");
  }
  if (isRanged && isDefenderProtectedByFortress(defender, state)) {
    const fortificationReduction = GAME_RULES.combat.fortificationBonus;
    if (fortificationReduction > 0) {
      attackerDamage = Math.max(1, attackerDamage - fortificationReduction);
      defenderModifiers.push(`-${fortificationReduction} Ranged Damage (Fortress)`);
      specialEffects.push("Fortification ranged reduction");
    }
  }

  const defenderHpAfter = Math.max(0, defender.hp - attackerDamage);
  const defenderRange = defenderStats.range;
  const defenderCanCounter =
    defenderHpAfter > 0 &&
    distance <= defenderRange &&
    defenderAttack > 0 &&
    (!defenderHasBombardment ||
      (distance > 1 && defender.status === "siege_mode" && defender.remainingMovement === defender.movement));
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

  onAfterAttack(attacker, defender, state);

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
