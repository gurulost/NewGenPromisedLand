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
  minResourceDistance?: number;
  maxResourcesPerPlayer?: number;
}

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

  constructor(config: MapGenerationConfig) {
    this.config = config;
    this.rng = new SeededRandom(config.seed);
    // Create seeded noise function
    this.noise2D = createNoise2D(() => this.rng.next());
  }

  generateMap(): GameMap {
    const tiles: Tile[] = [];
    const mapRadius = Math.min(this.config.width, this.config.height);

    // Generate terrain using multiple noise layers
    for (let q = -mapRadius; q <= mapRadius; q++) {
      const r1 = Math.max(-mapRadius, -q - mapRadius);
      const r2 = Math.min(mapRadius, -q + mapRadius);
      
      for (let r = r1; r <= r2; r++) {
        const s = -q - r;
        const coordinate: HexCoordinate = { q, r, s };
        
        const terrain = this.generateTerrain(q, r, mapRadius);
        
        const tile: Tile = {
          coordinate,
          terrain,
          resources: [],
          hasCity: false,
          exploredBy: [],
        };

        tiles.push(tile);
      }
    }

    // Place cities first before resources
    this.placeCities(tiles, mapRadius);
    
    // Then place resources strategically around cities
    this.placeResourcesStrategically(tiles);

    return {
      tiles,
      width: this.config.width,
      height: this.config.height,
    };
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
   * Strategic city placement ensuring balanced distribution across map sectors
   */
  private placeCities(tiles: Tile[], mapRadius: number): void {
    const targetCities = Math.max(3, Math.floor(this.config.playerCount * 1.5));
    const placedCities: HexCoordinate[] = [];
    
    // Divide map into sectors based on player count for balanced distribution
    const sectors = this.createMapSectors(mapRadius, this.config.playerCount);
    
    // Place one major city per sector first (for potential player spawns)
    for (const sector of sectors) {
      const cityLocation = this.findBestCityLocation(tiles, sector, placedCities, mapRadius);
      if (cityLocation) {
        const cityTile = tiles.find(t => 
          t.coordinate.q === cityLocation.q && 
          t.coordinate.r === cityLocation.r
        );
        if (cityTile) {
          cityTile.hasCity = true;
          placedCities.push(cityLocation);
        }
      }
    }
    
    // Place additional neutral cities to reach target count
    while (placedCities.length < targetCities) {
      const cityLocation = this.findBestCityLocation(tiles, null, placedCities, mapRadius);
      if (!cityLocation) break; // No more suitable locations
      
      const cityTile = tiles.find(t => 
        t.coordinate.q === cityLocation.q && 
        t.coordinate.r === cityLocation.r
      );
      if (cityTile) {
        cityTile.hasCity = true;
        placedCities.push(cityLocation);
      }
    }
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
      minResourceDistance: 2,
      maxResourcesPerPlayer: 3
    });
    
    return generator.generateMap();
  }
}