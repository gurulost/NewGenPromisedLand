import { createNoise2D } from 'simplex-noise';
import type { GameMap, Tile, TerrainType, HexCoordinate, FactionId } from '@shared/types/game';
import { hexDistance } from './hex';

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
    mountain: 0.8,
    forest: 1.0,
    grainField: 1.2,
    wildAnimal: 0.8,
    water: 1.0,
    fish: 1.0,
    ruins: 1.0,
    lore: "Agriculturally focused, city-building people (Alma 50); extra fertile fields accelerate peaceful booming while slightly fewer mountains keep starts flexible."
  },
  LAMANITES: {
    mountain: 0.8,
    forest: 1.5,
    grainField: 0.5,
    wildAnimal: 1.5,
    water: 1.0,
    fish: 1.0,
    ruins: 1.0,
    lore: "Dwelt in the wilderness and lived by the chase (Enos 1:20); dense forests and abundant game fuel aggressive early hunts."
  },
  MULEKITES: {
    mountain: 0.5,
    forest: 0.8,
    grainField: 1.3,
    wildAnimal: 1.0,
    water: 1.5,
    fish: 1.5,
    ruins: 1.2,
    lore: "River-valley traders along the Sidon (Omni 1:16); plentiful waterways and fish support commerce, extra ruins from Jaredite encounters."
  },
  ANTI_NEPHI_LEHIES: {
    mountain: 0.6,
    forest: 0.9,
    grainField: 1.5,
    wildAnimal: 1.5,
    water: 1.0,
    fish: 1.0,
    ruins: 1.0,
    lore: "Peaceful herders in Jershon (Alma 27); rich pastures enable tall, defensive play while fewer mountains reduce rush-mining incentives."
  },
  ZORAMITES: {
    mountain: 1.5,
    forest: 0.5,
    grainField: 0.7,
    wildAnimal: 0.5,
    water: 0.8,
    fish: 0.8,
    ruins: 1.0,
    lore: "Proud, stark land of Antionum (Alma 31); rocky starts suit defensive Pride strategies, but limited food pushes expansion."
  },
  JAREDITES: {
    mountain: 1.5,
    forest: 1.0,
    grainField: 0.8,
    wildAnimal: 1.2,
    water: 0.8,
    fish: 0.8,
    ruins: 2.0,
    lore: "Ancient civilization with many herds and flocks (Ether 13); rugged highlands and double ruins for exploring their fallen empire."
  }
};

interface ResourceSpawnRate {
  food: number;
  stone: number;
  gold: number;
  // World Elements
  timber_grove: number;
  wild_goats: number;
  grain_patch: number;
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
    
    // Step 4: Place capturable villages
    this.placeVillages(tiles, mapRadius, capitalPositions);
    
    // Step 5: Generate terrain with faction-specific modifiers
    this.generateFactionBiasedTerrain(tiles, mapRadius, capitalPositions);
    
