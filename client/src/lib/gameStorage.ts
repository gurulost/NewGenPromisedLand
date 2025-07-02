import { get, set } from 'idb-keyval';
import { z } from 'zod';
import type { GameState } from '@shared/types/game';
import { GameStateSchema } from '@shared/types/game';

// Enhanced validation for import/export safety
export interface GameValidationResult {
  success: boolean;
  data?: GameState;
  error?: string;
  issues?: z.ZodIssue[];
}

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

// Enhanced save game function with validation
export async function saveGame(gameState: GameState): Promise<void> {
  try {
    // Validate before saving
    const validation = validateGameState(gameState);
    if (!validation.success) {
      throw new Error(`Cannot save invalid game state: ${validation.error}`);
    }

    await set(`game-${gameState.id}`, gameState);
    console.log('Game saved successfully:', gameState.id);
  } catch (error) {
    console.error('Failed to save game:', error);
    throw error;
  }
}

// Enhanced load game function with validation
export async function loadGame(gameId: string): Promise<GameState | null> {
  try {
    const data = await get(`game-${gameId}`);
    if (!data) return null;

    // Validate loaded data
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

// Enhanced export function with validation
export async function exportGameToFile(gameState: GameState): Promise<void> {
  try {
    // Validate before export
    const validation = validateGameState(gameState);
    if (!validation.success) {
      throw new Error(`Cannot export invalid game state: ${validation.error}`);
    }

    const dataStr = JSON.stringify(gameState, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chronicles-save-${gameState.id}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to export game:', error);
    throw error;
  }
}

// Enhanced import function with comprehensive validation
export async function importGameFromFile(file: File): Promise<GameState | null> {
  try {
    const text = await file.text();
    let data: unknown;
    
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      throw new Error('Invalid JSON format in save file');
    }

    // Comprehensive validation using Zod schema
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

// List all saved games with validation
export async function listSavedGames(): Promise<Array<{ id: string; timestamp: number; valid: boolean }>> {
  try {
    // This would require implementing a list of game IDs stored separately
    // For now, return empty array as this requires additional storage management
    return [];
  } catch (error) {
    console.error('Failed to list saved games:', error);
    return [];
  }
}

// Delete saved game
export async function deleteSavedGame(gameId: string): Promise<boolean> {
  try {
    await set(`game-${gameId}`, undefined);
    return true;
  } catch (error) {
    console.error('Failed to delete saved game:', error);
    return false;
  }
}