type TelemetryChannel = 'ability' | 'combat' | 'system' | 'technology';
type TelemetryStatus = 'success' | 'blocked' | 'error' | 'info';

export interface TelemetryEvent {
  channel: TelemetryChannel;
  status: TelemetryStatus;
  abilityId?: string;
  playerId?: string;
  attackerId?: string;
  defenderId?: string;
  technologyId?: string;
  reason?: string;
  damage?: number;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

type TelemetryListener = (event: TelemetryEvent) => void;

const listeners = new Set<TelemetryListener>();

export const subscribeTelemetry = (listener: TelemetryListener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const emitTelemetry = (
  event: Omit<TelemetryEvent, 'timestamp'>
): TelemetryEvent => {
  const enriched: TelemetryEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };

  listeners.forEach(listener => {
    try {
      listener(enriched);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[telemetry] listener error', error);
      }
    }
  });

  if (process.env.NEWGEN_TELEMETRY_DEBUG === 'true') {
    const scope = `[telemetry:${enriched.channel}:${enriched.status}]`;
    console.debug(scope, enriched);
  }

  return enriched;
};
