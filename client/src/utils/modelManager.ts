// Centralized 3D model management system
// Ensures all models are properly preloaded and cached for optimal performance

import { useGLTF } from '@react-three/drei';
import type { GameState } from '@shared/types/game';
import { UNIT_ANIMATION_REGISTRY } from './unitAnimationRegistry';

// Define all model paths in one place for easy management
export const MODEL_PATHS = {
  // Unit models - each unit type has its own unique model
  units: {
    // Core units
    warrior: '/models/warrior.glb',
    worker: '/models/settler.glb',
    scout: '/models/scout.glb',
    slinger: '/models/archer.glb',

    // Infantry units
    spearman: '/models/spearman.glb',
    commander: '/models/commander.glb',
    guard: '/models/guard.glb',
    peacekeeping_guard: '/models/peacekeeping_guard.glb',
    stripling_warrior: '/models/stripling_warrior.glb',

    // Large/special units
    ancient_giant: '/models/ancient_giant.glb',
    cavalry: '/models/cavalry.glb',
    catapult: '/models/catapult.glb',
    boat: '/models/boat.glb',
    voyager: '/models/boat.glb',

    // Scout variants
    wilderness_hunter: '/models/wilderness_hunter.glb',
    royal_envoy: '/models/royal_envoy.glb',

    // Religious/influence units
    missionary: '/models/missionary.glb',
    priestcraft_preacher: '/models/priestcraft_preacher.glb',
    converted_missionary: '/models/converted_missionary.glb',
    scribe_teacher: '/models/scribe_teacher.glb',
    prophet: '/models/prophet.glb',
    shipwright: '/models/settler.glb',
    taskmaster: '/models/priestcraft_preacher.glb',
    amulonite_enforcer: '/models/guard.glb',
  },
  // Village models
  village: '/models/village.glb', // Upgraded village model
  // City models (existing ones are fine)
  cities: {
    level1: '/models/city_level1.glb',
    level2: '/models/city_level2.glb',
    level3: '/models/city_level3.glb',
  },
  // Resource models - Unified World Elements System
  resources: {
    // Legacy models for backward compatibility
    fruit: '/models/fruit.glb',
    stone: '/models/stone.glb',
    game: '/models/game.glb',
    metal: '/models/metal.glb',

    // New unified world elements models
    timber_grove: '/models/forest_canopy.glb',
    fishing_shoal: '/models/fish_shoal.glb',
    jaredite_ruins: '/models/jaredite_ruins.glb',
    ore_vein: '/models/ore_vein.glb',
  },
  // Improvement models - tile-based constructions
  improvements: {
    farm: '/models/improvements/farm.glb',
    mine: '/models/improvements/mine.glb',
    forest_camp: '/models/improvements/forest_camp.glb',
    lumber_hut: '/models/improvements/lumber_hut.glb',
    sawmill: '/models/improvements/sawmill.glb',
    plantation: '/models/improvements/plantation.glb',
    irrigation: '/models/improvements/irrigation.glb',
    workshop: '/models/improvements/workshop.glb',
    port: '/models/improvements/port.glb',
    aqueduct: '/models/improvements/aqueduct.glb',
    road: '/models/improvements/road.glb',
    shrine: '/models/improvements/shrine.glb',
  },
  // Structure models - city buildings
  structures: {
    temple: '/models/structures/temple.glb',
    granary: '/models/structures/granary.glb',
    lighthouse: '/models/structures/lighthouse.glb',
    cathedral: '/models/structures/cathedral.glb',
    academy: '/models/structures/academy.glb',
    library: '/models/structures/library.glb',
    fortress: '/models/structures/fortress.glb',
  }
};

const TERRAIN_MODEL_PATHS = [
  '/models/terrain_plains.glb',
  '/models/terrain_forest.glb',
  '/models/terrain_mountain.glb',
  '/models/terrain_hill.glb',
  '/models/terrain_water.glb',
];

// Automatically derive available models from MODEL_PATHS to prevent manual list drift
const buildAvailableModelPaths = (): Set<string> => {
  const paths = new Set<string>();

  // Add all unit models
  Object.values(MODEL_PATHS.units).forEach(path => paths.add(path));
  Object.values(UNIT_ANIMATION_REGISTRY).forEach((entry) => {
    if (entry?.animatedModelPath) paths.add(entry.animatedModelPath);
  });

  // Add village model
  paths.add(MODEL_PATHS.village);

  // Add all city models
  Object.values(MODEL_PATHS.cities).forEach(path => paths.add(path));

  // Add all resource models
  Object.values(MODEL_PATHS.resources).forEach(path => paths.add(path));

  // Add all improvement models
  Object.values(MODEL_PATHS.improvements).forEach(path => paths.add(path));

  // Add all structure models
  Object.values(MODEL_PATHS.structures).forEach(path => paths.add(path));

  // Add terrain models
  TERRAIN_MODEL_PATHS.forEach(path => paths.add(path));

  return paths;
};

