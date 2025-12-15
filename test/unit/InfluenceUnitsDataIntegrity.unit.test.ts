import { describe, it, expect } from 'vitest';
import { UNIT_DEFINITIONS } from '../../shared/data/units';
import { TECHNOLOGIES } from '../../shared/data/technologies';

describe('Influence units SSOT data integrity', () => {
  it('defines each unit with correct faction lock + tech + requirements', () => {
    expect(UNIT_DEFINITIONS.priestcraft_preacher.factionSpecific).toContain('ZORAMITES');
    expect(UNIT_DEFINITIONS.priestcraft_preacher.requiredTechnology).toBe('spirituality');

    expect(UNIT_DEFINITIONS.converted_missionary.factionSpecific).toContain('LAMANITES');
    expect(UNIT_DEFINITIONS.converted_missionary.requiredTechnology).toBe('priesthood');
    expect(UNIT_DEFINITIONS.converted_missionary.requirements?.faith).toBeGreaterThanOrEqual(40);

    expect(UNIT_DEFINITIONS.scribe_teacher.factionSpecific).toContain('MULEKITES');
    expect(UNIT_DEFINITIONS.scribe_teacher.requiredTechnology).toBe('trade');

    expect(UNIT_DEFINITIONS.prophet.factionSpecific).toContain('JAREDITES');
    expect(UNIT_DEFINITIONS.prophet.requiredTechnology).toBe('spirituality');

    // Explicitly ensure none of these have convert/heal abilities unless intended.
    expect(UNIT_DEFINITIONS.priestcraft_preacher.abilities).not.toContain('convert');
    expect(UNIT_DEFINITIONS.scribe_teacher.abilities).not.toContain('convert');
    expect(UNIT_DEFINITIONS.prophet.abilities).not.toContain('convert');
  });

  it('lists units in the correct tech unlocks (tech tree SSOT)', () => {
    expect(TECHNOLOGIES.spirituality.unlocks.units).toEqual(
      expect.arrayContaining(['priestcraft_preacher', 'prophet'])
    );
    expect(TECHNOLOGIES.priesthood.unlocks.units).toEqual(
      expect.arrayContaining(['missionary', 'converted_missionary'])
    );
    expect(TECHNOLOGIES.trade.unlocks.units).toEqual(
      expect.arrayContaining(['scribe_teacher'])
    );
  });
});

