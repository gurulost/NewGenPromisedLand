import { describe, it, expect } from 'vitest';
import { MapGenerator } from '@shared/utils/mapGenerator';
import type { FactionId } from '@shared/types/faction';

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
});
