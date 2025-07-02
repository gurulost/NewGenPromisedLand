import { createNoise2D } from 'simplex-noise';
import type { GameMap, Tile, HexCoordinate, TerrainType } from '@shared/types/game';

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

    // Generate strategic resource placement
    this.placeResources(tiles, mapRadius);
    
    // Place cities on strategic locations
    this.placeCities(tiles, mapRadius);

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

  private placeResources(tiles: Tile[], mapRadius: number): void {
    const resourceTypes = ['gold', 'stone', 'wood', 'food'];
    const maxResourcesPerType = Math.max(2, Math.floor(this.config.playerCount * 1.5));
    
    // Use secondary noise for resource placement
    const resourceNoise = createNoise2D(() => this.rng.next());
    
    for (const resourceType of resourceTypes) {
      let placedCount = 0;
      const attempts = tiles.length;
      
      for (let attempt = 0; attempt < attempts && placedCount < maxResourcesPerType; attempt++) {
        const tile = tiles[Math.floor(this.rng.next() * tiles.length)];
        
        // Skip unsuitable terrain
        if (tile.terrain === 'water' || tile.terrain === 'mountain') continue;
        if (tile.resources.length > 0) continue; // One resource per tile
        
        const { q, r } = tile.coordinate;
        const resourceValue = resourceNoise(q * 0.2, r * 0.2);
        
        // Higher chance for resources on good terrain
        let resourceChance = 0.15;
        if (tile.terrain === 'forest' && resourceType === 'wood') resourceChance = 0.4;
        if (tile.terrain === 'plains' && resourceType === 'food') resourceChance = 0.3;
        if (tile.terrain === 'desert' && resourceType === 'gold') resourceChance = 0.25;
        
        if (resourceValue > (0.5 - resourceChance)) {
          tile.resources.push(resourceType);
          placedCount++;
        }
      }
    }
  }

  private placeCities(tiles: Tile[], mapRadius: number): void {
    const maxCities = Math.max(3, Math.floor(this.config.playerCount * 2));
    let placedCities = 0;
    
    // Place cities on good terrain with some spacing
    const cityAttempts = tiles.length;
    const minCityDistance = 3;
    
    for (let attempt = 0; attempt < cityAttempts && placedCities < maxCities; attempt++) {
      const tile = tiles[Math.floor(this.rng.next() * tiles.length)];
      
      // Only place cities on suitable terrain
      if (tile.terrain !== 'plains' && tile.terrain !== 'forest') continue;
      if (tile.hasCity) continue;
      
      // Check distance from other cities
      const tooClose = tiles.some(otherTile => {
        if (!otherTile.hasCity) return false;
        const distance = Math.sqrt(
          Math.pow(tile.coordinate.q - otherTile.coordinate.q, 2) +
          Math.pow(tile.coordinate.r - otherTile.coordinate.r, 2)
        );
        return distance < minCityDistance;
      });
      
      if (!tooClose) {
        tile.hasCity = true;
        placedCities++;
      }
    }
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