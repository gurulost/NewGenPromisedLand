import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useToast } from '../../hooks/useToast';
import { Toast, ToastType } from './FeedbackComponents';

interface ToastContextType {
  success: (title: string, message?: string, duration?: number) => string;
  error: (title: string, message?: string, duration?: number) => string;
  warning: (title: string, message?: string, duration?: number) => string;
  info: (title: string, message?: string, duration?: number) => string;
  // Game-themed methods
  combat: (title: string, message?: string) => string;
  discovery: (title: string, message?: string) => string;
  faith: (title: string, message?: string) => string;
  pride: (title: string, message?: string) => string;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);
const noopToast = () => '';
const noopRemoveToast = () => {};
const FALLBACK_TOAST_CONTEXT: ToastContextType = {
  success: noopToast,
  error: noopToast,
  warning: noopToast,
  info: noopToast,
  combat: noopToast,
  discovery: noopToast,
  faith: noopToast,
  pride: noopToast,
  removeToast: noopRemoveToast,
};

declare global {
  interface Window {
    __ngplToastContext?: ToastContextType;
  }
}

const MAX_TOASTS = 4;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toasts, removeToast, success, error, warning, info, addToast } = useToast();

  // Game-themed toast methods
  const combat = useCallback((title: string, message?: string) =>
    addToast({ type: 'combat' as ToastType, title, message, duration: 3000 }), [addToast]);
  const discovery = useCallback((title: string, message?: string) =>
    addToast({ type: 'discovery' as ToastType, title, message, duration: 4000 }), [addToast]);
  const faith = useCallback((title: string, message?: string) =>
    addToast({ type: 'faith' as ToastType, title, message, duration: 3500 }), [addToast]);
  const pride = useCallback((title: string, message?: string) =>
    addToast({ type: 'pride' as ToastType, title, message, duration: 3500 }), [addToast]);
  const contextValue = useMemo<ToastContextType>(
    () => ({ success, error, warning, info, combat, discovery, faith, pride, removeToast }),
    [success, error, warning, info, combat, discovery, faith, pride, removeToast]
  );

  // Limit visible toasts
  const visibleToasts = toasts.slice(-MAX_TOASTS);

  useEffect(() => {
    window.__ngplToastContext = contextValue;
    return () => {
      if (window.__ngplToastContext === contextValue) {
        delete window.__ngplToastContext;
      }
    };
  }, [contextValue]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      {/* Toast Container - Bottom right, less obtrusive during gameplay */}
      <div className="fixed bottom-4 right-4 z-[var(--z-toast)] space-y-2 max-w-sm">
        <AnimatePresence mode="popLayout">
          {visibleToasts.map((toast) => (
            <Toast
              key={toast.id}
              type={toast.type as ToastType}
              title={toast.title}
              message={toast.message}
              duration={toast.duration}
              onClose={() => removeToast(toast.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToastContext() {
  const context = useContext(ToastContext);
  if (context) {
    return context;
  }

  return (typeof window !== 'undefined' ? window.__ngplToastContext : undefined) ?? FALLBACK_TOAST_CONTEXT;
}
