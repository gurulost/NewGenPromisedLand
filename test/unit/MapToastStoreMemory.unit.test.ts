import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MEMORY_LIMITS } from '../../client/src/lib/memoryUtils';

describe('Map toast store memory bounds', () => {
  let useMapToastStore: any;

  beforeEach(async () => {
    vi.resetModules();
    vi.unmock('zustand');
    ({ useMapToastStore } = await import('../../client/src/lib/stores/useMapToasts'));
    useMapToastStore.setState({ toasts: [] });
  });

  it('caps map toasts', () => {
    for (let i = 0; i < MEMORY_LIMITS.MAP_TOAST_MAX_ITEMS + 50; i++) {
      useMapToastStore.getState().addToast(`toast ${i}`, 'reward', { x: 0, y: 0, z: 0 });
    }
    expect(useMapToastStore.getState().toasts.length).toBeLessThanOrEqual(MEMORY_LIMITS.MAP_TOAST_MAX_ITEMS);
  });

  it('cleans up by TTL', () => {
    const now = vi.spyOn(Date, 'now');
    const t0 = new Date('2025-01-01T00:00:00.000Z').getTime();
    now.mockReturnValue(t0);

    useMapToastStore.getState().addToast('hello', 'reward', { x: 0, y: 0, z: 0 });
    expect(useMapToastStore.getState().toasts.length).toBe(1);

    now.mockReturnValue(t0 + MEMORY_LIMITS.MAP_TOAST_TTL_MS + 1);
    useMapToastStore.getState().cleanupStale();
    expect(useMapToastStore.getState().toasts.length).toBe(0);

    now.mockRestore();
  });
});
