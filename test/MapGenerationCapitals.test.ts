import { describe, it, expect } from 'vitest';
import { MapGenerator } from '@shared/utils/mapGenerator';
import { hexDistance } from '@shared/utils/hex';
import type { FactionId } from '@shared/types/faction';

describe('Map Generation - Capitals', () => {
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

  it('should expose capital positions and keep them on land', () => {
    const playerFactions: FactionId[] = ['nephites', 'lamanites', 'mulekites', 'zoramites'];
    const mapGenerator = createMapGenerator(4, 12, playerFactions, 'capital-seed');
    const map = mapGenerator.generateMap();
    const capitals = mapGenerator.getCapitalPositions();

    expect(capitals.length).toBe(4);

    capitals.forEach(capital => {
      const tile = map.tiles.find(t =>
        t.coordinate.q === capital.q &&
        t.coordinate.r === capital.r &&
        t.coordinate.s === capital.s
      );
      expect(tile).toBeDefined();
      expect(tile?.hasCity).toBe(true);
      expect(tile?.terrain).not.toBe('water');
    });
  });

  it('should keep capitals reasonably spaced', () => {
    const playerFactions: FactionId[] = ['nephites', 'lamanites', 'mulekites', 'zoramites'];
    const mapGenerator = createMapGenerator(4, 12, playerFactions, 'spacing-seed');
    mapGenerator.generateMap();
    const capitals = mapGenerator.getCapitalPositions();

    for (let i = 0; i < capitals.length; i++) {
      for (let j = i + 1; j < capitals.length; j++) {
        const distance = hexDistance(capitals[i], capitals[j]);
        expect(distance).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('should guarantee a nearby expansion village', () => {
    const playerFactions: FactionId[] = ['nephites', 'lamanites', 'mulekites', 'zoramites'];
    const mapGenerator = createMapGenerator(4, 12, playerFactions, 'village-seed');
    const map = mapGenerator.generateMap();
    const capitals = mapGenerator.getCapitalPositions();

    capitals.forEach(capital => {
      const hasVillage = map.tiles.some(tile => {
        if (tile.feature !== 'village') return false;
        const dist = hexDistance(tile.coordinate, capital);
        return dist >= 4 && dist <= 6;
      });
      expect(hasVillage).toBe(true);
    });
  });
});
