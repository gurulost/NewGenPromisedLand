import { FACTIONS } from "./factions";
import { GAME_RULES } from "./gameRules";

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

  RIGHTEOUS_DEFENSE: {
    id: 'RIGHTEOUS_DEFENSE',
    name: 'Righteous Defense',
    description: 'Defensive structures cost less and provide additional protection.',
    type: 'faction',
    effect: 'DEFENSIVE_ECONOMY',
  },

  BLOOD_FEUD: {
    id: 'BLOOD_FEUD',
    name: 'Blood Feud',
    description: 'When a unit dies, nearby allies gain permanent +2 attack',
    type: 'faction',
    effect: 'VENGEANCE_BUFF',
  },

  WARRIOR_RAGE: {
    id: 'WARRIOR_RAGE',
    name: 'Warrior Rage',
    description: 'All units gain +3 attack but -1 defense for 4 turns.',
    type: 'faction',
    effect: 'RAGE_BUFF',
    duration: 4,
    cooldown: 6,
    requirements: { pride: 60 },
  },

  COVENANT_OF_PEACE: {
    id: 'COVENANT_OF_PEACE',
    name: 'Covenant of Peace',
    description: 'Target an enemy unit within 2 tiles to attempt conversion. Success requires significant faith advantage. Costs 15 Faith.',
    type: 'faction',
    effect: 'CONVERT_TARGET',
    cooldown: 6,
    requirements: { faith: 15 },
  },

  MISSIONARY_ZEAL: {
    id: 'MISSIONARY_ZEAL',
    name: 'Missionary Zeal',
    description: 'Spread faith to nearby tiles, pressuring neutral villages and weakening enemy resolve.',
    type: 'faction',
    effect: 'SPREAD_FAITH',
    cooldown: 7,
    requirements: { faith: 80 },
  },

  ANCIENT_KNOWLEDGE: {
    id: 'ANCIENT_KNOWLEDGE',
    name: 'Ancient Knowledge',
    description: 'Gain bonus resources when exploring ruins or ancient sites.',
    type: 'faction',
    effect: 'RUIN_BONUS',
  },

  CULTURAL_RECLAMATION: {
    id: 'CULTURAL_RECLAMATION',
    name: 'Cultural Reclamation',
    description: 'Convert enemy units within 2 tiles through cultural influence.',
    type: 'faction',
    effect: 'CONVERT_AREA',
    cooldown: 10,
    requirements: { faith: 40 },
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

  WEALTH_ACCUMULATION: {
    id: 'WEALTH_ACCUMULATION',
    name: 'Wealth Accumulation',
    description: 'Generate extra resources from all sources but lose faith over time.',
    type: 'faction',
    effect: 'WEALTH_TRADEOFF',
  },

  PROPHETIC_COLLAPSE: {
    id: 'PROPHETIC_COLLAPSE',
    name: 'Prophetic Collapse',
    description: 'When pride reaches extreme levels, instability erupts across the civilization.',
    type: 'faction',
    effect: 'CIVIL_COLLAPSE',
  },

  ANCIENT_MIGHT: {
    id: 'ANCIENT_MIGHT',
    name: 'Ancient Might',
    description: 'All units gain +2 to all stats for a time, but pride rises rapidly.',
    type: 'faction',
    effect: 'ANCIENT_MIGHT_BUFF',
    cooldown: 15,
  },

  SHIPBUILDING_TRADITION: {
    id: 'SHIPBUILDING_TRADITION',
    name: 'Shipbuilding Tradition',
    description: 'Ports generate +1 star/turn even without Seafaring.',
    type: 'faction',
    effect: 'HAGOTH_PORT_BONUS',
  },

  NORTHWARD_VENTURES: {
    id: 'NORTHWARD_VENTURES',
    name: 'Northward Ventures',
    description: 'Voyagers are amphibious and can make landfall.',
    type: 'faction',
    effect: 'HAGOTH_AMPHIBIOUS_VOYAGER',
  },

  BONDAGE_TASKMASTERS: {
    id: 'BONDAGE_TASKMASTERS',
    name: 'Bondage Taskmasters',
    description: 'Taskmasters intimidate adjacent enemy military units at end of turn.',
    type: 'faction',
    effect: 'TASKMASTER_INTIMIDATION_AURA',
  },

  // Legacy ability ids (kept for compatibility with existing UI/tests)
  lamanite_guerrilla_tactics: {
    id: 'lamanite_guerrilla_tactics',
    name: 'Guerrilla Tactics',
    description: 'Units positioned in forests gain a defense bonus until they leave the forest.',
    type: 'faction',
    effect: 'FOREST_DEFENSE',
    cooldown: 0,
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

  AMPHIBIOUS: {
    id: 'AMPHIBIOUS',
    name: 'Amphibious',
    description: 'Can move between water and land tiles.',
    type: 'unit',
    effect: 'AMPHIBIOUS_MOVEMENT',
  },

  INTIMIDATE: {
    id: 'INTIMIDATE',
    name: 'Intimidate',
    description: 'Applies Intimidated to nearby enemy military units.',
    type: 'unit',
    effect: 'INTIMIDATION_DEBUFF',
  },

  ANTI_CAVALRY: {
    id: 'ANTI_CAVALRY',
    name: 'Anti-Cavalry',
    description: 'Deals bonus damage to fast or mounted units',
    type: 'unit',
    effect: 'ANTI_CAVALRY_BONUS',
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
    description: 'Adjacent allies gain +1 attack and defense in combat',
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
    description: `Convert enemy units to your side through faith (costs ${GAME_RULES.conversion.costs.unit} Faith)`,
    type: 'unit',
    effect: 'CONVERT_ENEMY',
    requirements: { faith: GAME_RULES.conversion.costs.unit },
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
    description: 'Adjacent enemy military units suffer reduced attack under testimony pressure.',
    type: 'faction',
    effect: 'TESTIMONY_PRESSURE_AURA',
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
  const faction = Object.values(FACTIONS).find(f => f.id === factionId);
  if (!faction) return [];

  return faction.abilities.map(ability => {
    const canonical = ABILITIES[ability.id];
    return {
      id: ability.id,
      name: ability.name ?? canonical?.name ?? ability.id,
      description: ability.description ?? canonical?.description ?? '',
      type: canonical?.type ?? ('faction' as const),
      effect: canonical?.effect ?? ability.description,
      duration: canonical?.duration,
      cooldown: canonical?.cooldown ?? ability.cooldown,
      requirements: canonical?.requirements ?? ability.requirements
    };
  });
};