const AVAILABLE_MODEL_PATHS = buildAvailableModelPaths();

const isModelAvailable = (path?: string | null) => !!path && AVAILABLE_MODEL_PATHS.has(path);

const preloadedPaths = new Set<string>();

const preloadPaths = (paths: Iterable<string>) => {
  Array.from(paths).forEach((path) => {
    if (!isModelAvailable(path)) return;
    if (preloadedPaths.has(path)) return;
    preloadedPaths.add(path);
    useGLTF.preload(path);
  });
};

// Preload all models for optimal performance
export const preloadAllModels = () => {
  const pathsToPreload = new Set<string>();

  // Preload unit models
  Object.values(MODEL_PATHS.units).forEach(path => {
    if (isModelAvailable(path)) pathsToPreload.add(path);
  });
  Object.values(UNIT_ANIMATION_REGISTRY).forEach((entry) => {
    if (entry?.animatedModelPath && isModelAvailable(entry.animatedModelPath)) {
      pathsToPreload.add(entry.animatedModelPath);
    }
  });

  // Preload village model
  if (isModelAvailable(MODEL_PATHS.village)) {
    pathsToPreload.add(MODEL_PATHS.village);
  }

  // Preload city models
  Object.values(MODEL_PATHS.cities).forEach(path => {
    if (isModelAvailable(path)) pathsToPreload.add(path);
  });

  // Preload resource models
  Object.values(MODEL_PATHS.resources).forEach(path => {
    if (isModelAvailable(path)) pathsToPreload.add(path);
  });

  // Preload improvement models
  Object.values(MODEL_PATHS.improvements).forEach(path => {
    if (isModelAvailable(path)) pathsToPreload.add(path);
  });

  // Preload structure models
  Object.values(MODEL_PATHS.structures).forEach(path => {
    if (isModelAvailable(path)) pathsToPreload.add(path);
  });

  // Preload terrain models
  TERRAIN_MODEL_PATHS.forEach((path) => {
    if (isModelAvailable(path)) pathsToPreload.add(path);
  });

  preloadPaths(pathsToPreload);
};

// Get model path for a specific unit type
export const getUnitModelPath = (unitType: string): string => {
  const path = MODEL_PATHS.units[unitType as keyof typeof MODEL_PATHS.units];
  if (isModelAvailable(path)) return path;

  // Warn developers when falling back to warrior model
  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
    console.warn(`[ModelManager] Model path "${path || unitType}" not available, falling back to warrior`);
  }
  return MODEL_PATHS.units.warrior;
};

export const getAnimatedUnitModelPath = (unitType: string): string | null => {
  const path = UNIT_ANIMATION_REGISTRY[unitType as keyof typeof UNIT_ANIMATION_REGISTRY]?.animatedModelPath;
  return path && isModelAvailable(path) ? path : null;
};

export const preloadAnimatedUnitModels = (unitTypes?: string[]) => {
  const types = unitTypes ?? Object.keys(UNIT_ANIMATION_REGISTRY);
  const pathsToPreload = new Set<string>();
  types.forEach((type) => {
    const path = UNIT_ANIMATION_REGISTRY[type as keyof typeof UNIT_ANIMATION_REGISTRY]?.animatedModelPath;
    if (path && isModelAvailable(path)) pathsToPreload.add(path);
  });
  preloadPaths(pathsToPreload);
};

// Get model path for village
export const getVillageModelPath = (): string => {
  return MODEL_PATHS.village;
};

// Get model path for city based on level
export const getCityModelPath = (level: number): string => {
  if (level >= 3) return MODEL_PATHS.cities.level3;
  if (level >= 2) return MODEL_PATHS.cities.level2;
  return MODEL_PATHS.cities.level1;
};

