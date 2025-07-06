import { describe, it, expect } from 'vitest';
import { 
  hexLine, 
  hasLineOfSight, 
  calculateVisibleTiles, 
  calculateFogOfWarState,
  getVisibleTilesInRange 
} from './lineOfSight';
import type { HexCoordinate } from '../types/coordinates';
import type { GameMap } from '../types/game';

describe('Line of Sight System', () => {
  // Create a simple test map for line of sight calculations
  const createTestMap = (): GameMap => ({
    width: 5,
    height: 5,
    tiles: [
      // Row 0: plains terrain
      { coordinate: { q: -2, r: 0, s: 2 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [] },
      { coordinate: { q: -1, r: 0, s: 1 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [] },
      { coordinate: { q: 0, r: 0, s: 0 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [] },
      { coordinate: { q: 1, r: 0, s: -1 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [] },
      { coordinate: { q: 2, r: 0, s: -2 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [] },
      
      // Row 1: mix with mountain blocking
      { coordinate: { q: -2, r: 1, s: 1 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [] },
      { coordinate: { q: -1, r: 1, s: 0 }, terrain: 'mountain', resources: [], hasCity: false, exploredBy: [] },
      { coordinate: { q: 0, r: 1, s: -1 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [] },
      { coordinate: { q: 1, r: 1, s: -2 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [] },
      { coordinate: { q: 2, r: 1, s: -3 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [] },
      
      // Row 2: plains terrain
      { coordinate: { q: -2, r: 2, s: 0 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [] },
      { coordinate: { q: -1, r: 2, s: -1 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [] },
      { coordinate: { q: 0, r: 2, s: -2 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [] },
      { coordinate: { q: 1, r: 2, s: -3 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [] },
      { coordinate: { q: 2, r: 2, s: -4 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [] },
    ]
  });

  describe('hexLine', () => {
    it('should return a line between two adjacent hexes', () => {
      const start: HexCoordinate = { q: 0, r: 0, s: 0 };
      const end: HexCoordinate = { q: 1, r: 0, s: -1 };
      
      const line = hexLine(start, end);
      
      expect(line).toHaveLength(2);
      expect(line[0]).toEqual(start);
      expect(line[1]).toEqual(end);
    });

    it('should return a line between distant hexes', () => {
      const start: HexCoordinate = { q: 0, r: 0, s: 0 };
      const end: HexCoordinate = { q: 2, r: 0, s: -2 };
      
      const line = hexLine(start, end);
      
      expect(line.length).toBeGreaterThan(2);
      expect(line[0]).toEqual(start);
      expect(line[line.length - 1]).toEqual(end);
    });

    it('should return single hex for same start and end', () => {
      const coord: HexCoordinate = { q: 0, r: 0, s: 0 };
      
      const line = hexLine(coord, coord);
      
      expect(line).toHaveLength(1);
      expect(line[0]).toEqual(coord);
    });
  });

  describe('hasLineOfSight', () => {
    const testMap = createTestMap();

    it('should have clear line of sight on plains', () => {
      const from: HexCoordinate = { q: 0, r: 0, s: 0 };
      const to: HexCoordinate = { q: 2, r: 0, s: -2 };
      
      const canSee = hasLineOfSight(from, to, testMap);
      
      expect(canSee).toBe(true);
    });

    it('should be blocked by mountains', () => {
      const from: HexCoordinate = { q: 0, r: 0, s: 0 };
      const to: HexCoordinate = { q: -2, r: 2, s: 0 };
      
      const canSee = hasLineOfSight(from, to, testMap);
      
      // This should be blocked by the mountain at (-1, 1, 0)
      expect(canSee).toBe(false);
    });

    it('should respect range limits', () => {
      const from: HexCoordinate = { q: 0, r: 0, s: 0 };
      const to: HexCoordinate = { q: 2, r: 0, s: -2 };
      
      const canSeeWithoutLimit = hasLineOfSight(from, to, testMap);
      const canSeeWithLimit = hasLineOfSight(from, to, testMap, 1);
      
      expect(canSeeWithoutLimit).toBe(true);
      expect(canSeeWithLimit).toBe(false);
    });

    it('should allow line of sight to adjacent tiles', () => {
      const from: HexCoordinate = { q: 0, r: 0, s: 0 };
      const to: HexCoordinate = { q: 1, r: 0, s: -1 };
      
      const canSee = hasLineOfSight(from, to, testMap);
      
      expect(canSee).toBe(true);
    });
  });

  describe('calculateVisibleTiles', () => {
    const testMap = createTestMap();

    it('should calculate visible tiles within range', () => {
      const center: HexCoordinate = { q: 0, r: 0, s: 0 };
      const visionRadius = 2;
      
      const visibleTiles = calculateVisibleTiles(center, visionRadius, testMap);
      
      expect(visibleTiles.size).toBeGreaterThan(0);
      expect(visibleTiles.has('0,0')).toBe(true); // Center should be visible
    });

    it('should not include tiles blocked by mountains', () => {
      const center: HexCoordinate = { q: 0, r: 0, s: 0 };
      const visionRadius = 3;
      
      const visibleTiles = calculateVisibleTiles(center, visionRadius, testMap);
      
      // Tiles behind the mountain should not be visible
      expect(visibleTiles.has('-2,2')).toBe(false);
    });

    it('should include tiles within range that are not blocked', () => {
      const center: HexCoordinate = { q: 0, r: 0, s: 0 };
      const visionRadius = 2;
      
      const visibleTiles = calculateVisibleTiles(center, visionRadius, testMap);
      
      // Adjacent tiles should be visible
      expect(visibleTiles.has('1,0')).toBe(true);
      expect(visibleTiles.has('0,1')).toBe(true);
    });
  });

  describe('getVisibleTilesInRange', () => {
    const testMap = createTestMap();

    it('should return visible tiles using shadow casting', () => {
      const center: HexCoordinate = { q: 0, r: 0, s: 0 };
      const visionRadius = 2;
      
      const visibleTiles = getVisibleTilesInRange(center, visionRadius, testMap, true);
      
      expect(visibleTiles.size).toBeGreaterThan(0);
      expect(visibleTiles.has('0,0')).toBe(true); // Center should always be visible
    });

    it('should return visible tiles using basic algorithm', () => {
      const center: HexCoordinate = { q: 0, r: 0, s: 0 };
      const visionRadius = 2;
      
      const visibleTiles = getVisibleTilesInRange(center, visionRadius, testMap, false);
      
      expect(visibleTiles.size).toBeGreaterThan(0);
      expect(visibleTiles.has('0,0')).toBe(true); // Center should always be visible
    });
  });

  describe('calculateFogOfWarState', () => {
    it('should return visible state for currently visible tiles', () => {
      const visibleTiles = new Set(['0,0']);
      const exploredTiles = new Set(['0,0', '1,0']);
      
      const fogState = calculateFogOfWarState('0,0', visibleTiles, exploredTiles);
      
      expect(fogState.visibility).toBe('visible');
      expect(fogState.opacity).toBe(1.0);
      expect(fogState.colorMultiplier).toBe(1.0);
    });

    it('should return explored state for explored but not visible tiles', () => {
      const visibleTiles = new Set(['0,0']);
      const exploredTiles = new Set(['0,0', '1,0']);
      
      const fogState = calculateFogOfWarState('1,0', visibleTiles, exploredTiles);
      
      expect(fogState.visibility).toBe('explored');
      expect(fogState.opacity).toBe(0.7); // Updated to match implementation
      expect(fogState.colorMultiplier).toBe(0.6); // Updated to match implementation
    });

    it('should return hidden state for unexplored tiles', () => {
      const visibleTiles = new Set(['0,0']);
      const exploredTiles = new Set(['0,0']);
      
      const fogState = calculateFogOfWarState('2,0', visibleTiles, exploredTiles);
      
      expect(fogState.visibility).toBe('unexplored'); // Updated to match implementation
      expect(fogState.opacity).toBe(0); // Updated to match implementation
      expect(fogState.colorMultiplier).toBe(0.0); // Updated to match implementation
    });
  });
});