import { describe, it, expect } from 'vitest';
import { MapGenerator, MAP_GENERATION_CONSTANTS } from '@shared/utils/mapGenerator';
import type { FactionId } from '@shared/types/faction';
import { hexNeighbors } from '@shared/utils/hex';

const buildTileIndex = (tiles: { coordinate: { q: number; r: number; s: number } }[]) => {
  const index = new Map<string, (typeof tiles)[number]>();
  tiles.forEach(tile => {
    index.set(`${tile.coordinate.q},${tile.coordinate.r},${tile.coordinate.s}`, tile);
  });
  return index;
};

const getWaterBodySize = (
  tiles: { coordinate: { q: number; r: number; s: number }; terrain: string }[],
  start: { q: number; r: number; s: number }
) => {
  const index = buildTileIndex(tiles);
  const startKey = `${start.q},${start.r},${start.s}`;
  if (index.get(startKey)?.terrain !== 'water') return 0;

  const visited = new Set<string>([startKey]);
  const queue = [start];
  let size = 0;

  while (queue.length > 0) {
    const current = queue.shift() as typeof start;
    const currentKey = `${current.q},${current.r},${current.s}`;
    size += 1;

    for (const neighbor of hexNeighbors(current)) {
      const key = `${neighbor.q},${neighbor.r},${neighbor.s}`;
      if (visited.has(key)) continue;
      const tile = index.get(key);
      if (!tile || tile.terrain !== 'water') continue;
      visited.add(key);
      queue.push(neighbor);
    }
  }

  return size;
};

describe('Map Generation - Water', () => {
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

  it('gives Mulekite capitals meaningful coastal access', () => {
    const playerFactions: FactionId[] = ['MULEKITES', 'NEPHITES'];
    const mapGenerator = createMapGenerator(2, 10, playerFactions, 'mulekite-water-seed');
    const map = mapGenerator.generateMap();
    const capital = mapGenerator.getCapitalPositions()[0];

    const index = buildTileIndex(map.tiles);
    const adjacentWater = hexNeighbors(capital)
      .map(coord => index.get(`${coord.q},${coord.r},${coord.s}`))
      .find(tile => tile?.terrain === 'water');

    expect(adjacentWater).toBeTruthy();

    const bodySize = getWaterBodySize(map.tiles as any, adjacentWater!.coordinate);
    const minBodySize = MAP_GENERATION_CONSTANTS.WATER_MULEKITE_MIN_BODY_SIZE_BY_SIZE.normal;
    expect(bodySize).toBeGreaterThanOrEqual(minBodySize);
  });

  it('keeps water bodies large enough to matter', () => {
    const playerFactions: FactionId[] = ['NEPHITES', 'LAMANITES', 'MULEKITES'];
    const mapGenerator = createMapGenerator(3, 10, playerFactions, 'water-body-seed');
    const map = mapGenerator.generateMap();

    const waterTiles = map.tiles.filter(tile => tile.terrain === 'water');
    expect(waterTiles.length).toBeGreaterThan(0);

    const index = buildTileIndex(map.tiles);
    const visited = new Set<string>();
    const minBodySize = MAP_GENERATION_CONSTANTS.WATER_MIN_BODY_SIZE_BY_SIZE.normal;

    for (const tile of waterTiles) {
      const key = `${tile.coordinate.q},${tile.coordinate.r},${tile.coordinate.s}`;
      if (visited.has(key)) continue;

      const size = getWaterBodySize(map.tiles as any, tile.coordinate);
      expect(size).toBeGreaterThanOrEqual(minBodySize);

      // Mark body as visited
      const queue = [tile.coordinate];
      visited.add(key);
      while (queue.length > 0) {
        const current = queue.shift() as typeof tile.coordinate;
        for (const neighbor of hexNeighbors(current)) {
          const neighborKey = `${neighbor.q},${neighbor.r},${neighbor.s}`;
          if (visited.has(neighborKey)) continue;
          const neighborTile = index.get(neighborKey);
          if (!neighborTile || neighborTile.terrain !== 'water') continue;
          visited.add(neighborKey);
          queue.push(neighbor);
        }
      }
    }
  });
});
