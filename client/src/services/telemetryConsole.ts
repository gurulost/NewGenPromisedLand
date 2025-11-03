import type { TelemetryEvent } from '@shared/logic/telemetry';
import { subscribeTelemetry } from '@shared/logic/telemetry';

declare global {
  interface Window {
    __telemetryEvents?: TelemetryEvent[];
  }
}

let initialized = false;

export const initTelemetryConsole = () => {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  const buffer: TelemetryEvent[] = [];
  const limit = 200;

  subscribeTelemetry(event => {
    buffer.unshift(event);
    if (buffer.length > limit) {
      buffer.pop();
    }
    window.__telemetryEvents = [...buffer];
  });
};
