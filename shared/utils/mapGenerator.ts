import { createNoise2D } from 'simplex-noise';
import type { GameMap, Tile, TerrainType, HexCoordinate, FactionId } from '@shared/types/game';
import { hexDistance } from './hex';

/**
 * Type definitions for map generation
 */
interface TerrainProbabilities {
  mountain: number;
  forest: number;
  plains: number;
}

export class SeededRandom {
  private seed: number;

  constructor(seed: number = Date.now()) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  choice<T>(array: T[]): T {
    return array[Math.floor(this.next() * array.length)];
  }
}

interface MapGenerationConfig {
  width: number;
  height: number;
  seed?: number;
  playerCount: number;
  mapSize: MapSize;
  minResourceDistance?: number;
  maxResourcesPerPlayer?: number;
}

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
  huge: { tiles: 400, dimensions: 20, maxPlayers: 8, name: 'Huge' }
};

/**
 * Map Generation Constants
 * Centralized configuration for all map generation parameters
 */
const MAP_GENERATION_CONSTANTS = {
  // Tribal homeland influence
  TRIBAL_HOMELAND_RADIUS: 4,           // Tiles from capital where tribal modifiers apply
  TRIBAL_INFLUENCE_FALLOFF: 4,         // Distance divisor for influence calculation
  
  // Capital placement
  CAPITAL_SPAWN_RADIUS_RATIO: 0.6,     // Ratio of map radius for capital placement
  
  // City and village spacing
  CITY_MIN_DISTANCE: 6,                // Minimum distance between cities
  VILLAGE_MIN_DISTANCE: 2,             // Minimum distance between villages
  MAP_EDGE_BUFFER: 2,                  // Buffer distance from map edge
  
  // Water generation
  WATER_EDGE_THRESHOLD: 0.8,           // Distance ratio for increased water at edges
  WATER_EDGE_CHANCE: 0.4,              // Water probability at map edges
  WATER_CENTER_CHANCE: 0.15,           // Water probability in center
  
  // Resource placement
  INNER_CITY_RADIUS: 1,                // Adjacent to city
  OUTER_CITY_RADIUS: 2,                // Two tiles from city
  WILDERNESS_MIN_DISTANCE: 3,          // Minimum distance from city for wilderness resources
  
  // Village density
  VILLAGE_DENSITY_RATIO: 25,           // Tiles per village (tiles.length / 25 = 4% density)
} as const;

/**
 * Tribal Homeland Generation System
 * Each tribe begins on a procedurally generated homeland tilted toward their cultural resources
 * Uses Polytopia-style multipliers with proper order of operations for consistent tile mix
 */
interface TribalSpawnModifiers {
  mountain: number;    // Applied first - affects food tiles inversely
  forest: number;      // Applied second - only affects remaining field share
  grainField: number;  // Calculated automatically = 100% - mountain - forest
  wildAnimal: number;  // Applied independently to overlay tiles
  water: number;       // Applied independently to coast tiles
  fish: number;        // Applied independently to water tiles
  ruins: number;       // Applied independently to overlay tiles
  lore: string;        // Cultural background for this tribe
}

