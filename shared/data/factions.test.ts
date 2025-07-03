import { describe, it, expect } from 'vitest';
import { FACTIONS, getFaction, getAllFactions } from './factions';

describe('Factions', () => {
  it('should have all six factions defined', () => {
    const allFactions = getAllFactions();
    expect(allFactions).toHaveLength(6);
    
    const expectedFactionIds = ['NEPHITES', 'LAMANITES', 'MULEKITES', 'ANTI_NEPHI_LEHIES', 'ZORAMITES', 'JAREDITES'];
    expectedFactionIds.forEach(id => {
      expect(FACTIONS[id]).toBeDefined();
    });
  });

  it('should have complete faction data', () => {
    const allFactions = getAllFactions();
    
    allFactions.forEach(faction => {
      expect(faction.id).toBeDefined();
      expect(faction.name).toBeDefined();
      expect(faction.description).toBeDefined();
      expect(faction.color).toBeDefined();
      expect(faction.abilities).toBeInstanceOf(Array);
      expect(faction.uniqueUnits).toBeInstanceOf(Array);
      expect(faction.startingStats).toBeDefined();
      expect(faction.playstyle).toBeDefined();
      expect(faction.strengths).toBeInstanceOf(Array);
      expect(faction.weaknesses).toBeInstanceOf(Array);
    });
  });

  it('should retrieve individual factions correctly', () => {
    const nephites = getFaction('NEPHITES');
    expect(nephites.name).toBe('Nephites');
    expect(nephites.id).toBe('NEPHITES');
    
    const lamanites = getFaction('LAMANITES');
    expect(lamanites.name).toBe('Lamanites');
    expect(lamanites.id).toBe('LAMANITES');
  });

  it('should have unique colors for each faction', () => {
    const allFactions = getAllFactions();
    const colors = allFactions.map(f => f.color);
    const uniqueColors = new Set(colors);
    
    expect(uniqueColors.size).toBe(allFactions.length);
  });

  it('should have valid faction abilities', () => {
    const allFactions = getAllFactions();
    
    allFactions.forEach(faction => {
      faction.abilities.forEach(ability => {
        expect(ability.id).toBeDefined();
        expect(ability.name).toBeDefined();
        expect(ability.description).toBeDefined();
        expect(['active', 'passive', 'triggered']).toContain(ability.type);
      });
    });
  });

  it('should have starting units defined', () => {
    const allFactions = getAllFactions();
    
    allFactions.forEach(faction => {
      expect(faction.uniqueUnits.length).toBeGreaterThan(0);
      faction.uniqueUnits.forEach(unitType => {
        expect(typeof unitType).toBe('string');
        expect(unitType.length).toBeGreaterThan(0);
      });
    });
  });

  it('should have faction bonuses with proper structure', () => {
    const allFactions = getAllFactions();
    
    allFactions.forEach(faction => {
      expect(faction.startingStats).toBeDefined();
      expect(typeof faction.startingStats.faith).toBe('number');
      expect(typeof faction.startingStats.pride).toBe('number');
      expect(typeof faction.startingStats.internalDissent).toBe('number');
    });
  });
});