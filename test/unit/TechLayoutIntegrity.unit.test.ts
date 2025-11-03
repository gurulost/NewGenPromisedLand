import { describe, it, expect } from 'vitest';

import { TECHNOLOGIES } from '../../shared/data/technologies';
import { TECH_LAYOUT } from '../../client/src/components/tech/techLayout';

describe('Tech layout integrity', () => {
  it('defines coordinates for every technology', () => {
    const techIds = Object.keys(TECHNOLOGIES);
    const missing = techIds.filter(id => !TECH_LAYOUT[id]);
    expect(missing).toEqual([]);
  });

  it('does not reference unknown technologies in layout', () => {
    const invalid = Object.keys(TECH_LAYOUT).filter(id => !TECHNOLOGIES[id]);
    expect(invalid).toEqual([]);
  });

  it('keeps rows reasonably spaced within each column', () => {
    const spacingByColumn = new Map<number, number[]>();
    Object.values(TECH_LAYOUT).forEach(entry => {
      const rows = spacingByColumn.get(entry.column) ?? [];
      rows.push(entry.row);
      spacingByColumn.set(entry.column, rows);
    });

    spacingByColumn.forEach(rows => {
      const sorted = rows.sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i += 1) {
        const gap = sorted[i] - sorted[i - 1];
        expect(gap).toBeGreaterThanOrEqual(0.7 - 1e-6);
      }
    });
  });
});
