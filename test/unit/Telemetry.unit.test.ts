import { describe, it, expect } from 'vitest';

import { emitTelemetry, subscribeTelemetry, TelemetryEvent } from '../../shared/logic/telemetry';

describe('Telemetry helpers', () => {
  it('notifies subscribers with enriched payload', () => {
    const events: TelemetryEvent[] = [];
    const unsubscribe = subscribeTelemetry(event => events.push(event));

    emitTelemetry({
      channel: 'ability',
      status: 'blocked',
      abilityId: 'TEST',
      playerId: 'player1',
      reason: 'requirements',
      metadata: { unmet: ['faith:10/20'] },
    });

    unsubscribe();

    expect(events).toHaveLength(1);
    const [event] = events;
    expect(event.timestamp).toBeTruthy();
    expect(event.channel).toBe('ability');
    expect(event.reason).toBe('requirements');
    expect(event.metadata?.unmet).toEqual(['faith:10/20']);
  });

  it('supports technology channel events', () => {
    const events: TelemetryEvent[] = [];
    const unsubscribe = subscribeTelemetry(event => events.push(event));

    emitTelemetry({
      channel: 'technology',
      status: 'success',
      playerId: 'player-1',
      technologyId: 'navigation',
      metadata: { cost: 42 },
    });

    unsubscribe();

    expect(events).toHaveLength(1);
    const [event] = events;
    expect(event.channel).toBe('technology');
    expect(event.technologyId).toBe('navigation');
    expect(event.metadata?.cost).toBe(42);
  });
});
