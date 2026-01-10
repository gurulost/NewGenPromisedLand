export type MapSize = 'tiny' | 'small' | 'normal' | 'large' | 'huge';

export interface MapSizeConfig {
  tiles: number;
  dimensions: number;
  maxPlayers: number;
  name: string;
}

export const MAP_SIZE_CONFIGS: Record<MapSize, MapSizeConfig> = {
  tiny: { tiles: 121, dimensions: 11, maxPlayers: 8, name: 'Tiny' },
  small: { tiles: 196, dimensions: 14, maxPlayers: 8, name: 'Small' },
  normal: { tiles: 256, dimensions: 16, maxPlayers: 8, name: 'Normal' },
  large: { tiles: 324, dimensions: 18, maxPlayers: 8, name: 'Large' },
  huge: { tiles: 400, dimensions: 20, maxPlayers: 8, name: 'Huge' },
};

export const MAP_GENERATION_CONSTANTS = {
  // Tribal homeland influences
  TRIBAL_HOMELAND_RADIUS: 4,           // Tiles from capital where tribal modifiers apply
  TRIBAL_INFLUENCE_FALLOFF: 4,         // Distance divisor for influence calculation

  // Capital placement
  CAPITAL_SPAWN_RADIUS_RATIO: 0.6,     // Ratio of map radius for capital placement

  // City and village spacing
  CITY_MIN_DISTANCE: 6,                // Minimum distance between cities
  VILLAGE_MIN_DISTANCE: 3,             // Minimum distance between villages
  VILLAGE_MIN_DISTANCE_FROM_CITY: 4,   // Minimum distance from any city
  MAP_EDGE_BUFFER: 2,                  // Buffer distance from map edge
  VILLAGE_EDGE_RADIUS_RATIO: 0.85,     // Max radial distance ratio from center
  MAX_SPACING_RELAX: 1,                // Bounded spacing relax for guarantees
  MAX_CAP_OVERAGE_FOR_GUARANTEE: 1,    // Bounded cap overage for guarantees

  // Water generation
  WATER_EDGE_THRESHOLD: 0.8,           // Distance ratio for increased water at edges
  WATER_EDGE_CHANCE: 0.4,              // Water probability at map edges
  WATER_CENTER_CHANCE: 0.15,           // Water probability in center

  WATER_RATIO_BY_SIZE: {
    tiny: { min: 0.12, max: 0.2 },
    small: { min: 0.14, max: 0.22 },
    normal: { min: 0.16, max: 0.24 },
    large: { min: 0.18, max: 0.28 },
    huge: { min: 0.2, max: 0.3 },
  },
  WATER_MIN_BODY_SIZE_BY_SIZE: {
    tiny: 6,
    small: 8,
    normal: 10,
    large: 12,
    huge: 14,
  },
  WATER_MULEKITE_MIN_BODY_SIZE_BY_SIZE: {
    tiny: 8,
    small: 10,
    normal: 12,
    large: 14,
    huge: 16,
  },
  WATER_MULEKITE_MIN_COAST_TILES_BY_SIZE: {
    tiny: 2,
    small: 2,
    normal: 3,
    large: 3,
    huge: 3,
  },
  WATER_REPAIR_BUDGET: 3,
  WATER_REPAIR_SEARCH_RADIUS: 6,
  WATER_SMOOTH_PASSES: 1,

  // Resource placement
  INNER_CITY_RADIUS: 1,                // Adjacent to city
  OUTER_CITY_RADIUS: 2,                // Two tiles from city
  HOME_RADIUS_RESOURCES: 2,            // Home-zone radius for resource caps
  WILDERNESS_MIN_DISTANCE: 3,          // Minimum distance from city for wilderness resources
  MIN_HARVESTABLES_R2: 2,              // Capital harvest guarantee within radius 2

  // Ruins placement
  RUINS_DENSITY: 0.03,                 // Target ruins density per tile
  RUINS_MIN_DISTANCE: 3,               // Minimum distance between ruins
  RUINS_MIN_DISTANCE_FROM_CITY: 2,     // Minimum distance from cities/villages
  RUINS_NEAR_MIN_DISTANCE: 2,          // Min distance from capital for "near" ring
  RUINS_NEAR_MAX_DISTANCE: 4,          // Max distance from capital for "near" ring
  RUINS_MID_MAX_DISTANCE: 8,           // Max distance from capital for "mid" ring
  RUINS_MOUNTAIN_WEIGHT: 1.35,         // Slightly favor mountains for ruins
  RUINS_FOREST_WEIGHT: 1.1,            // Mild forest preference

  // Village density
  VILLAGE_DENSITY_RATIO: 25,           // Tiles per village (tiles.length / 25 = 4% density)
  VILLAGE_EARLY_RADIUS_BY_SIZE: {
    tiny: 7,
    small: 7,
    normal: 8,
    large: 9,
    huge: 9,
  },
  VILLAGE_TARGET_EARLY_MIN: 2,
  VILLAGE_CONTESTED_TARGET_RATIO: 0.15,
  VILLAGE_BEST_OF_K: 7,

  // Neutral city placement
  NEUTRAL_CITY_WORKABLE_MIN_BY_SIZE: {
    tiny: 6,
    small: 7,
    normal: 8,
    large: 9,
    huge: 10,
  },
  NEUTRAL_CITY_MIN_LANDMASS_BY_SIZE: {
    tiny: 10,
    small: 14,
    normal: 18,
    large: 22,
    huge: 26,
  },
  NEUTRAL_CITY_EARLY_RADIUS_BY_SIZE: {
    tiny: 7,
    small: 7,
    normal: 8,
    large: 9,
    huge: 9,
  },
  NEUTRAL_CITY_MIN_LAND_NEIGHBORS: 3,
  NEUTRAL_CITY_BEST_OF_K: 7,
} as const;

export const CAPITAL_MIN_DISTANCE_BY_SIZE: Record<MapSize, number> = {
  tiny: 4,
  small: 5,
  normal: 6,
  large: 7,
  huge: 8,
};
