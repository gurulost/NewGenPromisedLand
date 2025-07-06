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
      improvements: ['farm', 'mine'],
      units: ['worker']
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
      units: ['scout'],
      improvements: ['forest_camp']
    },
    category: 'military'
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
      improvements: ['irrigation', 'plantation'],
      structures: ['granary']
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