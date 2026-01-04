export interface Technology {
  id: string;
  name: string;
  description: string;
  cost: number;
  prerequisites: string[];
  unlocks: {
    // Abilities must map to shared/data/abilities.ts ids for gating.
    units?: string[];
    improvements?: string[];
    structures?: string[];
    abilities?: string[];
    // Benefits are UI-only unlock notes (world-elements, passive bonuses, upgrades).
    benefits?: string[];
  };
  category: 'military' | 'economic' | 'religious' | 'exploration';
}

export const TECHNOLOGIES: Record<string, Technology> = {
  // Tier 1 - Starting Technologies
  organization: {
    id: 'organization',
    name: 'Organization',
    description: 'Like Nephi organizing his people into "rulers and teachers" (2 Nephi 5:19), this establishes basic civic structure for resource management and settlement construction, enabling the growth of a righteous society.',
    cost: 5,
    prerequisites: [],
    unlocks: {
      improvements: ['farm', 'road'],
      units: ['worker']
    },
    category: 'economic'
  },

  forestry: {
    id: 'forestry',
    name: 'Forestry',
    description: 'Following Nephi\'s example of constructing ships from timber (1 Nephi 18:1), this knowledge of forest management enables lumber harvesting and timber processing for construction and economic growth.',
    cost: 5,
    prerequisites: [],
    unlocks: {
      improvements: ['lumber_hut', 'forest_camp'],
      benefits: ['Clear Forest (Worker action)']
    },
    category: 'economic'
  },

  hunting: {
    id: 'hunting',
    name: 'Hunting',
    description: 'Following Nephi\'s example of obtaining food in the wilderness (1 Nephi 16:31), this knowledge of tracking, archery, and survival enables both sustenance and defense against wild beasts and enemies.',
    cost: 5,
    prerequisites: [],
    unlocks: {
      units: ['scout']
    },
    category: 'military'
  },

  husbandry: {
    id: 'husbandry',
    name: 'Husbandry',
    description: 'Learn to domesticate and care for wild herds, turning animals into sustainable blessings for your people.',
    cost: 8,
    prerequisites: ['hunting'],
    unlocks: {
      benefits: ['Corral (Wild Goats)']
    },
    category: 'economic'
  },

  spirituality: {
    id: 'spirituality',
    name: 'Spirituality',
    description: 'As Lehi taught his family to "pray unto the Lord" (1 Nephi 2:16), this foundational faith practice strengthens the people through divine guidance, blessings, and protection from the adversary.',
    cost: 5,
    prerequisites: [],
    unlocks: {
      improvements: ['shrine'],
      structures: ['temple'],
      units: ['priestcraft_preacher', 'prophet'],
      abilities: ['blessing']
    },
    category: 'religious'
  },

  // Tier 2 - Advanced Technologies
  agriculture: {
    id: 'agriculture',
    name: 'Agriculture',
    description: 'Inspired by the Nephites who "did till the earth, and raise all manner of grain, and of fruit" (Enos 1:21), these advanced farming techniques provide abundant harvests to feed growing populations and support temple construction.',
    cost: 10,
    prerequisites: ['organization'],
    unlocks: {
      improvements: ['plantation'],
      structures: ['granary'],
      benefits: ['Field (Grain Patch)']
    },
    category: 'economic'
  },

  irrigation: {
    id: 'irrigation',
    name: 'Irrigation',
    description: 'Channel water to nourish crops and fields, multiplying harvests through careful stewardship.',
    cost: 12,
    prerequisites: ['agriculture'],
    unlocks: {
      improvements: ['irrigation'],
      benefits: ['Windmill (Grain Patch upgrade)']
    },
    category: 'economic'
  },

  mining: {
    id: 'mining',
    name: 'Mining',
    description: 'Develop mining techniques to extract ore and wealth from the mountains.',
    cost: 10,
    prerequisites: ['organization'],
    unlocks: {
      improvements: ['mine']
    },
    category: 'economic'
  },

  woodcraft: {
    id: 'woodcraft',
    name: 'Woodcraft',
    description: 'Advanced timbercraft and stewardship of forests, unlocking deeper yields from sacred groves.',
    cost: 10,
    prerequisites: ['forestry'],
    unlocks: {
      benefits: ['Sawmill (Timber Grove)']
    },
    category: 'economic'
  },

  construction: {
    id: 'construction',
    name: 'Construction',
    description: 'Master advanced building methods to raise stronger works and improve resource processing.',
    cost: 15,
    prerequisites: ['organization', 'forestry'],
    unlocks: {
      improvements: ['sawmill'],
    },
    category: 'economic'
  },

  bronze_working: {
    id: 'bronze_working',
    name: 'Bronze Working',
    description: 'As Nephi "did take the sword of Laban" and later taught his people to work metals (2 Nephi 5:15), this knowledge of forging creates stronger weapons and tools for both defense and industry.',
    cost: 12,
    prerequisites: ['hunting', 'organization'],
    unlocks: {
      units: ['spearman'],
      improvements: ['workshop']
    },
    category: 'military'
  },

  sailing: {
    id: 'sailing',
    name: 'Sailing',
    description: 'Following the pattern of Lehi\'s transoceanic voyage guided by the Liahona (1 Nephi 18), this mastery of navigation enables exploration across waters to discover new lands and establish coastal settlements.',
    cost: 8,
    prerequisites: ['hunting'],
    unlocks: {
      units: ['boat'],
      improvements: ['port'],
      structures: ['lighthouse']
    },
    category: 'exploration'
  },

  seafaring: {
    id: 'seafaring',
    name: 'Seafaring',
    description: 'Navigate coasts and waters with confidence, expanding maritime reach and enabling fishing and trade.',
    cost: 12,
    prerequisites: ['sailing'],
    unlocks: {
      benefits: ['Ports +1★/turn']
    },
    category: 'exploration'
  },

  fishing: {
    id: 'fishing',
    name: 'Fishing',
    description: 'Harvest the bounty of the sea through organized fishing practices and coastal infrastructure.',
    cost: 10,
    prerequisites: ['seafaring'],
    unlocks: {
      benefits: ['Fishing Jetty (Fishing Shoal)']
    },
    category: 'economic'
  },

  trade: {
    id: 'trade',
    name: 'Trade',
    description: 'Connect settlements through commerce, increasing prosperity through linked city networks.',
    cost: 15,
    prerequisites: ['organization', 'seafaring'],
    unlocks: {
      units: ['scribe_teacher'],
      benefits: ['Trade Routes', 'Harbor Upgrade (Fishing Jetty)', 'Road Network bonus increased']
    },
    category: 'economic'
  },

  priesthood: {
    id: 'priesthood',
    name: 'Priesthood',
    description: 'As Alma organized priests and teachers "after the manner of the holy order of God" (Alma 13:1), this sacred authority enables missionaries to baptize, heal, and establish the church among all nations.',
    cost: 15,
    prerequisites: ['spirituality'],
    unlocks: {
      units: ['missionary', 'converted_missionary'],
      structures: ['cathedral'],
      abilities: ['conversion', 'divine_protection']
    },
    category: 'religious'
  },

  // Tier 3 - Elite Technologies
  philosophy: {
    id: 'philosophy',
    name: 'Philosophy',
    description: 'Like King Benjamin\'s profound teachings on service and charity (Mosiah 2), this wisdom tradition combines scriptural knowledge with reasoned learning, establishing schools to preserve truth and educate future generations.',
    cost: 20,
    prerequisites: ['priesthood', 'bronze_working'],
    unlocks: {
      structures: ['academy', 'library'],
      abilities: ['enlightenment']
    },
    category: 'religious'
  },

  engineering: {
    id: 'engineering',
    name: 'Engineering',
    description: 'Following the pattern of Nephi who "did build a temple; and I did construct it after the manner of the temple of Solomon" (2 Nephi 5:16), this advanced construction enables magnificent buildings and siege warfare capabilities.',
    cost: 25,
    prerequisites: ['bronze_working', 'agriculture'],
    unlocks: {
      units: ['catapult'],
      improvements: ['aqueduct'],
      structures: ['fortress']
    },
    category: 'military'
  },

  navigation: {
    id: 'navigation',
    name: 'Navigation',
    description: 'Master deeper waters and distant voyages, opening the way to the great creatures and riches of the sea.',
    cost: 25,
    prerequisites: ['seafaring', 'trade'],
    unlocks: {
      benefits: ['Great Sea Beast Expeditions']
    },
    category: 'exploration'
  },

  leadership: {
    id: 'leadership',
    name: 'Leadership',
    description: 'Like Captain Moroni\'s inspiring leadership that united the Nephite armies (Alma 46), this develops military command structures and tactical coordination, enabling elite commanders to rally troops and lead complex formations.',
    cost: 20,
    prerequisites: ['bronze_working', 'organization'],
    unlocks: {
      units: ['commander'],
      benefits: ['Rally Troops (Commander)']
    },
    category: 'military'
  }
};

