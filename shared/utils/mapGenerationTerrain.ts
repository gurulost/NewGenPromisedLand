import type { HexCoordinate } from '@shared/types/coordinates';
import type { FactionId } from '@shared/types/faction';
import type { TerrainType, Tile } from '@shared/types/game';
import { hexDistance } from './hex';
import { MAP_GENERATION_CONSTANTS } from './mapGenerationConstants';
import type { RandomSource } from './mapGenerationRandom';
import type {
  ResourceSpawnRate,
  TerrainProbabilities,
  TribalSpawnModifiers,
} from './mapGenerationTypes';

type Noise2D = (x: number, y: number) => number;

/**
 * Tribal Homeland Generation System
 * Each tribe begins on a procedurally generated homeland tilted toward their cultural resources
 * Uses Polytopia-style multipliers with proper order of operations for consistent tile mix
 */
export const TRIBAL_SPAWN_MODIFIERS: Record<FactionId, TribalSpawnModifiers> = {
  NEPHITES: {
    mountain: 0.8,
    forest: 1.0,
    grainField: 1.2,
    wildAnimal: 1.0,
    water: 1.0,
    fish: 1.0,
    ruins: 1.0,
    lore: "Advanced civilization with organized agriculture and cities",
  },
  LAMANITES: {
    mountain: 1.0,
    forest: 1.5,
    grainField: 1.0,
    wildAnimal: 1.5,
    water: 1.0,
    fish: 1.0,
    ruins: 1.0,
    lore: "Forest-dwelling hunters skilled in wilderness survival",
  },
  MULEKITES: {
    mountain: 1.0,
    forest: 1.0,
    grainField: 1.0,
    wildAnimal: 1.0,
    water: 2.0,
    fish: 1.8,
    ruins: 1.2,
    lore: "River-valley traders with access to waterways and ancient ruins",
  },
  ANTI_NEPHI_LEHIES: {
    mountain: 0.6,
    forest: 1.0,
    grainField: 1.5,
    wildAnimal: 1.5,
    water: 1.0,
    fish: 1.0,
    ruins: 1.0,
    lore: "Peaceful herders focused on agriculture and animal husbandry",
  },
  ZORAMITES: {
    mountain: 1.5,
    forest: 0.5,
    grainField: 1.0,
    wildAnimal: 1.0,
    water: 1.0,
    fish: 1.0,
    ruins: 1.0,
    lore: "Mountain-dwelling people with rocky, challenging homeland",
  },
  JAREDITES: {
    mountain: 1.5,
    forest: 1.0,
    grainField: 1.0,
    wildAnimal: 1.0,
    water: 1.0,
    fish: 1.0,
    ruins: 2.0,
    lore: "Ancient civilization with extensive ruins and mountainous territory",
  },
  HAGOTHS_MARINERS: {
    mountain: 0.9,
    forest: 1.2,
    grainField: 0.9,
    wildAnimal: 0.9,
    water: 2.3,
    fish: 2.0,
    ruins: 1.0,
    lore: "Maritime shipbuilders with strong coastal economies and exploratory traditions",
  },
  AMULONITES: {
    mountain: 1.0,
    forest: 1.0,
    grainField: 1.3,
    wildAnimal: 1.2,
    water: 0.9,
    fish: 0.8,
    ruins: 0.9,
    lore: "Taskmaster regimes built on agricultural extraction and coercive control",
  },
};

export const normalizeFactionId = (id?: string): FactionId | null => {
  if (!id) return null;
  const upper = id.toUpperCase();
  return (upper in TRIBAL_SPAWN_MODIFIERS) ? (upper as FactionId) : null;
};

export const getTribalSpawnModifiers = (id?: string): TribalSpawnModifiers | null => {
  const factionId = normalizeFactionId(id);
  return factionId ? TRIBAL_SPAWN_MODIFIERS[factionId] : null;
};

export const factionWantsWater = (id?: string): boolean => {
  return (getTribalSpawnModifiers(id)?.water ?? 1) > 1;
};

export const getFactionFishModifier = (id?: string): number => {
  return getTribalSpawnModifiers(id)?.fish ?? 1;
};

