import { describe, it, expect } from 'vitest';
import { UNIT_DEFINITIONS, getFactionSpecificUnitTypes, getUnitDefinition, getUnitsForFaction } from './units';
import { FactionIdSchema } from '../types/faction';
import { UnitTypeSchema } from '../types/unit';

describe('Unit Definitions', () => {
  it('should have all unit types defined from schema', () => {
    const unitTypes = UnitTypeSchema.options;

    unitTypes.forEach((type) => {
      expect(UNIT_DEFINITIONS[type]).toBeDefined();
    });

    expect(Object.keys(UNIT_DEFINITIONS)).toHaveLength(unitTypes.length);
  });

  it('should have complete unit stats', () => {
    Object.values(UNIT_DEFINITIONS).forEach(unit => {
      expect(unit.name).toBeDefined();
      expect(unit.description).toBeDefined();
      expect(unit.cost).toBeGreaterThan(0);
      expect(unit.baseStats.hp).toBeGreaterThan(0);
      expect(unit.baseStats.attack).toBeGreaterThan(0);
      expect(unit.baseStats.defense).toBeGreaterThan(0);
      expect(unit.baseStats.movement).toBeGreaterThan(0);
      expect(unit.baseStats.visionRadius).toBeGreaterThan(0);
      expect(unit.baseStats.attackRange).toBeGreaterThan(0);
    });
  });

  it('should retrieve unit definitions correctly', () => {
    const warrior = getUnitDefinition('warrior');
    expect(warrior.name).toBe('Warrior');
    expect(warrior.type).toBe('warrior');
    
    const missionary = getUnitDefinition('missionary');
    expect(missionary.name).toBe('Missionary');
    expect(missionary.type).toBe('missionary');
  });

  it('should have valid abilities arrays', () => {
    Object.values(UNIT_DEFINITIONS).forEach(unit => {
      expect(Array.isArray(unit.abilities)).toBe(true);
      unit.abilities.forEach(ability => {
        expect(typeof ability).toBe('string');
      });
    });
  });

  it('should have appropriate costs for different unit types', () => {
    const worker = getUnitDefinition('worker');
    const commander = getUnitDefinition('commander');
    
    // Commander should cost more than worker
    expect(commander.cost).toBeGreaterThan(worker.cost);
  });

  it('should filter units by faction correctly', () => {
    const nephiteUnits = getUnitsForFaction('NEPHITES');
    const lamaniteUnits = getUnitsForFaction('LAMANITES');
    
    expect(nephiteUnits.length).toBeGreaterThan(0);
    expect(lamaniteUnits.length).toBeGreaterThan(0);
    
    // Check that we get common units + faction-specific units
    const nephiteSpecificUnits = nephiteUnits.filter(unit => 
      unit.factionSpecific.length > 0 && unit.factionSpecific.includes('NEPHITES')
    );
    const lamaniteSpecificUnits = lamaniteUnits.filter(unit => 
      unit.factionSpecific.length > 0 && unit.factionSpecific.includes('LAMANITES')
    );
    
    // Each faction should have at least some faction-specific units
    expect(nephiteSpecificUnits.length).toBeGreaterThan(0);
    expect(lamaniteSpecificUnits.length).toBeGreaterThan(0);
    
    // Verify common units are included for all factions
    const commonUnits = nephiteUnits.filter(unit => unit.factionSpecific.length === 0);
    expect(commonUnits.length).toBeGreaterThan(0);
  });

  it('should expose faction-specific unit types consistent with unit definitions', () => {
    FactionIdSchema.options.forEach((factionId) => {
      const expected = UnitTypeSchema.options.filter((unitType) =>
        UNIT_DEFINITIONS[unitType].factionSpecific.includes(factionId)
      );

      expect(getFactionSpecificUnitTypes(factionId)).toEqual(expected);
    });
  });

  it('should have reasonable stat ranges', () => {
    Object.values(UNIT_DEFINITIONS).forEach(unit => {
      // HP should be reasonable (between 1 and 50)
      expect(unit.baseStats.hp).toBeGreaterThanOrEqual(1);
      expect(unit.baseStats.hp).toBeLessThanOrEqual(50);
      
      // Attack and defense should be reasonable
      expect(unit.baseStats.attack).toBeGreaterThanOrEqual(1);
      expect(unit.baseStats.attack).toBeLessThanOrEqual(20);
      expect(unit.baseStats.defense).toBeGreaterThanOrEqual(1);
      expect(unit.baseStats.defense).toBeLessThanOrEqual(20);
      
      // Movement should be between 1 and 5
      expect(unit.baseStats.movement).toBeGreaterThanOrEqual(1);
      expect(unit.baseStats.movement).toBeLessThanOrEqual(5);
    });
  });

  it('should have proper tech requirements structure', () => {
    Object.values(UNIT_DEFINITIONS).forEach(unit => {
      if (unit.requirements && Object.keys(unit.requirements).length > 0) {
        // Check requirements structure (faith, pride, dissent, techs)
        if (unit.requirements.faith !== undefined) {
          expect(typeof unit.requirements.faith).toBe('number');
        }
      }
    });
  });
});
