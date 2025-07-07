// Centralized 3D model management system
// Ensures all models are properly preloaded and cached for optimal performance

import { useGLTF } from '@react-three/drei';

// Define all model paths in one place for easy management
export const MODEL_PATHS = {
  // Upgraded unit models from attached assets
  units: {
    warrior: '/attached_assets/0-2_1751822119779.glb',
    worker: '/attached_assets/Worker_1751829936748.glb',
    scout: '/attached_assets/Fun Scout_1751831308185.glb',
    // Use upgraded models for all unit types for consistency
    spearman: '/attached_assets/0-2_1751822119779.glb', // Use warrior model
    commander: '/attached_assets/0-2_1751822119779.glb', // Use warrior model  
    stripling_warrior: '/attached_assets/0-2_1751822119779.glb', // Use warrior model
    guard: '/attached_assets/0-2_1751822119779.glb', // Use warrior model
    peacekeeping_guard: '/attached_assets/0-2_1751822119779.glb', // Use warrior model
    ancient_giant: '/attached_assets/0-2_1751822119779.glb', // Use warrior model
    wilderness_hunter: '/attached_assets/Fun Scout_1751831308185.glb', // Use scout model
    royal_envoy: '/attached_assets/Fun Scout_1751831308185.glb', // Use scout model
    missionary: '/attached_assets/Fun Scout_1751831308185.glb', // Use scout model temporarily
    boat: '/models/boat.glb', // Keep existing boat model
    catapult: '/attached_assets/0-2_1751822119779.glb', // Use warrior model
  },
  // Village models
  village: '/attached_assets/Village_1751831751478.glb',
  // City models (existing ones are fine)
  cities: {
    level1: '/models/city_level1.glb',
    level2: '/models/city_level2.glb',
    level3: '/models/city_level3.glb',
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

// Initialize model preloading
preloadAllModels();