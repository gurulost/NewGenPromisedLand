import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { TurnTransition, getTurnTransitionTimings } from '../../client/src/components/ui/TurnTransition';
import type { PlayerState } from '../../shared/types/game';

const mockPlayer: PlayerState = {
  id: 'p1',
  name: 'Test Player',
  factionId: 'NEPHITES',
  stars: 10,
  stats: { faith: 5, pride: 2, internalDissent: 1 },
  modifiers: [],
  researchedTechs: [],
  researchProgress: 0,
  citiesOwned: [],
  constructionQueue: [],
  visibilityMask: [],
  exploredTiles: [],
  isEliminated: false,
  turnOrder: 0,
};

describe('getTurnTransitionTimings', () => {
  it('clamps duration and keeps phase delays ordered', () => {
    const timings = getTurnTransitionTimings(300);

    expect(timings.totalDuration).toBeGreaterThanOrEqual(1000);
    expect(timings.displayDelay).toBeGreaterThanOrEqual(200);
    expect(timings.displayDelay).toBeLessThanOrEqual(800);
    expect(timings.exitDelay).toBeGreaterThan(timings.displayDelay);
    expect(timings.exitDelay).toBeLessThanOrEqual(timings.totalDuration);
  });
});

describe('TurnTransition lifecycle', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resets to enter phase when reopened after reaching exit phase', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const onComplete = vi.fn();
    const { container, rerender } = render(
      <TurnTransition isVisible currentPlayer={mockPlayer} onComplete={onComplete} duration={1200} />,
    );

    const getOverlayRoot = () => container.querySelector('div.fixed.inset-0') as HTMLElement | null;

    expect(getOverlayRoot()).toHaveAttribute('data-transition-phase', 'enter');
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(getOverlayRoot()).toHaveAttribute('data-transition-phase', 'exit');

    rerender(
      <TurnTransition isVisible={false} currentPlayer={mockPlayer} onComplete={onComplete} duration={1200} />,
    );
    expect(getOverlayRoot()).not.toBeInTheDocument();

    rerender(
      <TurnTransition isVisible currentPlayer={mockPlayer} onComplete={onComplete} duration={1200} />,
    );
    expect(getOverlayRoot()).toHaveAttribute('data-transition-phase', 'enter');
  });

  it('invokes onComplete using clamped total duration', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const onComplete = vi.fn();

    render(<TurnTransition isVisible currentPlayer={mockPlayer} onComplete={onComplete} duration={200} />);

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('does not restart completion timer when onComplete prop identity changes', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const firstOnComplete = vi.fn();
    const secondOnComplete = vi.fn();

    const { rerender } = render(
      <TurnTransition isVisible currentPlayer={mockPlayer} onComplete={firstOnComplete} duration={1200} />,
    );

    act(() => {
      vi.advanceTimersByTime(400);
    });

    rerender(
      <TurnTransition isVisible currentPlayer={mockPlayer} onComplete={secondOnComplete} duration={1200} />,
    );

    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(firstOnComplete).not.toHaveBeenCalled();
    expect(secondOnComplete).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(secondOnComplete).toHaveBeenCalledTimes(1);
  });
});
