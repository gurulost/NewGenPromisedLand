import React, { createContext, useContext } from 'react';
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

const MAX_TOASTS = 4;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toasts, removeToast, success, error, warning, info, addToast } = useToast();

  // Game-themed toast methods
  const combat = (title: string, message?: string) =>
    addToast({ type: 'combat' as ToastType, title, message, duration: 3000 });
  const discovery = (title: string, message?: string) =>
    addToast({ type: 'discovery' as ToastType, title, message, duration: 4000 });
  const faith = (title: string, message?: string) =>
    addToast({ type: 'faith' as ToastType, title, message, duration: 3500 });
  const pride = (title: string, message?: string) =>
    addToast({ type: 'pride' as ToastType, title, message, duration: 3500 });

  // Limit visible toasts
  const visibleToasts = toasts.slice(-MAX_TOASTS);

  return (
    <ToastContext.Provider value={{ success, error, warning, info, combat, discovery, faith, pride, removeToast }}>
      {children}

      {/* Toast Container - Bottom right, less obtrusive during gameplay */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
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
  if (!context) {
    throw new Error('useToastContext must be used within a ToastProvider');
  }
  return context;
}