import { describe, it, expect } from 'vitest';
import { UNIT_DEFINITIONS, getUnitDefinition, getUnitsForFaction } from './units';

describe('Unit Definitions', () => {
  it('should have all unit types defined', () => {
    const unitTypes = ['warrior', 'stripling_warrior', 'royal_envoy', 'missionary', 'guard', 'scout', 'worker', 'commander'];
    
    unitTypes.forEach(type => {
      expect(UNIT_DEFINITIONS[type]).toBeDefined();
    });
  });

  it('should have complete unit stats', () => {
    Object.values(UNIT_DEFINITIONS).forEach(unit => {
      expect(unit.name).toBeDefined();
      expect(unit.description).toBeDefined();
      expect(unit.cost).toBeGreaterThan(0);
      expect(unit.hp).toBeGreaterThan(0);
      expect(unit.attack).toBeGreaterThan(0);
      expect(unit.defense).toBeGreaterThan(0);
      expect(unit.movement).toBeGreaterThan(0);
      expect(unit.visionRadius).toBeGreaterThan(0);
      expect(unit.attackRange).toBeGreaterThan(0);
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
    const nephiteUnits = getUnitsForFaction('nephites');
    const lamaniteUnits = getUnitsForFaction('lamanites');
    
    expect(nephiteUnits.length).toBeGreaterThan(0);
    expect(lamaniteUnits.length).toBeGreaterThan(0);
    
    // Each faction should have specific units
    nephiteUnits.forEach(unit => {
      expect(unit.availableToFactions).toContain('nephites');
    });
    
    lamaniteUnits.forEach(unit => {
      expect(unit.availableToFactions).toContain('lamanites');
    });
  });

  it('should have reasonable stat ranges', () => {
    Object.values(UNIT_DEFINITIONS).forEach(unit => {
      // HP should be reasonable (between 1 and 50)
      expect(unit.hp).toBeGreaterThanOrEqual(1);
      expect(unit.hp).toBeLessThanOrEqual(50);
      
      // Attack and defense should be reasonable
      expect(unit.attack).toBeGreaterThanOrEqual(1);
      expect(unit.attack).toBeLessThanOrEqual(20);
      expect(unit.defense).toBeGreaterThanOrEqual(1);
      expect(unit.defense).toBeLessThanOrEqual(20);
      
      // Movement should be between 1 and 5
      expect(unit.movement).toBeGreaterThanOrEqual(1);
      expect(unit.movement).toBeLessThanOrEqual(5);
    });
  });

  it('should have proper tech requirements structure', () => {
    Object.values(UNIT_DEFINITIONS).forEach(unit => {
      if (unit.techRequirements && unit.techRequirements.length > 0) {
        unit.techRequirements.forEach(tech => {
          expect(typeof tech).toBe('string');
          expect(tech.length).toBeGreaterThan(0);
        });
      }
    });
  });
});