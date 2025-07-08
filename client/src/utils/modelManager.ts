// Centralized 3D model management system
// Ensures all models are properly preloaded and cached for optimal performance

import { useGLTF } from '@react-three/drei';

// Define all model paths in one place for easy management
export const MODEL_PATHS = {
  // Upgraded unit models from attached assets
  units: {
    warrior: '/models/warrior.glb',
    worker: '/models/worker.glb',
    scout: '/models/scout.glb',
    // Use standard models for all unit types for consistency
    spearman: '/models/warrior.glb', // Use warrior model
    commander: '/models/warrior.glb', // Use warrior model  
    stripling_warrior: '/models/warrior.glb', // Use warrior model
    guard: '/models/warrior.glb', // Use warrior model
    peacekeeping_guard: '/models/warrior.glb', // Use warrior model
    ancient_giant: '/models/warrior.glb', // Use warrior model
    wilderness_hunter: '/models/scout.glb', // Use scout model
    royal_envoy: '/models/scout.glb', // Use scout model
    missionary: '/models/scout.glb', // Use scout model temporarily
    boat: '/models/boat.glb', // Keep existing boat model
    catapult: '/models/warrior.glb', // Use warrior model
  },
  // Village models
  village: '/models/village.glb',
  // City models (existing ones are fine)
  cities: {
    level1: '/models/city_level1.glb',
    level2: '/models/city_level2.glb',
    level3: '/models/city_level3.glb',
  },
  // Resource models
  resources: {
    fruit: '/models/fruit.glb',
    stone: '/models/stone.glb',
    game: '/models/game.glb',
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

// Get resource model path
export const getResourceModelPath = (resourceType: string): string | null => {
  switch (resourceType) {
    case 'fruit':
      return MODEL_PATHS.resources.fruit;
    case 'stone':
      return MODEL_PATHS.resources.stone;
    case 'game':
    case 'animal':
      return MODEL_PATHS.resources.game;
    default:
      return null; // Return null for resources without 3D models (will use procedural)
  }
};

// Initialize model preloading
preloadAllModels();