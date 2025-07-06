import { UnitDefinition, UnitType } from "../types/unit";

export const UNIT_DEFINITIONS: Record<UnitType, UnitDefinition> = {
  // === COMMON UNITS (Available to all factions) ===
  
  warrior: {
    type: 'warrior',
    name: 'Warrior',
    description: 'Basic melee unit with balanced stats - the backbone of any army',
    baseStats: {
      hp: 25,
      attack: 6,
      defense: 4,
      movement: 3,
      visionRadius: 2,
      attackRange: 1,
    },
    cost: 10,
    factionSpecific: [], // Available to ALL factions
    abilities: [],
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
    factionSpecific: [], // Available to ALL factions
    abilities: ['stealth', 'reconnaissance'],
    requiredTechnology: 'hunting', // Scouts require hunting technology
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
    factionSpecific: [], // Available to ALL factions
    abilities: ['BUILD', 'GATHER'],
    requiredTechnology: 'organization',
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
    factionSpecific: [], // Available to ALL factions
    abilities: ['FORTIFY', 'PROTECTIVE_STANCE'],
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
    factionSpecific: [], // Available to ALL factions
    abilities: ['LEADERSHIP', 'TACTICAL_COMMAND'],
  },

  // === FACTION-SPECIFIC SPECIAL UNITS ===

  stripling_warrior: {
    type: 'stripling_warrior',
    name: 'Stripling Warrior',
    description: 'Elite Nephite warriors - young faithful soldiers with divine protection',
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
    factionSpecific: ['NEPHITES'], // Nephites only
    abilities: ['FAITHFUL_DEFENSE', 'YOUNG_VIGOR'],
  },

  spearman: {
    type: 'spearman',
    name: 'Spearman',
    description: 'Bronze-armed warrior with extended reach and anti-cavalry capabilities',
    baseStats: {
      hp: 20,
      attack: 7,
      defense: 5,
      movement: 3,
      visionRadius: 2,
      attackRange: 1,
    },
    cost: 12,
    factionSpecific: [], // Available to ALL factions
    abilities: ['formation_fighting'],
    requiredTechnology: 'bronze_working',
  },

  boat: {
    type: 'boat',
    name: 'Boat',
    description: 'Simple watercraft for coastal exploration and transport',
    baseStats: {
      hp: 15,
      attack: 3,
      defense: 2,
      movement: 4,
      visionRadius: 3,
      attackRange: 1,
    },
    cost: 8,
    factionSpecific: [], // Available to ALL factions
    abilities: ['NAVAL_TRANSPORT', 'COASTAL_EXPLORATION'],
    requiredTechnology: 'sailing',
  },

  catapult: {
    type: 'catapult',
    name: 'Catapult',
    description: 'Siege weapon with long-range bombardment capabilities',
    baseStats: {
      hp: 12,
      attack: 15,
      defense: 2,
      movement: 1,
      visionRadius: 2,
      attackRange: 3,
    },
    cost: 20,
    factionSpecific: [], // Available to ALL factions
    abilities: ['siege'],
    requiredTechnology: 'engineering',
  },

  missionary: {
    type: 'missionary',
    name: 'Missionary',
    description: 'Peaceful conversion specialist - spreads faith and heals allies',
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
    factionSpecific: ['NEPHITES', 'ANTI_NEPHI_LEHIES'], // Religious factions
    abilities: ['heal', 'convert'],
    requiredTechnology: 'priesthood',
  },

  royal_envoy: {
    type: 'royal_envoy',
    name: 'Royal Envoy',
    description: 'Elite diplomatic unit - converts enemies and gathers intelligence',
    baseStats: {
      hp: 15,
      attack: 2,
      defense: 3,
      movement: 4,
      visionRadius: 3, // Diplomats have better vision
      attackRange: 1,
    },
    cost: 15,
    factionSpecific: ['MULEKITES', 'ZORAMITES'], // Diplomatic/trade factions
    abilities: ['DIPLOMACY', 'INTELLIGENCE'],
  },

  wilderness_hunter: {
    type: 'wilderness_hunter',
    name: 'Wilderness Hunter',
    description: 'Elite Lamanite ranger - masters of forest warfare and ambush tactics',
    baseStats: {
      hp: 18,
      attack: 7,
      defense: 3,
      movement: 4,
      visionRadius: 3,
      attackRange: 2, // Ranged attacks
    },
    cost: 13,
    requirements: { pride: 40 },
    factionSpecific: ['LAMANITES'], // Lamanites only
    abilities: ['FOREST_STEALTH', 'AMBUSH', 'RANGED_ATTACK'],
  },

  ancient_giant: {
    type: 'ancient_giant',
    name: 'Ancient Giant',
    description: 'Massive Jaredite warrior - legendary strength from the ancient world',
    baseStats: {
      hp: 45,
      attack: 10,
      defense: 5,
      movement: 2,
      visionRadius: 2,
      attackRange: 1,
    },
    cost: 30,
    requirements: { pride: 80, dissent: 20 }, // High cost, requires ancient knowledge
    factionSpecific: ['JAREDITES'], // Jaredites only
    abilities: ['GIANT_STRENGTH', 'INTIMIDATE', 'SIEGE_BREAKER'],
  },

  peacekeeping_guard: {
    type: 'peacekeeping_guard',
    name: 'Peacekeeping Guard',
    description: 'Anti-Nephi-Lehi defensive specialist - pacifist but incredibly defensive',
    baseStats: {
      hp: 35,
      attack: 2, // Very low attack - they avoid violence
      defense: 10, // Exceptional defense
      movement: 2,
      visionRadius: 2,
      attackRange: 1,
    },
    cost: 16,
    requirements: { faith: 80 },
    factionSpecific: ['ANTI_NEPHI_LEHIES'], // Anti-Nephi-Lehies only
    abilities: ['PACIFIST_DEFENSE', 'PROTECTIVE_AURA', 'NON_VIOLENCE'],
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
