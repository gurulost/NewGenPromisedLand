import { useMemo } from 'react';
import { useReducedMotion } from './useReducedMotion';

export type PerformanceMode = 'high' | 'low' | 'reduced-motion';

/**
 * Extends Navigator interface for device capability APIs
 * These are available in most modern browsers but not in TypeScript's lib.dom
 */
interface NavigatorExtended extends Navigator {
    deviceMemory?: number; // RAM in GB (Chrome/Edge)
    connection?: {
        saveData?: boolean;
        effectiveType?: string;
    };
}

/**
 * Detects device hardware capabilities and returns appropriate performance mode.
 * 
 * Detection signals:
 * - navigator.deviceMemory: RAM in GB (≤2 GB = low)
 * - navigator.hardwareConcurrency: CPU cores (≤2 = low)
 * - prefers-reduced-motion: User accessibility preference
 * 
 * Defaults to 'high' if detection fails (assume modern device).
 */
export function usePerformanceMode(): PerformanceMode {
    const reducedMotion = useReducedMotion();

    return useMemo(() => {
        // Reduced motion takes priority (accessibility)
        if (reducedMotion) {
            return 'reduced-motion';
        }

        const nav = navigator as NavigatorExtended;

        // Check device memory (RAM)
        // Values: 0.25, 0.5, 1, 2, 4, 8 GB (rounded to nearest power of 2)
        const lowMemory = nav.deviceMemory !== undefined && nav.deviceMemory <= 2;

        // Check CPU cores
        const lowCores = navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency <= 2;

        // Check if user has data saver enabled (suggests limited device/connection)
        const saveData = nav.connection?.saveData === true;

        // Determine mode
        if (lowMemory || lowCores || saveData) {
            return 'low';
        }

        return 'high';
    }, [reducedMotion]);
}

/**
 * Returns true if heavy visual effects should be disabled.
 * Use this for quick checks in components.
 */
export function useShouldReduceEffects(): boolean {
    const mode = usePerformanceMode();
    return mode !== 'high';
}

/**
 * Get performance mode for non-React contexts (one-time check)
 */
export function getPerformanceMode(): PerformanceMode {
    // Check reduced motion preference
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        return 'reduced-motion';
    }

    const nav = navigator as NavigatorExtended;
    const lowMemory = nav.deviceMemory !== undefined && nav.deviceMemory <= 2;
    const lowCores = navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency <= 2;
    const saveData = nav.connection?.saveData === true;

    if (lowMemory || lowCores || saveData) {
        return 'low';
    }

    return 'high';
}
