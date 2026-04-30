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
      rule: "manual_only",
      notes: "AI timing is not yet tuned; resolver support is available but AI should not originate this ability casually.",
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
      rule: "manual_only",
      notes: "AI should wait for an offensive timing rule before using this high-variance buff.",
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
      rule: "manual_only",
      notes: "AI should not use this until it evaluates forest occupancy and upcoming enemy attacks.",
    },
    ui: {
      ready: "Prepare forest units for ambush defense.",
      blocked: "Requires Lamanite units positioned in forest.",
    },
  },
  CULTURAL_RECLAMATION: {
    id: "CULTURAL_RECLAMATION",
    owningFaction: "MULEKITES",
    status: "design_pending",
    cost: { faith: 60 },
    activationRequirement: { faith: 40 },
    cooldown: 10,
    target: {
      type: "enemy_units_area",
      range: 2,
      rules: "Pending: define whether this targets one unit, all units in range, cities, or culture pressure over time.",
    },
    effect: "Pending design decision before implementation.",
    stackingRule: "pending",
    aiUse: {
      rule: "skip_design_pending",
      notes: "No AI behavior until target rules and conversion math are specified.",
    },
    ui: {
      ready: "Design pending.",
      blocked: "Cultural Reclamation is not implemented yet.",
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
      rule: "manual_only",
      notes: "AI should wait for a conversion-value heuristic before activating.",
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
      rule: "manual_only",
      notes: "AI should wait for a risk/reward rule that accounts for dissent and economy timing.",
    },
    ui: {
      ready: "Convert pride into temporary economic power.",
      blocked: "Requires 70 Pride.",
    },
  },
  ANCIENT_MIGHT: {
    id: "ANCIENT_MIGHT",
    owningFaction: "JAREDITES",
    status: "design_pending",
    cost: {},
    cooldown: 15,
    target: {
      type: "player",
      rules: "Pending: define duration, pride increase cadence, collapse interaction, and exact stat modifiers.",
    },
    effect: "Pending design decision before implementation.",
    stackingRule: "pending",
    aiUse: {
      rule: "skip_design_pending",
      notes: "No AI behavior until the pride/collapse tradeoff is specified.",
    },
    ui: {
      ready: "Design pending.",
      blocked: "Ancient Might is not implemented yet.",
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
