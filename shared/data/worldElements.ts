/**
 * World Elements System - Book of Mormon themed resources with Polytopia mechanics
 * Every element presents "cash-now vs growth-later" moral choices affecting Faith/Pride/Dissent
 */

import { HexCoordinate } from '../types/coordinates';
import { GameState } from '../types/game';

export interface ElementAction {
  name: string;
  starsDelta: number;
  faithDelta: number;
  prideDelta: number;
  dissentDelta: number;
  popDelta: number;
  tileTransform?: string;
  requiresUnitTag?: string;
}

export interface ElementStructure {
  name: string;
  costStars: number;
  effectPermanent: {
    popDelta: number;
    starsPerTurn: number;
  };
  faithDelta: number;
  prideDelta: number;
  dissentDelta: number;
  upgrade?: {
    techRequired: string;
    structure: string;
    costStars: number;
    effectPermanent: {
      popDelta: number;
      starsPerTurn: number;
    };
  };
}

export interface WorldElement {
  elementId: string;
  displayName: string;
  description: string;
  scriptureRef: string;
  terrain: string[];
  spawnWeight: number;
  immediateAction?: ElementAction;
  longTermBuild?: ElementStructure;
  techPrerequisite?: string;
  assetTileset: string;
  assetStructure?: string;
  assetStructureUpgrade?: string;
  uiTooltipHarvest?: string;
  uiTooltipBuild?: string;
  notes: string;
}

