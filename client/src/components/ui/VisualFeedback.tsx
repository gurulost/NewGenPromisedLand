import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Toast notification types
export type ToastType = 'success' | 'warning' | 'error' | 'reward' | 'combat' | 'info';

export interface GameToast {
    id: string;
    message: string;
    type: ToastType;
    icon?: string;
    duration?: number;
}

interface ToastNotificationProps {
    toast: GameToast;
    onDismiss: (id: string) => void;
}

const toastColors: Record<ToastType, string> = {
    success: 'from-green-600/90 to-green-800/90 border-green-400/50',
    warning: 'from-amber-600/90 to-amber-800/90 border-amber-400/50',
    error: 'from-red-600/90 to-red-800/90 border-red-400/50',
    reward: 'from-amber-500/90 to-yellow-700/90 border-yellow-400/50',
    combat: 'from-red-700/90 to-red-900/90 border-red-500/50',
    info: 'from-blue-600/90 to-blue-800/90 border-blue-400/50',
};

const toastIcons: Record<ToastType, string> = {
    success: '✓',
    warning: '⚠',
    error: '✕',
    reward: '⭐',
    combat: '⚔️',
    info: 'ℹ',
};

function ToastNotification({ toast, onDismiss }: ToastNotificationProps) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss(toast.id);
        }, toast.duration || 3000);

        return () => clearTimeout(timer);
    }, [toast.id, toast.duration, onDismiss]);

    return (
        <motion.div
            initial={{ opacity: 0, x: 100, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.8 }}
            className={`
        flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm
        bg-gradient-to-r ${toastColors[toast.type]}
        shadow-lg shadow-black/30 min-w-[200px] max-w-[350px]
      `}
        >
            <span className="text-2xl">{toast.icon || toastIcons[toast.type]}</span>
            <span className="text-white font-medium text-sm flex-1">{toast.message}</span>
            <button
                onClick={() => onDismiss(toast.id)}
                className="text-white/60 hover:text-white transition-colors"
            >
                ✕
            </button>
        </motion.div>
    );
}

// Screen Flash Component
interface ScreenFlashProps {
    type: 'gold' | 'red' | 'blue' | 'green' | null;
    onComplete: () => void;
}

export function ScreenFlash({ type, onComplete }: ScreenFlashProps) {
    useEffect(() => {
        if (type) {
            const timer = setTimeout(onComplete, 500);
            return () => clearTimeout(timer);
        }
    }, [type, onComplete]);

    if (!type) return null;

    const colors = {
        gold: 'bg-amber-400/30',
        red: 'bg-red-500/30',
        blue: 'bg-blue-400/30',
        green: 'bg-green-400/30',
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={`fixed inset-0 pointer-events-none z-[200] ${colors[type]}`}
        />
    );
}

// Toast Container - manages all toasts
interface ToastContainerProps {
    toasts: GameToast[];
    onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
    return (
        <div className="fixed top-4 right-4 z-[150] flex flex-col gap-2 pointer-events-auto">
            <AnimatePresence mode="popLayout">
                {toasts.map(toast => (
                    <ToastNotification key={toast.id} toast={toast} onDismiss={onDismiss} />
                ))}
            </AnimatePresence>
        </div>
    );
}

// Custom hook for managing toasts
export function useGameToasts() {
    const [toasts, setToasts] = useState<GameToast[]>([]);

    const addToast = useCallback((message: string, type: ToastType, icon?: string, duration?: number) => {
        const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setToasts(prev => [...prev, { id, message, type, icon, duration }]);
        return id;
    }, []);

    const dismissToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const clearAll = useCallback(() => {
        setToasts([]);
    }, []);

    return { toasts, addToast, dismissToast, clearAll };
}

// Visual feedback context for global access
import { createContext, useContext } from 'react';

interface VisualFeedbackContextType {
    showToast: (message: string, type: ToastType, icon?: string, duration?: number) => void;
    triggerFlash: (type: 'gold' | 'red' | 'blue' | 'green') => void;
}

export const VisualFeedbackContext = createContext<VisualFeedbackContextType | null>(null);

export function useVisualFeedback() {
    const context = useContext(VisualFeedbackContext);
    if (!context) {
        // Return no-op functions if not within provider
        return {
            showToast: () => { },
            triggerFlash: () => { },
        };
    }
    return context;
}

export function VisualFeedbackProvider({ children }: { children: React.ReactNode }) {
    const { toasts, addToast, dismissToast } = useGameToasts();
    const [flashType, setFlashType] = useState<'gold' | 'red' | 'blue' | 'green' | null>(null);

    const triggerFlash = useCallback((type: 'gold' | 'red' | 'blue' | 'green') => {
        setFlashType(type);
    }, []);

    return (
        <VisualFeedbackContext.Provider value={{ showToast: addToast, triggerFlash }}>
            {children}
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />
            <ScreenFlash type={flashType} onComplete={() => setFlashType(null)} />
        </VisualFeedbackContext.Provider>
    );
}
