// Centralized 3D model management system
// Ensures all models are properly preloaded and cached for optimal performance

import { useGLTF } from '@react-three/drei';

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

    // Scout variants
    wilderness_hunter: '/models/wilderness_hunter.glb',
    royal_envoy: '/models/royal_envoy.glb',

    // Religious/influence units
    missionary: '/models/missionary.glb',
    priestcraft_preacher: '/models/priestcraft_preacher.glb',
    converted_missionary: '/models/converted_missionary.glb',
    scribe_teacher: '/models/scribe_teacher.glb',
    prophet: '/models/prophet.glb',
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
    timber_grove: '/models/forest_canopy.glb', // Enchanted forest model for timber groves
    fishing_shoal: '/models/fish_shoal.glb', // Fish shoal model for water resources
    jaredite_ruins: '/models/jaredite_ruins.glb', // Jaredite ruins model
    ore_vein: '/models/ore_vein.glb', // Ore vein model for unified ore system
  }
};

// Automatically derive available models from MODEL_PATHS to prevent manual list drift
const buildAvailableModelPaths = (): Set<string> => {
  const paths = new Set<string>();

  // Add all unit models
  Object.values(MODEL_PATHS.units).forEach(path => paths.add(path));

  // Add village model
  paths.add(MODEL_PATHS.village);

  // Add all city models
  Object.values(MODEL_PATHS.cities).forEach(path => paths.add(path));

  // Add all resource models
  Object.values(MODEL_PATHS.resources).forEach(path => paths.add(path));

  return paths;
};

const AVAILABLE_MODEL_PATHS = buildAvailableModelPaths();

const isModelAvailable = (path?: string | null) => !!path && AVAILABLE_MODEL_PATHS.has(path);

// Preload all models for optimal performance
export const preloadAllModels = () => {
  const preloadPaths = new Set<string>();

  // Preload unit models
  Object.values(MODEL_PATHS.units).forEach(path => {
    if (isModelAvailable(path)) preloadPaths.add(path);
  });

  // Preload village model
  if (isModelAvailable(MODEL_PATHS.village)) {
    preloadPaths.add(MODEL_PATHS.village);
  }

  // Preload city models
  Object.values(MODEL_PATHS.cities).forEach(path => {
    if (isModelAvailable(path)) preloadPaths.add(path);
  });

  // Preload resource models
  Object.values(MODEL_PATHS.resources).forEach(path => {
    if (isModelAvailable(path)) preloadPaths.add(path);
  });

  preloadPaths.forEach(path => useGLTF.preload(path));
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

// Initialize model preloading
preloadAllModels();
