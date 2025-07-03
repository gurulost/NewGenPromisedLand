import { describe, it, expect } from 'vitest';
import { GAME_RULES, GameRuleHelpers } from './gameRules';
import type { PlayerState } from '../types/game';

describe('GameRules', () => {
  it('should have all required sections defined', () => {
    expect(GAME_RULES.victory).toBeDefined();
    expect(GAME_RULES.resources).toBeDefined();
    expect(GAME_RULES.units).toBeDefined();
    expect(GAME_RULES.research).toBeDefined();
    expect(GAME_RULES.cities).toBeDefined();
    expect(GAME_RULES.capture).toBeDefined();
    expect(GAME_RULES.terrain).toBeDefined();
    expect(GAME_RULES.turns).toBeDefined();
    expect(GAME_RULES.abilities).toBeDefined();
    expect(GAME_RULES.combat).toBeDefined();
  });

  it('should have reasonable victory thresholds', () => {
    expect(GAME_RULES.victory.faithThreshold).toBeGreaterThan(0);
    expect(GAME_RULES.victory.territoryControlThreshold).toBeGreaterThan(0);
    expect(GAME_RULES.victory.territoryControlThreshold).toBeLessThanOrEqual(100);
  });

  it('should have positive resource generation values', () => {
    expect(GAME_RULES.resources.baseStarsPerTurn).toBeGreaterThan(0);
    expect(GAME_RULES.resources.starsPerCity).toBeGreaterThan(0);
    expect(GAME_RULES.resources.faithPerCity).toBeGreaterThan(0);
    expect(GAME_RULES.resources.faithPerTemple).toBeGreaterThan(0);
  });

  it('should have valid unit stats', () => {
    expect(GAME_RULES.units.defaultVisionRadius).toBeGreaterThan(0);
    expect(GAME_RULES.units.defaultMovementSpeed).toBeGreaterThan(0);
    expect(GAME_RULES.units.maxUnitsPerCity).toBeGreaterThan(0);
    expect(GAME_RULES.units.healingAmount).toBeGreaterThan(0);
    expect(GAME_RULES.units.upgradeBaseCost).toBeGreaterThan(0);
  });

  it('should have terrain movement costs defined', () => {
    expect(GAME_RULES.terrain.movementCosts.plains).toBeDefined();
    expect(GAME_RULES.terrain.movementCosts.mountain).toBeDefined();
    expect(GAME_RULES.terrain.movementCosts.water).toBeDefined();
    expect(GAME_RULES.terrain.movementCosts.desert).toBeDefined();
    expect(GAME_RULES.terrain.movementCosts.swamp).toBeDefined();
  });

  it('should have ability configuration values', () => {
    expect(GAME_RULES.abilities.healRadius).toBeGreaterThan(0);
    expect(GAME_RULES.abilities.pacifyRadius).toBeGreaterThan(0);
    expect(GAME_RULES.abilities.tradeRadius).toBeGreaterThan(0);
    expect(GAME_RULES.abilities.conversionRadius).toBeGreaterThan(0);
    expect(GAME_RULES.abilities.visionRevealRadius).toBeGreaterThan(0);
  });

  it('should have reasonable attack bonuses', () => {
    expect(GAME_RULES.abilities.attackBonuses.righteousCharge).toBeGreaterThan(0);
    expect(GAME_RULES.abilities.attackBonuses.ancestralRage).toBeGreaterThan(0);
    expect(GAME_RULES.abilities.attackBonuses.guerrillaBonus).toBeGreaterThan(0);
  });

  it('should have resource costs for abilities', () => {
    expect(GAME_RULES.abilities.resourceCosts.faithHealing).toBeGreaterThan(0);
    expect(GAME_RULES.abilities.resourceCosts.conversion).toBeGreaterThan(0);
    expect(GAME_RULES.abilities.resourceCosts.towerVision).toBeGreaterThan(0);
  });
});

describe('GameRuleHelpers', () => {
  const mockPlayer: PlayerState = {
    id: 'player1',
    name: 'Test Player',
    factionId: 'nephites',
    isEliminated: false,
    stats: {
      faith: 50,
      pride: 30,
      internalDissent: 20
    },
    stars: 100,
    researchedTechs: [],
    turnOrder: 0,
    visibilityMask: [],
    researchProgress: 0,
    citiesOwned: []
  };

  it('should calculate star income correctly', () => {
    const income = GameRuleHelpers.calculateStarIncome(3); // 3 cities
    const expectedIncome = GAME_RULES.resources.baseStarsPerTurn + (3 * GAME_RULES.resources.starsPerCity);
    expect(income).toBe(expectedIncome);
  });

  it('should check faith victory correctly', () => {
    expect(GameRuleHelpers.hasFaithVictory(95)).toBe(true);
    expect(GameRuleHelpers.hasFaithVictory(30)).toBe(false);
  });

  it('should check territorial victory correctly', () => {
    const totalCities = 10;
    const playerCities = 8; // 80% control
    
    expect(GameRuleHelpers.hasTerritorialVictory(playerCities, totalCities)).toBe(true);
    
    const fewCities = 3; // 30% control
    expect(GameRuleHelpers.hasTerritorialVictory(fewCities, totalCities)).toBe(false);
  });

  it('should calculate research cost with scaling', () => {
    const baseCost = GameRuleHelpers.calculateResearchCost(GAME_RULES.research.baseTechCost, 0); // First tech
    const scaledCost = GameRuleHelpers.calculateResearchCost(GAME_RULES.research.baseTechCost, 3); // Fourth tech
    
    expect(baseCost).toBe(GAME_RULES.research.baseTechCost);
    expect(scaledCost).toBeGreaterThan(baseCost);
  });

  it('should return correct movement cost for terrain', () => {
    expect(GameRuleHelpers.getMovementCost('plains')).toBe(GAME_RULES.terrain.movementCosts.plains);
    expect(GameRuleHelpers.getMovementCost('mountain')).toBe(GAME_RULES.terrain.movementCosts.mountain);
    expect(GameRuleHelpers.getMovementCost('water')).toBe(GAME_RULES.terrain.movementCosts.water);
  });

  it('should identify passable terrain correctly', () => {
    expect(GameRuleHelpers.isTerrainPassable('plains')).toBe(true);
    expect(GameRuleHelpers.isTerrainPassable('mountain')).toBe(true);
    
    // Water should be impassable according to current rules
    expect(GameRuleHelpers.isTerrainPassable('water')).toBe(false);
  });

  it('should return defense bonus for terrain', () => {
    expect(GameRuleHelpers.getDefenseBonus('mountain')).toBe(GAME_RULES.terrain.defenseBonus.mountain);
    expect(GameRuleHelpers.getDefenseBonus('plains')).toBe(GAME_RULES.terrain.defenseBonus.plains);
  });
});