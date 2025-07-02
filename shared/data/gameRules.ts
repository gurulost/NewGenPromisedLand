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

  // Turn Management
  turns: {
    maxTurnsPerGame: number;
    turnTimeLimit: number; // seconds, -1 for unlimited
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

  turns: {
    maxTurnsPerGame: 200,
    turnTimeLimit: -1, // Unlimited for turn-based
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
};