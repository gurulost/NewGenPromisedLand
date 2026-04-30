import { describe, it, expect } from 'vitest';

import { ABILITIES, getFactionAbilities } from '../../shared/data/abilities';
import {
  FACTION_ABILITY_SPECS,
  IMPLEMENTED_ACTIVE_FACTION_ABILITY_IDS,
  getFactionAbilitySpec,
} from '../../shared/data/factionAbilitySpecs';
import { getAllFactions } from '../../shared/data/factions';

describe('Ability data integrity', () => {
  it('provides canonical definitions and implementation specs for every active faction ability', () => {
    const factions = getAllFactions();
    const activeAbilityIds = new Set<string>();

    factions.forEach(faction => {
      faction.abilities
        .filter(ability => ability.type === 'active')
        .forEach(ability => {
          activeAbilityIds.add(ability.id);
          const canonical = ABILITIES[ability.id];
          expect(canonical, `Missing canonical ability definition for ${ability.id}`).toBeDefined();
          expect(getFactionAbilitySpec(ability.id), `Missing active ability spec for ${ability.id}`).toBeDefined();
        });
    });

    expect(Object.keys(FACTION_ABILITY_SPECS).sort()).toEqual(Array.from(activeAbilityIds).sort());
  });

  it('merges faction ability metadata from canonical definitions', () => {
    const factions = getAllFactions();

    factions.forEach(faction => {
      const factionAbilities = getFactionAbilities(faction.id);

      factionAbilities.forEach(ability => {
        const canonical = ABILITIES[ability.id];
        if (canonical) {
          expect(ability.type).toBe(canonical.type);
          if (canonical.cooldown) {
            expect(ability.cooldown).toBe(canonical.cooldown ?? ability.cooldown);
          }
          if (canonical.requirements) {
            expect(ability.requirements).toMatchObject(canonical.requirements);
          }
        }
      });
    });
  });

  it('keeps pending active faction abilities explicitly unavailable to AI and UI', () => {
    const pendingSpecs = Object.values(FACTION_ABILITY_SPECS).filter(spec => spec.status !== 'implemented');

    expect(pendingSpecs.map(spec => spec.id).sort()).toEqual([
      'ANCIENT_MIGHT',
      'CULTURAL_RECLAMATION',
    ]);

    pendingSpecs.forEach(spec => {
      expect(spec.stackingRule).toBe('pending');
      expect(spec.aiUse.rule).toMatch(/^skip_/);
      expect(spec.ui.blocked.toLowerCase()).toContain('not implemented');
    });
  });

  it('keeps the implemented active faction ability allowlist deliberate', () => {
    expect([...IMPLEMENTED_ACTIVE_FACTION_ABILITY_IDS].sort()).toEqual([
      'COVENANT_OF_PEACE',
      'MISSIONARY_ZEAL',
      'RAMEUMPTOM',
      'TITLE_OF_LIBERTY',
      'WARRIOR_RAGE',
      'lamanite_guerrilla_tactics',
    ]);
  });
});
