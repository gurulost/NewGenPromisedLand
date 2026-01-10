import { describe, it, expect } from 'vitest';
import { MapGenerator } from '@shared/utils/mapGenerator';
import type { FactionId } from '@shared/types/faction';
import { hexDistance } from '@shared/utils/hex';

const LAND_RESOURCE_TYPES = ['grain_patch', 'wild_goats', 'timber_grove', 'ore_vein'] as const;

describe('Map Generation - Land Resource Controls', () => {
  const createMapGenerator = (
    playerCount: number,
    mapSize: number,
    playerFactions: FactionId[],
    seed: string,
    minResourceDistance: number,
    maxResourcesPerPlayer: number
  ) => {
    return new MapGenerator(
      {
        width: mapSize,
        height: mapSize,
        seed: seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0),
        playerCount,
        mapSize: 'normal',
        minResourceDistance,
        maxResourcesPerPlayer,
      },
      playerFactions
    );
  };

  it('enforces same-type spacing for land resources', () => {
    const playerFactions: FactionId[] = ['NEPHITES', 'LAMANITES', 'MULEKITES', 'ZORAMITES'];
    const minDistance = 2;
    const mapGenerator = createMapGenerator(4, 8, playerFactions, 'resource-spacing', minDistance, 4);
    const map = mapGenerator.generateMap();

    LAND_RESOURCE_TYPES.forEach(resourceType => {
      const resourceTiles = map.tiles.filter(tile => tile.resources.includes(resourceType));
      for (let i = 0; i < resourceTiles.length; i++) {
        for (let j = i + 1; j < resourceTiles.length; j++) {
          const distance = hexDistance(resourceTiles[i].coordinate, resourceTiles[j].coordinate);
          expect(distance).toBeGreaterThanOrEqual(minDistance);
        }
      }
    });
  });

  it('caps home-zone land resources per capital', () => {
    const playerFactions: FactionId[] = ['NEPHITES', 'LAMANITES', 'MULEKITES', 'ZORAMITES'];
    const maxResourcesPerPlayer = 2;
    const mapGenerator = createMapGenerator(4, 8, playerFactions, 'resource-cap', 2, maxResourcesPerPlayer);
    const map = mapGenerator.generateMap();
    const capitals = mapGenerator.getCapitalPositions();

    capitals.forEach(capital => {
      const nearbyTiles = map.tiles.filter(tile => hexDistance(tile.coordinate, capital) <= 2);
      const landResourceCount = nearbyTiles.filter(tile =>
        tile.resources.some(resource => LAND_RESOURCE_TYPES.includes(resource as any))
      ).length;

      expect(landResourceCount).toBeLessThanOrEqual(maxResourcesPerPlayer);
    });
  });

  it('guarantees minimum harvest opportunities near capitals', () => {
    const playerFactions: FactionId[] = ['NEPHITES', 'LAMANITES', 'MULEKITES', 'ZORAMITES'];
    const mapGenerator = createMapGenerator(4, 8, playerFactions, 'resource-guarantee', 2, 4);
    const map = mapGenerator.generateMap();
    const capitals = mapGenerator.getCapitalPositions();

    capitals.forEach(capital => {
      const nearbyTiles = map.tiles.filter(tile => {
        const distance = hexDistance(tile.coordinate, capital);
        return distance <= 2 && distance > 0;
      });
      const harvestableCount = nearbyTiles.filter(tile =>
        tile.resources.some(resource => LAND_RESOURCE_TYPES.includes(resource as any))
      ).length;

      expect(harvestableCount).toBeGreaterThanOrEqual(2);
    });
  });

  it('still spawns land resources when constraints are disabled', () => {
    const playerFactions: FactionId[] = ['NEPHITES', 'LAMANITES', 'MULEKITES', 'ZORAMITES'];
    const mapGenerator = createMapGenerator(4, 8, playerFactions, 'resource-disabled', 0, 0);
    const map = mapGenerator.generateMap();

    const landResourceTiles = map.tiles.filter(tile =>
      tile.resources.some(resource => LAND_RESOURCE_TYPES.includes(resource as any))
    );

    expect(landResourceTiles.length).toBeGreaterThan(0);
  });
});