export const WORLD_ELEMENTS: Record<string, WorldElement> = {
  timber_grove: {
    elementId: 'timber_grove',
    displayName: 'Timber Grove',
    description: 'Sacred groves of massive timbers, as recorded in Helaman 3:9',
    scriptureRef: 'Hel. 3:9',
    terrain: ['forest', 'hill'],
    spawnWeight: 1.0,
    immediateAction: {
      name: 'Harvest Lumber',
      starsDelta: 2,
      faithDelta: 0,
      prideDelta: 1,
      dissentDelta: 1,
      popDelta: 1, // Added population boost for unified system
      tileTransform: 'plains'
    },
    longTermBuild: {
      name: 'Sawmill',
      costStars: 5,
      effectPermanent: {
        popDelta: 1,
        starsPerTurn: 1
      },
      faithDelta: 1,
      prideDelta: 0,
      dissentDelta: 0
    },
    techPrerequisite: 'woodcraft',
    assetTileset: 'tiles/feature_timber_grove.png',
    assetStructure: 'structures/sawmill.png',
    uiTooltipHarvest: 'Chop for 2★ (raises Pride & Dissent)',
    uiTooltipBuild: 'Spend 5★ for Sawmill (+1 Pop, +1★/turn, +1 Faith)',
    notes: 'Exact forest→lumber-hut numbers; Faith/Pride hooks added'
  },

  wild_goats: {
    elementId: 'wild_goats',
    displayName: 'Wild Goats',
    description: 'Herds of goats as found in the promised land (1 Nephi 18:25)',
    scriptureRef: '1 Ne. 18:25',
    terrain: ['plains', 'hill'],
    spawnWeight: 0.8,
    immediateAction: {
      name: 'Slaughter for Meat',
      starsDelta: 2,
      faithDelta: 0,
      prideDelta: 1,
      dissentDelta: 1,
      popDelta: 1, // Added population boost for unified system
      tileTransform: 'plains'
    },
    longTermBuild: {
      name: 'Corral',
      costStars: 5,
      effectPermanent: {
        popDelta: 1,
        starsPerTurn: 1
      },
      faithDelta: 1,
      prideDelta: 0,
      dissentDelta: 0
    },
    techPrerequisite: 'husbandry',
    assetTileset: 'tiles/feature_goats.png',
    assetStructure: 'structures/corral.png',
    uiTooltipHarvest: 'Gain 2★ by slaughtering (Pride +1, Dissent +1)',
    uiTooltipBuild: '5★ Corral: +1 Pop, +1★/turn, +1 Faith',
    notes: 'Polytopia animal logic; dovetails with Faith/Pride economy'
  },

  grain_patch: {
    elementId: 'grain_patch',
    displayName: 'Untilled Grain Patch',
    description: 'Wild grains ready for cultivation (Mosiah 9:9)',
    scriptureRef: 'Mos. 9:9',
    terrain: ['plains', 'forest'],
    spawnWeight: 1.1,
    immediateAction: {
      name: 'Gather Harvest',
      starsDelta: 0,
      faithDelta: 0,
      prideDelta: 1,
      dissentDelta: 1,
      popDelta: 2, // Boosted to +2 population for unified system
      tileTransform: 'plains'
    },
    longTermBuild: {
      name: 'Field',
      costStars: 5,
      effectPermanent: {
        popDelta: 2,
        starsPerTurn: 0
      },
      faithDelta: 1,
      prideDelta: 0,
      dissentDelta: 0,
      upgrade: {
        techRequired: 'irrigation',
        structure: 'Windmill',
        costStars: 0,
        effectPermanent: {
          popDelta: 0,
          starsPerTurn: 1
        }
      }
    },
    techPrerequisite: 'agriculture',
    assetTileset: 'tiles/feature_grain.png',
    assetStructure: 'structures/field.png',
    assetStructureUpgrade: 'structures/windmill.png',
    uiTooltipHarvest: 'Free +1 Pop now (Pride +1, Dissent +1)',
    uiTooltipBuild: '5★ Field (+2 Pop, +1 Faith). Windmill adds +1★/turn post-Irrigation',
    notes: 'Matches Polytopia fruit/crop → farm → windmill chain'
  },

  fishing_shoal: {
    elementId: 'fishing_shoal',
    displayName: 'Fishing Shoal',
    description: 'Rich fishing grounds in coastal waters (Ether 10:4)',
    scriptureRef: 'Ether 10:4',
    terrain: ['water'],
    spawnWeight: 0.9,
    // No immediate action - must build jetty
    longTermBuild: {
      name: 'Fishing Jetty',
      costStars: 2,
      effectPermanent: {
        popDelta: 1,
        starsPerTurn: 0
      },
      faithDelta: 0,
      prideDelta: 0,
      dissentDelta: 0,
      upgrade: {
        techRequired: 'trade',
        structure: 'Harbor',
        costStars: 0,
        effectPermanent: {
          popDelta: 0,
          starsPerTurn: 2 // same as Custom House
        }
      }
    },
    techPrerequisite: 'seafaring',
    assetTileset: 'tiles/feature_fish.png',
    assetStructure: 'structures/fishing_jetty.png',
    assetStructureUpgrade: 'structures/harbor.png',
    uiTooltipBuild: '2★ Jetty (+1 Pop). Harbor adds steady ★ after Trade',
    notes: 'Numbers align with Polytopia fish/port chain'
  },

  sea_beast: {
    elementId: 'sea_beast',
    displayName: 'Great Sea Beast',
    description: 'Mighty creatures of the deep (Ether 2:24)',
    scriptureRef: 'Ether 2:24',
    terrain: ['deep_water'],
    spawnWeight: 0.4,
    immediateAction: {
      name: 'Expedition Harvest',
      starsDelta: 10,
      faithDelta: 0,
      prideDelta: 3,
      dissentDelta: 3,
      popDelta: 0,
      tileTransform: 'deep_water_plain',
      requiresUnitTag: 'naval_commander'
    },
    longTermBuild: {
      name: 'Sea Platform',
      costStars: 5,
      effectPermanent: {
        popDelta: 2,
        starsPerTurn: 0
      },
      faithDelta: 2,
      prideDelta: 0,
      dissentDelta: 0
    },
    techPrerequisite: 'navigation',
    assetTileset: 'tiles/feature_whale.png',
    assetStructure: 'structures/sea_platform.png',
    uiTooltipHarvest: 'Harvest for 10★ (Pride +3, Dissent +3)',
    uiTooltipBuild: '5★ Platform (+2 Pop, +2 Faith)',
    notes: 'Whale vs platform trade-off exactly preserved'
  },

  ore_vein: {
    elementId: 'ore_vein',
    displayName: 'Ore Vein',
    description: 'Precious metals and ores found in the mountains (Helaman 6:11)',
    scriptureRef: 'Hel. 6:11',
    terrain: ['mountain'],
    spawnWeight: 1.0,
    immediateAction: {
      name: 'Tap the Vein',
      starsDelta: 2,
      faithDelta: 0,
      prideDelta: 1,
      dissentDelta: 1,
      popDelta: 1, // Population boost for unified system
      tileTransform: 'mountain' // Stays mountain after harvest
    },
    longTermBuild: {
      name: 'Mine',
      costStars: 5,
      effectPermanent: {
        popDelta: 1,
        starsPerTurn: 1
      },
      faithDelta: 1,
      prideDelta: 0,
      dissentDelta: 0
    },
    techPrerequisite: 'mining', // Tech required for building, not harvesting
    assetTileset: 'tiles/feature_ore_vein.png',
    assetStructure: 'structures/mine.png',
    uiTooltipHarvest: 'Tap for +1 Pop and 2★ (Pride +1, Dissent +1)',
    uiTooltipBuild: '5★ Mine: +1 Pop, +1★/turn, +1 Faith',
    notes: 'Replaces stone/metal from classic system with unified moral choice'
  },

  jaredite_ruins: {
    elementId: 'jaredite_ruins',
    displayName: 'Jaredite Ruins',
    description: 'Ancient ruins of the Jaredite civilization (Mosiah 8:8)',
    scriptureRef: 'Mos. 8:8',
    terrain: ['plains', 'desert', 'forest', 'hill'],
    spawnWeight: 0.5,
    immediateAction: {
      name: 'Explore Ruins',
      starsDelta: 0, // Variable based on random reward
      faithDelta: 1, // Always grants faith
      prideDelta: 0,
      dissentDelta: 0,
      popDelta: 0, // Variable based on random reward
      tileTransform: 'plains'
    },
    techPrerequisite: undefined, // No tech needed
    assetTileset: 'tiles/feature_ruins.png',
    uiTooltipHarvest: 'Explore for random boon (+1 Faith)',
    notes: 'Uses Polytopia ruin RNG table; produces giant as "Title of Liberty"'
  }
};

