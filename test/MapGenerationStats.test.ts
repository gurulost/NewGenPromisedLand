import { describe, it, expect } from 'vitest';
import {
  CAPITAL_MIN_DISTANCE_BY_SIZE,
  MAP_GENERATION_CONSTANTS,
  MAP_SIZE_CONFIGS,
  MapGenerator,
} from '@shared/utils/mapGenerator';
import { hexDistance, hexNeighbors } from '@shared/utils/hex';
import type { HexCoordinate } from '@shared/types/coordinates';
import type { FactionId } from '@shared/types/faction';
import type { GameMap } from '@shared/types/game';
import type { MapSize } from '@shared/utils/mapGenerationConstants';

const buildGenerator = (seed: number, playerCount: number, factions: FactionId[]) => {
  return new MapGenerator(
    {
      width: 12,
      height: 12,
      seed,
      playerCount,
      mapSize: 'normal',
      minResourceDistance: 2,
      maxResourcesPerPlayer: 3,
    },
    factions
  );
};

const ALL_FACTIONS: FactionId[] = [
  'NEPHITES',
  'MULEKITES',
  'LAMANITES',
  'ZORAMITES',
  'JAREDITES',
  'ANTI_NEPHI_LEHIES',
  'HAGOTHS_MARINERS',
  'AMULONITES',
];

const WATER_FACTION_SLOTS = ALL_FACTIONS
  .map((faction, index) => ({ faction, index }))
  .filter(entry => entry.faction === 'MULEKITES' || entry.faction === 'HAGOTHS_MARINERS')
  .map(entry => entry.index);

const buildSizedGenerator = (
  seed: number,
  mapSize: MapSize,
  playerCount: number,
  factions: FactionId[]
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
    },
    factions
  );
};

const coordKey = (coord: HexCoordinate) => `${coord.q},${coord.r},${coord.s}`;

const buildTileIndex = (map: GameMap) => {
  const index = new Map<string, GameMap['tiles'][number]>();
  map.tiles.forEach(tile => {
    index.set(coordKey(tile.coordinate), tile);
  });
  return index;
};

const collectReachableLandKeys = (map: GameMap, start: HexCoordinate) => {
  const tileIndex = buildTileIndex(map);
  const startTile = tileIndex.get(coordKey(start));
  const reachable = new Set<string>();
  if (!startTile || startTile.terrain === 'water') return reachable;

  const queue: HexCoordinate[] = [start];
  reachable.add(coordKey(start));

  while (queue.length > 0) {
    const current = queue.shift() as HexCoordinate;
    for (const neighbor of hexNeighbors(current)) {
      const key = coordKey(neighbor);
      if (reachable.has(key)) continue;
      const tile = tileIndex.get(key);
      if (!tile || tile.terrain === 'water') continue;
      reachable.add(key);
      queue.push(neighbor);
    }
  }

  return reachable;
};

