import { describe, it, expect } from 'vitest';
import { MapGenerator, MAP_GENERATION_CONSTANTS } from '@shared/utils/mapGenerator';
import type { FactionId } from '@shared/types/faction';
import { hexDistance, hexNeighbors } from '@shared/utils/hex';
import { GameRuleHelpers } from '@shared/data/gameRules';

const buildLandmassSize = (tiles: any[], start: any) => {
  const tileIndex = new Map<string, any>();
  tiles.forEach(tile => tileIndex.set(`${tile.coordinate.q},${tile.coordinate.r},${tile.coordinate.s}`, tile));
  const visited = new Set<string>();
  const queue = [start];
  visited.add(`${start.coordinate.q},${start.coordinate.r},${start.coordinate.s}`);
  let size = 0;

  while (queue.length > 0) {
    const current = queue.shift();
    size += 1;
    for (const neighbor of hexNeighbors(current.coordinate)) {
      const key = `${neighbor.q},${neighbor.r},${neighbor.s}`;
      if (visited.has(key)) continue;
      const tile = tileIndex.get(key);
      if (!tile || tile.terrain === 'water') continue;
      visited.add(key);
      queue.push(tile);
    }
  }

  return size;
};

describe('Map Generation - Neutral Cities', () => {
  const createMapGenerator = (playerCount: number, mapSize: number, playerFactions: FactionId[], seed: string) => {
    return new MapGenerator({
      width: mapSize,
      height: mapSize,
      seed: seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0),
      playerCount,
      mapSize: 'normal',
      minResourceDistance: 2,
      maxResourcesPerPlayer: 3,
    }, playerFactions);
  };

  it('places neutral cities on workable land with sufficient surrounding tiles', () => {
    const playerFactions: FactionId[] = ['NEPHITES', 'LAMANITES', 'MULEKITES', 'ZORAMITES'];
    const mapGenerator = createMapGenerator(4, 12, playerFactions, 'neutral-quality');
    const map = mapGenerator.generateMap();
    const capitals = mapGenerator.getCapitalPositions();
    const capitalKeys = new Set(capitals.map(c => `${c.q},${c.r},${c.s}`));

    const neutralCities = map.tiles.filter(tile =>
      tile.hasCity && !capitalKeys.has(`${tile.coordinate.q},${tile.coordinate.r},${tile.coordinate.s}`)
    );

    const minWorkable = MAP_GENERATION_CONSTANTS.NEUTRAL_CITY_WORKABLE_MIN_BY_SIZE.normal;
    const minLandmass = MAP_GENERATION_CONSTANTS.NEUTRAL_CITY_MIN_LANDMASS_BY_SIZE.normal;
    const minNeighbors = MAP_GENERATION_CONSTANTS.NEUTRAL_CITY_MIN_LAND_NEIGHBORS;

    neutralCities.forEach(city => {
      expect(city.terrain).not.toBe('water');

      const landNeighbors = hexNeighbors(city.coordinate)
        .map(coord => map.tiles.find(t =>
          t.coordinate.q === coord.q && t.coordinate.r === coord.r && t.coordinate.s === coord.s
        ))
        .filter(tile => tile && tile.terrain !== 'water').length;
      expect(landNeighbors).toBeGreaterThanOrEqual(minNeighbors);

      const workableCount = map.tiles.filter(tile => {
        const distance = hexDistance(tile.coordinate, city.coordinate);
        if (distance > 2) return false;
        return GameRuleHelpers.isTerrainPassable(tile.terrain);
      }).length;
      expect(workableCount).toBeGreaterThanOrEqual(minWorkable);

      const landmassSize = buildLandmassSize(map.tiles, city);
      expect(landmassSize).toBeGreaterThanOrEqual(minLandmass);
    });
  });
});
