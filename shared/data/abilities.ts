import { FACTIONS } from "./factions";

export interface AbilityDefinition {
  id: string;
  name: string;
  description: string;
  type: 'unit' | 'faction' | 'global';
  effect: string;
  duration?: number;
  cooldown?: number;
  requirements?: {
    faith?: number;
    pride?: number;
    dissent?: number;
  };
}

export const ABILITIES: Record<string, AbilityDefinition> = {
  // Faction Abilities
  TITLE_OF_LIBERTY: {
    id: 'TITLE_OF_LIBERTY',
    name: 'Title of Liberty',
    description: 'Inspires all units within 3 tiles, increasing their attack and defense by 30% and granting immunity to negative status effects',
    type: 'faction',
    effect: 'MORALE_BOOST',
    duration: 3,
    cooldown: 8,
    requirements: { faith: 70 },
  },

  BLOOD_FEUD: {
    id: 'BLOOD_FEUD',
    name: 'Blood Feud',
    description: 'When a unit dies, nearby allies gain permanent +2 attack',
    type: 'faction',
    effect: 'VENGEANCE_BUFF',
  },

  COVENANT_OF_PEACE: {
    id: 'COVENANT_OF_PEACE',
    name: 'Covenant of Peace',
    description: 'Target an enemy unit within 2 tiles to attempt conversion. Success chance: 50% + (Your Faith - Their Faith). Costs 15 Faith.',
    type: 'faction',
    effect: 'CONVERT_TARGET',
    cooldown: 6,
    requirements: { faith: 15 },
  },

  RAMEUMPTOM: {
    id: 'RAMEUMPTOM',
    name: 'Rameumptom',
    description: 'Gain +100% resource generation for 5 turns but increase internal dissent by 20',
    type: 'faction',
    effect: 'RESOURCE_PRIDE_TRADE',
    duration: 5,
    cooldown: 12,
    requirements: { pride: 70 },
  },

  // Unit Abilities
  FAITHFUL_DEFENSE: {
    id: 'FAITHFUL_DEFENSE',
    name: 'Faithful Defense',
    description: 'Defense increases based on faith level',
    type: 'unit',
    effect: 'FAITH_DEFENSE_BONUS',
  },

  YOUNG_VIGOR: {
    id: 'YOUNG_VIGOR',
    name: 'Young Vigor',
    description: 'Immune to fear effects and morale penalties',
    type: 'unit',
    effect: 'FEAR_IMMUNITY',
  },

  DIPLOMACY: {
    id: 'DIPLOMACY',
    name: 'Diplomacy',
    description: 'Can negotiate with enemy units to avoid combat',
    type: 'unit',
    effect: 'AVOID_COMBAT',
  },

  CONVERT: {
    id: 'CONVERT',
    name: 'Convert',
    description: 'Turn enemy units to your faction through faith',
    type: 'unit',
    effect: 'UNIT_CONVERSION',
  },

  HEAL: {
    id: 'HEAL',
    name: 'Heal',
    description: 'Restore HP to nearby friendly units',
    type: 'unit',
    effect: 'RESTORE_HP',
  },

  FORTIFY: {
    id: 'FORTIFY',
    name: 'Fortify',
    description: 'Double defense but cannot move',
    type: 'unit',
    effect: 'DEFENSIVE_STANCE',
  },

  STEALTH: {
    id: 'STEALTH',
    name: 'Stealth',
    description: 'Invisible to enemies unless adjacent',
    type: 'unit',
    effect: 'INVISIBILITY',
  },

  LEADERSHIP: {
    id: 'LEADERSHIP',
    name: 'Leadership',
    description: 'Nearby units gain +1 to all stats',
    type: 'unit',
    effect: 'AREA_BUFF',
  },

  // Technology-unlocked abilities
  blessing: {
    id: 'blessing',
    name: 'Blessing',
    description: 'Provides divine protection and healing to allied units',
    type: 'unit',
    effect: 'DIVINE_HEALING',
    requirements: { faith: 30 },
  },

  conversion: {
    id: 'conversion',
    name: 'Conversion',
    description: 'Convert enemy units to your side through faith',
    type: 'unit',
    effect: 'CONVERT_ENEMY',
    requirements: { faith: 50 },
  },

  divine_protection: {
    id: 'divine_protection',
    name: 'Divine Protection',
    description: 'Reduces all incoming damage by 50% for 2 turns',
    type: 'unit',
    effect: 'DAMAGE_REDUCTION',
    duration: 2,
    cooldown: 5,
    requirements: { faith: 60 },
  },

  enlightenment: {
    id: 'enlightenment',
    name: 'Enlightenment',
    description: 'Instantly grants one free technology that you meet prerequisites for',
    type: 'global',
    effect: 'FREE_TECHNOLOGY',
    cooldown: 20,
    requirements: { faith: 80 },
  },

  // Counter-Abilities and Resistance
  FAITHFUL_RESISTANCE: {
    id: 'FAITHFUL_RESISTANCE',
    name: 'Faithful Resistance',
    description: 'Units have +50% resistance to conversion attempts',
    type: 'faction',
    effect: 'CONVERSION_RESISTANCE',
  },

  SPIRITUAL_WARFARE: {
    id: 'SPIRITUAL_WARFARE',
    name: 'Spiritual Warfare',
    description: 'Nearby enemies lose 2 Faith per turn when adjacent to your units',
    type: 'faction',
    effect: 'FAITH_DRAIN_AURA',
  },

  RIGHTEOUS_FURY: {
    id: 'RIGHTEOUS_FURY',
    name: 'Righteous Fury',
    description: 'When a unit is converted, all nearby allies gain +3 attack for 3 turns',
    type: 'faction',
    effect: 'CONVERSION_VENGEANCE',
    duration: 3,
  },

  DIVINE_WARD: {
    id: 'DIVINE_WARD',
    name: 'Divine Ward',
    description: 'Grants immunity to negative status effects for 3 turns. Costs 10 Faith.',
    type: 'unit',
    effect: 'STATUS_IMMUNITY',
    duration: 3,
    cooldown: 8,
    requirements: { faith: 10 },
  },
};

export const getAbility = (id: string): AbilityDefinition | undefined => {
  return ABILITIES[id];
};

export const getFactionAbilities = (factionId: string): AbilityDefinition[] => {
  // Return the abilities directly from the faction data structure
  const faction = Object.values(FACTIONS).find(f => f.id === factionId);
  return faction?.abilities || [];
};