export const TRIBAL_SPAWN_MODIFIERS: Record<FactionId, TribalSpawnModifiers> = {
  NEPHITES: {
    mountain: 0.8,      // 0.8× mountain
    forest: 1.0,        // Neutral forest
    grainField: 1.2,    // 1.2× grain (calculated automatically)
    wildAnimal: 1.0,    // Neutral wild animals
    water: 1.0,         // Neutral water
    fish: 1.0,          // Neutral fish
    ruins: 1.0,         // Neutral ruins
    lore: "Advanced civilization with organized agriculture and cities"
  },
  LAMANITES: {
    mountain: 1.0,      // Neutral mountain
    forest: 1.5,        // 1.5× forest
    grainField: 1.0,    // Auto-calculated (fields = remainder)
    wildAnimal: 1.5,    // 1.5× wild_goats
    water: 1.0,         // Neutral water
    fish: 1.0,          // Neutral fish
    ruins: 1.0,         // Neutral ruins
    lore: "Forest-dwelling hunters skilled in wilderness survival"
  },
  MULEKITES: {
    mountain: 1.0,      // Neutral mountain
    forest: 1.0,        // Neutral forest
    grainField: 1.0,    // Auto-calculated
    wildAnimal: 1.0,    // Neutral animals
    water: 2.0,         // 2.0× water (increased for better water identity)
    fish: 1.8,          // 1.8× fish (increased for river traders)
    ruins: 1.2,         // 1.2× ruins
    lore: "River-valley traders with access to waterways and ancient ruins"
  },
  ANTI_NEPHI_LEHIES: {
    mountain: 0.6,      // 0.6× mountain
    forest: 1.0,        // Neutral forest
    grainField: 1.5,    // 1.5× grain (peaceful agriculture)
    wildAnimal: 1.5,    // 1.5× wild animals (herding)
    water: 1.0,         // Neutral water
    fish: 1.0,          // Neutral fish
    ruins: 1.0,         // Neutral ruins
    lore: "Peaceful herders focused on agriculture and animal husbandry"
  },
  ZORAMITES: {
    mountain: 1.5,      // 1.5× mountain
    forest: 0.5,        // 0.5× forest
    grainField: 1.0,    // Auto-calculated (limited by terrain)
    wildAnimal: 1.0,    // Neutral animals
    water: 1.0,         // Neutral water
    fish: 1.0,          // Neutral fish
    ruins: 1.0,         // Neutral ruins
    lore: "Mountain-dwelling people with rocky, challenging homeland"
  },
  JAREDITES: {
    mountain: 1.5,      // 1.5× mountain
    forest: 1.0,        // Neutral forest
    grainField: 1.0,    // Auto-calculated
    wildAnimal: 1.0,    // Neutral animals
    water: 1.0,         // Neutral water
    fish: 1.0,          // Neutral fish
    ruins: 2.0,         // 2.0× ruins (ancient civilization)
    lore: "Ancient civilization with extensive ruins and mountainous territory"
  }
};

interface ResourceSpawnRate {
  // Unified World Elements System - All resources now provide moral choices
  timber_grove: number;
  wild_goats: number;
  grain_patch: number;
  ore_vein: number;         // Replaces stone + gold with unified ore system
  fishing_shoal: number;
  sea_beast: number;
  jaredite_ruins: number;
  empty: number;
}

export class MapGenerator {
  private rng: SeededRandom;
  private noise2D: ReturnType<typeof createNoise2D>;
  private config: MapGenerationConfig;
  private playerFactions: string[] = [];

  constructor(config: MapGenerationConfig, playerFactions?: string[]) {
    this.config = config;
    this.playerFactions = playerFactions || [];
    this.rng = new SeededRandom(config.seed);
    // Create seeded noise function
    this.noise2D = createNoise2D(() => this.rng.next());
  }

  generateMap(): GameMap {
    const tiles: Tile[] = [];
    const mapRadius = Math.min(this.config.width, this.config.height);

    // Step 1: Generate base hex grid
    for (let q = -mapRadius; q <= mapRadius; q++) {
      const r1 = Math.max(-mapRadius, -q - mapRadius);
      const r2 = Math.min(mapRadius, -q + mapRadius);
      
      for (let r = r1; r <= r2; r++) {
        const s = -q - r;
        const coordinate: HexCoordinate = { q, r, s };
        
        const tile: Tile = {
          coordinate,
          terrain: 'plains' as TerrainType, // Temporary, will be set properly
          resources: [],
          hasCity: false,
          exploredBy: [],
        };

        tiles.push(tile);
      }
    }

    // Step 2: Determine capital spawns (player starting positions)
    const capitalPositions = this.generateCapitalSpawns(mapRadius);
    
    // Step 3: Place neutral villages/cities
    this.placeCities(tiles, mapRadius, capitalPositions);
    
    // Step 4: Generate terrain with faction-specific modifiers (BEFORE villages)
    this.generateFactionBiasedTerrain(tiles, mapRadius, capitalPositions);
    
    // Step 5: Place capturable villages (AFTER terrain is generated)
    this.placeVillages(tiles, mapRadius, capitalPositions);
    
    // Step 6: Place resources strategically (city zones + wilderness)
    this.placeResourcesStrategically(tiles);
    
    // Step 6.5: Guarantee opening-ring harvest opportunities (safety pass)
    this.guaranteeCapitalHarvestOpportunities(tiles, capitalPositions);
    
    // Step 7: Place special features
    this.placeSpecialFeatures(tiles, capitalPositions);

    return {
      tiles,
      width: this.config.width,
      height: this.config.height,
    };
  }