// Get resource model path for unified world elements system
export const getResourceModelPath = (resourceType: string): string | null => {
  switch (resourceType) {
    // Unified World Elements System - Scripture-themed resources
    case 'timber_grove':
      return isModelAvailable(MODEL_PATHS.resources.timber_grove) ? MODEL_PATHS.resources.timber_grove : null;
    case 'wild_goats':
    case 'sea_beast':
      return isModelAvailable(MODEL_PATHS.resources.game) ? MODEL_PATHS.resources.game : null; // Animal model for creatures
    case 'grain_patch':
      return isModelAvailable(MODEL_PATHS.resources.fruit) ? MODEL_PATHS.resources.fruit : null; // Agricultural products
    case 'ore_vein':
      return isModelAvailable(MODEL_PATHS.resources.ore_vein) ? MODEL_PATHS.resources.ore_vein : null;
    case 'fishing_shoal':
      return isModelAvailable(MODEL_PATHS.resources.fishing_shoal) ? MODEL_PATHS.resources.fishing_shoal : null;
    case 'jaredite_ruins':
      return isModelAvailable(MODEL_PATHS.resources.jaredite_ruins) ? MODEL_PATHS.resources.jaredite_ruins : null;

    // Legacy resources for backward compatibility
    case 'fruit':
      return isModelAvailable(MODEL_PATHS.resources.fruit) ? MODEL_PATHS.resources.fruit : null;
    case 'stone':
      return isModelAvailable(MODEL_PATHS.resources.stone) ? MODEL_PATHS.resources.stone : null;
    case 'game':
      return isModelAvailable(MODEL_PATHS.resources.game) ? MODEL_PATHS.resources.game : null;
    case 'metal':
      return isModelAvailable(MODEL_PATHS.resources.metal) ? MODEL_PATHS.resources.metal : null;

    default:
      return null;
  }
};

// Get model path for a specific improvement type
export const getImprovementModelPath = (improvementType: string): string | null => {
  const path = MODEL_PATHS.improvements[improvementType as keyof typeof MODEL_PATHS.improvements];
  if (isModelAvailable(path)) return path;
  return null;
};

// Get model path for a specific structure type
export const getStructureModelPath = (structureType: string): string | null => {
  const path = MODEL_PATHS.structures[structureType as keyof typeof MODEL_PATHS.structures];
  if (isModelAvailable(path)) return path;
  return null;
};

export type ModelPreloadMode = 'all' | 'match' | 'none';

const getStaticUnitModelPath = (unitType: string): string | null => {
  const path = MODEL_PATHS.units[unitType as keyof typeof MODEL_PATHS.units];
  return isModelAvailable(path) ? path : null;
};

export const collectMatchModelPaths = (gameState: GameState): Set<string> => {
  const paths = new Set<string>();

  if (isModelAvailable(MODEL_PATHS.village)) paths.add(MODEL_PATHS.village);

  const unitTypes = new Set(gameState.units.map((unit) => unit.type));
  unitTypes.forEach((type) => {
    const staticPath = getStaticUnitModelPath(type);
    if (staticPath) paths.add(staticPath);
    const animatedPath = UNIT_ANIMATION_REGISTRY[type as keyof typeof UNIT_ANIMATION_REGISTRY]?.animatedModelPath;
    if (animatedPath && isModelAvailable(animatedPath)) paths.add(animatedPath);
  });

  gameState.cities?.forEach((city) => {
    paths.add(getCityModelPath(city.level));
  });

  gameState.improvements?.forEach((improvement) => {
    const path = getImprovementModelPath(improvement.type);
    if (path) paths.add(path);
  });

  gameState.structures?.forEach((structure) => {
    const path = getStructureModelPath(structure.type);
    if (path) paths.add(path);
  });

  const resourceTypes = new Set<string>();
  gameState.map?.tiles.forEach((tile) => {
    tile.resources?.forEach((resource) => resourceTypes.add(resource));
  });

  resourceTypes.forEach((resourceType) => {
    const path = getResourceModelPath(resourceType);
    if (path) paths.add(path);
  });

  return paths;
};

export const preloadMatchModels = (gameState: GameState) => {
  preloadPaths(collectMatchModelPaths(gameState));
};

export const initModelPreloading = (params: {
  mode?: ModelPreloadMode;
  gameState?: GameState;
  useIdle?: boolean;
  deferMs?: number;
}) => {
  const {
    mode = 'match',
    gameState,
    useIdle = true,
    deferMs = 300,
  } = params;

  if (mode === 'none') return () => undefined;

  const perform = () => {
    if (mode === 'all') {
      preloadAllModels();
      return;
    }
    if (mode === 'match' && gameState) {
      preloadMatchModels(gameState);
    }
  };

  if (typeof window === 'undefined') {
    perform();
    return () => undefined;
  }

  const idleCallback = (window as any).requestIdleCallback as
    | ((cb: () => void, opts?: { timeout: number }) => number)
    | undefined;
  const cancelIdle = (window as any).cancelIdleCallback as
    | ((id: number) => void)
    | undefined;

  if (useIdle && idleCallback) {
    const idleId = idleCallback(perform, { timeout: Math.max(deferMs, 0) });
    return () => {
      if (cancelIdle) cancelIdle(idleId);
    };
  }

  const timeoutId = window.setTimeout(perform, deferMs);
  return () => window.clearTimeout(timeoutId);
};
