import { GameState } from "../types/game";
import { Unit } from "../types/unit";
import { GAME_RULES } from "../data/gameRules";
import { getActiveModifiers } from "../data/modifiers";
import { hexDistance } from "../utils/hex";

export interface ComputeStatsContext {
  role: "attacker" | "defender";
  opponent?: Unit;
  distance?: number;
  terrain?: string;
}

export interface ComputeStatsResult {
  attack: number;
  defense: number;
  modifiers: string[];
  specialEffects: string[];
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

export function onComputeStats(
  unit: Unit,
  state: GameState,
  ctx: ComputeStatsContext
): ComputeStatsResult {
  const abilities = getAbilitySet(unit);
  const opponent = ctx.opponent;
  const distance = ctx.distance ?? (opponent ? hexDistance(unit.coordinate, opponent.coordinate) : 0);
  const terrain = ctx.terrain;

  const modifiers: string[] = [];
  const specialEffects: string[] = [];

  let attack = unit.attack;
  let defense = unit.defense;
  const baseDefense = unit.defense;

  const statusEffects = Array.isArray((unit as any).statusEffects) ? (unit as any).statusEffects : [];
  const isRallied = unit.status === "rallied" || statusEffects.some((e: any) => e?.type === "RALLIED");

  if (ctx.role === "attacker") {
    const pressure = statusEffects.find((e: any) => e?.type === "TESTIMONY_PRESSURE");
    const testimonyPenalty = typeof pressure?.attackPenalty === "number" ? pressure.attackPenalty : 0;
    if (testimonyPenalty > 0) {
      attack = Math.max(0, attack - testimonyPenalty);
      modifiers.push(`-${testimonyPenalty} Attack (Testimony Pressure)`);
    }

    if (isRallied) {
      attack += 2;
      modifiers.push("+2 Attack (Rallied)");
    }
  }

  if (unit.status === "siege_mode") {
    attack += 3;
    modifiers.push("+3 Attack (Siege Mode)");
  }

  if (ctx.role === "attacker" && terrain === "forest" && distance > 1 && hasAbility(abilities, "AMBUSH")) {
    attack += 2;
    modifiers.push("+2 Attack (Forest Ambush)");
    specialEffects.push("Forest ambush");
  }

  if (ctx.role === "defender" && unit.status === "formation") {
    let formationBonus = 2;
    const hasShieldWall = state.units.some(u =>
      u.playerId === unit.playerId &&
      u.id !== unit.id &&
      u.status === "formation" &&
      hexDistance(u.coordinate, unit.coordinate) === 1
    );
    if (hasShieldWall) {
      formationBonus += 1;
      specialEffects.push("Shield Wall Synergy");
      modifiers.push("Shield Wall");
    }
    formationBonus = Math.min(3, formationBonus);
    defense += formationBonus;
    modifiers.push(`+${formationBonus} Defense (Formation)`);
  }

  if (ctx.role === "defender" && hasAbility(abilities, "FAITHFUL_DEFENSE")) {
    const defenderPlayer = state.players.find(p => p.id === unit.playerId);
    const defenderFaith = defenderPlayer?.stats.faith ?? 0;
    const defendingCity = state.cities.find(
      c => c.coordinate.q === unit.coordinate.q && c.coordinate.r === unit.coordinate.r
    );
    const didNotMove = unit.remainingMovement === unit.movement;
    const isDefensivePosture =
      defendingCity !== undefined ||
      unit.status === "formation" ||
      unit.status === "fortified" ||
      didNotMove;

    if (isDefensivePosture) {
      const faithBonus = defenderFaith >= 95 ? 2 : defenderFaith >= 80 ? 1 : 0;
      if (faithBonus > 0) {
        defense += faithBonus;
        modifiers.push(`+${faithBonus} Defense (Faithful Defense)`);
        specialEffects.push("Faithful defense");
      }
    }
  }

  const intimidated = statusEffects.some((e: any) => e?.type === "INTIMIDATED");
  if (intimidated && !hasAbility(abilities, "YOUNG_VIGOR")) {
    attack = Math.max(0, attack - 1);
    modifiers.push("-1 Attack (Intimidated)");
  }

  if (ctx.role === "attacker" && opponent && hasAbility(abilities, "ANTI_CAVALRY") && isFastUnit(opponent)) {
    attack += ANTI_CAVALRY_BONUS;
    modifiers.push(`+${ANTI_CAVALRY_BONUS} Attack (Anti-Cavalry)`);
    specialEffects.push("Anti-cavalry bonus");
  }

  if (hasAdjacentLeader(unit, state)) {
    attack += LEADERSHIP_BONUS;
    defense += LEADERSHIP_BONUS;
    modifiers.push(`+${LEADERSHIP_BONUS} Attack (Leadership)`);
    modifiers.push(`+${LEADERSHIP_BONUS} Defense (Leadership)`);
    specialEffects.push("Leadership bonus");
  }

  if (ctx.role === "defender" && hasAbility(abilities, "FORTIFY") && (unit.status === "defending" || unit.status === "fortified")) {
    defense += FORTIFY_DEFENSE_BONUS;
    modifiers.push(`+${FORTIFY_DEFENSE_BONUS} Defense (Fortify)`);
    specialEffects.push("Fortify defense");
  }

  const player = state.players.find(p => p.id === unit.playerId);
  if (player) {
    if (ctx.role === "attacker") {
      const attackModifiers = getActiveModifiers(player, "on_attack");
      for (const modifier of attackModifiers) {
        for (const effect of modifier.effect) {
          if (effect.stat === "attack" && effect.target === "self") {
            attack += effect.value;
            modifiers.push(`${effect.value >= 0 ? "+" : ""}${effect.value} Attack (${modifier.name})`);
          }
        }
      }
    }
    if (ctx.role === "defender") {
      const defenseModifiers = getActiveModifiers(player, "on_defend");
      for (const modifier of defenseModifiers) {
        for (const effect of modifier.effect) {
          if (effect.stat === "defense" && effect.target === "self") {
            defense += effect.value;
            modifiers.push(`${effect.value >= 0 ? "+" : ""}${effect.value} Defense (${modifier.name})`);
          }
        }
      }
    }

    const faithCfg = GAME_RULES.faithBonuses;
    if (ctx.role === "attacker" && player.stats.faith >= faithCfg.highThreshold) {
      attack += faithCfg.highAttackBonus;
      modifiers.push(`+${faithCfg.highAttackBonus} Attack (High Faith)`);
    }
    if (ctx.role === "defender") {
      const defenderFaith = player.stats.faith;
      if (defenderFaith >= faithCfg.highThreshold) {
        defense += faithCfg.highDefenseBonus;
        modifiers.push(`+${faithCfg.highDefenseBonus} Defense (High Faith)`);
      } else if (defenderFaith >= faithCfg.lowThreshold) {
        defense += faithCfg.lowDefenseBonus;
        modifiers.push(`+${faithCfg.lowDefenseBonus} Defense (Faith)`);
      }
    }
  }

  if (ctx.role === "defender" && terrain) {
    const terrainBonus = GAME_RULES.terrain.defenseBonus[terrain] || 0;
    if (terrainBonus > 0) {
      defense += terrainBonus;
      modifiers.push(`+${terrainBonus} Defense (Terrain)`);
      specialEffects.push("Terrain defense bonus");
    }
  }

  if (ctx.role === "defender") {
    const defendingCity = state.cities.find(
      c => c.coordinate.q === unit.coordinate.q && c.coordinate.r === unit.coordinate.r
    );
    if (defendingCity) {
      const structureDefenseBonus = (state.structures || [])
        .filter(structure => structure.cityId === defendingCity.id && (structure.constructionTurns ?? 0) <= 0)
        .reduce((sum, structure) => sum + (structure.effects?.defenseBonus ?? 0), 0);
      if (structureDefenseBonus > 0) {
        defense += structureDefenseBonus;
        modifiers.push(`+${structureDefenseBonus} Defense (City Structures)`);
        specialEffects.push("City structure defense bonus");
      }
    }

    const totalBonus = defense - baseDefense;
    if (totalBonus > 4) {
      defense = baseDefense + 4;
      modifiers.push(`(Defense bonus capped at +4)`);
    }
  }

  return { attack, defense, modifiers, specialEffects };
}

export function onBeforeAttack(_attacker: Unit, _defender: Unit, _state: GameState): void {
  // Hook placeholder for future effects.
}

export function onAfterAttack(_attacker: Unit, _defender: Unit, _state: GameState): void {
  // Hook placeholder for future effects.
}

export function onTurnStartUnit(unit: Unit, _state: GameState): Unit {
  const abilities = getAbilitySet(unit);
  if (abilities.has('YOUNG_VIGOR')) {
    const existing = Array.isArray((unit as any).statusEffects) ? (unit as any).statusEffects : [];
    const filtered = existing.filter((e: any) => e?.type !== 'INTIMIDATED' && e?.type !== 'TESTIMONY_PRESSURE');
    return { ...unit, statusEffects: filtered } as Unit;
  }
  return unit;
}

export function onAction(_unit: Unit, _actionType: string, _state: GameState): Unit {
  return _unit;
}
