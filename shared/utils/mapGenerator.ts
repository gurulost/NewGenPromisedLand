import { createNoise2D } from 'simplex-noise';
import type { GameMap, Tile, TerrainType, HexCoordinate } from '@shared/types/game';
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
  tiny: { tiles: 121, dimensions: 11, maxPlayers: 2, name: 'Tiny' },
  small: { tiles: 196, dimensions: 14, maxPlayers: 3, name: 'Small' },
  normal: { tiles: 256, dimensions: 16, maxPlayers: 4, name: 'Normal' },
  large: { tiles: 324, dimensions: 18, maxPlayers: 6, name: 'Large' },
  huge: { tiles: 400, dimensions: 20, maxPlayers: 8, name: 'Huge' }
};

interface FactionTerrainModifiers {
  mountainMod: number;
  forestMod: number;
  resourceMods: {
    metal: number;
    animal: number;
    fruit: number;
    crop: number;
    fish?: number;
    water?: number;
  };
  specialFeatures?: string[];
}

export const FACTION_TERRAIN_MODIFIERS: Record<string, FactionTerrainModifiers> = {
  NEPHITES: {
    mountainMod: 1.5,
    forestMod: 0.8,
    resourceMods: { metal: 1.5, animal: 1.0, fruit: 1.0, crop: 1.0 },
    specialFeatures: ['Sacred Grove']
  },
  LAMANITES: {
    mountainMod: 0.8,
    forestMod: 1.5,
    resourceMods: { metal: 1.0, animal: 2.0, fruit: 0.5, crop: 0.0 }
  },
  MULEKITES: {
    mountainMod: 0.5,
    forestMod: 0.8,
    resourceMods: { metal: 1.0, animal: 1.0, fruit: 1.5, crop: 1.0, fish: 1.5, water: 1.5 }
  },
  ZORAMITES: {
    mountainMod: 1.2,
    forestMod: 0.5,
    resourceMods: { metal: 2.0, animal: 1.0, fruit: 0.5, crop: 1.0 }
  },
  ANTI_NEPHI_LEHIES: {
    mountainMod: 0.5,
    forestMod: 1.2,
    resourceMods: { metal: 0.1, animal: 0.1, fruit: 1.0, crop: 2.0 }
  },
  JAREDITES: {
    mountainMod: 1.0,
    forestMod: 1.0,
    resourceMods: { metal: 1.0, animal: 1.0, fruit: 1.0, crop: 1.0 }
  }
};

interface ResourceSpawnRate {
  food: number;
  wood: number;
  stone: number;
  gold: number;
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
    
    // Step 4: Generate terrain with faction-specific modifiers
    this.generateFactionBiasedTerrain(tiles, mapRadius, capitalPositions);
    
    // Step 5: Place resources in zones around cities
    this.placeZonedResources(tiles);
    
    // Step 6: Place special features
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
   * Step 4: Generate faction-biased terrain using cascading modifiers
   */
  private generateFactionBiasedTerrain(tiles: Tile[], mapRadius: number, capitalPositions: HexCoordinate[]): void {
    // Base terrain percentages
    const baseTerrain = {
      mountain: 0.14,  // 14%
      forest: 0.38,    // 38%
      plains: 0.48     // 48% (fields)
    };

    for (const tile of tiles) {
      // Determine which faction influences this tile (if any)
      let influencingFaction = null;
      let minDistance = Infinity;
      
      for (let i = 0; i < capitalPositions.length; i++) {
        const distance = hexDistance(tile.coordinate, capitalPositions[i]);
        if (distance < Math.floor(mapRadius * 0.4) && distance < minDistance) {
          minDistance = distance;
          influencingFaction = this.playerFactions[i];
        }
      }

      // Apply faction modifiers if within influence range
      let terrainProbs = { ...baseTerrain };
      if (influencingFaction && FACTION_TERRAIN_MODIFIERS[influencingFaction]) {
        terrainProbs = this.applyCascadingModifiers(baseTerrain, FACTION_TERRAIN_MODIFIERS[influencingFaction]);
      }

      // Generate terrain based on noise and modified probabilities
      tile.terrain = this.selectTerrainFromProbabilities(tile.coordinate, terrainProbs, mapRadius);
    }
  }

