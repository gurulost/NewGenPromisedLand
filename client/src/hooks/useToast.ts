import { useState, useCallback, useEffect, useRef } from 'react';
import { pushCapped, MEMORY_LIMITS } from '../lib/memoryUtils';

// Extended toast types including game-themed variants
export type ToastDataType = 'success' | 'error' | 'warning' | 'info' | 'combat' | 'discovery' | 'faith' | 'pride';

interface ToastData {
  id: string;
  type: ToastDataType;
  title: string;
  message?: string;
  duration?: number;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const timeoutsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeouts.clear();
    };
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
    const timeoutId = timeoutsRef.current.get(id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutsRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback((toast: Omit<ToastData, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { ...toast, id };

    setToasts(prev => pushCapped(prev, newToast, MEMORY_LIMITS.TOAST_MAX_ITEMS));

    // Auto-remove after duration
    if (toast.duration !== 0) {
      const timeoutId = window.setTimeout(() => {
        removeToast(id);
      }, toast.duration || 4000);
      timeoutsRef.current.set(id, timeoutId);
    }

    return id;
  }, [removeToast]);

  const success = useCallback((title: string, message?: string, duration?: number) => {
    return addToast({ type: 'success', title, message, duration });
  }, [addToast]);

  const error = useCallback((title: string, message?: string, duration?: number) => {
    return addToast({ type: 'error', title, message, duration });
  }, [addToast]);

  const warning = useCallback((title: string, message?: string, duration?: number) => {
    return addToast({ type: 'warning', title, message, duration });
  }, [addToast]);

  const info = useCallback((title: string, message?: string, duration?: number) => {
    return addToast({ type: 'info', title, message, duration });
  }, [addToast]);

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };
}
