import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MapGenerator, MAP_SIZE_CONFIGS } from '@shared/utils/mapGenerator';
import type { HexCoordinate } from '@shared/types/coordinates';
import type { FactionId } from '@shared/types/faction';
import type { GameMap } from '@shared/types/game';
import type { MapSize } from '@shared/utils/mapGenerationConstants';

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

interface CharacterizationCase {
  name: string;
  seed: number;
  mapSize: MapSize;
  factions: FactionId[];
  expectedDigest: string;
}

const CHARACTERIZATION_CASES: CharacterizationCase[] = [
  {
    name: 'normal-four-core',
    seed: 4100,
    mapSize: 'normal',
    factions: ['NEPHITES', 'MULEKITES', 'LAMANITES', 'ZORAMITES'],
    expectedDigest: '05bdf310d7a62e130e3fb6e9c78af67d811ac1addcce274b17df8d5125948c0f',
  },
  {
    name: 'normal-eight-full',
    seed: 4101,
    mapSize: 'normal',
    factions: ALL_FACTIONS,
    expectedDigest: '999b0e8713400312d73acff5bad4662782233897eae7554149ca7a0d024ca71e',
  },
  {
    name: 'small-water-factions',
    seed: 4102,
    mapSize: 'small',
    factions: ['MULEKITES', 'HAGOTHS_MARINERS', 'NEPHITES', 'LAMANITES'],
    expectedDigest: 'cfdfc2a18f5d703cd918e8b2198139184ee5047f25e24466cd9c81f1c793d892',
  },
];

const coordKey = (coord: HexCoordinate) => `${coord.q},${coord.r},${coord.s}`;

const sortCounts = (counts: Record<string, number>) => {
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right))
  );
};

const countValues = (values: Array<string | undefined | null>) => {
  const counts: Record<string, number> = {};
  values.forEach(value => {
    if (value == null) return;
    counts[value] = (counts[value] ?? 0) + 1;
  });
  return sortCounts(counts);
};

const buildGenerator = (testCase: CharacterizationCase) => {
  const dimensions = MAP_SIZE_CONFIGS[testCase.mapSize].dimensions;
  return new MapGenerator(
    {
      width: dimensions,
      height: dimensions,
      seed: testCase.seed,
      playerCount: testCase.factions.length,
      mapSize: testCase.mapSize,
      minResourceDistance: 2,
      maxResourcesPerPlayer: 3,
    },
    testCase.factions
  );
};

const summarizeMap = (map: GameMap, generator: MapGenerator, testCase: CharacterizationCase) => {
  const report = generator.getGenerationReport();
  if (!report) {
    throw new Error(`Missing generation report for ${testCase.name}`);
  }

  const resources = map.tiles.flatMap(tile => tile.resources ?? []);

  return {
    seed: testCase.seed,
    mapSize: testCase.mapSize,
    playerCount: testCase.factions.length,
    dimensions: [map.width, map.height],
    tileCount: map.tiles.length,
    capitals: generator.getCapitalPositions().map(coordKey).sort(),
    terrainCounts: countValues(map.tiles.map(tile => tile.terrain)),
    featureCounts: countValues(map.tiles.map(tile => tile.feature)),
    resourceCounts: countValues(resources),
    cityOwners: countValues(
      map.tiles.filter(tile => tile.hasCity).map(tile => tile.cityOwner ?? 'neutral')
    ),
    water: {
      motif: report.water.motif,
      ratio: Number(report.water.ratio.toFixed(4)),
      bodySizes: report.water.bodySizes.slice(0, 8),
      repairsByCapital: report.water.repairsByCapital,
    },
    villages: {
      placed: report.villages.placed,
      target: report.villages.target,
      contested: report.villages.contested,
      contestedTarget: report.villages.contestedTarget,
      earlyCounts: report.villages.earlyCounts,
      ringCounts: report.villages.ringCounts,
    },
    neutralCities: {
      placed: report.neutralCities.placed,
      target: report.neutralCities.target,
      earlyCounts: report.neutralCities.earlyCounts,
    },
    resources: {
      homeCounts: report.resources.homeCounts,
      blockedBySpacing: report.resources.blockedBySpacing,
      blockedByCap: report.resources.blockedByCap,
      blockedByOccupied: report.resources.blockedByOccupied,
      fallbackPlaced: report.resources.fallbackPlaced,
      relaxSpacingUsed: report.resources.relaxSpacingUsed,
      relaxCapUsed: report.resources.relaxCapUsed,
      varietyExtraGranted: report.resources.varietyExtraGranted,
    },
    ruins: report.ruins,
  };
};

const digestSummary = (summary: ReturnType<typeof summarizeMap>) => {
  return createHash('sha256').update(JSON.stringify(summary)).digest('hex');
};

describe('MapGenerator characterization', () => {
  it.each(CHARACTERIZATION_CASES)('keeps representative generated summary stable for $name', testCase => {
    const generator = buildGenerator(testCase);
    const map = generator.generateMap();
    const summary = summarizeMap(map, generator, testCase);

    expect(digestSummary(summary), JSON.stringify(summary, null, 2)).toBe(testCase.expectedDigest);
  });

  it('returns defensive capital coordinate copies through the public API', () => {
    const generator = buildGenerator(CHARACTERIZATION_CASES[0]);
    generator.generateMap();

    const firstRead = generator.getCapitalPositions();
    firstRead[0].q = 999;

    expect(generator.getCapitalPositions()[0].q).not.toBe(999);
  });
});