  /**
   * Apply cascading terrain modifiers as specified
   */
  private applyCascadingModifiers(base: any, modifiers: FactionTerrainModifiers): any {
    // Step 1: Start with base percentages
    let mountain = base.mountain;
    let forest = base.forest;
    let plains = base.plains;

    // Step 2: Apply mountain modifier
    const originalMountain = mountain;
    mountain = Math.min(0.8, Math.max(0.05, mountain * modifiers.mountainMod)); // Clamp between 5-80%
    const mountainDelta = mountain - originalMountain;
    
    // Subtract delta proportionally from original forest and plains
    const originalTotal = base.forest + base.plains;
    if (originalTotal > 0) {
      forest -= mountainDelta * (base.forest / originalTotal);
      plains -= mountainDelta * (base.plains / originalTotal);
    }

    // Step 3: Apply forest modifier to newly adjusted forest percentage
    const newForest = Math.min(0.8, Math.max(0.05, forest * modifiers.forestMod));
    const forestDelta = newForest - forest;
    
    // Subtract forest delta only from plains
    plains -= forestDelta;
    forest = newForest;

    // Step 4: Ensure valid percentages
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
   */
  private selectTerrainFromProbabilities(coord: HexCoordinate, probs: any, mapRadius: number): TerrainType {
    // Use noise to add variation
    const noiseValue = this.noise2D(coord.q * 0.1, coord.r * 0.1);
    const distanceFromCenter = Math.sqrt(coord.q ** 2 + coord.r ** 2) / mapRadius;
    
    // Add some edge effects (more water near edges)
    let waterChance = distanceFromCenter > 0.8 ? 0.3 : 0.1;
    
    const rand = this.rng.next() + noiseValue * 0.3;
    
    if (rand < waterChance) return 'water';
    
    const adjustedRand = (rand - waterChance) / (1 - waterChance);
    
    if (adjustedRand < probs.mountain) return 'mountain';
    if (adjustedRand < probs.mountain + probs.forest) return 'forest';
    return 'plains';
  }

  /**
   * Step 5: Place resources in zones around cities with faction modifiers
   */
  private placeZonedResources(tiles: Tile[]): void {
    const cityTiles = tiles.filter(tile => tile.hasCity);
    
    for (const tile of tiles) {
      // Only place resources within 2-tile radius of cities
      const nearbyCity = cityTiles.find(cityTile => 
        hexDistance(tile.coordinate, cityTile.coordinate) <= 2
      );
      
      if (!nearbyCity || tile.hasCity) continue;
      
      const distance = hexDistance(tile.coordinate, nearbyCity.coordinate);
      const isInnerCity = distance === 1;
      
      // Get spawn rates based on distance
      const spawnRates = isInnerCity ? this.getInnerCitySpawnTable() : this.getOuterCitySpawnTable();
      
      // Apply faction resource modifiers if applicable
      // TODO: Implement faction-specific resource modifiers based on nearby capital
      
      const resource = this.getResourceFromTable(spawnRates, tile.terrain);
      if (resource) {
        tile.resources = [resource];
      }
    }
  }

  /**
   * Step 6: Place special faction features
   */
  private placeSpecialFeatures(tiles: Tile[], capitalPositions: HexCoordinate[]): void {
    for (let i = 0; i < capitalPositions.length; i++) {
      const faction = this.playerFactions[i];
      const modifiers = FACTION_TERRAIN_MODIFIERS[faction];
      
      if (modifiers?.specialFeatures) {
        for (const feature of modifiers.specialFeatures) {
          // Find a suitable tile near the capital for special features
          const nearbyTiles = tiles.filter(tile => {
            const distance = hexDistance(tile.coordinate, capitalPositions[i]);
            return distance >= 2 && distance <= 4 && !tile.hasCity && tile.resources.length === 0;
          });
          
          if (nearbyTiles.length > 0) {
            const chosenTile = this.rng.choice(nearbyTiles);
            chosenTile.resources = [feature];
          }
        }
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
      food: 30,  // 30%
      wood: 25,  // 25%
      stone: 20, // 20%
      gold: 15,  // 15%
      empty: 10  // 10%
    };
  }
  
  /**
   * Outer city spawn rates (2 tiles away) - lower concentration
   */
  private getOuterCitySpawnTable(): ResourceSpawnRate {
    return {
      food: 10,  // 10%
      wood: 20,  // 20%
      stone: 10, // 10%
      gold: 5,   // 5%
      empty: 55  // 55%
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
        type: 'wood', 
        rate: spawnTable.wood, 
        terrains: ['forest'] 
      },
      { 
        type: 'stone', 
        rate: spawnTable.stone, 
        terrains: ['mountain', 'desert'] 
      },
      { 
        type: 'gold', 
        rate: spawnTable.gold, 
        terrains: ['mountain', 'desert'] 
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