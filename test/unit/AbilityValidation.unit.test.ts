import { describe, it, expect } from 'vitest';

import { validateAbilityForPlayer } from '../../client/src/utils/abilityValidation';
import { ABILITIES } from '../../shared/data/abilities';
import type { PlayerState } from '../../shared/types/game';

const basePlayer = (overrides: Partial<PlayerState> = {}): PlayerState => ({
  id: 'player1',
  name: 'Tester',
  factionId: 'NEPHITES',
  isAI: false,
  aiDifficulty: undefined,
  stars: 10,
  stats: { faith: 50, pride: 30, internalDissent: 10 },
  modifiers: [],
  abilityCooldowns: {},
  researchedTechs: [],
  researchInspiration: 0,
  citiesOwned: [],
  constructionQueue: [],
  visibilityMask: [],
  exploredTiles: [],
  isEliminated: false,
  turnOrder: 0,
  ...overrides,
});

describe('Ability validation helper', () => {
  it('reports missing ability definition', () => {
    const player = basePlayer();
    const result = validateAbilityForPlayer(undefined, 'UNKNOWN', player);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('missing');
  });

  it('honours cooldown state', () => {
    const player = basePlayer({
      abilityCooldowns: { TITLE_OF_LIBERTY: 2 },
    });
    const ability = ABILITIES.TITLE_OF_LIBERTY;
    const result = validateAbilityForPlayer(ability, 'TITLE_OF_LIBERTY', player);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('cooldown');
    expect(result.cooldownRemaining).toBe(2);
  });

  it('flags unmet requirements', () => {
    const player = basePlayer({
      stats: { faith: 20, pride: 10, internalDissent: 5 },
    });
    const ability = ABILITIES.TITLE_OF_LIBERTY;
    const result = validateAbilityForPlayer(ability, 'TITLE_OF_LIBERTY', player);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('requirements');
    expect(result.unmetRequirements).toContain('faith:20/70');
  });

  it('approves when requirements met and no cooldown', () => {
    const player = basePlayer({
      stats: { faith: 80, pride: 40, internalDissent: 5 },
    });
    const ability = ABILITIES.TITLE_OF_LIBERTY;
    const result = validateAbilityForPlayer(ability, 'TITLE_OF_LIBERTY', player);
    expect(result.ok).toBe(true);
  });
});
