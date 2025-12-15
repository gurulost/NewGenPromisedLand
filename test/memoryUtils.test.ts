import { describe, it, expect } from 'vitest';
import {
  pushCapped,
  pushMultipleCapped,
  filterByTTL,
  enforceCapAndTTL,
  MEMORY_LIMITS,
} from '../client/src/lib/memoryUtils';

describe('memoryUtils', () => {
  describe('pushCapped', () => {
    it('should add item when array is below max', () => {
      const arr = [1, 2, 3];
      const result = pushCapped(arr, 4, 10);
      expect(result).toEqual([1, 2, 3, 4]);
    });

    it('should drop oldest when at capacity', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = pushCapped(arr, 6, 5);
      expect(result).toEqual([2, 3, 4, 5, 6]);
    });

    it('should handle max of 0', () => {
      const arr = [1, 2, 3];
      const result = pushCapped(arr, 4, 0);
      expect(result).toEqual([]);
    });

    it('should handle empty array', () => {
      const result = pushCapped([], 1, 5);
      expect(result).toEqual([1]);
    });

    it('should enforce cap of 200 for game log', () => {
      const entries = Array.from({ length: 250 }, (_, i) => ({ id: i }));
      let arr: { id: number }[] = [];
      entries.forEach(entry => {
        arr = pushCapped(arr, entry, MEMORY_LIMITS.GAME_LOG_MAX_ENTRIES);
      });
      expect(arr.length).toBe(MEMORY_LIMITS.GAME_LOG_MAX_ENTRIES);
      expect(arr[0].id).toBe(50); // oldest 50 dropped
      expect(arr[arr.length - 1].id).toBe(249);
    });
  });

  describe('pushMultipleCapped', () => {
    it('should add multiple items when below max', () => {
      const arr = [1, 2];
      const result = pushMultipleCapped(arr, [3, 4, 5], 10);
      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('should keep only newest when over capacity', () => {
      const arr = [1, 2, 3];
      const result = pushMultipleCapped(arr, [4, 5, 6], 4);
      expect(result).toEqual([3, 4, 5, 6]);
    });
  });

  describe('filterByTTL', () => {
    it('should keep items within TTL', () => {
      const now = Date.now();
      const items = [
        { id: 1, createdAt: now - 1000 }, // 1s old
        { id: 2, createdAt: now - 5000 }, // 5s old
        { id: 3, createdAt: now - 10000 }, // 10s old
      ];
      const result = filterByTTL(items, item => item.createdAt, 15000);
      expect(result.length).toBe(3);
    });

    it('should remove items older than TTL', () => {
      const now = Date.now();
      const items = [
        { id: 1, createdAt: now - 1000 }, // 1s old
        { id: 2, createdAt: now - 20000 }, // 20s old
        { id: 3, createdAt: now - 35000 }, // 35s old
      ];
      const result = filterByTTL(items, item => item.createdAt, 15000);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(1);
    });
  });

  describe('enforceCapAndTTL', () => {
    it('should remove stale items and enforce cap', () => {
      const now = Date.now();
      const items = [
        { id: 1, createdAt: now - 1000 },
        { id: 2, createdAt: now - 2000 },
        { id: 3, createdAt: now - 3000 },
        { id: 4, createdAt: now - 50000 }, // stale
        { id: 5, createdAt: now - 60000 }, // stale
      ];
      const result = enforceCapAndTTL(items, item => item.createdAt, 30000, 10);
      expect(result.length).toBe(3);
    });

    it('should apply cap after TTL filter', () => {
      const now = Date.now();
      const items = Array.from({ length: 10 }, (_, i) => ({
        id: i,
        createdAt: now - (i * 1000),
      }));
      const result = enforceCapAndTTL(items, item => item.createdAt, 30000, 3);
      expect(result.length).toBe(3);
      // Should keep the 3 newest (after slicing from end)
      expect(result[0].id).toBe(7);
      expect(result[2].id).toBe(9);
    });
  });

  describe('MEMORY_LIMITS constants', () => {
    it('should have reasonable limits defined', () => {
      expect(MEMORY_LIMITS.GAME_LOG_MAX_ENTRIES).toBe(200);
      expect(MEMORY_LIMITS.PARTICLE_MAX_EVENTS).toBe(100);
      expect(MEMORY_LIMITS.PARTICLE_TTL_MS).toBe(30000);
      expect(MEMORY_LIMITS.TOAST_MAX_ITEMS).toBe(20);
      expect(MEMORY_LIMITS.MAP_TOAST_MAX_ITEMS).toBe(50);
      expect(MEMORY_LIMITS.COMBAT_EFFECT_MAX_ITEMS).toBe(50);
    });
  });
});
