import { useEffect, useRef, useState } from 'react';
import type { TelemetryEvent } from '@shared/logic/telemetry';
import {
  clearTelemetryHistory,
  exportTelemetryHistory,
  getTelemetryHistory,
  onTelemetryHistoryChange,
} from '../services/telemetryStore';

export const useTelemetryLog = (limit = 50) => {
  const [events, setEvents] = useState<TelemetryEvent[]>(() => {
    const history = getTelemetryHistory();
    return history.slice(0, limit);
  });
  const limitRef = useRef(limit);

  useEffect(() => {
    limitRef.current = limit;
  }, [limit]);

  useEffect(() => {
    const unsubscribe = onTelemetryHistoryChange(history => {
      setEvents(history.slice(0, limitRef.current));
    });
    return () => unsubscribe();
  }, []);

  const clear = () => {
    clearTelemetryHistory();
  };

  const exportLog = () => {
    exportTelemetryHistory();
  };

  return { events, clear, exportLog };
};
