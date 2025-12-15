import { describe, it, expect } from 'vitest';

import { TECHNOLOGIES } from '../../shared/data/technologies';
import { getEffectiveTechCostForPlayer, getTechCostDetails, canPlayerResearchTechnology } from '../../shared/logic/technologyHelpers';
import type { PlayerState } from '../../shared/types/game';

const createPlayer = (overrides: Partial<PlayerState> = {}): PlayerState => ({
  id: 'player-test',
  name: 'Helper Tester',
  factionId: 'NEPHITES',
  isAI: false,
  stars: 100,
  stats: { faith: 25, pride: 15, internalDissent: 5 },
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

describe('technologyHelpers', () => {
  it('scales research cost based on number of researched technologies', () => {
    const player = createPlayer({ researchedTechs: ['organization'] });
    const agriculture = TECHNOLOGIES.agriculture;

    const cost = getEffectiveTechCostForPlayer(agriculture, player);
    expect(cost).toBe(12); // 10 * 1.2

    const veteranPlayer = createPlayer({ researchedTechs: ['organization', 'woodcraft', 'hunting'] });
    const forestry = TECHNOLOGIES.forestry;
    const scaledCost = getEffectiveTechCostForPlayer(forestry, veteranPlayer);
    expect(scaledCost).toBe(Math.floor(forestry.cost * Math.pow(1.2, 3)));
  });

  it('prevents research when prerequisites are missing', () => {
    const player = createPlayer({ researchedTechs: ['organization'] });
    const bronzeWorking = TECHNOLOGIES.bronze_working;

    expect(canPlayerResearchTechnology(player, bronzeWorking)).toBe(false);
  });

  it('prevents research when stars are insufficient', () => {
    const player = createPlayer({
      stars: 5,
      researchedTechs: ['organization', 'hunting', 'mining'],
    });
    const bronzeWorking = TECHNOLOGIES.bronze_working;

    expect(canPlayerResearchTechnology(player, bronzeWorking)).toBe(false);
  });

  it('allows research when requirements are satisfied', () => {
    const player = createPlayer({
      stars: 200,
      researchedTechs: ['organization', 'hunting', 'mining'],
    });
    const bronzeWorking = TECHNOLOGIES.bronze_working;

    expect(canPlayerResearchTechnology(player, bronzeWorking)).toBe(true);
  });

  it('applies research inspiration to reduce final cost', () => {
    const player = createPlayer({ researchedTechs: ['organization'], researchInspiration: 5 });
    const agriculture = TECHNOLOGIES.agriculture;

    const costDetails = getTechCostDetails(agriculture, player);
    expect(costDetails.baseCost).toBe(12);
    expect(costDetails.discount).toBe(5);
    expect(costDetails.finalCost).toBe(7);
  });

  it('caps inspiration discount to keep at least 1 star cost', () => {
    const player = createPlayer({ researchInspiration: 50 });
    const woodcraft = TECHNOLOGIES.woodcraft;

    const costDetails = getTechCostDetails(woodcraft, player);
    expect(costDetails.finalCost).toBe(1);
    expect(costDetails.discount).toBe(costDetails.baseCost - 1);
  });
});
