import type { GameState } from "@shared/types/game";
import { GameStateSchema } from "@shared/types/game";
import {
  type SaveMetadata,
  SaveMetadataSchema,
  SAVE_SCHEMA_VERSION,
} from "@shared/types/save";
import { compress, decompress } from "lz-string";
import { getDeviceId } from "./deviceId";

export type { SaveMetadata } from "@shared/types/save";

export type SaveStorage = "server" | "local";

export class SaveApiError extends Error {
  constructor(
    message: string,
    public readonly code: "timeout" | "network" | "server" | "invalid_response",
    public readonly status?: number,
  ) {
    super(message);
    this.name = "SaveApiError";
  }
}

export function isExpectedCloudSaveUnavailable(error: unknown): boolean {
  return (
    error instanceof SaveApiError &&
    error.code === "server" &&
    error.status === 503 &&
    error.message === "Save API unavailable"
  );
}

export interface ServerSave {
  id: number;
  deviceId: string;
  name: string;
  gameState: GameState;
  metadata: SaveMetadata;
  createdAt: string;
  updatedAt: string;
  storage: SaveStorage;
}

const LOCAL_SAVE_PREFIX = "chronicles_save_";

function parseLocalSaveId(storageKey: string): number | null {
  if (!storageKey.startsWith(LOCAL_SAVE_PREFIX)) return null;
  const suffix = storageKey.slice(LOCAL_SAVE_PREFIX.length); // e.g. save_123
  const match = suffix.match(/(\d+)$/);
  if (!match) return null;
  return Number(match[1]);
}

function localStorageAvailable(): boolean {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

function buildFallbackMetadata(gameState: GameState): SaveMetadata {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  return {
    currentPlayer: currentPlayer?.name ?? "Unknown",
    turn: Math.max(1, gameState.turn || 1),
    playerCount: Math.max(1, gameState.players.length),
    mapSize: `${gameState.map.width}x${gameState.map.height}`,
    factions: gameState.players.map((player) => player.factionId),
  };
}

function normalizeSaveRecord(source: unknown, storage: SaveStorage): ServerSave | null {
  if (!source || typeof source !== "object") return null;

  const record = source as Record<string, unknown>;
  const parsedId = Number(record.id);
  if (!Number.isFinite(parsedId)) return null;

  const gameStateResult = GameStateSchema.safeParse(record.gameState);
  if (!gameStateResult.success) return null;

  const metadataResult = SaveMetadataSchema.safeParse(record.metadata);
  const metadata = metadataResult.success
    ? metadataResult.data
    : buildFallbackMetadata(gameStateResult.data);

  const name = typeof record.name === "string" && record.name.trim()
    ? record.name.trim()
    : `Save ${parsedId}`;
  const createdAt = typeof record.createdAt === "string"
    ? record.createdAt
    : new Date().toISOString();
  const updatedAt = typeof record.updatedAt === "string"
    ? record.updatedAt
    : createdAt;

  return {
    id: parsedId,
    deviceId: typeof record.deviceId === "string" ? record.deviceId : "unknown",
    name,
    gameState: gameStateResult.data,
    metadata,
    createdAt,
    updatedAt,
    storage,
  };
}

function readLocalSaves(): ServerSave[] {
  if (!localStorageAvailable()) return [];

  const saves: ServerSave[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(LOCAL_SAVE_PREFIX)) continue;

    const numericId = parseLocalSaveId(key);
    if (!numericId) continue;

    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as any;

      const name = String(parsed?.name ?? `Save ${numericId}`);
      const createdAt = parsed?.createdAt ?? new Date(parsed?.timestamp ?? Date.now()).toISOString();
      const updatedAt = parsed?.updatedAt ?? createdAt;
      const metadata = parsed?.metadata ?? {};

      let gameState: GameState | null = null;
      const storedGameState = parsed?.gameState;
      if (typeof storedGameState === "string") {
        const inflated = decompress(storedGameState) || storedGameState;
        const result = GameStateSchema.safeParse(JSON.parse(inflated));
        gameState = result.success ? result.data : null;
      } else if (storedGameState && typeof storedGameState === "object") {
        const result = GameStateSchema.safeParse(storedGameState);
        gameState = result.success ? result.data : null;
      }

      if (!gameState) continue;
      const metadataResult = SaveMetadataSchema.safeParse(metadata);
      const normalizedMetadata = metadataResult.success
        ? metadataResult.data
        : buildFallbackMetadata(gameState);

      saves.push({
        id: numericId,
        deviceId: parsed?.deviceId ?? getDeviceId(),
        name,
        gameState,
        metadata: normalizedMetadata,
        createdAt,
        updatedAt,
        storage: "local",
      });
    } catch {
      continue;
    }
  }

  saves.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return saves;
}

