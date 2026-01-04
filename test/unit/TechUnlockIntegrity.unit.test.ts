import { describe, it, expect } from 'vitest';

import { TECHNOLOGIES } from '../../shared/data/technologies';
import { ABILITIES } from '../../shared/data/abilities';

describe('Tech unlock integrity', () => {
  it('lists only valid ability ids in tech unlocks', () => {
    const abilityIds = new Set(Object.keys(ABILITIES));
    const invalid: Array<{ techId: string; abilityId: string }> = [];

    Object.values(TECHNOLOGIES).forEach((tech) => {
      (tech.unlocks.abilities || []).forEach((abilityId) => {
        if (!abilityIds.has(abilityId)) {
          invalid.push({ techId: tech.id, abilityId });
        }
      });
    });

    expect(invalid).toEqual([]);
  });

  it('keeps benefits distinct from ability ids', () => {
    const abilityIds = new Set(Object.keys(ABILITIES));
    const conflicts: Array<{ techId: string; benefit: string }> = [];

    Object.values(TECHNOLOGIES).forEach((tech) => {
      (tech.unlocks.benefits || []).forEach((benefit) => {
        if (abilityIds.has(benefit)) {
          conflicts.push({ techId: tech.id, benefit });
        }
      });
    });

    expect(conflicts).toEqual([]);
  });
});
