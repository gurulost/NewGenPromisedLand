// Centralized 3D model management system
// Ensures all models are properly preloaded and cached for optimal performance

import { useGLTF } from '@react-three/drei';

// Define all model paths in one place for easy management
export const MODEL_PATHS = {
  // Upgraded unit models from attached assets
  units: {
    warrior: '/models/warrior.glb', // Upgraded warrior model
    worker: '/models/settler.glb', // Upgraded settler model for worker units
    scout: '/models/scout.glb',

    // Use standard models for all unit types for consistency
    spearman: '/models/warrior.glb', // Use warrior model
    commander: '/models/warrior.glb', // Use warrior model  
    stripling_warrior: '/models/stripling_warrior.glb', // Upgraded stripling warrior model
    guard: '/models/warrior.glb', // Use warrior model
    peacekeeping_guard: '/models/warrior.glb', // Use warrior model
    ancient_giant: '/models/warrior.glb', // Use warrior model
    wilderness_hunter: '/models/scout.glb', // Use scout model
    royal_envoy: '/models/scout.glb', // Use scout model
    missionary: '/models/missionary.glb', // Upgraded missionary model
    boat: '/models/boat.glb', // Upgraded boat model
    catapult: '/models/warrior.glb', // Use warrior model
    cavalry: '/models/cavalry.glb', // Upgraded cavalry model (war elephant)
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

// Preload all models for optimal performance
export const preloadAllModels = () => {
  // Preload unit models
  Object.values(MODEL_PATHS.units).forEach(path => {
    useGLTF.preload(path);
  });
  
  // Preload village model
  useGLTF.preload(MODEL_PATHS.village);
  
  // Preload city models
  Object.values(MODEL_PATHS.cities).forEach(path => {
    useGLTF.preload(path);
  });
  
  // Preload resource models
  Object.values(MODEL_PATHS.resources).forEach(path => {
    useGLTF.preload(path);
  });
};

// Get model path for a specific unit type
export const getUnitModelPath = (unitType: string): string => {
  return MODEL_PATHS.units[unitType as keyof typeof MODEL_PATHS.units] || MODEL_PATHS.units.warrior;
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
      return MODEL_PATHS.resources.timber_grove;
    case 'wild_goats':
    case 'sea_beast':
      return MODEL_PATHS.resources.game; // Animal model for creatures
    case 'grain_patch':
      return MODEL_PATHS.resources.fruit; // Agricultural products
    case 'ore_vein':
      return MODEL_PATHS.resources.ore_vein;
    case 'fishing_shoal':
      return MODEL_PATHS.resources.fishing_shoal;
    case 'jaredite_ruins':
      return MODEL_PATHS.resources.jaredite_ruins;
    
    // Legacy resources for backward compatibility
    case 'fruit':
      return MODEL_PATHS.resources.fruit;
    case 'stone':
      return MODEL_PATHS.resources.stone;
    case 'game':
      return MODEL_PATHS.resources.game;
    case 'metal':
      return MODEL_PATHS.resources.metal;
    
    default:
      return null;
  }
};

// Initialize model preloading
preloadAllModels();