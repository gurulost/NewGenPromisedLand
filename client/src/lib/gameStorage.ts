import { GameMap, GameState, Tile, TerrainType, HexCoordinate } from "@shared/types/game";

// Simple seeded random number generator
class SeededRandom {
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

export function generateMap(width: number, height: number, seed?: number): GameMap {
  const rng = new SeededRandom(seed);
  const tiles: Tile[] = [];

  // Generate proper hexagonal grid with offset coordinates
  const mapRadius = Math.min(width, height);
  for (let q = -mapRadius; q <= mapRadius; q++) {
    const r1 = Math.max(-mapRadius, -q - mapRadius);
    const r2 = Math.min(mapRadius, -q + mapRadius);
    for (let r = r1; r <= r2; r++) {
      const s = -q - r;
      
      // Generate terrain with strategic distribution
      let terrain: TerrainType = 'plains';
      const distanceFromCenter = Math.sqrt(q * q + r * r);
      const noise = (q * 0.1 + r * 0.1 + rng.next() * 0.6);
      
      // Center tends to be more accessible (plains/forest)
      // Edges more likely to have obstacles (water/mountains)
      const centerBias = Math.max(0, 1 - distanceFromCenter / mapRadius);
      const adjustedNoise = noise + centerBias * 0.3;
      
      if (adjustedNoise < 0.15) {
        terrain = 'water';
      } else if (adjustedNoise < 0.25) {
        terrain = 'swamp';
      } else if (adjustedNoise < 0.5) {
        terrain = 'forest';
      } else if (adjustedNoise < 0.75) {
        terrain = 'plains';
      } else if (adjustedNoise < 0.9) {
        terrain = 'desert';
      } else {
        terrain = 'mountain';
      }

      const coordinate: HexCoordinate = { q, r, s };
      
      const tile: Tile = {
        coordinate,
        terrain,
        resources: [],
        hasCity: false,
        exploredBy: [],
      };

      // Add some resources randomly
      if (rng.next() < 0.3) {
        const resourceTypes = ['gold', 'stone', 'wood', 'food'];
        tile.resources.push(rng.choice(resourceTypes));
      }

      // Add cities occasionally on good terrain
      if ((terrain === 'plains' || terrain === 'forest') && rng.next() < 0.1) {
        tile.hasCity = true;
      }

      tiles.push(tile);
    }
  }

  return {
    tiles,
    width,
    height,
  };
}

export async function saveGame(gameState: GameState): Promise<void> {
  try {
    const { default: lzString } = await import('lz-string');
    const { default: idbKeyval } = await import('idb-keyval');
    
    const compressed = lzString.compress(JSON.stringify(gameState));
    await idbKeyval.set(`game-${gameState.id}`, compressed);
    
    console.log('Game saved successfully');
  } catch (error) {
    console.error('Failed to save game:', error);
  }
}

export async function loadGame(gameId: string): Promise<GameState | null> {
  try {
    const { default: lzString } = await import('lz-string');
    const { default: idbKeyval } = await import('idb-keyval');
    
    const compressed = await idbKeyval.get(`game-${gameId}`);
    if (!compressed) return null;
    
    const decompressed = lzString.decompress(compressed);
    if (!decompressed) return null;
    
    return JSON.parse(decompressed) as GameState;
  } catch (error) {
    console.error('Failed to load game:', error);
    return null;
  }
}

export async function exportGameToFile(gameState: GameState): Promise<void> {
  try {
    const { default: lzString } = await import('lz-string');
    
    const compressed = lzString.compress(JSON.stringify(gameState));
    const blob = new Blob([compressed], { type: 'application/octet-stream' });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chronicles-game-${gameState.id}.save`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('Game exported successfully');
  } catch (error) {
    console.error('Failed to export game:', error);
  }
}

export async function importGameFromFile(file: File): Promise<GameState | null> {
  try {
    const { default: lzString } = await import('lz-string');
    
    const compressed = await file.text();
    const decompressed = lzString.decompress(compressed);
    
    if (!decompressed) {
      throw new Error('Invalid save file format');
    }
    
    const gameState = JSON.parse(decompressed) as GameState;
    
    // Validate the game state structure
    if (!gameState.id || !gameState.players || !gameState.map) {
      throw new Error('Corrupted save file');
    }
    
    return gameState;
  } catch (error) {
    console.error('Failed to import game:', error);
    return null;
  }
}
