import { describe, it, expect } from 'vitest';
import { 
  hexDistance, 
  hexNeighbors, 
  pixelToHex, 
  hexToPixel, 
  isValidHexCoordinate,
  hexAdd,
  hexSubtract,
  hexRing
} from './hex';
import type { HexCoordinate } from '../types/coordinates';

describe('Hex Coordinate Utilities', () => {
  const origin: HexCoordinate = { q: 0, r: 0, s: 0 };
  const adjacent: HexCoordinate = { q: 1, r: 0, s: -1 };
  const distant: HexCoordinate = { q: 3, r: -1, s: -2 };

  describe('hexDistance', () => {
    it('should calculate distance from origin correctly', () => {
      expect(hexDistance(origin, origin)).toBe(0);
      expect(hexDistance(origin, adjacent)).toBe(1);
      expect(hexDistance(origin, distant)).toBe(3);
    });

    it('should be symmetric', () => {
      expect(hexDistance(origin, distant)).toBe(hexDistance(distant, origin));
      expect(hexDistance(adjacent, distant)).toBe(hexDistance(distant, adjacent));
    });

    it('should handle negative coordinates', () => {
      const negative: HexCoordinate = { q: -2, r: 1, s: 1 };
      expect(hexDistance(origin, negative)).toBe(2);
    });
  });

  describe('hexNeighbors', () => {
    it('should return 6 neighbors for origin', () => {
      const neighbors = hexNeighbors(origin);
      expect(neighbors).toHaveLength(6);
    });

    it('should have all neighbors at distance 1', () => {
      const neighbors = hexNeighbors(origin);
      neighbors.forEach(neighbor => {
        expect(hexDistance(origin, neighbor)).toBe(1);
      });
    });

    it('should maintain coordinate sum invariant', () => {
      const neighbors = hexNeighbors(origin);
      neighbors.forEach(neighbor => {
        expect(neighbor.q + neighbor.r + neighbor.s).toBe(0);
      });
    });
  });

  describe('hexAdd', () => {
    it('should add coordinates correctly', () => {
      const a: HexCoordinate = { q: 1, r: -1, s: 0 };
      const b: HexCoordinate = { q: 2, r: 0, s: -2 };
      const result = hexAdd(a, b);
      
      expect(result).toEqual({ q: 3, r: -1, s: -2 });
      expect(result.q + result.r + result.s).toBe(0);
    });
  });

  describe('hexSubtract', () => {
    it('should subtract coordinates correctly', () => {
      const a: HexCoordinate = { q: 3, r: -1, s: -2 };
      const b: HexCoordinate = { q: 1, r: -1, s: 0 };
      const result = hexSubtract(a, b);
      
      expect(result).toEqual({ q: 2, r: 0, s: -2 });
      expect(result.q + result.r + result.s).toBe(0);
    });
  });

  describe('isValidHexCoordinate', () => {
    it('should validate correct coordinates', () => {
      expect(isValidHexCoordinate(origin)).toBe(true);
      expect(isValidHexCoordinate(adjacent)).toBe(true);
      expect(isValidHexCoordinate(distant)).toBe(true);
    });

    it('should reject invalid coordinates', () => {
      const invalid: HexCoordinate = { q: 1, r: 1, s: 1 }; // sum !== 0
      expect(isValidHexCoordinate(invalid)).toBe(false);
    });
  });

  describe('hexRing', () => {
    it('should return correct number of hexes for radius 1', () => {
      const ring = hexRing(origin, 1);
      expect(ring).toHaveLength(6);
    });

    it('should return correct number of hexes for radius 2', () => {
      const ring = hexRing(origin, 2);
      expect(ring).toHaveLength(12);
    });

    it('should return empty array for radius 0', () => {
      const ring = hexRing(origin, 0);
      expect(ring).toHaveLength(0);
    });

    it('should have all hexes at correct distance', () => {
      const radius = 3;
      const ring = hexRing(origin, radius);
      ring.forEach(hex => {
        expect(hexDistance(origin, hex)).toBe(radius);
      });
    });
  });

  describe('Pixel conversion', () => {
    const hexSize = 32;

    it('should convert hex to pixel and back consistently', () => {
      const hexCoord: HexCoordinate = { q: 2, r: -1, s: -1 };
      const pixel = hexToPixel(hexCoord, hexSize);
      const backToHex = pixelToHex(pixel.x, pixel.y, hexSize);
      
      // Due to floating point precision, we check if they're approximately equal
      expect(Math.abs(backToHex.q - hexCoord.q)).toBeLessThan(0.01);
      expect(Math.abs(backToHex.r - hexCoord.r)).toBeLessThan(0.01);
      expect(Math.abs(backToHex.s - hexCoord.s)).toBeLessThan(0.01);
    });

    it('should place origin at pixel origin', () => {
      const pixel = hexToPixel(origin, hexSize);
      expect(pixel.x).toBe(0);
      expect(pixel.y).toBe(0);
    });
  });
});