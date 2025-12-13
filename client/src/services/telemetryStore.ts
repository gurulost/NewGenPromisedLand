import type { TelemetryEvent } from '@shared/logic/telemetry';
import { subscribeTelemetry } from '@shared/logic/telemetry';

interface TelemetryHistory {
  sessionId: string;
  startedAt: string;
  events: TelemetryEvent[];
}

const STORAGE_KEY = 'cpl-telemetry-history-v1';
const MAX_EVENTS = 500;

type HistoryListener = (events: TelemetryEvent[]) => void;

const listeners = new Set<HistoryListener>();
let initialized = false;
let history: TelemetryHistory | null = null;

const notify = () => {
  if (!history) return;
  const snapshot = [...history.events];
  listeners.forEach(listener => {
    try {
      listener(snapshot);
    } catch (error) {
      if ((import.meta as any).env?.DEV) {
        console.error('[telemetryStore] listener error', error);
      }
    }
  });
};

const persist = () => {
  if (typeof window === 'undefined' || !history) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (error) {
    if ((import.meta as any).env?.DEV) {
      console.warn('[telemetryStore] persist failed', error);
    }
  }
};

const ensureHistory = () => {
  if (history) return;
  const now = new Date().toISOString();

  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as TelemetryHistory;
        if (parsed?.events && Array.isArray(parsed.events)) {
          history = {
            sessionId: parsed.sessionId || `telemetry-${Date.now()}`,
            startedAt: parsed.startedAt || now,
            events: parsed.events,
          };
          return;
        }
      }
    } catch (error) {
      if ((import.meta as any).env?.DEV) {
        console.warn('[telemetryStore] failed to parse stored history', error);
      }
    }
  }

  history = {
    sessionId: `telemetry-${Date.now()}`,
    startedAt: now,
    events: [],
  };
};

const recordEvent = (event: TelemetryEvent) => {
  ensureHistory();
  if (!history) return;

  history.events.unshift(event);
  if (history.events.length > MAX_EVENTS) {
    history.events.length = MAX_EVENTS;
  }
  persist();
  notify();
};

export const initTelemetryStore = () => {
  if (initialized || typeof window === 'undefined') return;
  ensureHistory();
  subscribeTelemetry(recordEvent);
  initialized = true;
};

export const getTelemetryHistory = (): TelemetryEvent[] => {
  ensureHistory();
  return history ? [...history.events] : [];
};

export const clearTelemetryHistory = () => {
  ensureHistory();
  if (!history) return;
  history.events = [];
  persist();
  notify();
};

export const exportTelemetryHistory = () => {
  ensureHistory();
  if (!history || typeof window === 'undefined') return;

  const payload = JSON.stringify(history, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `telemetry-${history.sessionId}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const onTelemetryHistoryChange = (listener: HistoryListener): (() => void) => {
  ensureHistory();
  listeners.add(listener);
  return () => listeners.delete(listener);
};
