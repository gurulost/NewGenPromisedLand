import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { UNIT_DEFINITIONS } from '@shared/data/units';

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const readPlayerReference = () => {
  const docPath = path.resolve(__dirname, '../../docs/PLAYER_REFERENCE.md');
  return fs.readFileSync(docPath, 'utf8');
};

describe('Player Reference unit coverage', () => {
  it('lists every current unit definition in the Units section', () => {
    const doc = readPlayerReference();

    Object.values(UNIT_DEFINITIONS).forEach((unit) => {
      expect(doc).toMatch(new RegExp(`^#### ${escapeRegExp(unit.name)}(?:\\s|$|\\()`, 'm'));
    });
  });
});
