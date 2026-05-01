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

    expect(pendingSpecs.map(spec => spec.id).sort()).toEqual([]);

    pendingSpecs.forEach(spec => {
      expect(spec.stackingRule).toBe('pending');
      expect(spec.aiUse.rule).toMatch(/^skip_/);
      expect(spec.ui.blocked.toLowerCase()).toContain('not implemented');
    });
  });

  it('keeps implemented active faction ability specs actionable for resolver, UI, and AI coverage', () => {
    const implementedSpecs = Object.values(FACTION_ABILITY_SPECS).filter(spec => spec.status === 'implemented');

    implementedSpecs.forEach(spec => {
      expect(spec.effect.trim(), `${spec.id} needs a concrete effect summary`).not.toHaveLength(0);
      expect(spec.target.rules.trim(), `${spec.id} needs target rules`).not.toHaveLength(0);
      expect(spec.ui.ready.trim(), `${spec.id} needs ready UI text`).not.toHaveLength(0);
      expect(spec.ui.blocked.trim(), `${spec.id} needs blocked UI text`).not.toHaveLength(0);
      expect(spec.aiUse.notes.trim(), `${spec.id} needs AI usage notes`).not.toHaveLength(0);
      expect(spec.aiUse.rule, `${spec.id} must be available to AI when humans can use it`).not.toMatch(/^skip_|manual_only/);
      expect(spec.stackingRule, `${spec.id} must not use pending stacking semantics`).not.toBe('pending');
      expect(spec.cooldown, `${spec.id} cooldown must be explicit`).toBeGreaterThanOrEqual(0);
    });
  });

  it('keeps the implemented active faction ability allowlist deliberate', () => {
    expect([...IMPLEMENTED_ACTIVE_FACTION_ABILITY_IDS].sort()).toEqual([
      'ANCIENT_MIGHT',
      'COVENANT_OF_PEACE',
      'CULTURAL_RECLAMATION',
      'MISSIONARY_ZEAL',
      'RAMEUMPTOM',
      'TITLE_OF_LIBERTY',
      'WARRIOR_RAGE',
      'lamanite_guerrilla_tactics',
    ]);
  });
});
