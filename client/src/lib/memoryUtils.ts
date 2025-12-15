/**
 * Memory management utilities for preventing unbounded array growth
 * These utilities help prevent memory leaks in long-running game sessions
 */

/**
 * Push an item to an array while enforcing a maximum size cap.
 * When the array is at capacity, the oldest item (first) is dropped.
 * 
 * @param arr - The source array (readonly to encourage immutability)
 * @param item - The item to add
 * @param max - Maximum number of items to keep
 * @returns A new array with the item added and size capped
 */
export function pushCapped<T>(arr: readonly T[], item: T, max: number): T[] {
  if (max <= 0) return [];
  if (arr.length < max) return [...arr, item];
  return [...arr.slice(1), item]; // drop oldest
}

/**
 * Push multiple items to an array while enforcing a maximum size cap.
 * 
 * @param arr - The source array
 * @param items - The items to add
 * @param max - Maximum number of items to keep
 * @returns A new array with items added and size capped
 */
export function pushMultipleCapped<T>(arr: readonly T[], items: T[], max: number): T[] {
  if (max <= 0) return [];
  const combined = [...arr, ...items];
  if (combined.length <= max) return combined;
  return combined.slice(combined.length - max);
}

/**
 * Filter items based on TTL (time-to-live).
 * Items older than maxAgeMs are removed.
 * 
 * @param arr - Array of items with a timestamp or createdAt field
 * @param getTimestamp - Function to extract timestamp from item
 * @param maxAgeMs - Maximum age in milliseconds
 * @returns Filtered array with only items within TTL
 */
export function filterByTTL<T>(
  arr: readonly T[],
  getTimestamp: (item: T) => number,
  maxAgeMs: number
): T[] {
  const now = Date.now();
  return arr.filter(item => now - getTimestamp(item) < maxAgeMs);
}

/**
 * Combined cap and TTL enforcement.
 * First removes expired items, then enforces the cap.
 * 
 * @param arr - Array of items
 * @param getTimestamp - Function to extract timestamp from item
 * @param maxAgeMs - Maximum age in milliseconds
 * @param maxItems - Maximum number of items to keep
 * @returns Filtered and capped array
 */
export function enforceCapAndTTL<T>(
  arr: readonly T[],
  getTimestamp: (item: T) => number,
  maxAgeMs: number,
  maxItems: number
): T[] {
  const withinTTL = filterByTTL(arr, getTimestamp, maxAgeMs);
  if (withinTTL.length <= maxItems) return withinTTL;
  return withinTTL.slice(withinTTL.length - maxItems);
}

// Memory management constants
export const MEMORY_LIMITS = {
  GAME_LOG_MAX_ENTRIES: 200,
  PARTICLE_MAX_EVENTS: 100,
  PARTICLE_TTL_MS: 30000, // 30 seconds
  TOAST_MAX_ITEMS: 20,
  MAP_TOAST_MAX_ITEMS: 50,
  MAP_TOAST_TTL_MS: 15000, // 15 seconds
  COMBAT_EFFECT_MAX_ITEMS: 50,
  COMBAT_EFFECT_TTL_MS: 10000, // 10 seconds
  FLOATING_TEXT_MAX_ITEMS: 30,
  FLOATING_TEXT_TTL_MS: 5000, // 5 seconds
} as const;

/**
 * Dispose ONLY cloned materials from a THREE.js Object3D.
 * 
 * IMPORTANT: This does NOT dispose geometries or textures because:
 * - scene.clone() creates shallow clones that SHARE geometries with the cached original
 * - material.clone() creates new materials but they reference the SAME textures
 * 
 * Only the cloned material instances need disposal - the shared resources
 * are managed by drei's useGLTF cache.
 * 
 * @param object - The cloned Object3D (from scene.clone())
 */
export function disposeClonedMaterials(object: any): void {
  if (!object) return;
  
  object.traverse?.((child: any) => {
    // Only dispose materials - NOT geometries or textures (they're shared)
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((material: any) => {
          // Call dispose on the material only, not its textures
          material.dispose?.();
        });
      } else {
        child.material.dispose?.();
      }
    }
  });
}