/**
 * Get all technologies available for research by a player
 */
export function getAvailableTechnologies(researchedTechs: string[]): Technology[] {
  return Object.values(TECHNOLOGIES).filter(tech => {
    // Already researched
    if (researchedTechs.includes(tech.id)) {
      return false;
    }
    
    // Check prerequisites
    return tech.prerequisites.every(prereq => researchedTechs.includes(prereq));
  });
}

/**
 * Calculate research cost (can scale with number of techs researched)
 */
export function calculateResearchCost(tech: Technology, researchedCount: number): number {
  // Use direct scaling factor to avoid circular dependency
  const costScalingFactor = 1.2; // From GAME_RULES.research.costScalingFactor
  return Math.floor(tech.cost * Math.pow(costScalingFactor, researchedCount));
}

/**
 * Check if a technology unlocks specific content
 */
export function doesTechUnlock(techId: string, category: keyof Technology['unlocks'], itemId: string): boolean {
  const tech = TECHNOLOGIES[techId];
  if (!tech || !tech.unlocks[category]) {
    return false;
  }
  
  return tech.unlocks[category]!.includes(itemId);
}

/**
 * Get all items unlocked by researched technologies
 */
export function getUnlockedContent(researchedTechs: string[]): Technology['unlocks'] {
  const unlocked: Technology['unlocks'] = {
    units: [],
    improvements: [],
    structures: [],
    abilities: [],
    benefits: []
  };
  
  researchedTechs.forEach(techId => {
    const tech = TECHNOLOGIES[techId];
    if (tech) {
      if (tech.unlocks.units) unlocked.units!.push(...tech.unlocks.units);
      if (tech.unlocks.improvements) unlocked.improvements!.push(...tech.unlocks.improvements);
      if (tech.unlocks.structures) unlocked.structures!.push(...tech.unlocks.structures);
      if (tech.unlocks.abilities) unlocked.abilities!.push(...tech.unlocks.abilities);
      if (tech.unlocks.benefits) unlocked.benefits!.push(...tech.unlocks.benefits);
    }
  });
  
  return unlocked;
}
