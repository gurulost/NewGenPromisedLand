import type { ImprovementDefinition, StructureDefinition } from "../types/city";
import type { UnitDefinition } from "../types/unit";
import { ABILITIES } from "./abilities";
import { GAME_RULES } from "./gameRules";

export type EffectIconKey =
  | "attack"
  | "defense"
  | "health"
  | "movement"
  | "vision"
  | "range"
  | "actions"
  | "stars"
  | "faith"
  | "pride"
  | "dissent"
  | "population"
  | "unitProduction"
  | "defenseBonus"
  | "road"
  | "naval"
  | "ability"
  | "cooldown"
  | "special";

export interface EffectDescriptor {
  id: string;
  label: string;
  value?: string;
  iconKey: EffectIconKey;
}

const formatSigned = (value: number, suffix = ""): string =>
  `${value >= 0 ? "+" : ""}${value}${suffix}`;

const formatAbilityName = (abilityId: string): string =>
  String(abilityId)
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const normalizeAbility = (abilityId: string): string =>
  String(abilityId).replace(/[^a-zA-Z0-9_]/g, "_").toUpperCase();

const resolveAbility = (abilityId: string) => {
  const normalized = normalizeAbility(abilityId);
  const match = Object.keys(ABILITIES).find((key) => key.toUpperCase() === normalized);
  return match ? ABILITIES[match] : undefined;
};

const formatCondition = (stat: string, gte?: number, lte?: number): string => {
  const statLabel = stat === "internalDissent" ? "Dissent" : formatAbilityName(stat);
  const parts: string[] = [];
  if (typeof gte === "number") parts.push(`${statLabel} >= ${gte}`);
  if (typeof lte === "number") parts.push(`${statLabel} <= ${lte}`);
  return parts.join(" and ");
};

const getAbilityDescriptor = (abilityId: string): EffectDescriptor => {
  const normalized = normalizeAbility(abilityId);
  const abilityDef = resolveAbility(abilityId);
  const name = abilityDef?.name ?? formatAbilityName(abilityId);

  const overrides: Record<string, () => EffectDescriptor> = {
    BUILD: () => ({
      id: `ability_${normalized}`,
      label: name,
      value: "Can construct improvements and structures.",
      iconKey: "ability",
    }),
    HARVEST: () => ({
      id: `ability_${normalized}`,
      label: name,
      value: "Harvest world elements for population (resource bonuses vary).",
      iconKey: "ability",
    }),
    CLEAR_FOREST: () => ({
      id: `ability_CLEAR_FOREST`,
      label: "Clear Forest",
      value: "Clear adjacent forest to gain +2 Stars, +1 Pride, +1 Dissent (requires Forestry).",
      iconKey: "special",
    }),
    BUILD_ROAD: () => ({
      id: `ability_${normalized}`,
      label: name,
      value: "Build roads on adjacent land tiles for 3 stars (requires Organization).",
      iconKey: "road",
    }),
    STEALTH: () => ({
      id: `ability_${normalized}`,
      label: name,
      value: "Spend an action to become stealthed; enemies must be adjacent to see or attack.",
      iconKey: "vision",
    }),
    RECONNAISSANCE: () => ({
      id: `ability_${normalized}`,
      label: name,
      value: `Reveal tiles within ${GAME_RULES.abilities.visionRevealRadius} tiles (spend 1 action).`,
      iconKey: "vision",
    }),
    FORMATION_FIGHTING: () => ({
      id: `ability_${normalized}`,
      label: name,
      value: "Enter formation to gain +2 defense while in formation.",
      iconKey: "defense",
    }),
    ANTI_CAVALRY: () => ({
      id: `ability_${normalized}`,
      label: name,
      value: "Gain +3 attack versus fast units (movement >= 4).",
      iconKey: "attack",
    }),
    RALLY_TROOPS: () => ({
      id: `ability_RALLY_TROOPS`,
      label: "Rally Troops",
      value: "Rally allies within 2 tiles, granting +2 attack until next turn. Gains +1 Pride.",
      iconKey: "ability",
    }),
    RALLY: () => ({
      id: `ability_RALLY`,
      label: "Rally",
      value: "Rally allies within 2 tiles, granting +2 attack until next turn. Gains +1 Pride.",
      iconKey: "ability",
    }),
    LEADERSHIP: () => ({
      id: `ability_${normalized}`,
      label: name,
      value: "Adjacent allies gain +1 attack and defense.",
      iconKey: "ability",
    }),
    NAVAL_TRANSPORT: () => ({
      id: `ability_${normalized}`,
      label: name,
      value: "Move on water and transport up to 2 land units.",
      iconKey: "naval",
    }),
    COASTAL_EXPLORATION: () => ({
      id: `ability_COASTAL_EXPLORATION`,
      label: "Coastal Exploration",
      value: "Reveal tiles within radius 2 (or 3 with Navigation tech). Earn up to 2 Stars for new discoveries.",
      iconKey: "naval",
    }),
    NAVAL_COMMAND: () => ({
      id: `ability_${normalized}`,
      label: name,
      value: "Counts as a Naval Commander for sea-beast actions.",
      iconKey: "naval",
    }),
    SIEGE: () => ({
      id: `ability_${normalized}`,
      label: name,
      value: "Artillery: must enter Siege Mode to fire at range; cannot attack adjacent targets (+3 attack in Siege Mode).",
      iconKey: "attack",
    }),
    HEAL: () => ({
      id: `ability_HEAL`,
      label: "Heal",
      value: `Spend 5 Faith to heal allies within 2 tiles for +3 HP and cleanse morale debuffs.`,
      iconKey: "faith",
    }),
    CONVERT: () => ({
      id: `ability_${normalized}`,
      label: name,
      value: `Spend ${GAME_RULES.conversion.costs.unit} Faith to attempt conversion within ${GAME_RULES.abilities.conversionRadius} tiles.`,
      iconKey: "faith",
    }),
    DIPLOMACY: () => ({
      id: `ability_${normalized}`,
      label: name,
      value: "High-faith units can avoid combat (faith >= 80).",
      iconKey: "ability",
    }),
    AMBUSH: () => ({
      id: `ability_${normalized}`,
      label: name,
      value: "Ranged attacks from forest gain +2 attack.",
      iconKey: "attack",
    }),
    RANGED_ATTACK: () => ({
      id: `ability_${normalized}`,
      label: name,
      value: "Ranged unit (see range stat).",
      iconKey: "range",
    }),
    PROTECTIVE_AURA: () => ({
      id: `ability_${normalized}`,
      label: name,
      value: "Adjacent allies take 1 less damage.",
      iconKey: "defense",
    }),
    FORTIFY: () => ({
      id: `ability_${normalized}`,
      label: name,
      value: "While defending or fortified, gain +4 defense.",
      iconKey: "defense",
    }),
  };

  if (overrides[normalized]) {
    return overrides[normalized]();
  }

  if (abilityDef?.description) {
    return {
      id: `ability_${normalized}`,
      label: name,
      value: abilityDef.description,
      iconKey: "ability",
    };
  }

  return {
    id: `ability_${normalized}`,
    label: name,
    value: "Special ability (details pending).",
    iconKey: "ability",
  };
};

