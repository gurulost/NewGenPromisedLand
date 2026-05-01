import { describe, expect, it } from 'vitest';
import type { HexCoordinate } from '@shared/types/coordinates';
import type { Tile } from '@shared/types/game';
import {
  CAPITAL_MIN_DISTANCE_BY_SIZE,
  MAP_GENERATION_CONSTANTS,
  MAP_SIZE_CONFIGS,
  MapGenerator,
  SeededRandom,
  TRIBAL_SPAWN_MODIFIERS,
} from '@shared/utils/mapGenerator';
import {
  getLandResourceCategory,
  isLandResourceType,
} from '@shared/utils/mapGenerationLandResources';
import { deriveSeed } from '@shared/utils/mapGenerationRandom';
import {
  getNearestCapital,
  getRuinsTargetCount,
} from '@shared/utils/mapGenerationRuins';
import {
  factionWantsWater,
  getFactionFishModifier,
  getTribalSpawnModifiers,
  normalizeFactionId,
} from '@shared/utils/mapGenerationTerrain';
import {
  generateWaterMask,
  repairCapitalWaterAccess,
} from '@shared/utils/mapGenerationWater';

const buildHexTiles = (radius: number): Tile[] => {
  const tiles: Tile[] = [];
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      const s = -q - r;
      tiles.push({
        coordinate: { q, r, s },
        terrain: 'plains',
        resources: [],
        hasCity: false,
        exploredBy: [],
      });
    }
  }
  return tiles;
};

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

describe('Map generation module boundaries', () => {
  it('keeps the public map generator facade import-compatible', () => {
    expect(typeof MapGenerator).toBe('function');
    expect(typeof SeededRandom).toBe('function');
    expect(MAP_SIZE_CONFIGS.small.dimensions).toBeGreaterThan(0);
    expect(MAP_GENERATION_CONSTANTS.MIN_HARVESTABLES_R2).toBeGreaterThan(0);
    expect(CAPITAL_MIN_DISTANCE_BY_SIZE.normal).toBeGreaterThan(0);
    expect(TRIBAL_SPAWN_MODIFIERS.MULEKITES.water).toBeGreaterThan(1);

    const generator = new MapGenerator(
      {
        width: MAP_SIZE_CONFIGS.small.dimensions,
        height: MAP_SIZE_CONFIGS.small.dimensions,
        seed: 5101,
        playerCount: 2,
        mapSize: 'small',
        minResourceDistance: 2,
        maxResourcesPerPlayer: 3,
      },
      ['NEPHITES', 'MULEKITES']
    );
    const map = generator.generateMap();

    expect(map.tiles.length).toBeGreaterThan(0);
    expect(generator.getCapitalPositions()).toHaveLength(2);
    expect(generator.getGenerationReport()?.playerCount).toBe(2);
  });

  it('keeps derived RNG streams deterministic and isolated by label', () => {
    const baseSeed = 6201;
    const firstTerrain = new SeededRandom(deriveSeed(baseSeed, 'terrain'));
    const secondTerrain = new SeededRandom(deriveSeed(baseSeed, 'terrain'));
    const water = new SeededRandom(deriveSeed(baseSeed, 'water'));

    const terrainSequence = [firstTerrain.next(), firstTerrain.next(), firstTerrain.next()];
    expect([secondTerrain.next(), secondTerrain.next(), secondTerrain.next()]).toEqual(terrainSequence);
    expect([water.next(), water.next(), water.next()]).not.toEqual(terrainSequence);
  });

  it('keeps faction and land-resource helpers explicit at module boundaries', () => {
    expect(normalizeFactionId('nephites')).toBe('NEPHITES');
    expect(normalizeFactionId('not-a-faction')).toBeNull();
    expect(getTribalSpawnModifiers('LAMANITES')?.forest).toBeGreaterThan(1);
    expect(factionWantsWater('MULEKITES')).toBe(true);
    expect(factionWantsWater('NEPHITES')).toBe(false);
    expect(getFactionFishModifier('HAGOTHS_MARINERS')).toBeGreaterThan(1);

    expect(isLandResourceType('grain_patch')).toBe(true);
    expect(isLandResourceType('fishing_shoal')).toBe(false);
    expect(getLandResourceCategory('grain_patch')).toBe('food');
    expect(getLandResourceCategory('ore_vein')).toBe('prod');
  });

  it('keeps water generation and repair result shapes consistent', () => {
    const tiles = buildHexTiles(5);
    const waterResult = generateWaterMask({
      tiles,
      mapRadius: 5,
      mapSize: 'small',
      rng: new SeededRandom(deriveSeed(7301, 'water')),
      waterNoise2D: () => 0,
      hasWaterFaction: true,
    });
    const waterTileCount = tiles.filter(tile => tile.terrain === 'water').length;

    expect(['coastal', 'inland_sea', 'straits']).toContain(waterResult.motif);
    expect(waterTileCount).toBeGreaterThan(0);
    expect(sum(waterResult.waterData.bodySizes)).toBe(waterTileCount);

    const capitalPositions: HexCoordinate[] = [{ q: 0, r: 0, s: 0 }];
    const repaired = repairCapitalWaterAccess({
      tiles,
      capitalPositions,
      waterData: waterResult.waterData,
      mapRadius: 5,
      mapSize: 'small',
      playerFactions: ['MULEKITES'],
    });

    expect(repaired.repairsByCapital).toHaveLength(capitalPositions.length);
    expect(repaired.repairReasonsByCapital).toHaveLength(capitalPositions.length);
    expect(sum(repaired.waterData.bodySizes)).toBe(tiles.filter(tile => tile.terrain === 'water').length);
  });

  it('keeps ruins helper outputs stable and easy to reason about', () => {
    const capitals: HexCoordinate[] = [
      { q: 0, r: 0, s: 0 },
      { q: 4, r: -4, s: 0 },
    ];

    expect(getNearestCapital({ q: 1, r: -1, s: 0 }, capitals)).toEqual({ index: 0, distance: 1 });
    expect(getNearestCapital({ q: 4, r: -3, s: -1 }, capitals)).toEqual({ index: 1, distance: 1 });
    expect(getRuinsTargetCount(100, 4)).toBeGreaterThan(4);
  });
});
