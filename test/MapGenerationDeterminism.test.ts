import { describe, it, expect } from 'vitest';
import { MapGenerator, MAP_SIZE_CONFIGS } from '@shared/utils/mapGenerator';
import type { FactionId } from '@shared/types/faction';
import type { MapSize } from '@shared/utils/mapGenerationConstants';

const buildGenerator = (
  seed: number,
  mapSize: MapSize,
  playerCount: number,
  factions: FactionId[],
  flags?: { disableVillages?: boolean; disableNeutralCities?: boolean }
) => {
  const dimensions = MAP_SIZE_CONFIGS[mapSize].dimensions;
  return new MapGenerator(
    {
      width: dimensions,
      height: dimensions,
      seed,
      playerCount,
      mapSize,
      minResourceDistance: 2,
      maxResourcesPerPlayer: 3,
      debugDisableVillages: flags?.disableVillages ?? false,
      debugDisableNeutralCities: flags?.disableNeutralCities ?? false,
    },
    factions
  );
};

const buildTerrainMask = (tiles: Array<{ coordinate: { q: number; r: number; s: number }; terrain: string }>) => {
  const mask = new Map<string, string>();
  tiles.forEach(tile => {
    mask.set(`${tile.coordinate.q},${tile.coordinate.r},${tile.coordinate.s}`, tile.terrain);
  });
  return mask;
};

const buildWaterMask = (tiles: Array<{ coordinate: { q: number; r: number; s: number }; terrain: string }>) => {
  const mask = new Map<string, boolean>();
  tiles.forEach(tile => {
    mask.set(`${tile.coordinate.q},${tile.coordinate.r},${tile.coordinate.s}`, tile.terrain === 'water');
  });
  return mask;
};

const expectMasksEqual = (a: Map<string, unknown>, b: Map<string, unknown>) => {
  expect(a.size).toBe(b.size);
  for (const [key, value] of a.entries()) {
    expect(b.get(key)).toBe(value);
  }
};

describe('Map Generation - RNG Stream Isolation', () => {
  it('keeps terrain and water masks stable when villages/neutrals are disabled', () => {
    const factions: FactionId[] = ['NEPHITES', 'MULEKITES', 'LAMANITES', 'ZORAMITES'];
    const seeds = [1201, 1202, 1203];
    const mapSizes: MapSize[] = ['small', 'normal'];

    mapSizes.forEach(mapSize => {
      seeds.forEach(seed => {
        const baseline = buildGenerator(seed, mapSize, factions.length, factions, {
          disableVillages: true,
          disableNeutralCities: true,
        }).generateMap();
        const full = buildGenerator(seed, mapSize, factions.length, factions).generateMap();

        expectMasksEqual(buildTerrainMask(baseline.tiles), buildTerrainMask(full.tiles));
        expectMasksEqual(buildWaterMask(baseline.tiles), buildWaterMask(full.tiles));
      });
    });
  });
});