  /**
   * Step 2: Generate capital spawns using quadrant-based system
   */
  private generateCapitalSpawns(mapRadius: number): HexCoordinate[] {
    const capitalPositions: HexCoordinate[] = [];
    const playerCount = this.config.playerCount;
    
    // Create balanced quadrants for player spawning
    for (let i = 0; i < playerCount; i++) {
      const angle = (i / playerCount) * 2 * Math.PI;
      const spawnRadius = Math.floor(mapRadius * MAP_GENERATION_CONSTANTS.CAPITAL_SPAWN_RADIUS_RATIO);
      
      const q = Math.round(spawnRadius * Math.cos(angle));
      const r = Math.round(spawnRadius * Math.sin(angle));
      const s = -q - r;
      
      capitalPositions.push({ q, r, s });
    }
    
    return capitalPositions;
  }

  /**
   * Step 3: Place cities with capital positions reserved for players
   */
  private placeCities(tiles: Tile[], mapRadius: number, capitalPositions: HexCoordinate[]): void {
    // Mark capital positions as cities
    for (const capitalPos of capitalPositions) {
      const tile = tiles.find(t => 
        t.coordinate.q === capitalPos.q && t.coordinate.r === capitalPos.r
      );
      if (tile) {
        tile.hasCity = true;
      }
    }

    // Place additional neutral cities/villages
    const additionalCities = Math.max(2, Math.floor(this.config.playerCount * 0.5));
    let placed = 0;
    
    while (placed < additionalCities) {
      const candidate = tiles[Math.floor(this.rng.next() * tiles.length)];
      
      // Check distance from existing cities
      const tooClose = [...capitalPositions].some(cityPos => 
        hexDistance(candidate.coordinate, cityPos) < MAP_GENERATION_CONSTANTS.CITY_MIN_DISTANCE
      );
      
      if (!candidate.hasCity && !tooClose) {
        candidate.hasCity = true;
        placed++;
      }
    }
  }

  /**
   * Step 5: Place capturable villages using Polytopia's three-pass system
   * Pass 1: Suburbs (future expansion - skipped for now)
   * Pass 2: Pre-terrain villages (future expansion - skipped for now) 
   * Pass 3: Post-terrain villages (main implementation)
   */
  private placeVillages(tiles: Tile[], mapRadius: number, capitalPositions: HexCoordinate[]): void {
    const placedVillages: HexCoordinate[] = [];
    
    // Pass 1: Suburbs (around capitals)
    // Skipped for initial implementation - can add later for water-heavy maps
    
    // Pass 2: Pre-terrain villages 
    // Skipped for initial implementation - mainly for archipelago/water maps
    
    // Pass 3: Post-terrain villages (universal pass)
    // Keep adding villages until no legal tile remains, with soft cap
    const maxVillages = Math.floor(tiles.length / MAP_GENERATION_CONSTANTS.VILLAGE_DENSITY_RATIO); // ~4% of land tiles like Polytopia
    let villagesPlaced = 0;
    let attempts = 0;
    const maxAttempts = tiles.length * 2; // Prevent infinite loops
    
    while (villagesPlaced < maxVillages && attempts < maxAttempts) {
      attempts++;
      
      // Pick random tile
      const candidateTile = tiles[Math.floor(this.rng.next() * tiles.length)];
      
      if (this.isValidVillageLocation(candidateTile, capitalPositions, placedVillages, mapRadius)) {
        candidateTile.feature = 'village';
        placedVillages.push(candidateTile.coordinate);
        villagesPlaced++;
      }
    }
    
    console.log(`Polytopia village spawning: Generated ${villagesPlaced} villages on map (${((villagesPlaced / tiles.length) * 100).toFixed(1)}% density)`);
  }