export interface RuinReward {
  type: 'tech' | 'population' | 'stars' | 'unit' | 'reveal';
  value?: number;
  techId?: string;
  unitType?: string;
  description: string;
}

export const RUIN_REWARDS: RuinReward[] = [
  { type: 'tech', description: 'Free Technology Scroll', techId: 'random' },
  { type: 'population', value: 3, description: '+3 Population to nearest city' },
  { type: 'stars', value: 15, description: '15 Star cache discovered' },
  { type: 'unit', unitType: 'ancient_giant', description: 'Title of Liberty Giant awakens' },
  { type: 'reveal', description: 'Nearest enemy capital revealed' }
];

/**
 * Get world element by ID
 */
export function getWorldElement(elementId: string): WorldElement | undefined {
  return WORLD_ELEMENTS[elementId];
}

/**
 * Get all world elements for a terrain type
 */
export function getElementsForTerrain(terrain: string): WorldElement[] {
  return Object.values(WORLD_ELEMENTS).filter(element => 
    element.terrain.includes(terrain)
  );
}

/**
 * Calculate total spawn weight for terrain
 */
export function getTotalSpawnWeight(terrain: string): number {
  return getElementsForTerrain(terrain).reduce((total, element) => 
    total + element.spawnWeight, 0
  );
}

/**
 * Execute immediate action on world element
 */
export function executeElementAction(
  gameState: GameState,
  playerId: string,
  elementId: string,
  coordinate: HexCoordinate,
  actionType: 'immediate' | 'build'
): {
  success: boolean;
  message: string;
  newState?: GameState;
  faithDelta?: number;
  prideDelta?: number;
  dissentDelta?: number;
} {
  const element = getWorldElement(elementId);
  if (!element) {
    return { success: false, message: 'Unknown world element' };
  }

  const player = gameState.players.find(p => p.id === playerId);
  if (!player) {
    return { success: false, message: 'Player not found' };
  }

  if (actionType === 'immediate' && element.immediateAction) {
    const action = element.immediateAction;
    
    // Check tech prerequisite
    if (element.techPrerequisite && !player.researchedTechs.includes(element.techPrerequisite)) {
      return { success: false, message: `Requires ${element.techPrerequisite} technology` };
    }

    // Check unit requirement
    if (action.requiresUnitTag) {
      // TODO: Check if player has required unit type at location
    }

    // Apply resource changes
    const newState = {
      ...gameState,
      players: gameState.players.map(p => 
        p.id === playerId 
          ? { 
              ...p, 
              stars: p.stars + action.starsDelta,
              stats: {
                ...p.stats,
                faith: Math.min(100, Math.max(0, p.stats.faith + action.faithDelta)),
                pride: Math.min(100, Math.max(0, p.stats.pride + action.prideDelta)),
                internalDissent: Math.min(100, Math.max(0, p.stats.internalDissent + action.dissentDelta))
              }
            }
          : p
      )
    };

    // Transform tile if specified
    if (action.tileTransform) {
      newState.map.tiles = newState.map.tiles.map(tile =>
        tile.coordinate.q === coordinate.q && tile.coordinate.r === coordinate.r
          ? { ...tile, terrain: action.tileTransform as any, resources: [] }
          : tile
      );
    }

    return {
      success: true,
      message: `${action.name} completed`,
      newState,
      faithDelta: action.faithDelta,
      prideDelta: action.prideDelta,
      dissentDelta: action.dissentDelta
    };
  }

  return { success: false, message: 'Invalid action type' };
}