import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { GAME_RULES } from '@shared/data/gameRules';

const readDoc = () => {
  const docPath = path.resolve(__dirname, '../../docs/PLAYER_REFERENCE.md');
  return fs.readFileSync(docPath, 'utf8');
};

describe('Rules parity (docs vs logic)', () => {
  it('keeps Missionary heal values in sync with PLAYER_REFERENCE', () => {
    const doc = readDoc();
    const healMatch = doc.match(/Heal nearby allies \(radius (\d+)\): costs (\d+) Faith, restores up to (\d+) HP/i);
    expect(healMatch, 'Heal rule not found in PLAYER_REFERENCE').not.toBeNull();

    const radius = Number(healMatch?.[1]);
    const cost = Number(healMatch?.[2]);
    const amount = Number(healMatch?.[3]);

    expect(radius).toBe(GAME_RULES.abilities.healRadius);
    expect(cost).toBe(GAME_RULES.abilities.resourceCosts.missionaryHeal);
    expect(amount).toBe(GAME_RULES.units.healingAmount);
  });

  it('keeps Missionary unit conversion values in sync with PLAYER_REFERENCE', () => {
    const doc = readDoc();
    const convertMatch = doc.match(/Convert enemy unit \(range (\d+)\): costs (\d+) Faith/i);
    expect(convertMatch, 'Conversion rule not found in PLAYER_REFERENCE').not.toBeNull();

    const radius = Number(convertMatch?.[1]);
    const cost = Number(convertMatch?.[2]);

    expect(radius).toBe(GAME_RULES.abilities.conversionRadius);
    expect(cost).toBe(GAME_RULES.conversion.costs.unit);
  });
});
