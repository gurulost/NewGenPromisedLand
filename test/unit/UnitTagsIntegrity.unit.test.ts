import { describe, it, expect } from 'vitest';
import { UNIT_DEFINITIONS } from '../../shared/data/units';

describe('Unit tags integrity (drift guardrails)', () => {
  it('defaults tags to an array for all unit definitions', () => {
    for (const def of Object.values(UNIT_DEFINITIONS)) {
      expect(Array.isArray(def.tags)).toBe(true);
    }
  });

  it('tags known non-military units so targeting rules stay stable', () => {
    expect(UNIT_DEFINITIONS.worker.tags).toEqual(expect.arrayContaining(['civilian']));
    expect(UNIT_DEFINITIONS.missionary.tags).toEqual(expect.arrayContaining(['civilian', 'influence']));
    expect(UNIT_DEFINITIONS.royal_envoy.tags).toEqual(expect.arrayContaining(['civilian', 'diplomat']));

    expect(UNIT_DEFINITIONS.priestcraft_preacher.tags).toEqual(expect.arrayContaining(['civilian', 'influence']));
    expect(UNIT_DEFINITIONS.converted_missionary.tags).toEqual(expect.arrayContaining(['civilian', 'influence']));
    expect(UNIT_DEFINITIONS.scribe_teacher.tags).toEqual(expect.arrayContaining(['civilian', 'influence']));
    expect(UNIT_DEFINITIONS.prophet.tags).toEqual(expect.arrayContaining(['civilian', 'influence']));
  });
});