const pushIfPositive = (
  effects: EffectDescriptor[],
  id: string,
  label: string,
  value: number | undefined,
  iconKey: EffectIconKey,
  suffix = ""
) => {
  if (!value) return;
  effects.push({ id, label, value: formatSigned(value, suffix), iconKey });
};

const isCulturalStructure = (structureId: string) =>
  GAME_RULES.victory.cultural.structureTypes.includes(structureId);

const isCulturalImprovement = (improvementId: string) =>
  GAME_RULES.victory.cultural.improvementTypes.includes(improvementId);

export const getUnitEffectSummary = (unitDef: UnitDefinition): EffectDescriptor[] => {
  const effects: EffectDescriptor[] = [];
  const stats = unitDef.baseStats;

  effects.push({ id: "attack", label: "Attack", value: String(stats.attack), iconKey: "attack" });
  effects.push({ id: "defense", label: "Defense", value: String(stats.defense), iconKey: "defense" });
  effects.push({ id: "health", label: "Health", value: String(stats.hp), iconKey: "health" });
  effects.push({ id: "movement", label: "Movement", value: String(stats.movement), iconKey: "movement" });
  effects.push({ id: "vision", label: "Vision", value: String(stats.visionRadius), iconKey: "vision" });
  effects.push({ id: "range", label: "Range", value: String(stats.attackRange), iconKey: "range" });
  effects.push({ id: "actions", label: "Actions", value: String(stats.actions), iconKey: "actions" });

  const abilityIds = Array.from(new Set(unitDef.abilities || []));
  abilityIds.forEach((abilityId) => {
    effects.push(getAbilityDescriptor(abilityId));
  });

  const passive = unitDef.passiveEffects?.perTurn;
  if (passive) {
    pushIfPositive(effects, "per_turn_stars", "Stars/turn", passive.stars, "stars");
    pushIfPositive(effects, "per_turn_faith", "Faith/turn", passive.faith, "faith");
    pushIfPositive(effects, "per_turn_pride", "Pride/turn", passive.pride, "pride");
    pushIfPositive(effects, "per_turn_dissent", "Dissent/turn", passive.dissent, "dissent");
  }

  const conditional = unitDef.passiveEffects?.perTurnWhen || [];
  conditional.forEach((entry, index) => {
    const conditionLabel = formatCondition(entry.stat, entry.gte, entry.lte);
    pushIfPositive(
      effects,
      `conditional_${index}_stars`,
      `Stars/turn (${conditionLabel})`,
      entry.perTurn.stars,
      "stars"
    );
    pushIfPositive(
      effects,
      `conditional_${index}_faith`,
      `Faith/turn (${conditionLabel})`,
      entry.perTurn.faith,
      "faith"
    );
    pushIfPositive(
      effects,
      `conditional_${index}_pride`,
      `Pride/turn (${conditionLabel})`,
      entry.perTurn.pride,
      "pride"
    );
    pushIfPositive(
      effects,
      `conditional_${index}_dissent`,
      `Dissent/turn (${conditionLabel})`,
      entry.perTurn.dissent,
      "dissent"
    );
  });

  const cooldownDelta = unitDef.passiveEffects?.diplomacyCooldownDelta;
  if (cooldownDelta) {
    const stacking = cooldownDelta.stacking === "any" ? "non-stacking" : "per unit";
    const entries = Object.entries(cooldownDelta.perTurn || {});
    entries.forEach(([key, value]) => {
      if (!value) return;
      const label = `${formatAbilityName(key)} cooldown`;
      effects.push({
        id: `cooldown_${key}`,
        label,
        value: `${formatSigned(value)} per turn (${stacking})`,
        iconKey: "cooldown",
      });
    });
  }

  if (unitDef.type === "missionary") {
    effects.push({
      id: "testimony_pressure",
      label: "Testimony pressure",
      value: `Adjacent enemy military units suffer -${GAME_RULES.influence.testimonyPressure.attackPenalty} attack for ${GAME_RULES.influence.testimonyPressure.durationTurns} turns (Nephite factions).`,
      iconKey: "faith",
    });
  }

  return effects;
};

