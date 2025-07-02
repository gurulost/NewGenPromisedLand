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
    description: 'Basic civic structure enabling resource management and construction',
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
    description: 'Basic survival and combat techniques',
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
    description: 'Foundation of faith and religious practice',
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
    description: 'Advanced farming techniques for greater food production',
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
    description: 'Metal forging for better weapons and tools',
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
    description: 'Ocean navigation and coastal development',
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
    description: 'Organized religious hierarchy and advanced spiritual practices',
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
    description: 'Advanced learning and wisdom traditions',
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
    description: 'Advanced construction and siege warfare',
    cost: 25,
    prerequisites: ['bronze_working', 'agriculture'],
    unlocks: {
      units: ['catapult'],
      improvements: ['aqueduct'],
      structures: ['fortress']
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