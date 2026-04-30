import { describe, expect, it } from 'vitest';

import { AITurnManager } from '@shared/ai/aiTurnManager';
import type { AIDecision } from '@shared/ai/aiEngine';
import type { GameAction, GameState, PlayerState } from '@shared/types/game';

describe('AITurnManager', () => {
  it('preserves builderUnitId when translating worker construction decisions', () => {
    const manager = new AITurnManager({} as GameState, () => {});
    const decision: AIDecision = {
      type: 'START_CONSTRUCTION',
      cityId: 'city-1',
      buildingType: 'farm',
      builderUnitId: 'worker-1',
      constructionCategory: 'improvements',
      targetCoordinate: { q: 1, r: 0, s: -1 },
      priority: 100,
    };

    const action = (
      manager as unknown as {
        translateDecisionToAction(decision: AIDecision, player: PlayerState): GameAction | null;
      }
    ).translateDecisionToAction(decision, { id: 'ai-player' } as PlayerState);

    expect(action).toMatchObject({
      type: 'START_CONSTRUCTION',
      payload: {
        playerId: 'ai-player',
        cityId: 'city-1',
        buildingType: 'farm',
        category: 'improvements',
        builderUnitId: 'worker-1',
        coordinate: { q: 1, r: 0, s: -1 },
      },
    });
  });
});
