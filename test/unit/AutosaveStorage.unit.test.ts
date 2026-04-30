import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { GameState } from '@shared/types/game';

const memory = new Map<string, any>();
const originalIndexedDB = (globalThis as any).indexedDB;
type PendingOperation = {
  kind: 'set' | 'del';
  key: string;
  value?: any;
  resolve: () => void;
};
let holdStorageOperations = false;
const pendingOperations: PendingOperation[] = [];

vi.mock('idb-keyval', () => ({
  get: async (key: string) => memory.get(key),
  set: async (key: string, value: any) => {
    if (holdStorageOperations) {
      await new Promise<void>((resolve) => {
        pendingOperations.push({ kind: 'set', key, value, resolve });
      });
    }
    memory.set(key, value);
  },
  del: async (key: string) => {
    if (holdStorageOperations) {
      await new Promise<void>((resolve) => {
        pendingOperations.push({ kind: 'del', key, resolve });
      });
    }
    memory.delete(key);
  },
}));

import { saveAutosave, loadAutosave, clearAutosave } from '../../client/src/lib/autosaveStorage';

describe('autosaveStorage', () => {
  beforeEach(async () => {
    holdStorageOperations = false;
    pendingOperations.length = 0;
    memory.clear();
    (globalThis as any).indexedDB = {};
    await clearAutosave();
  });
  afterEach(() => {
    if (originalIndexedDB === undefined) {
      delete (globalThis as any).indexedDB;
      return;
    }
    (globalThis as any).indexedDB = originalIndexedDB;
  });

  it('round-trips a valid game state through autosave', async () => {
    const mockGameState: GameState = {
      id: 'test-game',
      rngSeed: 123,
      players: [
        {
          id: 'player1',
          name: 'Alice',
          factionId: 'NEPHITES',
          stats: { faith: 50, pride: 30, internalDissent: 10 },
          visibilityMask: [],
          exploredTiles: [],
          isEliminated: false,
          turnOrder: 0,
          stars: 20,
          researchedTechs: [],
          researchProgress: 0,
          citiesOwned: ['city1'],
          constructionQueue: [],
          atWarWith: [],
          alliedWith: [],
          tradeRoutes: [],
          diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
        },
      ],
      currentPlayerIndex: 0,
      turn: 5,
      phase: 'playing',
      map: { width: 8, height: 8, tiles: [] },
      units: [],
      cities: [],
      improvements: [],
      structures: [],
      lastAction: undefined,
      winner: undefined,
    };

    await saveAutosave(mockGameState);
    const loaded = await loadAutosave();

    expect(loaded).not.toBeNull();
    expect(loaded?.gameState.id).toBe('test-game');
    expect(loaded?.gameState.turn).toBe(5);
    expect(typeof loaded?.timestamp).toBe('number');
  });

  it('clears autosave', async () => {
    const mockGameState: GameState = {
      id: 'test-game',
      players: [],
      currentPlayerIndex: 0,
      turn: 1,
      phase: 'playing',
      map: { width: 1, height: 1, tiles: [] },
      units: [],
      cities: [],
      improvements: [],
      structures: [],
    };

    await saveAutosave(mockGameState);
    expect(await loadAutosave()).not.toBeNull();

    await clearAutosave();
    expect(await loadAutosave()).toBeNull();
  });

  it('serializes save and clear operations by call order', async () => {
    const mockGameState: GameState = {
      id: 'test-game',
      players: [],
      currentPlayerIndex: 0,
      turn: 1,
      phase: 'playing',
      map: { width: 1, height: 1, tiles: [] },
      units: [],
      cities: [],
      improvements: [],
      structures: [],
    };

    holdStorageOperations = true;
    const savePromise = saveAutosave(mockGameState);
    await Promise.resolve();

    expect(pendingOperations).toHaveLength(1);
    expect(pendingOperations[0].kind).toBe('set');

    const clearPromise = clearAutosave();
    await Promise.resolve();
    expect(pendingOperations).toHaveLength(1);

    pendingOperations.shift()?.resolve();
    await savePromise;
    await Promise.resolve();

    expect(pendingOperations).toHaveLength(1);
    expect(pendingOperations[0].kind).toBe('del');

    pendingOperations.shift()?.resolve();
    await clearPromise;

    holdStorageOperations = false;
    expect(await loadAutosave()).toBeNull();
  });

  it('returns null instead of throwing for corrupt autosave payloads', async () => {
    memory.set('cpl_autosave_v1', '{not-valid-json');

    await expect(loadAutosave()).resolves.toBeNull();
  });
});
