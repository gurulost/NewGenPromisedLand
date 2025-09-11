// Centralized 3D model management system
// Ensures all models are properly preloaded and cached for optimal performance

import { useGLTF } from '@react-three/drei';

// Define all model paths in one place for easy management
export const MODEL_PATHS = {
  // Enhanced unit models with faction-specific variants
  units: {
    // Core civilization units - foundational types
    warrior: '/models/warrior.glb',          // Standard melee fighter
    worker: '/models/settler.glb',           // Civilian builder
    scout: '/models/scout.glb',              // Reconnaissance unit
    spearman: '/models/warrior.glb',         // Spear formation fighter
    commander: '/models/warrior.glb',        // Military leader
    guard: '/models/warrior.glb',            // Defensive unit
    
    // Faction-specific elite units with unique models
    stripling_warrior: '/models/stripling_warrior.glb', // Nephite: Faithful young warriors (2,000 sons)
    missionary: '/models/missionary.glb',               // Nephite: Religious conversion specialists
    cavalry: '/models/cavalry.glb',                     // Mulekite: War elephants/mounted cavalry
    
    // Cultural variant units using enhanced fallbacks
    peacekeeping_guard: '/models/warrior.glb',     // Anti-Nephi-Lehi: Pacifist defenders
    ancient_giant: '/models/warrior.glb',           // Jaredite: Powerful giant warriors
    wilderness_hunter: '/models/scout.glb',         // Lamanite: Expert wilderness trackers
    royal_envoy: '/models/missionary.glb',          // Zoramite: Diplomatic representatives
    
    // Naval and siege specialists
    boat: '/models/boat.glb',                       // Naval transport and combat
    catapult: '/models/warrior.glb',                // Siege warfare engine
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

// Enhanced unit model path resolver with intelligent fallbacks
export const getUnitModelPath = (unitType: string, factionId?: string): string => {
  // First, try to find faction-specific variant if factionId is provided
  if (factionId) {
    const factionSpecificKey = `${unitType}_${factionId.toLowerCase()}` as keyof typeof MODEL_PATHS.units;
    const factionSpecificPath = MODEL_PATHS.units[factionSpecificKey];
    if (factionSpecificPath) {
      return factionSpecificPath;
    }
    
    // Try alternative faction naming conventions
    const shortFactionId = getFactionShortName(factionId);
    if (shortFactionId) {
      const altFactionKey = `${unitType}_${shortFactionId}` as keyof typeof MODEL_PATHS.units;
      const altFactionPath = MODEL_PATHS.units[altFactionKey];
      if (altFactionPath) {
        return altFactionPath;
      }
    }
  }
  
  // Get base model path
  const basePath = MODEL_PATHS.units[unitType as keyof typeof MODEL_PATHS.units];
  if (basePath) {
    return basePath;
  }
  
  // Intelligent fallbacks based on unit role and faction
  const fallbackPath = getUnitFallbackPath(unitType, factionId);
  return fallbackPath;
};

// Helper function to get faction short names for model variants
const getFactionShortName = (factionId: string): string | null => {
  switch (factionId.toUpperCase()) {
    case 'NEPHITES':
      return 'nephite';
    case 'LAMANITES':
      return 'lamanite';
    case 'MULEKITES':
      return 'mulekite';
    case 'JAREDITES':
      return 'jaredite';
    case 'ANTI_NEPHI_LEHI':
      return 'anl';
    case 'ZORAMITES':
      return 'zoramite';
    default:
      return null;
  }
};

// Enhanced fallback system with faction awareness
const getUnitFallbackPath = (unitType: string, factionId?: string): string => {
  // Faction-specific intelligent fallbacks
  if (factionId) {
    switch (factionId.toUpperCase()) {
      case 'NEPHITES':
        // Nephites prefer religious/elite units
        if (['commander', 'guard'].includes(unitType)) {
          return MODEL_PATHS.units.stripling_warrior || MODEL_PATHS.units.warrior;
        }
        if (['priest', 'elder'].includes(unitType)) {
          return MODEL_PATHS.units.missionary;
        }
        break;
        
      case 'LAMANITES':
        // Lamanites prefer wilderness/hunting units
        if (['tracker', 'ranger'].includes(unitType)) {
          return MODEL_PATHS.units.scout;
        }
        break;
        
      case 'MULEKITES':
        // Mulekites prefer cavalry and mounted units
        if (['mounted_warrior', 'war_elephant'].includes(unitType)) {
          return MODEL_PATHS.units.cavalry;
        }
        break;
        
      case 'JAREDITES':
        // Jaredites prefer ancient/powerful units
        if (['giant_warrior', 'ancient_commander'].includes(unitType)) {
          return MODEL_PATHS.units.warrior; // Will get enhanced scaling for giants
        }
        break;
    }
  }
  
  // Standard intelligent fallbacks based on unit role
  switch (unitType) {
    // Military units fallback to warrior
    case 'spearman':
    case 'guard':
    case 'commander':
    case 'ancient_giant':
    case 'peacekeeping_guard':
      return MODEL_PATHS.units.warrior;
      
    // Exploration units fallback to scout
    case 'wilderness_hunter':
    case 'tracker':
    case 'ranger':
      return MODEL_PATHS.units.scout;
      
    // Diplomatic/religious units fallback to missionary
    case 'royal_envoy':
    case 'priest':
    case 'elder':
      return MODEL_PATHS.units.missionary;
      
    // Naval units fallback to boat
    case 'naval_unit':
      return MODEL_PATHS.units.boat;
      
    // Siege units fallback to warrior (representing crew)
    case 'catapult':
    case 'siege_engine':
      return MODEL_PATHS.units.warrior;
      
    // Default fallback
    default:
      return MODEL_PATHS.units.warrior;
  }
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

// Enhanced model scaling and material variants
export const getUnitModelScale = (unitType: string): number => {
  switch (unitType) {
    // Large impressive units
    case 'ancient_giant':
      return 0.85; // Jaredite giants are notably larger
    case 'cavalry':
      return 0.8;  // War elephants are imposing
    case 'commander':
      return 0.75; // Leaders stand out
      
    // Elite specialized units
    case 'stripling_warrior':
      return 0.7;  // Young but well-trained
    case 'missionary':
    case 'royal_envoy':
      return 0.68; // Diplomatic units are notable
      
    // Standard military units
    case 'warrior':
    case 'spearman':
    case 'guard':
    case 'peacekeeping_guard':
      return 0.65; // Standard military scale
      
    // Agile reconnaissance units
    case 'scout':
    case 'wilderness_hunter':
      return 0.6;  // Faster, more agile
      
    // Civilian units
    case 'worker':
      return 0.55; // Smaller civilian scale
      
    // Naval units (boat scale handled separately)
    case 'boat':
      return 1.0;  // Full scale for naval vessels
      
    default:
      return 0.65; // Standard fallback
  }
};

// Get unit material enhancements based on faction
export const getUnitMaterialEnhancements = (unitType: string, factionId?: string) => {
  return {
    // Faction-specific color tinting
    colorMultiplier: factionId === 'NEPHITES' ? 1.1 : 
                     factionId === 'LAMANITES' ? 0.95 : 1.0,
    // Elite unit glow effects
    emissiveIntensity: ['stripling_warrior', 'ancient_giant', 'commander'].includes(unitType) ? 0.1 : 0.05,
    // Unit-specific material properties
    metallic: ['commander', 'cavalry', 'ancient_giant'].includes(unitType) ? 0.3 : 0.1,
    roughness: unitType === 'scout' ? 0.8 : 0.6
  };
};

// Initialize model preloading
preloadAllModels();