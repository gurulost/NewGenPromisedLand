import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  executeAIPlayerTurn: vi.fn(),
  shouldExecuteAITurn: vi.fn(),
  useLocalGame: vi.fn(),
}));

vi.mock('../../lib/stores/useLocalGame', () => ({
  useLocalGame: mocks.useLocalGame,
}));

vi.mock('@shared/ai/aiTurnManager', () => ({
  AITurnManager: class MockAITurnManager {
    static shouldExecuteAITurn(...args: unknown[]) {
      return mocks.shouldExecuteAITurn(...args);
    }

    executeAIPlayerTurn(...args: unknown[]) {
      return mocks.executeAIPlayerTurn(...args);
    }
  },
}));

import { useAITurn } from '../useAITurn';

const makeGameState = (turn: number) => ({
  turn,
  currentPlayerIndex: 0,
  players: [
    {
      id: 'ai-player',
      name: 'AI Player',
      factionId: 'NEPHITES',
      isAI: true,
    },
  ],
});

describe('useAITurn', () => {
  let storeState: any;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.clearAllMocks();

    storeState = {
      gameState: makeGameState(1),
      dispatch: vi.fn(),
      onlineSession: null,
      gameMode: 'standard',
    };

    mocks.useLocalGame.mockImplementation((selector?: (state: any) => unknown) =>
      selector ? selector(storeState) : storeState
    );
    mocks.shouldExecuteAITurn.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not re-enter while an AI turn is already executing across gameState updates', async () => {
    let finishExecution: (() => void) | undefined;
    mocks.executeAIPlayerTurn.mockImplementation(() =>
      new Promise<void>(resolve => {
        finishExecution = resolve;
      })
    );

    const { rerender } = renderHook(() => useAITurn());

    await act(async () => {
      vi.advanceTimersByTime(1500);
      await Promise.resolve();
    });

    expect(mocks.executeAIPlayerTurn).toHaveBeenCalledTimes(1);

    storeState = {
      ...storeState,
      gameState: makeGameState(2),
    };
    rerender();

    await act(async () => {
      vi.advanceTimersByTime(1500);
      await Promise.resolve();
    });

    expect(mocks.executeAIPlayerTurn).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishExecution?.();
      await Promise.resolve();
    });
  });
});
