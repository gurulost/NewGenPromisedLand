import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MapGenerator } from '@shared/utils/mapGenerator';
import { FactionId } from '@shared/types/faction';
import { hexDistance } from '@shared/utils/hex';

describe('Map Generation - Villages', () => {
  const createMapGenerator = (playerCount: number, mapSize: number, playerFactions: FactionId[], seed: string) => {
    return new MapGenerator({
      width: mapSize,
      height: mapSize,
      seed: seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0),
      playerCount,
      mapSize: 'normal',
      minResourceDistance: 2,
      maxResourcesPerPlayer: 3
    }, playerFactions);
  };

  describe('Village Placement', () => {
    it('should generate villages on a standard map', () => {
      const playerFactions: FactionId[] = ['nephites', 'lamanites'];
      const mapGenerator = createMapGenerator(2, 8, playerFactions, 'test-seed');
      const map = mapGenerator.generateMap();
      
      const villageTiles = map.tiles.filter(tile => tile.feature === 'village');
      
      // Should have at least some villages generated
      expect(villageTiles.length).toBeGreaterThan(0);
    });

    it('should generate appropriate number of villages for map size', () => {
      const playerFactions: FactionId[] = ['nephites', 'lamanites'];
      const mapGenerator = createMapGenerator(2, 12, playerFactions, 'test-seed');
      const map = mapGenerator.generateMap();
      
      const villageTiles = map.tiles.filter(tile => tile.feature === 'village');
      const totalTiles = map.tiles.length;
      
      // Villages should be roughly 8% of total valid tiles (based on spawn chance)
      // Allow for some variance due to placement constraints
      expect(villageTiles.length).toBeGreaterThan(0);
      expect(villageTiles.length).toBeLessThan(totalTiles * 0.15); // Upper bound
    });

    it('should not place villages on water tiles', () => {
      const playerFactions: FactionId[] = ['nephites', 'lamanites'];
      const mapGenerator = createMapGenerator(2, 10, playerFactions, 'test-seed');
      const map = mapGenerator.generateMap();
      
      const villageOnWater = map.tiles.some(tile => 
        tile.feature === 'village' && tile.terrain === 'water'
      );
      
      expect(villageOnWater).toBe(false);
    });

    it('should not place villages on city tiles', () => {
      const playerFactions: FactionId[] = ['nephites', 'lamanites'];
      const mapGenerator = createMapGenerator(2, 10, playerFactions, 'test-seed');
      const map = mapGenerator.generateMap();
      
      const villageOnCity = map.tiles.some(tile => 
        tile.feature === 'village' && tile.hasCity
      );
      
      expect(villageOnCity).toBe(false);
    });

    it('should maintain minimum distance between villages', () => {
      const playerFactions: FactionId[] = ['nephites', 'lamanites'];
      const mapGenerator = createMapGenerator(2, 12, playerFactions, 'test-seed');
      const map = mapGenerator.generateMap();
      
      const villageTiles = map.tiles.filter(tile => tile.feature === 'village');
      const MIN_DISTANCE = 3;
      
      // Check all pairs of villages
      for (let i = 0; i < villageTiles.length; i++) {
        for (let j = i + 1; j < villageTiles.length; j++) {
          const distance = hexDistance(
            villageTiles[i].coordinate,
            villageTiles[j].coordinate
          );
          expect(distance).toBeGreaterThanOrEqual(MIN_DISTANCE);
        }
      }
    });

    it('should maintain minimum distance from cities', () => {
      const playerFactions: FactionId[] = ['nephites', 'lamanites'];
      const mapGenerator = createMapGenerator(2, 12, playerFactions, 'test-seed');
      const map = mapGenerator.generateMap();
      
      const villageTiles = map.tiles.filter(tile => tile.feature === 'village');
      const cityTiles = map.tiles.filter(tile => tile.hasCity);
      const MIN_DISTANCE_FROM_CITIES = 4;
      
      // Check distance from each village to all cities
      for (const village of villageTiles) {
        for (const city of cityTiles) {
          const distance = hexDistance(village.coordinate, city.coordinate);
          expect(distance).toBeGreaterThanOrEqual(MIN_DISTANCE_FROM_CITIES);
        }
      }
    });

    it('should not place villages too close to map edges', () => {
      const playerFactions: FactionId[] = ['nephites', 'lamanites'];
      const mapRadius = 10;
      const mapGenerator = createMapGenerator(2, mapRadius, playerFactions, 'test-seed');
      const map = mapGenerator.generateMap();
      
      const villageTiles = map.tiles.filter(tile => tile.feature === 'village');
      const maxDistanceFromCenter = mapRadius * 0.85;
      
      for (const village of villageTiles) {
        const distanceFromCenter = Math.sqrt(
          village.coordinate.q ** 2 + village.coordinate.r ** 2
        );
        expect(distanceFromCenter).toBeLessThanOrEqual(maxDistanceFromCenter);
      }
    });

    it('should initialize villages as neutral (no owner)', () => {
      const playerFactions: FactionId[] = ['nephites', 'lamanites'];
      const mapGenerator = createMapGenerator(2, 10, playerFactions, 'test-seed');
      const map = mapGenerator.generateMap();
      
      const villageTiles = map.tiles.filter(tile => tile.feature === 'village');
      
      for (const village of villageTiles) {
        expect(village.cityOwner).toBeUndefined();
      }
    });

    it('should place villages on valid terrain types', () => {
      const playerFactions: FactionId[] = ['nephites', 'lamanites'];
      const mapGenerator = createMapGenerator(2, 10, playerFactions, 'test-seed');
      const map = mapGenerator.generateMap();
      
      const villageTiles = map.tiles.filter(tile => tile.feature === 'village');
      const validTerrains = ['plains', 'forest', 'mountain', 'desert', 'swamp'];
      
      for (const village of villageTiles) {
        expect(validTerrains).toContain(village.terrain);
      }
    });
  });

  describe('Village Distribution', () => {
    it('should generate villages with different player counts', () => {
      const twoPlayerMap = createMapGenerator(2, 10, ['nephites', 'lamanites'], 'test-seed');
      const fourPlayerMap = createMapGenerator(4, 10, ['nephites', 'lamanites', 'mulekites', 'zoramites'], 'test-seed-2');
      
      const twoPlayerVillages = twoPlayerMap.generateMap().tiles.filter(t => t.feature === 'village');
      const fourPlayerVillages = fourPlayerMap.generateMap().tiles.filter(t => t.feature === 'village');
      
      // Both should have villages
      expect(twoPlayerVillages.length).toBeGreaterThan(0);
      expect(fourPlayerVillages.length).toBeGreaterThan(0);
    });

    it('should work with different map sizes', () => {
      const playerFactions: FactionId[] = ['nephites', 'lamanites'];
      
      const smallMap = createMapGenerator(2, 6, playerFactions, 'small-seed').generateMap();
      const largeMap = createMapGenerator(2, 14, playerFactions, 'large-seed').generateMap();
      
      const smallVillages = smallMap.tiles.filter(t => t.feature === 'village');
      const largeVillages = largeMap.tiles.filter(t => t.feature === 'village');
      
      // Both should have villages, larger map should generally have more
      expect(smallVillages.length).toBeGreaterThan(0);
      expect(largeVillages.length).toBeGreaterThan(0);
      expect(largeVillages.length).toBeGreaterThan(smallVillages.length);
    });

    it('should be deterministic with same seed', () => {
      const playerFactions: FactionId[] = ['nephites', 'lamanites'];
      const seed = 'deterministic-test';
      
      const map1 = createMapGenerator(2, 10, playerFactions, seed).generateMap();
      const map2 = createMapGenerator(2, 10, playerFactions, seed).generateMap();
      
      const villages1 = map1.tiles.filter(t => t.feature === 'village');
      const villages2 = map2.tiles.filter(t => t.feature === 'village');
      
      // Same number of villages
      expect(villages1.length).toBe(villages2.length);
      
      // Same village positions
      for (let i = 0; i < villages1.length; i++) {
        const found = villages2.some(v => 
          v.coordinate.q === villages1[i].coordinate.q &&
          v.coordinate.r === villages1[i].coordinate.r &&
          v.coordinate.s === villages1[i].coordinate.s
        );
        expect(found).toBe(true);
      }
    });

    it('should generate different villages with different seeds', () => {
      const playerFactions: FactionId[] = ['nephites', 'lamanites'];
      
      const map1 = createMapGenerator(2, 10, playerFactions, 'seed-1').generateMap();
      const map2 = createMapGenerator(2, 10, playerFactions, 'seed-2').generateMap();
      
      const villages1 = map1.tiles.filter(t => t.feature === 'village');
      const villages2 = map2.tiles.filter(t => t.feature === 'village');
      
      // Should have different village configurations
      // (Very unlikely to be identical with different seeds)
      const identical = villages1.length === villages2.length &&
        villages1.every((v1, i) => 
          villages2[i] &&
          v1.coordinate.q === villages2[i].coordinate.q &&
          v1.coordinate.r === villages2[i].coordinate.r
        );
      
      expect(identical).toBe(false);
    });
  });

  describe('Village Console Logging', () => {
    it('should log village generation count', () => {
      // Capture console output
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const playerFactions: FactionId[] = ['nephites', 'lamanites'];
      const mapGenerator = createMapGenerator(2, 10, playerFactions, 'log-test');
      mapGenerator.generateMap();
      
      // Check if village count was logged
      const villageLogCalls = consoleSpy.mock.calls.filter(call =>
        call[0] && call[0].includes('villages on map')
      );
      
      expect(villageLogCalls.length).toBeGreaterThan(0);
      
      consoleSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small maps', () => {
      const playerFactions: FactionId[] = ['nephites', 'lamanites'];
      const mapGenerator = createMapGenerator(2, 3, playerFactions, 'tiny-seed');
      const map = mapGenerator.generateMap();
      
      const villageTiles = map.tiles.filter(tile => tile.feature === 'village');
      
      // Might have 0 villages on very small maps due to constraints
      expect(villageTiles.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle maps with many players', () => {
      const playerFactions: FactionId[] = [
        'nephites', 'lamanites', 'mulekites', 'zoramites', 'jaredites', 'anti_nephi_lehies'
      ];
      const mapGenerator = createMapGenerator(6, 14, playerFactions, 'many-players');
      const map = mapGenerator.generateMap();
      
      const villageTiles = map.tiles.filter(tile => tile.feature === 'village');
      
      expect(villageTiles.length).toBeGreaterThan(0);
    });

    it('should handle single player maps', () => {
      const playerFactions: FactionId[] = ['nephites'];
      const mapGenerator = createMapGenerator(1, 8, playerFactions, 'single-player');
      const map = mapGenerator.generateMap();
      
      const villageTiles = map.tiles.filter(tile => tile.feature === 'village');
      
      expect(villageTiles.length).toBeGreaterThan(0);
    });

    it('should not create infinite loops with tight constraints', () => {
      // This test ensures the algorithm doesn't get stuck
      const playerFactions: FactionId[] = ['nephites', 'lamanites'];
      
      const startTime = Date.now();
      const mapGenerator = createMapGenerator(2, 8, playerFactions, 'constraint-test');
      const map = mapGenerator.generateMap();
      const endTime = Date.now();
      
      // Should complete within reasonable time (less than 5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);
      
      const villageTiles = map.tiles.filter(tile => tile.feature === 'village');
      expect(villageTiles.length).toBeGreaterThanOrEqual(0);
    });
  });
});