import { describe, it, expect } from 'vitest';
import { FACTIONS, getFaction, getAllFactions } from './factions';

describe('Factions', () => {
  it('should have all six factions defined', () => {
    const allFactions = getAllFactions();
    expect(allFactions).toHaveLength(6);
    
    const expectedFactionIds = ['nephites', 'lamanites', 'mulekites', 'anti-nephi-lehies', 'zoramites', 'jaredites'];
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
      expect(faction.startingUnits).toBeInstanceOf(Array);
      expect(faction.bonuses).toBeDefined();
    });
  });

  it('should retrieve individual factions correctly', () => {
    const nephites = getFaction('nephites');
    expect(nephites.name).toBe('Nephites');
    expect(nephites.id).toBe('nephites');
    
    const lamanites = getFaction('lamanites');
    expect(lamanites.name).toBe('Lamanites');
    expect(lamanites.id).toBe('lamanites');
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
      faction.abilities.forEach(abilityId => {
        expect(typeof abilityId).toBe('string');
        expect(abilityId.length).toBeGreaterThan(0);
      });
    });
  });

  it('should have starting units defined', () => {
    const allFactions = getAllFactions();
    
    allFactions.forEach(faction => {
      expect(faction.startingUnits.length).toBeGreaterThan(0);
      faction.startingUnits.forEach(unitType => {
        expect(typeof unitType).toBe('string');
        expect(unitType.length).toBeGreaterThan(0);
      });
    });
  });

  it('should have faction bonuses with proper structure', () => {
    const allFactions = getAllFactions();
    
    allFactions.forEach(faction => {
      if (faction.bonuses.stats) {
        const statsBonuses = faction.bonuses.stats;
        if (statsBonuses.faith !== undefined) {
          expect(typeof statsBonuses.faith).toBe('number');
        }
        if (statsBonuses.pride !== undefined) {
          expect(typeof statsBonuses.pride).toBe('number');
        }
        if (statsBonuses.internalDissent !== undefined) {
          expect(typeof statsBonuses.internalDissent).toBe('number');
        }
      }
    });
  });
});