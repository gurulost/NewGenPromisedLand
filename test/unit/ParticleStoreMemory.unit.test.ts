import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MEMORY_LIMITS } from '../../client/src/lib/memoryUtils';

describe('Particle store memory bounds', () => {
  let useParticleStore: any;

  beforeEach(async () => {
    vi.resetModules();
    vi.unmock('zustand');
    ({ useParticleStore } = await import('../../client/src/components/effects/ParticleEffects'));
    useParticleStore.setState({ events: [] });
  });

  it('caps particle events', () => {
    for (let i = 0; i < MEMORY_LIMITS.PARTICLE_MAX_EVENTS + 50; i++) {
      useParticleStore.getState().addEvent('combat', { q: i, r: 0 });
    }
    expect(useParticleStore.getState().events.length).toBeLessThanOrEqual(MEMORY_LIMITS.PARTICLE_MAX_EVENTS);
  });

  it('cleans up by TTL', () => {
    const now = vi.spyOn(Date, 'now');
    const t0 = new Date('2025-01-01T00:00:00.000Z').getTime();
    now.mockReturnValue(t0);

    useParticleStore.getState().addEvent('faith', { q: 0, r: 0 });
    expect(useParticleStore.getState().events.length).toBe(1);

    now.mockReturnValue(t0 + MEMORY_LIMITS.PARTICLE_TTL_MS + 1);
    useParticleStore.getState().cleanupStale();
    expect(useParticleStore.getState().events.length).toBe(0);

    now.mockRestore();
  });
});
