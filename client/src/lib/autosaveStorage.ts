import { get, set, del } from 'idb-keyval';
import * as LZString from 'lz-string';
import type { GameState } from '@shared/types/game';
import { GameStateSchema } from '@shared/types/game';

const AUTOSAVE_KEY = 'cpl_autosave_v1';
const AUTOSAVE_VERSION = 1 as const;

export interface AutosavePayload {
  version: typeof AUTOSAVE_VERSION;
  timestamp: number;
  gameState: GameState;
}

export async function saveAutosave(gameState: GameState): Promise<void> {
  if (typeof indexedDB === 'undefined') return;

  const validation = GameStateSchema.safeParse(gameState);
  if (!validation.success) {
    throw new Error('Refusing to autosave invalid game state');
  }

  const payload: AutosavePayload = {
    version: AUTOSAVE_VERSION,
    timestamp: Date.now(),
    gameState: validation.data,
  };

  const json = JSON.stringify(payload);
  const compressed = LZString.compress(json);
  await set(AUTOSAVE_KEY, compressed);
}

export async function loadAutosave(): Promise<AutosavePayload | null> {
  if (typeof indexedDB === 'undefined') return null;

  const stored = await get(AUTOSAVE_KEY);
  if (!stored) return null;

  let data: unknown;
  if (typeof stored === 'string') {
    const decompressed = LZString.decompress(stored);
    if (decompressed) {
      data = JSON.parse(decompressed);
    } else {
      // Legacy/edge: stored is already JSON.
      data = JSON.parse(stored);
    }
  } else {
    // Legacy/edge: stored as object.
    data = stored;
  }

  // Legacy support: some callers may have stored the raw GameState.
  if (data && typeof data === 'object' && !('gameState' in (data as any))) {
    const validation = GameStateSchema.safeParse(data);
    if (!validation.success) return null;
    return {
      version: AUTOSAVE_VERSION,
      timestamp: Date.now(),
      gameState: validation.data,
    };
  }

  const payload = data as Partial<AutosavePayload>;
  if (!payload.gameState) return null;

  const validatedState = GameStateSchema.safeParse(payload.gameState);
  if (!validatedState.success) return null;

  return {
    version: AUTOSAVE_VERSION,
    timestamp: typeof payload.timestamp === 'number' ? payload.timestamp : Date.now(),
    gameState: validatedState.data,
  };
}

export async function clearAutosave(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;

  await del(AUTOSAVE_KEY);
}
