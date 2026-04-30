import { GAME_RULES } from "./gameRules";
import type { FactionId } from "../types/factionId";

export type FactionAbilityImplementationStatus =
  | "implemented"
  | "design_pending"
  | "disabled";

export type FactionAbilityTargetType =
  | "none"
  | "friendly_unit_optional"
  | "enemy_unit_auto"
  | "enemy_units_area"
  | "player";

export type FactionAbilityAIUseRule =
  | "manual_only"
  | "skip_design_pending"
  | "skip_disabled"
  | "buff_when_combat_ready"
  | "convert_when_pressure_available"
  | "economy_when_stable"
  | "forest_defense_when_available"
  | "rage_when_engaged"
  | "ancient_might_when_contested"
  | "pressure_when_targets_available";

export interface FactionAbilityResourceCost {
  faith?: number;
  pride?: number;
  stars?: number;
  dissent?: number;
}

export interface FactionAbilitySpec {
  id: string;
  owningFaction: FactionId;
  status: FactionAbilityImplementationStatus;
  cost: FactionAbilityResourceCost;
  activationRequirement?: FactionAbilityResourceCost;
  cooldown: number;
  target: {
    type: FactionAbilityTargetType;
    range?: number;
    rules: string;
  };
  effect: string;
  durationTurns?: number;
  stackingRule: "refresh" | "terrain_idempotent" | "single_resolution" | "pending";
  aiUse: {
    rule: FactionAbilityAIUseRule;
    notes: string;
  };
  ui: {
    ready: string;
    blocked: string;
  };
}

