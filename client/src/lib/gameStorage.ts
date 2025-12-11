import { get, set, del } from 'idb-keyval';
import { z } from 'zod';
import * as LZString from 'lz-string';
import type { GameState } from '@shared/types/game';
import { GameStateSchema } from '@shared/types/game';

// Enhanced validation for import/export safety
export interface GameValidationResult {
  success: boolean;
  data?: GameState;
  error?: string;
  issues?: z.ZodIssue[];
}

// Game metadata for listing saved games
export interface GameMetadata {
  id: string;
  timestamp: number;
  playerCount: number;
  currentTurn: number;
  factionNames: string[];
}

// Game index for managing saved games list
const GAME_INDEX_KEY = 'game_index';

export function validateGameState(data: unknown): GameValidationResult {
  try {
    const result = GameStateSchema.safeParse(data);
    
    if (result.success) {
      return {
        success: true,
        data: result.data
      };
    } else {
      return {
        success: false,
        error: 'Invalid game state format',
        issues: result.error.issues
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown validation error'
    };
  }
}

// Helper function to update game index
async function updateGameIndex(metadata: GameMetadata): Promise<void> {
  try {
    const currentIndex = (await get(GAME_INDEX_KEY)) as GameMetadata[] || [];
    const existingIndex = currentIndex.findIndex(game => game.id === metadata.id);
    
    if (existingIndex >= 0) {
      currentIndex[existingIndex] = metadata;
    } else {
      currentIndex.push(metadata);
    }
    
    await set(GAME_INDEX_KEY, currentIndex);
  } catch (error) {
    console.error('Failed to update game index:', error);
  }
}

// Enhanced save game function with compression and validation
export async function saveGame(gameState: GameState): Promise<void> {
  try {
    // 1. Validate before saving
    const validation = validateGameState(gameState);
    if (!validation.success) {
      throw new Error(`Cannot save invalid game state: ${validation.error}`);
    }

    // 2. Stringify to JSON
    const jsonString = JSON.stringify(gameState);
    
    // 3. Compress using LZ-String
    const compressedData = LZString.compress(jsonString);
    
    // 4. Store compressed data
    await set(`game-${gameState.id}`, compressedData);
    
    // 5. Update game index with metadata
    const metadata: GameMetadata = {
      id: gameState.id,
      timestamp: Date.now(),
      playerCount: gameState.players.length,
      currentTurn: gameState.turn,
      factionNames: gameState.players.map(p => p.name)
    };
    
    await updateGameIndex(metadata);
    console.log('Game saved and compressed successfully:', gameState.id);
  } catch (error) {
    console.error('Failed to save game:', error);
    throw error;
  }
}

// Enhanced load game function with decompression and validation
export async function loadGame(gameId: string): Promise<GameState | null> {
  try {
    // 1. Read compressed data from storage
    const compressedData = await get(`game-${gameId}`);
    if (!compressedData) return null;

    let data: unknown;
    
    // Handle both old uncompressed saves and new compressed saves
    if (typeof compressedData === 'string') {
      // 2. Decompress using LZ-String
      const decompressedString = LZString.decompress(compressedData);
      if (!decompressedString) {
        // Fallback: try parsing as uncompressed JSON (legacy support)
        try {
          data = JSON.parse(compressedData);
        } catch {
          throw new Error('Failed to decompress save data');
        }
      } else {
        // 3. Parse JSON
        data = JSON.parse(decompressedString);
      }
    } else {
      // Legacy: direct object storage (old saves)
      data = compressedData;
    }

    // 4. Validate loaded data using Zod schema
    const validation = validateGameState(data);
    if (!validation.success) {
      console.error('Loaded game data is corrupted:', validation.error, validation.issues);
      throw new Error('Corrupted save file - cannot load game');
    }

    return validation.data!;
  } catch (error) {
    console.error('Failed to load game:', error);
    return null;
  }
}

// Enhanced export function with compression and validation
export async function exportGameToFile(gameState: GameState, compressed = true): Promise<void> {
  try {
    // 1. Validate before export
    const validation = validateGameState(gameState);
    if (!validation.success) {
      throw new Error(`Cannot export invalid game state: ${validation.error}`);
    }

    let dataStr: string;
    let fileName: string;
    let mimeType: string;

    if (compressed) {
      // 2. Stringify and compress for smaller file size
      const jsonString = JSON.stringify(gameState);
      // 3. Compress using LZ-String
      dataStr = LZString.compress(jsonString);
      fileName = `chronicles-save-${gameState.id}-${Date.now()}.cpl`; // .cpl = compressed save
      mimeType = 'application/octet-stream';
    } else {
      // Export readable JSON for debugging
      dataStr = JSON.stringify(gameState, null, 2);
      fileName = `chronicles-save-${gameState.id}-${Date.now()}.json`;
      mimeType = 'application/json';
    }
    
    const dataBlob = new Blob([dataStr], { type: mimeType });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log(`Game exported successfully: ${fileName}`);
  } catch (error) {
    console.error('Failed to export game:', error);
    throw error;
  }
}

// Enhanced import function with decompression and comprehensive validation
export async function importGameFromFile(file: File): Promise<GameState | null> {
  try {
    const text = await file.text();
    let data: unknown;
    
    // Detect file type and handle accordingly
    const isCompressed = file.name.endsWith('.cpl') || file.name.endsWith('.compressed');
    
    if (isCompressed) {
      // 1. Read compressed data
      // 2. Decompress using LZ-String
      const decompressedString = LZString.decompress(text);
      if (!decompressedString) {
        throw new Error('Failed to decompress save file');
      }
      // 3. Parse JSON
      data = JSON.parse(decompressedString);
    } else {
      // Handle uncompressed JSON files
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        throw new Error('Invalid JSON format in save file');
      }
    }

    // 4. Comprehensive validation using Zod schema
    const validation = validateGameState(data);
    if (!validation.success) {
      const errorDetails = validation.issues?.map(issue => 
        `${issue.path.join('.')}: ${issue.message}`
      ).join(', ') || validation.error;
      
      throw new Error(`Invalid save file format: ${errorDetails}`);
    }

    console.log('Game imported and validated successfully');
    return validation.data!;
    
  } catch (error) {
    console.error('Failed to import game:', error);
    throw error;
  }
}