function writeLocalSave(
  name: string,
  gameState: GameState,
  metadata: SaveMetadata
): ServerSave {
  const validatedState = GameStateSchema.parse(gameState);
  const validatedMetadata = SaveMetadataSchema.parse(metadata);
  const now = Date.now();
  const storageId = `save_${now}`;
  const storageKey = `${LOCAL_SAVE_PREFIX}${storageId}`;

  const createdAt = new Date(now).toISOString();
  const payload = {
    id: storageId,
    schemaVersion: SAVE_SCHEMA_VERSION,
    deviceId: getDeviceId(),
    name,
    timestamp: now,
    createdAt,
    updatedAt: createdAt,
    metadata: validatedMetadata,
    // Keep saves compact in localStorage.
    gameState: compress(JSON.stringify(validatedState)),
  };

  localStorage.setItem(storageKey, JSON.stringify(payload));

  return {
    id: now,
    deviceId: payload.deviceId,
    name,
    gameState: validatedState,
    metadata: validatedMetadata,
    createdAt,
    updatedAt: createdAt,
    storage: "local",
  };
}

function removeLocalSave(id: number): void {
  if (!localStorageAvailable()) return;
  const storageKey = `${LOCAL_SAVE_PREFIX}save_${id}`;
  localStorage.removeItem(storageKey);
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "http://localhost";
  const url = new URL(path, baseUrl).toString();

  const controller = new AbortController();
  const timeoutMs = 1500;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const requestOptions: RequestInit = {
      ...options,
      credentials: "include",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    };
    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Request failed" }));
      throw new SaveApiError(error.error || "Cloud save request failed", "server", response.status);
    }

    try {
      return await response.json();
    } catch {
      throw new SaveApiError("Cloud save service returned an invalid response", "invalid_response");
    }
  } catch (error) {
    if (error instanceof SaveApiError) {
      throw error;
    }
    if ((error as Error)?.name === "AbortError") {
      throw new SaveApiError("Cloud save service timed out", "timeout");
    }
    throw new SaveApiError("Cloud save service is unavailable", "network");
  } finally {
    clearTimeout(timeout);
  }
}

export function getLocalSavesSnapshot(): ServerSave[] {
  return readLocalSaves();
}

export function listLocalSaves(): ServerSave[] {
  return readLocalSaves();
}

export async function listSaves(): Promise<ServerSave[]> {
  const saves = await apiRequest<unknown[]>("/api/saves");
  return Array.isArray(saves)
    ? saves
        .map((save) => normalizeSaveRecord(save, "server"))
        .filter((save): save is ServerSave => save !== null)
    : [];
}

export async function getSave(id: number): Promise<ServerSave> {
  const save = normalizeSaveRecord(await apiRequest<unknown>(`/api/saves/${id}`), "server");
  if (!save) {
    throw new SaveApiError("Cloud save service returned an invalid save", "invalid_response");
  }
  return save;
}

export async function createSave(
  name: string,
  gameState: GameState,
  metadata: SaveMetadata
): Promise<ServerSave> {
  const save = normalizeSaveRecord(await apiRequest<unknown>("/api/saves", {
    method: "POST",
    body: JSON.stringify({ name, gameState, metadata, schemaVersion: SAVE_SCHEMA_VERSION }),
  }), "server");
  if (!save) {
    throw new SaveApiError("Cloud save service returned an invalid save", "invalid_response");
  }
  return save;
}

export function createLocalSave(
  name: string,
  gameState: GameState,
  metadata: SaveMetadata
): ServerSave {
  return writeLocalSave(name, gameState, metadata);
}

export async function updateSave(
  id: number,
  name: string,
  gameState: GameState,
  metadata: SaveMetadata
): Promise<ServerSave> {
  const save = normalizeSaveRecord(await apiRequest<unknown>(`/api/saves/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name, gameState, metadata, schemaVersion: SAVE_SCHEMA_VERSION }),
  }), "server");
  if (!save) {
    throw new SaveApiError("Cloud save service returned an invalid save", "invalid_response");
  }
  return save;
}

export async function deleteSave(id: number): Promise<void> {
  await apiRequest<{ success: boolean }>(`/api/saves/${id}`, {
    method: "DELETE",
  });
}

export function deleteLocalSave(id: number): void {
  removeLocalSave(id);
}