export const FACTION_ABILITY_SPECS = {
  TITLE_OF_LIBERTY: {
    id: "TITLE_OF_LIBERTY",
    owningFaction: "NEPHITES",
    status: "implemented",
    cost: { faith: 50 },
    activationRequirement: { faith: 70 },
    cooldown: 8,
    target: {
      type: "friendly_unit_optional",
      range: 3,
      rules: "Uses the requested friendly unit as the banner source, or picks the friendly unit covering the most nearby allies.",
    },
    effect: "Friendly units within 3 tiles gain +30% attack, +30% defense, and immunity to negative status effects for 3 turns.",
    durationTurns: 3,
    stackingRule: "refresh",
    aiUse: {
      rule: "buff_when_combat_ready",
      notes: "AI may activate when a friendly source can cover multiple units and combat is likely soon.",
    },
    ui: {
      ready: "Inspire nearby friendly units.",
      blocked: "Requires 70 Faith and an available friendly banner source.",
    },
  },
  WARRIOR_RAGE: {
    id: "WARRIOR_RAGE",
    owningFaction: "LAMANITES",
    status: "implemented",
    cost: {},
    activationRequirement: { pride: 60 },
    cooldown: 6,
    target: {
      type: "player",
      rules: "Affects all units owned by the activating Lamanite player.",
    },
    effect: "All owned units gain +3 attack and -1 defense for 4 turns.",
    durationTurns: 4,
    stackingRule: "refresh",
    aiUse: {
      rule: "rage_when_engaged",
      notes: "AI may activate when several owned units are in or near combat and Pride is sufficient.",
    },
    ui: {
      ready: "Commit to an offensive rage.",
      blocked: "Requires 60 Pride.",
    },
  },
  lamanite_guerrilla_tactics: {
    id: "lamanite_guerrilla_tactics",
    owningFaction: "LAMANITES",
    status: "implemented",
    cost: {},
    cooldown: 0,
    target: {
      type: "player",
      rules: "Affects owned units currently standing on forest tiles.",
    },
    effect: `Owned forest units gain +${GAME_RULES.abilities.attackBonuses.guerrillaBonus} defense until they leave forest terrain.`,
    stackingRule: "terrain_idempotent",
    aiUse: {
      rule: "forest_defense_when_available",
      notes: "AI may activate when owned units are standing on forest tiles.",
    },
    ui: {
      ready: "Prepare forest units for ambush defense.",
      blocked: "Requires Lamanite units positioned in forest.",
    },
  },
  CULTURAL_RECLAMATION: {
    id: "CULTURAL_RECLAMATION",
    owningFaction: "MULEKITES",
    status: "implemented",
    cost: { faith: GAME_RULES.abilities.factionActive.culturalReclamation.faithCost },
    activationRequirement: { faith: GAME_RULES.abilities.factionActive.culturalReclamation.activationFaith },
    cooldown: GAME_RULES.abilities.factionActive.culturalReclamation.cooldown,
    target: {
      type: "enemy_units_area",
      range: GAME_RULES.abilities.factionActive.culturalReclamation.range,
      rules: "Global faction activation projected through owned cities, Scribe-Teachers, and Royal Envoys. Visible non-allied enemy units within 2 tiles receive cultural pressure.",
    },
    effect: "Applies cultural pressure for 2 turns, reducing defense by 1 and increasing later unit conversion chance by 20 percentage points for the Mulekites.",
    durationTurns: GAME_RULES.abilities.factionActive.culturalReclamation.durationTurns,
    stackingRule: "refresh",
    aiUse: {
      rule: "pressure_when_targets_available",
      notes: "AI may activate when multiple visible enemy units are in cultural range, or one pressured target is valuable and Faith is abundant.",
    },
    ui: {
      ready: "Apply cultural pressure near cities and cultural units.",
      blocked: "Requires 40 Faith and visible non-allied enemy units near a city, Scribe-Teacher, or Royal Envoy.",
    },
  },
  COVENANT_OF_PEACE: {
    id: "COVENANT_OF_PEACE",
    owningFaction: "ANTI_NEPHI_LEHIES",
    status: "implemented",
    cost: { faith: GAME_RULES.abilities.resourceCosts.covenantOfPeace },
    activationRequirement: { faith: GAME_RULES.abilities.resourceCosts.covenantOfPeace },
    cooldown: 6,
    target: {
      type: "enemy_unit_auto",
      range: GAME_RULES.conversion.covenantOfPeace.range,
      rules: "Automatically selects the lowest-HP enemy unit within range of any friendly unit, then requires the configured faith advantage.",
    },
    effect: "Converts the selected enemy unit if the faith advantage requirement is met.",
    stackingRule: "single_resolution",
    aiUse: {
      rule: "convert_when_pressure_available",
      notes: "AI may activate when a valid nearby conversion target exists and the faith advantage requirement is met.",
    },
    ui: {
      ready: "Attempt a peaceful conversion.",
      blocked: "Requires enough Faith, a valid enemy target, and the required faith advantage.",
    },
  },
  MISSIONARY_ZEAL: {
    id: "MISSIONARY_ZEAL",
    owningFaction: "ANTI_NEPHI_LEHIES",
    status: "implemented",
    cost: { faith: 40 },
    activationRequirement: { faith: 80 },
    cooldown: 7,
    target: {
      type: "enemy_units_area",
      range: 4,
      rules: "Global faction activation projected through owned missionaries. Visible non-allied enemy military units within 4 tiles of any owned missionary receive testimony pressure.",
    },
    effect: "Applies testimony pressure for 1 turn, reducing affected enemy military units by 1 attack and clearing temporary rally/command buffs.",
    durationTurns: GAME_RULES.influence.testimonyPressure.durationTurns,
    stackingRule: "refresh",
    aiUse: {
      rule: "pressure_when_targets_available",
      notes: "AI may activate when enough enemy military units are in missionary pressure range.",
    },
    ui: {
      ready: "Project testimony pressure through owned missionaries.",
      blocked: "Requires 80 Faith, an owned missionary, and visible enemy military units within 4 tiles.",
    },
  },
  RAMEUMPTOM: {
    id: "RAMEUMPTOM",
    owningFaction: "ZORAMITES",
    status: "implemented",
    cost: {},
    activationRequirement: { pride: 70 },
    cooldown: 12,
    target: {
      type: "player",
      rules: "Affects the activating Zoramite player.",
    },
    effect: "Doubles star and faith yields for 5 turns and immediately increases internal dissent by 20.",
    durationTurns: 5,
    stackingRule: "refresh",
    aiUse: {
      rule: "economy_when_stable",
      notes: "AI may activate when Pride is high, dissent is not already critical, and the temporary economy burst is likely to matter.",
    },
    ui: {
      ready: "Convert pride into temporary economic power.",
      blocked: "Requires 70 Pride.",
    },
  },
  ANCIENT_MIGHT: {
    id: "ANCIENT_MIGHT",
    owningFaction: "JAREDITES",
    status: "implemented",
    cost: {},
    activationRequirement: { pride: GAME_RULES.abilities.factionActive.ancientMight.activationPride },
    cooldown: GAME_RULES.abilities.factionActive.ancientMight.cooldown,
    target: {
      type: "player",
      rules: "Affects all units owned by the activating Jaredite player.",
    },
    effect: "All owned units gain +2 attack and +2 defense for 4 turns. The activating player gains 10 Pride immediately and 10 Pride at each source turn end while the effect remains active, intentionally pushing toward existing pride-cycle instability.",
    durationTurns: GAME_RULES.abilities.factionActive.ancientMight.durationTurns,
    stackingRule: "refresh",
    aiUse: {
      rule: "ancient_might_when_contested",
      notes: "AI may activate when it has enough units to benefit and Pride has room before reaching the highest-risk band.",
    },
    ui: {
      ready: "Awaken ancient strength at the cost of rising Pride.",
      blocked: "Requires 60 Pride and at least one owned unit.",
    },
  },
} satisfies Record<string, FactionAbilitySpec>;

export type FactionAbilitySpecId = keyof typeof FACTION_ABILITY_SPECS;

export function getFactionAbilitySpec(abilityId: string): FactionAbilitySpec | undefined {
  return FACTION_ABILITY_SPECS[abilityId as FactionAbilitySpecId];
}

export function isImplementedFactionAbility(abilityId: string): boolean {
  return getFactionAbilitySpec(abilityId)?.status === "implemented";
}

export const IMPLEMENTED_ACTIVE_FACTION_ABILITY_IDS = Object.values(FACTION_ABILITY_SPECS)
  .filter(spec => spec.status === "implemented")
  .map(spec => spec.id);
