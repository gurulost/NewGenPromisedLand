import { UnitDefinition, UnitType } from "../types/unit";

export const UNIT_DEFINITIONS: Record<UnitType, UnitDefinition> = {
  warrior: {
    type: 'warrior',
    name: 'Warrior',
    description: 'Basic melee unit with balanced stats',
    baseStats: {
      hp: 25,
      attack: 6,
      defense: 4,
      movement: 3,
      visionRadius: 2,
      attackRange: 1,
    },
    cost: 10,
    factionSpecific: ['LAMANITES', 'JAREDITES'],
    abilities: [],
  },

  stripling_warrior: {
    type: 'stripling_warrior',
    name: 'Stripling Warrior',
    description: 'Young faithful warriors with high morale and defensive bonuses',
    baseStats: {
      hp: 20,
      attack: 5,
      defense: 6,
      movement: 3,
      visionRadius: 2,
      attackRange: 1,
    },
    cost: 12,
    requirements: { faith: 70 },
    factionSpecific: ['NEPHITES'],
    abilities: ['FAITHFUL_DEFENSE', 'YOUNG_VIGOR'],
  },

  royal_envoy: {
    type: 'royal_envoy',
    name: 'Royal Envoy',
    description: 'Diplomatic unit that can convert enemies and gather intelligence',
    baseStats: {
      hp: 15,
      attack: 2,
      defense: 3,
      movement: 4,
      visionRadius: 3, // Diplomats have better vision
      attackRange: 1,
    },
    cost: 15,
    factionSpecific: ['MULEKITES', 'ZORAMITES'],
    abilities: ['DIPLOMACY', 'INTELLIGENCE'],
  },

  missionary: {
    type: 'missionary',
    name: 'Missionary',
    description: 'Peaceful unit focused on spreading faith and converting others',
    baseStats: {
      hp: 18,
      attack: 1,
      defense: 2,
      movement: 3,
      visionRadius: 2,
      attackRange: 1,
    },
    cost: 8,
    requirements: { faith: 60 },
    factionSpecific: ['NEPHITES', 'ANTI_NEPHI_LEHIES'],
    abilities: ['CONVERT', 'HEAL'],
  },

  guard: {
    type: 'guard',
    name: 'Guard',
    description: 'Defensive unit specialized in protecting cities and key locations',
    baseStats: {
      hp: 30,
      attack: 4,
      defense: 8,
      movement: 2,
      visionRadius: 2,
      attackRange: 1,
    },
    cost: 14,
    factionSpecific: ['ANTI_NEPHI_LEHIES'],
    abilities: ['FORTIFY', 'PROTECTIVE_STANCE'],
  },

  scout: {
    type: 'scout',
    name: 'Scout',
    description: 'Fast reconnaissance unit with high movement and vision',
    baseStats: {
      hp: 12,
      attack: 3,
      defense: 2,
      movement: 5,
      visionRadius: 4, // Scouts have exceptional vision
      attackRange: 1,
    },
    cost: 6,
    factionSpecific: ['LAMANITES'],
    abilities: ['STEALTH', 'EXTENDED_VISION'],
  },

  worker: {
    type: 'worker',
    name: 'Worker',
    description: 'Non-combat unit for building improvements and gathering resources',
    baseStats: {
      hp: 10,
      attack: 1,
      defense: 1,
      movement: 2,
      visionRadius: 2,
      attackRange: 1,
    },
    cost: 5,
    factionSpecific: ['MULEKITES'],
    abilities: ['BUILD', 'GATHER'],
  },

  commander: {
    type: 'commander',
    name: 'Commander',
    description: 'Elite unit that provides leadership bonuses to nearby forces',
    baseStats: {
      hp: 35,
      attack: 8,
      defense: 6,
      movement: 3,
      visionRadius: 3, // Commanders have enhanced vision
      attackRange: 1,
    },
    cost: 25,
    requirements: { pride: 50 },
    factionSpecific: ['ZORAMITES', 'JAREDITES'],
    abilities: ['LEADERSHIP', 'TACTICAL_COMMAND'],
  },
};

export const getUnitDefinition = (type: UnitType): UnitDefinition => {
  return UNIT_DEFINITIONS[type];
};

export const getUnitsForFaction = (factionId: string): UnitDefinition[] => {
  return Object.values(UNIT_DEFINITIONS).filter(unit => 
    unit.factionSpecific.length === 0 || unit.factionSpecific.includes(factionId)
  );
};