export const getStructureEffectSummary = (structureDef: StructureDefinition): EffectDescriptor[] => {
  const effects: EffectDescriptor[] = [];
  const stats = structureDef.effects;

  pushIfPositive(effects, "stars", "Stars/turn", stats.starProduction, "stars");
  pushIfPositive(effects, "faith", "Faith/turn", stats.faithProduction, "faith");
  pushIfPositive(
    effects,
    "population",
    "Population gain (on completion)",
    stats.populationGrowth,
    "population"
  );
  pushIfPositive(effects, "unit_production", "Unit production", stats.unitProduction, "unitProduction");
  pushIfPositive(effects, "defense_bonus", "City defense bonus", stats.defenseBonus, "defenseBonus");

  if (structureDef.id === "temple") {
    effects.push({
      id: "temple_morale",
      label: "Morale relief",
      value: "Reduces dissent by 1 (max 4 with alliances) and humbles pride by 1 if you have any temples.",
      iconKey: "special",
    });
  }

  if (structureDef.id === "fortress") {
    effects.push({
      id: "fortress_fortification",
      label: "Fortification",
      value: `Ranged attacks deal -${GAME_RULES.combat.fortificationBonus} damage to defenders in this city.`,
      iconKey: "defense",
    });
  }

  if (isCulturalStructure(structureDef.id)) {
    effects.push({
      id: "cultural_site",
      label: "Cultural site",
      value: "Counts toward cultural victory.",
      iconKey: "special",
    });
  }

  return effects;
};

export const getImprovementEffectSummary = (improvementDef: ImprovementDefinition): EffectDescriptor[] => {
  const effects: EffectDescriptor[] = [];

  pushIfPositive(effects, "stars", "Stars/turn", improvementDef.starProduction, "stars");

  if (improvementDef.effects?.faithProduction) {
    pushIfPositive(
      effects,
      "faith",
      "Faith/turn",
      improvementDef.effects.faithProduction,
      "faith"
    );
  }

  if (improvementDef.effects?.populationGrowth) {
    pushIfPositive(
      effects,
      "population",
      "Population gain (on completion)",
      improvementDef.effects.populationGrowth,
      "population"
    );
  }

  if (improvementDef.id === "port") {
    effects.push({
      id: "port_seafaring",
      label: "Seafaring bonus",
      value: "+1 star/turn with Seafaring technology.",
      iconKey: "naval",
    });
  }

  if (improvementDef.id === "road") {
    effects.push({
      id: "road_income",
      label: "Network income",
      value: "Connected cities earn +1 star/turn per extra city (doubled with Trade).",
      iconKey: "road",
    });
    effects.push({
      id: "road_movement",
      label: "Movement",
      value: "Reduces movement cost for friendly units on road tiles.",
      iconKey: "movement",
    });
  }

  if (isCulturalImprovement(improvementDef.id)) {
    effects.push({
      id: "cultural_site",
      label: "Cultural site",
      value: "Counts toward cultural victory.",
      iconKey: "special",
    });
  }

  return effects;
};
