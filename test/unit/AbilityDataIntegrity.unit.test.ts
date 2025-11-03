import { describe, it, expect } from 'vitest';

import { ABILITIES, getFactionAbilities } from '../../shared/data/abilities';
import { getAllFactions } from '../../shared/data/factions';

describe('Ability data integrity', () => {
  it('provides canonical definitions for every active faction ability', () => {
    const factions = getAllFactions();

    factions.forEach(faction => {
      faction.abilities
        .filter(ability => ability.type === 'active')
        .forEach(ability => {
          const canonical = ABILITIES[ability.id];
          expect(canonical, `Missing canonical ability definition for ${ability.id}`).toBeDefined();
        });
    });
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
});