export const generateFactionBiasedTerrain = ({
  tiles,
  capitalPositions,
  playerFactions,
  terrainRng,
  terrainNoise2D,
}: {
  tiles: Tile[];
  capitalPositions: HexCoordinate[];
  playerFactions: string[];
  terrainRng: RandomSource;
  terrainNoise2D: Noise2D;
}): void => {
  const baseTerrain = {
    plains: 0.48,
    forest: 0.38,
    mountain: 0.14,
  };

  for (const tile of tiles) {
    if (tile.terrain === 'water') continue;

    let terrainProbs = { ...baseTerrain };

    for (let i = 0; i < capitalPositions.length; i++) {
      const distance = hexDistance(tile.coordinate, capitalPositions[i]);
      if (distance <= MAP_GENERATION_CONSTANTS.TRIBAL_HOMELAND_RADIUS) {
        const modifiers = getTribalSpawnModifiers(playerFactions[i]);

        if (modifiers) {
          const influence = Math.max(0, 1 - distance / MAP_GENERATION_CONSTANTS.TRIBAL_INFLUENCE_FALLOFF);
          terrainProbs = applyPolytopiaTribalModifiers(terrainProbs, modifiers, influence);
        }
      }
    }

    tile.terrain = selectLandTerrainFromProbabilities({
      coord: tile.coordinate,
      probs: terrainProbs,
      terrainRng,
      terrainNoise2D,
    });
  }
};

export const applyPolytopiaTribalModifiers = (
  base: TerrainProbabilities,
  modifiers: TribalSpawnModifiers,
  influence: number
): TerrainProbabilities => {
  let mountain = base.mountain;
  const mountainMod = 1 + (modifiers.mountain - 1) * influence;
  mountain = Math.min(0.8, Math.max(0.05, mountain * mountainMod));

  const remainingAfterMountain = 1 - mountain;
  let forest = base.forest * remainingAfterMountain / (base.forest + base.plains);
  const forestMod = 1 + (modifiers.forest - 1) * influence;
  forest = Math.min(remainingAfterMountain * 0.9, Math.max(0.05, forest * forestMod));

  const plains = Math.max(0.05, remainingAfterMountain - forest);

  return { mountain, forest, plains };
};

export const selectLandTerrainFromProbabilities = ({
  coord,
  probs,
  terrainRng,
  terrainNoise2D,
}: {
  coord: HexCoordinate;
  probs: TerrainProbabilities;
  terrainRng: RandomSource;
  terrainNoise2D: Noise2D;
}): TerrainType => {
  const noiseValue = terrainNoise2D(coord.q * 0.1, coord.r * 0.1);
  const rand = Math.max(0, Math.min(0.999, terrainRng.next() + noiseValue * 0.2));

  if (rand < probs.mountain) return 'mountain';
  if (rand < probs.mountain + probs.forest) return 'forest';
  return 'plains';
};

export const applyTribalResourceModifiers = (
  baseRates: ResourceSpawnRate,
  modifiers: TribalSpawnModifiers,
  influence: number
): ResourceSpawnRate => {
  const modified = { ...baseRates };

  const wildGoatsMod = 1 + (modifiers.wildAnimal - 1) * influence;
  const fishMod = 1 + (modifiers.fish - 1) * influence;

  modified.wild_goats = Math.round(modified.wild_goats * wildGoatsMod);
  modified.fishing_shoal = Math.round(modified.fishing_shoal * fishMod);
  modified.sea_beast = Math.round(modified.sea_beast * fishMod);

  modified.wild_goats = Math.max(0, Math.min(30, modified.wild_goats));
  modified.fishing_shoal = Math.max(0, Math.min(20, modified.fishing_shoal));
  modified.sea_beast = Math.max(0, Math.min(15, modified.sea_beast));

  return modified;
};

export const applyTribalModifiersForTile = ({
  baseRates,
  coord,
  capitalPositions,
  playerCount,
  playerFactions,
}: {
  baseRates: ResourceSpawnRate;
  coord: HexCoordinate;
  capitalPositions: HexCoordinate[];
  playerCount: number;
  playerFactions: string[];
}): ResourceSpawnRate => {
  let modified = { ...baseRates };

  for (let i = 0; i < playerCount && i < capitalPositions.length; i++) {
    const capitalPos = capitalPositions[i];
    const distance = hexDistance(coord, capitalPos);
    if (distance > MAP_GENERATION_CONSTANTS.TRIBAL_HOMELAND_RADIUS) continue;

    const modifiers = getTribalSpawnModifiers(playerFactions[i]);
    if (!modifiers) continue;

    const influence = Math.max(0, 1 - distance / MAP_GENERATION_CONSTANTS.TRIBAL_INFLUENCE_FALLOFF);
    modified = applyTribalResourceModifiers(modified, modifiers, influence);
  }

  return modified;
};

export const placeSpecialFeatures = (): void => {
  // No generated tribal special features are defined yet; faction identity is handled by terrain and resource modifiers.
};
