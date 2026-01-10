import { describe, it, expect } from 'vitest';
import { MapGenerator, MAP_GENERATION_CONSTANTS } from '@shared/utils/mapGenerator';
import type { FactionId } from '@shared/types/faction';
import { hexDistance } from '@shared/utils/hex';

describe('Map Generation - Ruins', () => {
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

  it('places ruins on valid land tiles with spacing', () => {
    const playerFactions: FactionId[] = ['NEPHITES', 'LAMANITES', 'MULEKITES', 'ZORAMITES'];
    const mapGenerator = createMapGenerator(4, 8, playerFactions, 'ruins-seed');
    const map = mapGenerator.generateMap();

    const ruinTiles = map.tiles.filter(tile => tile.resources.includes('jaredite_ruins'));
    expect(ruinTiles.length).toBeGreaterThan(0);

    const invalidPlacement = ruinTiles.some(tile =>
      tile.terrain === 'water' || tile.hasCity || tile.feature === 'village'
    );
    expect(invalidPlacement).toBe(false);

    for (let i = 0; i < ruinTiles.length; i++) {
      for (let j = i + 1; j < ruinTiles.length; j++) {
        const distance = hexDistance(ruinTiles[i].coordinate, ruinTiles[j].coordinate);
        expect(distance).toBeGreaterThanOrEqual(MAP_GENERATION_CONSTANTS.RUINS_MIN_DISTANCE);
      }
    }
  });

  it('keeps some ruins beyond the near-capital ring when extras exist', () => {
    const playerFactions: FactionId[] = ['NEPHITES', 'LAMANITES', 'MULEKITES', 'ZORAMITES'];
    const mapGenerator = createMapGenerator(4, 8, playerFactions, 'ruins-explore-seed');
    const map = mapGenerator.generateMap();
    const capitals = mapGenerator.getCapitalPositions();

    const ruinTiles = map.tiles.filter(tile => tile.resources.includes('jaredite_ruins'));
    const hasExplorationRuin = ruinTiles.some(tile => {
      const nearest = Math.min(...capitals.map(cap => hexDistance(tile.coordinate, cap)));
      return nearest > MAP_GENERATION_CONSTANTS.RUINS_NEAR_MAX_DISTANCE;
    });

    expect(hasExplorationRuin).toBe(true);
  });
});
