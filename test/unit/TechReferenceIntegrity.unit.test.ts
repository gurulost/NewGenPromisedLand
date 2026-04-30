import { describe, it, expect } from 'vitest';

import { TECHNOLOGIES } from '../../shared/data/technologies';
import { NEW_TECHNOLOGIES, getAllTechnologies } from '../../shared/data/newTechnologies';
import { IMPROVEMENT_DEFINITIONS, STRUCTURE_DEFINITIONS } from '../../shared/types/city';
import { UNIT_DEFINITIONS } from '../../shared/data/units';
import { WORLD_ELEMENTS } from '../../shared/data/worldElements';

describe('Tech reference integrity', () => {
  it('includes every tech referenced by game content', () => {
    const techIds = new Set(Object.keys(TECHNOLOGIES));
    const referenced = new Set<string>();

    Object.values(IMPROVEMENT_DEFINITIONS).forEach(def => referenced.add(def.requiredTech));
    Object.values(STRUCTURE_DEFINITIONS).forEach(def => referenced.add(def.requiredTech));
    Object.values(UNIT_DEFINITIONS).forEach(def => {
      if (def.requiredTechnology) referenced.add(def.requiredTechnology);
    });

    Object.values(WORLD_ELEMENTS).forEach(element => {
      if (element.techPrerequisite) referenced.add(element.techPrerequisite);
      if (element.longTermBuild?.upgrade?.techRequired) referenced.add(element.longTermBuild.upgrade.techRequired);
    });

    const missing = Array.from(referenced).filter(id => !techIds.has(id)).sort();
    expect(missing).toEqual([]);
  });

  it('keeps legacy newTechnologies exports aligned to canonical tech definitions', () => {
    expect(getAllTechnologies()).toBe(TECHNOLOGIES);

    Object.entries(NEW_TECHNOLOGIES).forEach(([techId, tech]) => {
      expect(tech).toBe(TECHNOLOGIES[techId]);
    });
  });
});