    // Step 6: Place resources in zones around cities
    this.placeZonedResources(tiles);
    
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
      const spawnRadius = Math.floor(mapRadius * 0.6); // 60% from center
      
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
        hexDistance(candidate.coordinate, cityPos) < 6
      );
      
      if (!candidate.hasCity && !tooClose) {
        candidate.hasCity = true;
        placed++;
      }
    }
  }

  /**
   * Step 4: Place capturable villages using Polytopia's three-pass system
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
    const maxVillages = Math.floor(tiles.length / 15); // ~4% of land tiles like Polytopia
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
    
    console.log(`Generated ${villagesPlaced} villages on map (${placedVillages.length} total)`);
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
    if (distanceFromCenter > mapRadius - 2) return false;
    
    // Must be ≥ 2 tiles from any existing village (Polytopia spacing rule)
    for (const villagePos of existingVillages) {
      if (hexDistance(tile.coordinate, villagePos) < 2) {
        return false;
      }
    }
    
    // Must be ≥ 2 tiles from any capital (prevent blocking starting areas)
    for (const capitalPos of capitalPositions) {
      if (hexDistance(tile.coordinate, capitalPos) < 2) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Step 5: Generate terrain with tribal homeland modifiers
   * Uses Polytopia-style cascading modifiers with proper order of operations
   */
  private generateFactionBiasedTerrain(tiles: Tile[], mapRadius: number, capitalPositions: HexCoordinate[]): void {
    // Base terrain distribution (neutral/Luxidoor settings)
    const baseTerrain = {
      mountain: 0.25,
      forest: 0.35,
      plains: 0.40  // This represents grain fields
    };
    
    for (const tile of tiles) {
      // Default terrain generation
      let terrainProbs = { ...baseTerrain };
      
      // Check if this tile is within a tribal homeland (4-tile radius from capitals)
      for (let i = 0; i < capitalPositions.length; i++) {
        const distance = hexDistance(tile.coordinate, capitalPositions[i]);
        if (distance <= 4) {
          const factionId = this.playerFactions[i] as FactionId;
          const modifiers = TRIBAL_SPAWN_MODIFIERS[factionId];
          
          if (modifiers) {
            // Apply tribal homeland modifiers with distance falloff
            const influence = Math.max(0, 1 - distance / 4); // Stronger influence closer to capital
            terrainProbs = this.applyTribalModifiers(terrainProbs, modifiers, influence);
          }
        }
      }
      
      // Generate terrain based on modified probabilities
      tile.terrain = this.selectTerrainFromProbabilities(tile.coordinate, terrainProbs, mapRadius);
    }
  }

  /**
   * Apply tribal homeland modifiers using Polytopia's cascading system
   * Order of operations: mountain → forest → plains (calculated automatically)
   */
  private applyTribalModifiers(base: any, modifiers: TribalSpawnModifiers, influence: number): any {
    // Step 1: Start with base percentages
    let mountain = base.mountain;
    let forest = base.forest;
    let plains = base.plains;

    // Step 2: Apply mountain modifier first
    const mountainMod = 1 + (modifiers.mountain - 1) * influence;
    const originalMountain = mountain;
    mountain = Math.min(0.8, Math.max(0.05, mountain * mountainMod)); // Clamp between 5-80%
    const mountainDelta = mountain - originalMountain;
    
    // Subtract delta proportionally from original forest and plains
    const originalTotal = base.forest + base.plains;
    if (originalTotal > 0) {
      forest -= mountainDelta * (base.forest / originalTotal);
      plains -= mountainDelta * (base.plains / originalTotal);
    }

    // Step 3: Apply forest modifier second
    const forestMod = 1 + (modifiers.forest - 1) * influence;
    const newForest = Math.min(0.8, Math.max(0.05, forest * forestMod));
    const forestDelta = newForest - forest;
    
    // Subtract forest delta only from plains (grain fields)
    plains -= forestDelta;
    forest = newForest;

    // Step 4: Plains (grain fields) are whatever is left
    // This ensures the map still sums to 100% and implements the grainField modifier indirectly
    plains = Math.max(0.05, plains);

    // Step 5: Ensure valid percentages
    const total = mountain + forest + plains;
    if (total > 0) {
      mountain /= total;
      forest /= total;
      plains /= total;
    }

    return { mountain, forest, plains };
  }

  /**
   * Select terrain based on probabilities and noise
   * Includes tribal water modifier for coast generation
   */
  private selectTerrainFromProbabilities(coord: HexCoordinate, probs: any, mapRadius: number): TerrainType {
    // Use noise to add variation
    const noiseValue = this.noise2D(coord.q * 0.1, coord.r * 0.1);
    const distanceFromCenter = Math.sqrt(coord.q ** 2 + coord.r ** 2) / mapRadius;
    
    // Base edge effects (more water near edges)
    let waterChance = distanceFromCenter > 0.8 ? 0.3 : 0.1;
    
    // Apply tribal water modifier if near capitals
    for (let i = 0; i < this.config.playerCount; i++) {
      const capitalPos = this.getCapitalPosition(i);
      if (capitalPos) {
        const distance = hexDistance(coord, capitalPos);
        if (distance <= 4) {
          const factionId = this.playerFactions[i] as FactionId;
          const modifiers = TRIBAL_SPAWN_MODIFIERS[factionId];
          
          if (modifiers) {
            const influence = Math.max(0, 1 - distance / 4);
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
   * Step 6: Place resources in zones around cities with tribal modifiers
   */
  private placeZonedResources(tiles: Tile[]): void {
    const cityTiles = tiles.filter(tile => tile.hasCity);
    // Use the existing capital positions from the map generation
    const capitalPositions = cityTiles.filter(city => 
      this.playerFactions.some((_, i) => {
        const expectedCapital = this.getCapitalPosition(i);
        return expectedCapital && 
               city.coordinate.q === expectedCapital.q && 
               city.coordinate.r === expectedCapital.r;
      })
    ).map(city => city.coordinate);
    
    for (const tile of tiles) {
      // Only place resources within 2-tile radius of cities
      const nearbyCity = cityTiles.find(cityTile => 
        hexDistance(tile.coordinate, cityTile.coordinate) <= 2
      );
      
      if (!nearbyCity || tile.hasCity) continue;
      
      const distance = hexDistance(tile.coordinate, nearbyCity.coordinate);
      const isInnerCity = distance === 1;
      
      // Get base spawn rates based on distance
      let spawnRates = isInnerCity ? this.getInnerCitySpawnTable() : this.getOuterCitySpawnTable();
      
      // Apply tribal homeland modifiers if this city is near a capital
      for (let i = 0; i < capitalPositions.length; i++) {
        const distanceFromCapital = hexDistance(nearbyCity.coordinate, capitalPositions[i]);
        if (distanceFromCapital <= 4) {
          const factionId = this.playerFactions[i] as FactionId;
          const modifiers = TRIBAL_SPAWN_MODIFIERS[factionId];
          
          if (modifiers) {
            // Apply tribal resource modifiers
            const influence = Math.max(0, 1 - distanceFromCapital / 4);
            spawnRates = this.applyTribalResourceModifiers(spawnRates, modifiers, influence);
          }
        }
      }
      
      const resource = this.getResourceFromTable(spawnRates, tile.terrain);
      if (resource) {
        tile.resources = [resource];
      }
    }
  }

  /**
   * Helper to get expected capital position for a player
   */
  private getCapitalPosition(playerIndex: number): HexCoordinate | null {
    const mapRadius = Math.min(this.config.width, this.config.height);
    const angle = (playerIndex / this.config.playerCount) * 2 * Math.PI;
    const spawnRadius = Math.floor(mapRadius * 0.6);
    
    const q = Math.round(spawnRadius * Math.cos(angle));
    const r = Math.round(spawnRadius * Math.sin(angle));
    const s = -q - r;
    
    return { q, r, s };
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
    
    // Apply modifiers to world elements and traditional resources
    modified.wild_goats = Math.round(modified.wild_goats * wildAnimalMod);
    modified.jaredite_ruins = Math.round(modified.jaredite_ruins * ruinsMod);
    modified.fishing_shoal = Math.round(modified.fishing_shoal * fishMod);
    modified.sea_beast = Math.round(modified.sea_beast * fishMod);
    
    // Also apply to traditional animal resources
    modified.food = Math.round(modified.food * wildAnimalMod); // Food includes hunted animals
    
    // Clamp values to reasonable ranges
    modified.wild_goats = Math.max(0, Math.min(30, modified.wild_goats));
    modified.jaredite_ruins = Math.max(0, Math.min(25, modified.jaredite_ruins));
    modified.fishing_shoal = Math.max(0, Math.min(20, modified.fishing_shoal));
    modified.sea_beast = Math.max(0, Math.min(15, modified.sea_beast));
    modified.food = Math.max(0, Math.min(25, modified.food));
    
    return modified;
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

  private generateTerrain(q: number, r: number, mapRadius: number): TerrainType {
    const distanceFromCenter = Math.sqrt(q * q + r * r);
    const normalizedDistance = distanceFromCenter / mapRadius;

    // Multiple noise octaves for realistic terrain
    const scale1 = 0.1;  // Large features
    const scale2 = 0.3;  // Medium features
    const scale3 = 0.6;  // Small details

    const noise1 = this.noise2D(q * scale1, r * scale1) * 0.6;
    const noise2 = this.noise2D(q * scale2, r * scale2) * 0.3;
    const noise3 = this.noise2D(q * scale3, r * scale3) * 0.1;
    
    const combinedNoise = noise1 + noise2 + noise3;

    // Center bias - make center more accessible
    const centerBias = Math.max(0, 1 - normalizedDistance);
    const adjustedNoise = combinedNoise + (centerBias * 0.4);

    // Edge bias - more obstacles at edges
    const edgeBias = Math.max(0, normalizedDistance - 0.7) * 0.3;

    const finalValue = adjustedNoise - edgeBias;

    // Convert to terrain types with strategic distribution
    if (finalValue < -0.3) {
      return 'water';
    } else if (finalValue < -0.1) {
      return 'swamp';
    } else if (finalValue < 0.2) {
      return 'plains';
    } else if (finalValue < 0.5) {
      return 'forest';
    } else if (finalValue < 0.7) {
      return 'desert';
    } else {
      return 'mountain';
    }
  }

  /**
   * Strategic resource placement using the 2-tile radius rule around cities
   * Resources only spawn within 2 hex tiles of cities, with higher rates adjacent to cities
   */
  private placeResourcesStrategically(tiles: Tile[]): void {
    // 1. Identify all city coordinates
    const cityTiles = tiles.filter(tile => tile.hasCity);
    if (cityTiles.length === 0) return; // No cities to place resources around
    
    const cityCoordinates = cityTiles.map(tile => tile.coordinate);
    
    // 2. Identify all spawnable tiles (within 2-tile radius of cities)
    const spawnableTiles = tiles.filter(tile => {
      if (tile.hasCity) return false; // Don't place on city tiles
      
      for (const cityCoord of cityCoordinates) {
        if (hexDistance(tile.coordinate, cityCoord) <= 2) {
          return true;
        }
      }
      return false;
    });
    
    // 3. Place resources using distance-based spawn tables
    spawnableTiles.forEach(tile => {
      const distanceToNearestCity = Math.min(
        ...cityCoordinates.map(cityCoord => hexDistance(tile.coordinate, cityCoord))
      );
      
      let spawnTable: ResourceSpawnRate;
      if (distanceToNearestCity === 1) {
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
  }
  
  /**
   * Inner city spawn rates (adjacent to cities) - high resource concentration
   */
  private getInnerCitySpawnTable(): ResourceSpawnRate {
    return {
      food: 20,          // 20%
      stone: 15,         // 15%
      gold: 10,          // 10%
      timber_grove: 15,  // 15%
      wild_goats: 12,    // 12%
      grain_patch: 16,   // 16%
      fishing_shoal: 0,  // 0% (water only)
      sea_beast: 0,      // 0% (deep water only)
      jaredite_ruins: 7, // 7%
      empty: 5           // 5%
    };
  }
  
  /**
   * Outer city spawn rates (2 tiles away) - lower concentration
   */
  private getOuterCitySpawnTable(): ResourceSpawnRate {
    return {
      food: 8,           // 8%
      stone: 10,         // 10%
      gold: 5,           // 5%
      timber_grove: 12,  // 12%
      wild_goats: 8,     // 8%
      grain_patch: 10,   // 10%
      fishing_shoal: 0,  // 0% (water only)
      sea_beast: 0,      // 0% (deep water only)
      jaredite_ruins: 7, // 7%
      empty: 40          // 40%
    };
  }
  
  /**
   * Select resource from spawn table based on terrain requirements and random roll
   */
  private getResourceFromTable(spawnTable: ResourceSpawnRate, terrain: TerrainType): string | null {
    const roll = this.rng.nextInt(1, 100); // 1-100 roll
    let cumulative = 0;
    
    // Check each resource type in order
    const resourceChecks = [
      { 
        type: 'food', 
        rate: spawnTable.food, 
        terrains: ['plains', 'forest'] 
      },
      { 
        type: 'stone', 
        rate: spawnTable.stone, 
        terrains: ['mountain', 'desert'] 
      },
      { 
        type: 'gold', 
        rate: spawnTable.gold, 
        terrains: ['mountain', 'desert', 'plains'] 
      },
      // World Elements
      { 
        type: 'timber_grove', 
        rate: spawnTable.timber_grove, 
        terrains: ['forest', 'hill'] 
      },
      { 
        type: 'wild_goats', 
        rate: spawnTable.wild_goats, 
        terrains: ['plains', 'hill'] 
      },
      { 
        type: 'grain_patch', 
        rate: spawnTable.grain_patch, 
        terrains: ['plains', 'forest'] 
      },
      { 
        type: 'fishing_shoal', 
        rate: spawnTable.fishing_shoal, 
        terrains: ['water'] 
      },
      { 
        type: 'sea_beast', 
        rate: spawnTable.sea_beast, 
        terrains: ['water'] // Will be limited to deep water in post-processing
      },
      { 
        type: 'jaredite_ruins', 
        rate: spawnTable.jaredite_ruins, 
        terrains: ['plains', 'desert', 'forest', 'hill'] 
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


  
  /**
   * Create balanced map sectors for player starting positions
   */
  private createMapSectors(mapRadius: number, playerCount: number): Array<{center: HexCoordinate, radius: number}> {
    const sectors: Array<{center: HexCoordinate, radius: number}> = [];
    const sectorRadius = Math.floor(mapRadius * 0.6); // Sectors in inner 60% of map
    
    for (let i = 0; i < playerCount; i++) {
      const angle = (i / playerCount) * 2 * Math.PI;
      const centerQ = Math.round(sectorRadius * Math.cos(angle));
      const centerR = Math.round(sectorRadius * Math.sin(angle));
      const centerS = -centerQ - centerR;
      
      sectors.push({
        center: { q: centerQ, r: centerR, s: centerS },
        radius: Math.floor(mapRadius / Math.max(2, playerCount - 1))
      });
    }
    
    return sectors;
  }
  
  /**
   * Find the best location for a city within a sector (or anywhere if no sector)
   */
  private findBestCityLocation(
    tiles: Tile[], 
    sector: {center: HexCoordinate, radius: number} | null,
    existingCities: HexCoordinate[], 
    mapRadius: number
  ): HexCoordinate | null {
    const candidates: Array<{coordinate: HexCoordinate, score: number}> = [];
    const minCityDistance = 4; // Minimum distance between cities
    
    for (const tile of tiles) {
      // Check if tile is in sector (if sector specified)
      if (sector) {
        const distanceFromSectorCenter = hexDistance(tile.coordinate, sector.center);
        if (distanceFromSectorCenter > sector.radius) continue;
      }
      
      // Only suitable terrain
      if (tile.terrain !== 'plains' && tile.terrain !== 'forest') continue;
      if (tile.hasCity) continue;
      
      // Check minimum distance from existing cities
      const tooClose = existingCities.some(cityCoord => 
        hexDistance(tile.coordinate, cityCoord) < minCityDistance
      );
      if (tooClose) continue;
      
      // Score based on terrain quality and resource potential nearby
      let score = this.scoreCityLocation(tile, tiles, mapRadius);
      
      // Prefer locations closer to sector center (if sector specified)
      if (sector) {
        const distanceFromCenter = hexDistance(tile.coordinate, sector.center);
        score += Math.max(0, (sector.radius - distanceFromCenter)) * 0.1;
      }
      
      candidates.push({ coordinate: tile.coordinate, score });
    }
    
    // Sort by score and pick the best location
    candidates.sort((a, b) => b.score - a.score);
    return candidates.length > 0 ? candidates[0].coordinate : null;
  }
  
  /**
   * Score a potential city location based on surrounding terrain and strategic value
   */
  private scoreCityLocation(centerTile: Tile, allTiles: Tile[], mapRadius: number): number {
    let score = 0;
    
    // Base score for terrain type
    if (centerTile.terrain === 'plains') score += 10;
    if (centerTile.terrain === 'forest') score += 8;
    
    // Analyze surrounding tiles (within 2 hex radius)
    for (const tile of allTiles) {
      const distance = hexDistance(centerTile.coordinate, tile.coordinate);
      if (distance > 2) continue;
      
      // Prefer diverse, workable terrain nearby
      switch (tile.terrain) {
        case 'plains':
          score += distance === 1 ? 3 : 1; // Adjacent plains very valuable
          break;
        case 'forest':
          score += distance === 1 ? 2 : 1; // Good for wood/food
          break;
        case 'desert':
          score += 0.5; // Can provide gold but harsh
          break;
        case 'mountain':
          score += distance === 1 ? 0 : 1; // Not adjacent, but can provide stone
          break;
        case 'water':
          score -= distance === 1 ? 2 : 0; // Adjacent water is problematic
          break;
      }
    }
    
    // Distance from map edge (prefer not too close to edge)
    const distanceFromCenter = Math.sqrt(
      centerTile.coordinate.q ** 2 + centerTile.coordinate.r ** 2
    );
    const normalizedDistance = distanceFromCenter / mapRadius;
    
    // Optimal distance is 30-70% from center
    if (normalizedDistance >= 0.3 && normalizedDistance <= 0.7) {
      score += 5;
    } else if (normalizedDistance > 0.8) {
      score -= 3; // Too close to edge
    }
    
    return score;
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