describe('Map Generation - Statistical Fairness', () => {
  it('keeps early village and neutral spreads within soft parity bounds', () => {
    const playerFactions: FactionId[] = ['NEPHITES', 'MULEKITES', 'LAMANITES', 'ZORAMITES'];
    const seeds = Array.from({ length: 30 }, (_, index) => 1000 + index);

    const reports = seeds.map(seed => {
      const generator = buildGenerator(seed, playerFactions.length, playerFactions);
      generator.generateMap();
      const report = generator.getGenerationReport();
      if (!report) {
        throw new Error('Missing generation report');
      }
      return report;
    });

    const villageSpreadOk = reports.filter(report =>
      (report.villages.earlySpread.max - report.villages.earlySpread.min) <= 3
    ).length;
    expect(villageSpreadOk).toBeGreaterThanOrEqual(Math.floor(seeds.length * 0.5));

    const neutralReports = reports.filter(report => report.neutralCities.placed > 0);
    const neutralSpreadOk = neutralReports.filter(report =>
      (report.neutralCities.earlySpread.max - report.neutralCities.earlySpread.min) <= 3
    ).length;
    if (neutralReports.length > 0) {
      expect(neutralSpreadOk).toBeGreaterThanOrEqual(Math.floor(neutralReports.length * 0.5));
    }
  });

  it('keeps capital resource variety high without frequent extra grants', () => {
    const playerFactions: FactionId[] = ['NEPHITES', 'MULEKITES', 'LAMANITES', 'ZORAMITES'];
    const seeds = Array.from({ length: 30 }, (_, index) => 2000 + index);
    let totalCapitals = 0;
    let varietyCapitals = 0;
    let extraGranted = 0;

    seeds.forEach(seed => {
      const generator = buildGenerator(seed, playerFactions.length, playerFactions);
      generator.generateMap();
      const report = generator.getGenerationReport();
      if (!report) {
        throw new Error('Missing generation report');
      }

      totalCapitals += report.capitals.length;
      varietyCapitals += report.capitals.filter(capital => capital.hasFood && capital.hasProd).length;
      extraGranted += report.resources.varietyExtraGranted.reduce((sum, count) => sum + count, 0);
    });

    expect(varietyCapitals / Math.max(1, totalCapitals)).toBeGreaterThanOrEqual(0.7);
    expect(extraGranted / Math.max(1, totalCapitals)).toBeLessThanOrEqual(0.3);
  });

  it('keeps max-player capital slots connected, unique, and at configured spacing', () => {
    const seeds = [3100, 3101, 3102];
    const mapSizes: MapSize[] = ['tiny', 'small', 'normal'];

    mapSizes.forEach(mapSize => {
      seeds.forEach(seed => {
        const generator = buildSizedGenerator(seed, mapSize, ALL_FACTIONS.length, ALL_FACTIONS);
        const map = generator.generateMap();
        const capitals = generator.getCapitalPositions();
        const tileIndex = buildTileIndex(map);
        const reachableFromFirstCapital = collectReachableLandKeys(map, capitals[0]);

        expect(capitals).toHaveLength(ALL_FACTIONS.length);
        expect(new Set(capitals.map(coordKey)).size).toBe(capitals.length);

        capitals.forEach(capital => {
          const tile = tileIndex.get(coordKey(capital));
          expect(tile).toBeDefined();
          expect(tile?.hasCity).toBe(true);
          expect(tile?.terrain).not.toBe('water');
          expect(reachableFromFirstCapital.has(coordKey(capital))).toBe(true);
        });

        for (let i = 0; i < capitals.length; i++) {
          for (let j = i + 1; j < capitals.length; j++) {
            expect(hexDistance(capitals[i], capitals[j])).toBeGreaterThanOrEqual(
              CAPITAL_MIN_DISTANCE_BY_SIZE[mapSize]
            );
          }
        }
      });
    });
  });

  it('keeps water-faction slots on meaningful coastal starts', () => {
    const seeds = [3200, 3201, 3202, 3203];

    seeds.forEach(seed => {
      const generator = buildSizedGenerator(seed, 'normal', ALL_FACTIONS.length, ALL_FACTIONS);
      generator.generateMap();
      const report = generator.getGenerationReport();
      if (!report) {
        throw new Error('Missing generation report');
      }

      WATER_FACTION_SLOTS.forEach(slot => {
        const water = report.capitals[slot].water;
        expect(water.adjacentWaterTiles).toBeGreaterThanOrEqual(1);
        expect(water.connectedBodySize).toBeGreaterThanOrEqual(
          MAP_GENERATION_CONSTANTS.WATER_MULEKITE_MIN_BODY_SIZE_BY_SIZE.normal
        );
        expect(water.coastTilesWithinRadius).toBeGreaterThanOrEqual(
          MAP_GENERATION_CONSTANTS.WATER_MULEKITE_MIN_COAST_TILES_BY_SIZE.normal
        );
      });
    });
  });

  it('gives each capital a nearby expansion village reachable by land', () => {
    const playerFactions: FactionId[] = ['NEPHITES', 'MULEKITES', 'LAMANITES', 'ZORAMITES'];
    const seeds = [3300, 3301, 3302];

    seeds.forEach(seed => {
      const generator = buildSizedGenerator(seed, 'normal', playerFactions.length, playerFactions);
      const map = generator.generateMap();
      const capitals = generator.getCapitalPositions();
      const villageTiles = map.tiles.filter(tile => tile.feature === 'village');

      capitals.forEach(capital => {
        const reachable = collectReachableLandKeys(map, capital);
        const hasReachableVillage = villageTiles.some(village => {
          const distance = hexDistance(village.coordinate, capital);
          return (
            distance >= MAP_GENERATION_CONSTANTS.VILLAGE_MIN_DISTANCE_FROM_CITY &&
            distance <= 6 &&
            reachable.has(coordKey(village.coordinate))
          );
        });

        expect(hasReachableVillage).toBe(true);
      });
    });
  });
});
