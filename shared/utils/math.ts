
/**
 * Clamps a value between 0 and 1 inclusive.
 */
export function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
}

/**
 * Clamps a value between 0 and 100 inclusive.
 */
export function clampStat(value: number): number {
    return Math.max(0, Math.min(100, value));
}
