import { GameRuleHelpers } from './gameRules';

export interface Technology {
  id: string;
  name: string;
  description: string;
  cost: number;
  prerequisites: string[];
  unlocks: {
    units?: string[];
    improvements?: string[];
    structures?: string[];
    abilities?: string[];
  };
  category: 'military' | 'economic' | 'religious' | 'exploration';
  aiGuidance?: {
    priority: number;
    minFaith: number;
    recommendedCities: number;
  };
}

export const TECHNOLOGIES: Record<string, Technology> = {
  // Tier 1 - Foundational Technologies
  organization: {
    id: 'organization',
    name: 'Organization',
    description: 'Like Nephi organizing his people into "rulers and teachers" (2 Nephi 5:19), this establishes basic civic structure for resource management and settlement construction, enabling the growth of a righteous society.',
    cost: 5,
    prerequisites: [],
    unlocks: {
      improvements: ['farm'],
      units: ['worker']
    },
    category: 'economic',
    aiGuidance: { priority: 90, minFaith: 100, recommendedCities: 1 },

  },

  woodcraft: {
    id: 'woodcraft',
    name: 'Woodcraft',
    description: 'Following Nephi\'s example of crafting with timber in the wilderness (1 Nephi 17:10), this teaches basic lumber harvesting and carpentry for early settlements.',
    cost: 6,
    prerequisites: [],
    unlocks: {
      improvements: ['lumber_hut']
    },
    category: 'economic',
    aiGuidance: { priority: 90, minFaith: 100, recommendedCities: 1 },

  },

  mining: {
    id: 'mining',
    name: 'Mining',
    description: 'As Nephi taught his people to work in ore (2 Nephi 5:15), this unlocks the knowledge to extract metals and precious stones from the earth.',
    cost: 7,
    prerequisites: ['organization'],
    unlocks: {
      improvements: ['mine']
    },
    category: 'economic',
    aiGuidance: { priority: 75, minFaith: 160, recommendedCities: 2 },

  },

  forestry: {
    id: 'forestry',
    name: 'Forestry',
    description: 'Following Nephi\'s example of constructing ships from timber (1 Nephi 18:1), this knowledge of forest management enables lumber harvesting and timber processing for construction and economic growth.',
    cost: 9,
    prerequisites: ['woodcraft'],
    unlocks: {
      improvements: ['sawmill'],
      abilities: ['clear_forest']
    },
    category: 'economic',
    aiGuidance: { priority: 75, minFaith: 160, recommendedCities: 2 },

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
    category: 'military',
    aiGuidance: { priority: 90, minFaith: 100, recommendedCities: 1 },

  },

  seafaring: {
    id: 'seafaring',
    name: 'Seafaring',
    description: 'Guided by the Liahona, Lehi\'s family learned to traverse the seas (1 Nephi 18). This technology grants the skills needed to navigate coastal waters and harvest their resources.',
    cost: 6,
    prerequisites: ['hunting'],
    unlocks: {
      abilities: ['coastal_fishing']
    },
    category: 'exploration',
    aiGuidance: { priority: 75, minFaith: 160, recommendedCities: 2 },

  },

  spirituality: {
    id: 'spirituality',
    name: 'Spirituality',
    description: 'As Lehi taught his family to "pray unto the Lord" (1 Nephi 2:16), this foundational faith practice strengthens the people through divine guidance, blessings, and protection from the adversary.',
    cost: 5,
    prerequisites: [],
    unlocks: {
      structures: ['temple'],
      abilities: ['blessing']
    },
    category: 'religious',
    aiGuidance: { priority: 90, minFaith: 100, recommendedCities: 1 },

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
      structures: ['granary']
    },
    category: 'economic',
    aiGuidance: { priority: 75, minFaith: 160, recommendedCities: 2 },

  },

  husbandry: {
    id: 'husbandry',
    name: 'Husbandry',
    description: 'Mosiah recorded the domestication of flocks and herds among the Nephites (Mosiah 2:3). This knowledge allows sustainable ranching of wild animals.',
    cost: 11,
    prerequisites: ['agriculture'],
    unlocks: {},
    category: 'economic',
    aiGuidance: { priority: 60, minFaith: 220, recommendedCities: 4 },

  },

  irrigation: {
    id: 'irrigation',
    name: 'Irrigation',
    description: 'Like the people of King Noah who built water works and towers (Mosiah 11:8), this introduces advanced water management to multiply harvests.',
    cost: 13,
    prerequisites: ['agriculture'],
    unlocks: {
      improvements: ['irrigation']
    },
    category: 'economic',
    aiGuidance: { priority: 60, minFaith: 220, recommendedCities: 4 },

  },

  bronze_working: {
    id: 'bronze_working',
    name: 'Bronze Working',
    description: 'As Nephi "did take the sword of Laban" and later taught his people to work metals (2 Nephi 5:15), this knowledge of forging creates stronger weapons and tools for both defense and industry.',
    cost: 12,
    prerequisites: ['hunting', 'mining'],
    unlocks: {
      units: ['spearman'],
      improvements: ['workshop']
    },
    category: 'military',
    aiGuidance: { priority: 60, minFaith: 220, recommendedCities: 4 },

  },

  sailing: {
    id: 'sailing',
    name: 'Sailing',
    description: 'Following the pattern of Lehi\'s transoceanic voyage guided by the Liahona (1 Nephi 18), this mastery of navigation enables exploration across waters to discover new lands and establish coastal settlements.',
    cost: 10,
    prerequisites: ['seafaring'],
    unlocks: {
      units: ['boat'],
      improvements: ['port'],
      structures: ['lighthouse']
    },
    category: 'exploration',
    aiGuidance: { priority: 60, minFaith: 220, recommendedCities: 4 },

  },

  priesthood: {
    id: 'priesthood',
    name: 'Priesthood',
    description: 'As Alma organized priests and teachers "after the manner of the holy order of God" (Alma 13:1), this sacred authority enables missionaries to baptize, heal, and establish the church among all nations.',
    cost: 15,
    prerequisites: ['spirituality'],
    unlocks: {
      units: ['missionary'],
      structures: ['cathedral'],
      abilities: ['conversion', 'divine_protection']
    },
    category: 'religious',
    aiGuidance: { priority: 75, minFaith: 160, recommendedCities: 2 },

  },

  trade: {
    id: 'trade',
    name: 'Trade',
    description: 'The Mulekites and Nephites prospered by exchanging goods across lands (Helaman 6:8). Establish trade practices to connect distant settlements.',
    cost: 14,
    prerequisites: ['seafaring'],
    unlocks: {},
    category: 'economic',
    aiGuidance: { priority: 60, minFaith: 220, recommendedCities: 4 },

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
    category: 'religious',
    aiGuidance: { priority: 45, minFaith: 280, recommendedCities: 6 },

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
    category: 'military',
    aiGuidance: { priority: 45, minFaith: 280, recommendedCities: 6 },

  },

  navigation: {
    id: 'navigation',
    name: 'Navigation',
    description: 'The Jaredite barges and Nephite vessels relied on divine guidance and skill to cross the great waters (Ether 6; 1 Nephi 18). This refines deep-water navigation and exploration.',
    cost: 20,
    prerequisites: ['sailing', 'trade'],
    unlocks: {},
    category: 'exploration',
    aiGuidance: { priority: 45, minFaith: 280, recommendedCities: 6 },

  },

  leadership: {
    id: 'leadership',
    name: 'Leadership',
    description: 'Like Captain Moroni\'s inspiring leadership that united the Nephite armies (Alma 46), this develops military command structures and tactical coordination, enabling elite commanders to rally troops and lead complex formations.',
    cost: 20,
    prerequisites: ['bronze_working', 'organization'],
    unlocks: {
      units: ['commander'],
      abilities: ['rally_troops', 'tactical_command']
    },
    category: 'military',
    aiGuidance: { priority: 45, minFaith: 280, recommendedCities: 6 },

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
  return GameRuleHelpers.calculateResearchCost(tech.cost, researchedCount);
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
    abilities: []
  };
  
  researchedTechs.forEach(techId => {
    const tech = TECHNOLOGIES[techId];
    if (tech) {
      if (tech.unlocks.units) unlocked.units!.push(...tech.unlocks.units);
      if (tech.unlocks.improvements) unlocked.improvements!.push(...tech.unlocks.improvements);
      if (tech.unlocks.structures) unlocked.structures!.push(...tech.unlocks.structures);
      if (tech.unlocks.abilities) unlocked.abilities!.push(...tech.unlocks.abilities);
    }
  });
  
  return unlocked;
}