  /**
   * Check if a tile is valid for village placement using Polytopia spacing rules
   */
  private isValidVillageLocation(
    tile: Tile, 
    capitalPositions: HexCoordinate[], 
    existingVillages: HexCoordinate[], 
    mapRadius: number
  ): boolean {
    // Must be land (not water)
    if (tile.terrain === 'water') return false;
    
    // Can't place on cities
    if (tile.hasCity) return false;
    
    // Already has a village
    if (tile.feature === 'village') return false;
    
    // Must be ≥ 2 tiles inside map edge (Polytopia rule)
    const distanceFromCenter = Math.sqrt(tile.coordinate.q ** 2 + tile.coordinate.r ** 2);
    if (distanceFromCenter > mapRadius - MAP_GENERATION_CONSTANTS.MAP_EDGE_BUFFER) return false;
    
    // Must be ≥ 2 tiles from any existing village (Polytopia spacing rule)
    for (const villagePos of existingVillages) {
      if (hexDistance(tile.coordinate, villagePos) < MAP_GENERATION_CONSTANTS.VILLAGE_MIN_DISTANCE) {
        return false;
      }
    }
    
    // Must be ≥ 2 tiles from any capital (prevent blocking starting areas)
    for (const capitalPos of capitalPositions) {
      if (hexDistance(tile.coordinate, capitalPos) < MAP_GENERATION_CONSTANTS.VILLAGE_MIN_DISTANCE) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Step 4: Generate terrain with tribal homeland modifiers
   * Uses Polytopia-style Luxidoor base percentages (48% fields, 38% forests, 14% mountains)
   */
  private generateFactionBiasedTerrain(tiles: Tile[], mapRadius: number, capitalPositions: HexCoordinate[]): void {
    // Base terrain distribution (Luxidoor's 48/38/14 split)
    const baseTerrain = {
      plains: 0.48,  // Fields (Grain Patch tiles)
      forest: 0.38,  // Forests (Timber Grove tiles)
      mountain: 0.14 // Mountains
    };
    
    for (const tile of tiles) {
      // Default terrain generation
      let terrainProbs = { ...baseTerrain };
      
      // Check if this tile is within a tribal homeland (4-tile radius from capitals)
      for (let i = 0; i < capitalPositions.length; i++) {
        const distance = hexDistance(tile.coordinate, capitalPositions[i]);
        if (distance <= MAP_GENERATION_CONSTANTS.TRIBAL_HOMELAND_RADIUS) {
          const factionId = this.playerFactions[i] as FactionId;
          const modifiers = TRIBAL_SPAWN_MODIFIERS[factionId];
          
          if (modifiers) {
            // Apply tribal homeland modifiers with distance falloff
            const influence = Math.max(0, 1 - distance / MAP_GENERATION_CONSTANTS.TRIBAL_INFLUENCE_FALLOFF); // Stronger influence closer to capital
            terrainProbs = this.applyPolytopiaTribalModifiers(terrainProbs, modifiers, influence);
          }
        }
      }
      
      // Generate terrain based on modified probabilities
      tile.terrain = this.selectTerrainFromProbabilities(tile.coordinate, terrainProbs, mapRadius, capitalPositions);
    }
  }

  /**
   * Apply tribal homeland modifiers using authentic Polytopia cascading system
   * Order: mountain → forest → fields (plains calculated as remainder)
   */
  private applyPolytopiaTribalModifiers(
    base: TerrainProbabilities, 
    modifiers: TribalSpawnModifiers, 
    influence: number
  ): TerrainProbabilities {
    // Step 1: Apply mountain modifier first (Polytopia order)
    let mountain = base.mountain;
    const mountainMod = 1 + (modifiers.mountain - 1) * influence;
    mountain = Math.min(0.8, Math.max(0.05, mountain * mountainMod)); // Clamp 5-80%
    
    // Step 2: Apply forest modifier to remaining land
    const remainingAfterMountain = 1 - mountain;
    let forest = base.forest * remainingAfterMountain / (base.forest + base.plains);
    const forestMod = 1 + (modifiers.forest - 1) * influence;
    forest = Math.min(remainingAfterMountain * 0.9, Math.max(0.05, forest * forestMod));
    
    // Step 3: Fields (plains) = remaining land (never gets direct multiplier)
    const plains = Math.max(0.05, remainingAfterMountain - forest);
    
    return { mountain, forest, plains };
  }

  /**
   * Select terrain based on probabilities and noise
   * Includes tribal water modifier for coast generation
   */
  private selectTerrainFromProbabilities(
    coord: HexCoordinate, 
    probs: TerrainProbabilities, 
    mapRadius: number, 
    capitalPositions: HexCoordinate[]
  ): TerrainType {
    // Use noise to add variation
    const noiseValue = this.noise2D(coord.q * 0.1, coord.r * 0.1);
    const distanceFromCenter = Math.sqrt(coord.q ** 2 + coord.r ** 2) / mapRadius;
    
    // Base edge effects (more water near edges) - increased for better Mulekite support
    let waterChance = distanceFromCenter > MAP_GENERATION_CONSTANTS.WATER_EDGE_THRESHOLD ? 
      MAP_GENERATION_CONSTANTS.WATER_EDGE_CHANCE : MAP_GENERATION_CONSTANTS.WATER_CENTER_CHANCE;
    
    // Apply tribal water modifier if near capitals
    for (let i = 0; i < this.config.playerCount && i < capitalPositions.length; i++) {
      const capitalPos = capitalPositions[i];
      if (capitalPos) {
        const distance = hexDistance(coord, capitalPos);
        if (distance <= MAP_GENERATION_CONSTANTS.TRIBAL_HOMELAND_RADIUS) {
          const factionId = this.playerFactions[i] as FactionId;
          const modifiers = TRIBAL_SPAWN_MODIFIERS[factionId];
          
          if (modifiers) {
            const influence = Math.max(0, 1 - distance / MAP_GENERATION_CONSTANTS.TRIBAL_INFLUENCE_FALLOFF);
            const waterMod = 1 + (modifiers.water - 1) * influence;
            waterChance *= waterMod;
          }
        }
      }
    }
    
    const rand = this.rng.next() + noiseValue * 0.3;
    
    if (rand < waterChance) return 'water';
    
    const adjustedRand = (rand - waterChance) / (1 - waterChance);
    
    if (adjustedRand < probs.mountain) return 'mountain';
    if (adjustedRand < probs.mountain + probs.forest) return 'forest';
    return 'plains';
  }





  /**
   * Apply tribal homeland modifiers to resource spawn rates
   * Water, fish, wild animals, and ruins are applied independently
   */
  private applyTribalResourceModifiers(
    baseRates: ResourceSpawnRate, 
    modifiers: TribalSpawnModifiers, 
    influence: number
  ): ResourceSpawnRate {
    const modified = { ...baseRates };
    
    // Apply independent modifiers (these don't affect land terrain balance)
    const wildAnimalMod = 1 + (modifiers.wildAnimal - 1) * influence;
    const ruinsMod = 1 + (modifiers.ruins - 1) * influence;
    const fishMod = 1 + (modifiers.fish - 1) * influence;
    
    // Apply modifiers to unified world elements system
    modified.wild_goats = Math.round(modified.wild_goats * wildAnimalMod);
    modified.jaredite_ruins = Math.round(modified.jaredite_ruins * ruinsMod);
    modified.fishing_shoal = Math.round(modified.fishing_shoal * fishMod);
    modified.sea_beast = Math.round(modified.sea_beast * fishMod);
    
    // Clamp values to reasonable ranges
    modified.wild_goats = Math.max(0, Math.min(30, modified.wild_goats));
    modified.jaredite_ruins = Math.max(0, Math.min(25, modified.jaredite_ruins));
    modified.fishing_shoal = Math.max(0, Math.min(20, modified.fishing_shoal));
    modified.sea_beast = Math.max(0, Math.min(15, modified.sea_beast));
    
    return modified;
  }

  /**
   * Step 6.5: Guarantee opening-ring harvest opportunities (safety pass)
   * After terrain and resources are populated, run safety pass to ensure
   * each capital has at least 2 harvestable resources within 2 tiles
   */
  private guaranteeCapitalHarvestOpportunities(tiles: Tile[], capitalPositions: HexCoordinate[]): void {
    for (const capitalPos of capitalPositions) {
      // Count harvestable resources within 2 tiles of capital
      const nearbyTiles = tiles.filter(tile => 
        hexDistance(tile.coordinate, capitalPos) <= 2 && 
        !tile.hasCity
      );
      
      const harvestableCount = nearbyTiles.reduce((count, tile) => {
        const hasHarvestable = tile.resources.some(resource => 
          ['grain_patch', 'wild_goats', 'timber_grove', 'ore_vein'].includes(resource)
        );
        return count + (hasHarvestable ? 1 : 0);
      }, 0);
      
      // If less than 2 harvestable resources, upgrade empty tiles
      if (harvestableCount < 2) {
        const needed = 2 - harvestableCount;
        const upgradableEmptyTiles = nearbyTiles.filter(tile => 
          tile.resources.length === 0 && // Empty tiles only
          ['plains', 'forest', 'mountain'].includes(tile.terrain) // Land tiles only
        );
        
        // Randomly select tiles to upgrade
        const shuffled = [...upgradableEmptyTiles].sort(() => this.rng.next() - 0.5);
        
        for (let i = 0; i < Math.min(needed, shuffled.length); i++) {
          const tile = shuffled[i];
          
          // Add appropriate harvestable resource based on terrain
          let resourceToAdd: string;
          switch (tile.terrain) {
            case 'plains':
              resourceToAdd = this.rng.next() < 0.7 ? 'grain_patch' : 'wild_goats';
              break;
            case 'forest':
              resourceToAdd = 'timber_grove';
              break;
            case 'mountain':
              resourceToAdd = 'ore_vein';
              break;
            default:
              resourceToAdd = 'grain_patch'; // Fallback
          }
          
          tile.resources.push(resourceToAdd);
        }
      }
    }
  }

  /**
   * Step 7: Place special tribal features (currently none defined)
   */
  private placeSpecialFeatures(tiles: Tile[], capitalPositions: HexCoordinate[]): void {
    // Tribal system uses resource modifiers instead of special features
    // This method is kept for future expansion if needed
    
    for (let i = 0; i < capitalPositions.length; i++) {
      const factionId = this.playerFactions[i] as FactionId;
      const modifiers = TRIBAL_SPAWN_MODIFIERS[factionId];
      
      // Future: Add any special tribal features here
      // For now, all tribal bonuses are handled through spawn rate modifiers
      
      if (modifiers && modifiers.lore) {
        // Log tribal lore for debugging
        console.log(`${factionId} homeland: ${modifiers.lore}`);
      }
    }
  }

  /**
   * Strategic resource placement with wilderness exemptions for key resources
   * Basic resources (timber, goats, grain, ore) can spawn beyond city radius to reward expansion
   */
  private placeResourcesStrategically(tiles: Tile[]): void {
    // 1. Identify all city coordinates
    const cityTiles = tiles.filter(tile => tile.hasCity);
    if (cityTiles.length === 0) return; // No cities to place resources around
    
    const cityCoordinates = cityTiles.map(tile => tile.coordinate);
    
    // 2. Identify spawnable tiles - different rules for different resource types
    const nearCityTiles = tiles.filter(tile => {
      if (tile.hasCity) return false; // Don't place on city tiles
      
      for (const cityCoord of cityCoordinates) {
        if (hexDistance(tile.coordinate, cityCoord) <= MAP_GENERATION_CONSTANTS.OUTER_CITY_RADIUS) {
          return true;
        }
      }
      return false;
    });
    
    // 3. All wilderness tiles for exempt resources (timber, goats, grain, ore)
    const wildernessTiles = tiles.filter(tile => {
      if (tile.hasCity) return false; // Don't place on city tiles
      
      // Check if far enough from any city (3+ tiles away for true wilderness)
      for (const cityCoord of cityCoordinates) {
        if (hexDistance(tile.coordinate, cityCoord) < MAP_GENERATION_CONSTANTS.WILDERNESS_MIN_DISTANCE) {
          return false;
        }
      }
      return true;
    });
    
    // 4. Place city-area resources using distance-based spawn tables
    nearCityTiles.forEach(tile => {
      const distanceToNearestCity = Math.min(
        ...cityCoordinates.map(cityCoord => hexDistance(tile.coordinate, cityCoord))
      );
      
      let spawnTable: ResourceSpawnRate;
      if (distanceToNearestCity === MAP_GENERATION_CONSTANTS.INNER_CITY_RADIUS) {
        spawnTable = this.getInnerCitySpawnTable(); // Adjacent to city
      } else {
        spawnTable = this.getOuterCitySpawnTable(); // 2 tiles from city
      }
      
      // Attempt to spawn a resource based on terrain and spawn table
      const resourceToSpawn = this.getResourceFromTable(spawnTable, tile.terrain);
      
      if (resourceToSpawn) {
        tile.resources.push(resourceToSpawn);
      }
    });
    
    // 5. Place wilderness resources (exempt from city radius restriction)
    wildernessTiles.forEach(tile => {
      const wildernessSpawnTable = this.getWildernessSpawnTable();
      const resourceToSpawn = this.getResourceFromTable(wildernessSpawnTable, tile.terrain);
      
      if (resourceToSpawn) {
        tile.resources.push(resourceToSpawn);
      }
    });
  }
  
  /**
   * Inner city spawn rates using authentic Polytopia percentages per blueprint
   * Field tiles: 48% -> Grain Patch 36%, Empty 12%
   * Forest tiles: 38% -> Wild Goats 10%, Timber Grove 9%, Empty 19%
   * Mountain tiles: 14% -> Ore Vein 11%, Empty 3%
   */
  private getInnerCitySpawnTable(): ResourceSpawnRate {
    return {
      // Field tiles (48% of land) - Inner city rates
      grain_patch: 36,       // 36% of field tiles per blueprint
      wild_goats: 10,        // 10% of forest tiles per blueprint (but spawns on plains too)
      
      // Forest tiles (38% of land) - Inner city rates  
      timber_grove: 9,       // 9% of forest tiles per blueprint
      
      // Mountain tiles (14% of land) - Inner city rates - unified ore system
      ore_vein: 11,          // 11% of mountain tiles per blueprint
      
      // Water-only resources
      fishing_shoal: 0,     // Water terrain only
      sea_beast: 0,         // Deep water only
      jaredite_ruins: 4,    // Standard ruins count (4-23 based on map size)
      empty: 30             // Remaining empty tiles (12% fields + 19% forest + 3% mountain = 34% total empty)
    };
  }
  
  /**
   * Wilderness spawn rates for tiles beyond city influence
   * Only basic expansion resources: timber, goats, grain, ore
   */
  private getWildernessSpawnTable(): ResourceSpawnRate {
    return {
      // Basic resources that reward expansion and exploration
      grain_patch: 2,       // 2% (rare grain patches in wilderness)
      wild_goats: 3,        // 3% (wilderness animals on plains only)
      timber_grove: 4,      // 4% (virgin forests on forest terrain only)
      ore_vein: 1.5,        // 1.5% (replaces stone + gold with unified ore system)
      
      // No special/rare resources in wilderness
      fishing_shoal: 0,     // Water only
      sea_beast: 0,         // Deep water only  
      jaredite_ruins: 0,    // No ruins in pure wilderness
      empty: 89.5           // Mostly empty wilderness
    };
  }

  /**
   * Outer city spawn rates per blueprint specifications
   * Field tiles: 48% -> Grain Patch 12%, Empty 36%
   * Forest tiles: 38% -> Wild Goats 3%, Timber Grove 3%, Empty 32%
   * Mountain tiles: 14% -> Ore Vein 3%, Empty 11%
   */
  private getOuterCitySpawnTable(): ResourceSpawnRate {
    return {
      // Field tiles - Outer city rates per blueprint
      grain_patch: 12,      // 12% of field tiles per blueprint
      wild_goats: 3,        // 3% of forest tiles per blueprint (but spawns on plains too)
      
      // Forest tiles - Outer city rates per blueprint
      timber_grove: 3,      // 3% of forest tiles per blueprint
      
      // Mountain tiles - Outer city rates - unified ore system
      ore_vein: 3,          // 3% of mountain tiles per blueprint
      
      // Water-only resources
      fishing_shoal: 0,     // Water terrain only
      sea_beast: 0,         // Deep water only
      jaredite_ruins: 4,    // Standard ruins distribution
      empty: 75             // Majority empty in outer zones (36% fields + 32% forest + 11% mountain = 79% total empty)
    };
  }
  
  /**
   * Select resource from spawn table based on terrain requirements and blueprint specs
   * Terrain-resource matching per Polytopia blueprint
   */
  private getResourceFromTable(spawnTable: ResourceSpawnRate, terrain: TerrainType): string | null {
    // Water-only resources (50% of shallow water gets Fish Shoals per blueprint)
    if (terrain === 'water') {
      const roll = this.rng.nextInt(1, 100);
      if (roll <= 50) { // 50% of shallow water gets Fish Shoals
        return 'fishing_shoal';
      }
      return null; // Empty water
    }
    
    // Land-based resources with terrain matching per blueprint:
    const roll = this.rng.nextInt(1, 100);
    let cumulative = 0;
    
    const resourceChecks = [
      // Field tiles (48% of land): grain_patch and wild_goats (animals prefer open plains)
      { 
        type: 'grain_patch', 
        rate: spawnTable.grain_patch, 
        terrains: ['plains'] // Fields only
      },
      { 
        type: 'wild_goats', 
        rate: spawnTable.wild_goats, 
        terrains: ['plains'] // Plains only - animals graze in open areas
      },
      
      // Forest tiles (38% of land): timber_grove only
      { 
        type: 'timber_grove', 
        rate: spawnTable.timber_grove, 
        terrains: ['forest'] // Forest only - chop vs sawmill choice
      },
      
      // Mountain tiles (14% of land): unified ore system
      { 
        type: 'ore_vein', 
        rate: spawnTable.ore_vein, 
        terrains: ['mountain'] // Mountain only - tap vs mine choice
      },
      
      // Ruins spawn on any land terrain
      { 
        type: 'jaredite_ruins', 
        rate: spawnTable.jaredite_ruins, 
        terrains: ['plains', 'forest', 'mountain'] 
      }
    ];
    
    for (const resource of resourceChecks) {
      cumulative += resource.rate;
      
      // Check if we rolled for this resource AND terrain is suitable
      if (roll <= cumulative && resource.terrains.includes(terrain)) {
        return resource.type;
      }
    }
    
    // No resource spawned (empty)
    return null;
  }

  


  // Static convenience method
  static generateBalancedMap(playerCount: number, seed?: number): GameMap {
    const baseSize = 4;
    const mapSize = baseSize + Math.floor(playerCount / 2);
    
    const generator = new MapGenerator({
      width: mapSize,
      height: mapSize,
      seed: seed ?? Date.now(),
      playerCount,
      mapSize: 'normal', // Default to normal size
      minResourceDistance: 2,
      maxResourcesPerPlayer: 3
    });
    
    return generator.generateMap();
  }
}