/**
 * Centralized game rules and configuration values
 * This file contains all global game parameters that can be tweaked for balance
 */

export interface GameRules {
  // Victory Conditions
  victory: {
    faithThreshold: number;
    territoryControlThreshold: number; // Percentage of cities needed for territorial victory
    eliminationRequired: boolean;
  };

  // Resource Generation
  resources: {
    baseStarsPerTurn: number;
    starsPerCity: number;
    faithPerCity: number;
    faithPerTemple: number;
  };

  // Unit Properties
  units: {
    defaultVisionRadius: number;
    defaultMovementSpeed: number;
    maxUnitsPerCity: number;
    healingAmount: number;
    upgradeBaseCost: number;
    maxAttackRange: number;
  };

  // Research System
  research: {
    baseTechCost: number;
    costScalingFactor: number; // Multiplier for each additional tech researched
  };

  // City Management
  cities: {
    basePopulation: number;
    maxPopulation: number;
    growthRate: number;
    baseProduction: number;
  };

  // City Capture Rules
  capture: {
    destroyAllStructures: boolean;
    transferStructures: boolean;
    destroyImprovements: boolean;
    transferImprovements: boolean;
  };

  // Terrain Rules
  terrain: {
    movementCosts: Record<string, number>;
    impassableTypes: string[];
    defenseBonus: Record<string, number>;
  };

  // Turn Management
  turns: {
    maxTurnsPerGame: number;
    turnTimeLimit: number; // seconds, -1 for unlimited
  };

  // Ability Configuration
  abilities: {
    defaultCooldown: number;
    healRadius: number;
    pacifyRadius: number;
    tradeRadius: number;
    conversionRadius: number;
    visionRevealRadius: number;
    attackBonuses: {
      righteousCharge: number;
      ancestralRage: number;
      guerrillaBonus: number;
    };
    resourceCosts: {
      faithHealing: number;
      conversion: number;
      towerVision: number;
      ancientKnowledge: number;
      prideBoost: number;
      declareWar: number;
      formAlliance: number;
      titleOfLiberty: number;
      covenantOfPeace: number;
      divineProtection: number;
      enlightenment: number;
      divineWard: number;
    };
    conversionResistance: {
      baseDifficulty: number;
      faithDifferentialWeight: number;
      maxSuccessChance: number;
      minSuccessChance: number;
    };
  };

  // Combat Configuration
  combat: {
    defaultAttackRange: number;
    damageReduction: number;
    fortificationBonus: number;
    terrainDefenseMultiplier: number;
  };
}

export const GAME_RULES: GameRules = {
  victory: {
    faithThreshold: 90,
    territoryControlThreshold: 0.8, // 80% of cities
    eliminationRequired: true,
  },

  resources: {
    baseStarsPerTurn: 1,
    starsPerCity: 2,
    faithPerCity: 2,
    faithPerTemple: 5,
  },

  units: {
    defaultVisionRadius: 2,
    defaultMovementSpeed: 3,
    maxUnitsPerCity: 4,
    healingAmount: 3,
    upgradeBaseCost: 15,
    maxAttackRange: 1,
  },

  research: {
    baseTechCost: 5,
    costScalingFactor: 1.2,
  },

  cities: {
    basePopulation: 100,
    maxPopulation: 1000,
    growthRate: 0.05, // 5% per turn
    baseProduction: 3,
  },

  capture: {
    destroyAllStructures: true,  // Aggressive capture rule
    transferStructures: false,
    destroyImprovements: false,  // Keep improvements when capturing
    transferImprovements: true,
  },

  terrain: {
    movementCosts: {
      'plains': 1,
      'forest': 2,
      'mountain': 3, // Passable but expensive
      'water': 99,   // Effectively impassable
      'desert': 2,
      'swamp': 3,
    },
    impassableTypes: ['water'],
    defenseBonus: {
      'plains': 0,
      'forest': 1,
      'mountain': 3,
      'water': 0,
      'desert': 0,
      'swamp': 1,
    },
  },

  turns: {
    maxTurnsPerGame: 200,
    turnTimeLimit: -1, // Unlimited for turn-based
  },

  abilities: {
    defaultCooldown: 5,
    healRadius: 2,
    pacifyRadius: 3,
    tradeRadius: 4,
    conversionRadius: 2,
    visionRevealRadius: 5,
    attackBonuses: {
      righteousCharge: 4,
      ancestralRage: 2,
      guerrillaBonus: 3,
    },
    resourceCosts: {
      faithHealing: 10,
      conversion: 20,
      towerVision: 15,
      ancientKnowledge: 25,
      prideBoost: 5,
      declareWar: 15,
      formAlliance: 10,
      titleOfLiberty: 30, // High cost for powerful faction ability
      covenantOfPeace: 15, // Faith cost per conversion attempt
      divineProtection: 20, // Faith cost for damage reduction
      enlightenment: 50, // Very high cost for free technology
      divineWard: 10, // Moderate cost for status immunity
    },
    conversionResistance: {
      baseDifficulty: 50, // Base 50% success chance
      faithDifferentialWeight: 5, // Each point of faith difference adds/subtracts 5%
      maxSuccessChance: 90, // Cap at 90% success
      minSuccessChance: 10, // Minimum 10% chance even with massive faith disadvantage
    },
  },

  combat: {
    defaultAttackRange: 1,
    damageReduction: 0.8,
    fortificationBonus: 2,
    terrainDefenseMultiplier: 1.5,
  },
};

/**
 * Helper functions for common rule calculations
 */
export const GameRuleHelpers = {
  /**
   * Calculate faith generation for a player based on their cities and structures
   */
  calculateFaithGeneration: (cityCount: number, templeCount: number = 0): number => {
    return (cityCount * GAME_RULES.resources.faithPerCity) + 
           (templeCount * GAME_RULES.resources.faithPerTemple);
  },

  /**
   * Calculate star income for a player based on their cities
   */
  calculateStarIncome: (cityCount: number): number => {
    return GAME_RULES.resources.baseStarsPerTurn + 
           (cityCount * GAME_RULES.resources.starsPerCity);
  },

  /**
   * Check if player has achieved faith victory
   */
  hasFaithVictory: (faith: number): boolean => {
    return faith >= GAME_RULES.victory.faithThreshold;
  },

  /**
   * Check if player has achieved territorial victory
   */
  hasTerritorialVictory: (playerCities: number, totalCities: number): boolean => {
    return (playerCities / totalCities) >= GAME_RULES.victory.territoryControlThreshold;
  },

  /**
   * Calculate research cost with scaling
   */
  calculateResearchCost: (baseCost: number, researchedCount: number): number => {
    return Math.floor(baseCost * Math.pow(GAME_RULES.research.costScalingFactor, researchedCount));
  },

  /**
   * Get movement cost for terrain type
   */
  getMovementCost: (terrain: string): number => {
    return GAME_RULES.terrain.movementCosts[terrain] || 1;
  },

  /**
   * Check if terrain is passable
   */
  isTerrainPassable: (terrain: string): boolean => {
    return !GAME_RULES.terrain.impassableTypes.includes(terrain);
  },

  /**
   * Get defense bonus for terrain
   */
  getDefenseBonus: (terrain: string): number => {
    return GAME_RULES.terrain.defenseBonus[terrain] || 0;
  },
};