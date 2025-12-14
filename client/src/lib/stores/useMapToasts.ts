import { create } from 'zustand';

// Toast types - duplicated here to avoid circular imports
export type MapToastType = 'stars' | 'faith' | 'pride' | 'dissent' | 'tech' | 'unit' | 'damage' | 'heal';

export interface MapToast {
    id: string;
    message: string;
    type: MapToastType;
    position: { x: number; y: number; z: number };
    duration?: number;
}

interface MapToastState {
    toasts: MapToast[];
    addToast: (message: string, type: MapToastType, worldPosition: { x: number; y: number; z: number }, duration?: number) => string;
    removeToast: (id: string) => void;
    clearAll: () => void;
}

export const useMapToastStore = create<MapToastState>((set) => ({
    toasts: [],

    addToast: (message, type, worldPosition, duration = 2000) => {
        const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newToast: MapToast = {
            id,
            message,
            type,
            position: worldPosition,
            duration,
        };
        set(state => ({ toasts: [...state.toasts, newToast] }));
        return id;
    },

    removeToast: (id) => {
        set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    },

    clearAll: () => {
        set({ toasts: [] });
    },
}));

// Helper to convert hex coordinates to world position
export function hexToWorldPos(q: number, r: number, hexSize: number = 1): { x: number; y: number; z: number } {
    const x = hexSize * (3 / 2 * q);
    const z = hexSize * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
    return { x, y: 0.5, z };
}