// Helper function to remove game from index
async function removeFromGameIndex(gameId: string): Promise<void> {
  try {
    const currentIndex = (await get(GAME_INDEX_KEY)) as GameMetadata[] || [];
    const filteredIndex = currentIndex.filter(game => game.id !== gameId);
    await set(GAME_INDEX_KEY, filteredIndex);
  } catch (error) {
    console.error('Failed to remove game from index:', error);
  }
}

// List all saved games using the game index
export async function listSavedGames(): Promise<GameMetadata[]> {
  try {
    const gameIndex = (await get(GAME_INDEX_KEY)) as GameMetadata[] || [];
    
    // Sort by timestamp (newest first)
    return gameIndex.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Failed to list saved games:', error);
    return [];
  }
}

// Delete saved game with proper cleanup
export async function deleteSavedGame(gameId: string): Promise<boolean> {
  try {
    // Delete the compressed game data using del() for explicit deletion
    await del(`game-${gameId}`);
    
    // Remove from game index
    await removeFromGameIndex(gameId);
    
    console.log('Game deleted successfully:', gameId);
    return true;
  } catch (error) {
    console.error('Failed to delete saved game:', error);
    return false;
  }
}

// Get save file size estimation
export async function getGameSaveSize(gameState: GameState): Promise<{ 
  uncompressed: number; 
  compressed: number; 
  compressionRatio: number 
}> {
  try {
    const jsonString = JSON.stringify(gameState);
    const compressedString = LZString.compress(jsonString);
    
    const uncompressedSize = new Blob([jsonString]).size;
    const compressedSize = new Blob([compressedString]).size;
    const compressionRatio = compressedSize / uncompressedSize;
    
    return {
      uncompressed: uncompressedSize,
      compressed: compressedSize,
      compressionRatio
    };
  } catch (error) {
    console.error('Failed to calculate save size:', error);
    return { uncompressed: 0, compressed: 0, compressionRatio: 1 };
  }
}