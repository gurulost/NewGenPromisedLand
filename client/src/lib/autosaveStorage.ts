import { get, set, del } from 'idb-keyval';
import * as LZString from 'lz-string';
import type { GameState } from '@shared/types/game';
import { GameStateSchema } from '@shared/types/game';

const AUTOSAVE_KEY = 'cpl_autosave_v1';
const AUTOSAVE_VERSION = 1 as const;

let autosaveOperationChain: Promise<void> = Promise.resolve();

export interface AutosavePayload {
  version: typeof AUTOSAVE_VERSION;
  timestamp: number;
  gameState: GameState;
}

function enqueueAutosaveOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = autosaveOperationChain.then(operation, operation);
  autosaveOperationChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function parseStoredAutosave(stored: unknown): unknown | null {
  if (typeof stored !== 'string') {
    return stored;
  }

  try {
    const decompressed = LZString.decompress(stored);
    if (decompressed) {
      return JSON.parse(decompressed);
    }

    // Legacy/edge: stored is already JSON.
    return JSON.parse(stored);
  } catch {
    return null;
  }
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
  await enqueueAutosaveOperation(() => set(AUTOSAVE_KEY, compressed));
}

export async function loadAutosave(): Promise<AutosavePayload | null> {
  if (typeof indexedDB === 'undefined') return null;

  const stored = await enqueueAutosaveOperation(() => get(AUTOSAVE_KEY));
  if (!stored) return null;

  const data = parseStoredAutosave(stored);
  if (!data) return null;

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

  await enqueueAutosaveOperation(() => del(AUTOSAVE_KEY));
}
