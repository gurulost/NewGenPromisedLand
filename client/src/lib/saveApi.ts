import type { GameState } from "@shared/types/game";
import { compress, decompress } from "lz-string";

export interface SaveMetadata {
  currentPlayer: string;
  turn: number;
  playerCount: number;
  mapSize: string;
  factions: string[];
}

export interface ServerSave {
  id: number;
  deviceId: string;
  name: string;
  gameState: GameState;
  metadata: SaveMetadata;
  createdAt: string;
  updatedAt: string;
}

const DEVICE_ID_KEY = "chronicles_device_id";
const LOCAL_SAVE_PREFIX = "chronicles_save_";

function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

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
        gameState = JSON.parse(inflated) as GameState;
      } else if (storedGameState && typeof storedGameState === "object") {
        gameState = storedGameState as GameState;
      }

      if (!gameState) continue;

      saves.push({
        id: numericId,
        deviceId: parsed?.deviceId ?? getDeviceId(),
        name,
        gameState,
        metadata,
        createdAt,
        updatedAt,
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
  const now = Date.now();
  const storageId = `save_${now}`;
  const storageKey = `${LOCAL_SAVE_PREFIX}${storageId}`;

  const createdAt = new Date(now).toISOString();
  const payload = {
    id: storageId,
    deviceId: getDeviceId(),
    name,
    timestamp: now,
    createdAt,
    updatedAt: createdAt,
    metadata,
    // Keep saves compact in localStorage.
    gameState: compress(JSON.stringify(gameState)),
  };

  localStorage.setItem(storageKey, JSON.stringify(payload));

  return {
    id: now,
    deviceId: payload.deviceId,
    name,
    gameState,
    metadata,
    createdAt,
    updatedAt: createdAt,
  };
}

function deleteLocalSave(id: number): void {
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
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Device-Id": getDeviceId(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Request failed" }));
      throw new Error(error.error || "Request failed");
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export function getLocalSavesSnapshot(): ServerSave[] {
  return readLocalSaves();
}

export async function listSaves(): Promise<ServerSave[]> {
  try {
    return await apiRequest<ServerSave[]>("/api/saves");
  } catch {
    return readLocalSaves();
  }
}

export async function getSave(id: number): Promise<ServerSave> {
  return apiRequest<ServerSave>(`/api/saves/${id}`);
}

export async function createSave(
  name: string,
  gameState: GameState,
  metadata: SaveMetadata
): Promise<ServerSave> {
  try {
    return await apiRequest<ServerSave>("/api/saves", {
      method: "POST",
      body: JSON.stringify({ name, gameState, metadata }),
    });
  } catch {
    return writeLocalSave(name, gameState, metadata);
  }
}

export async function updateSave(
  id: number,
  name: string,
  gameState: GameState,
  metadata: SaveMetadata
): Promise<ServerSave> {
  return apiRequest<ServerSave>(`/api/saves/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name, gameState, metadata }),
  });
}

export async function deleteSave(id: number): Promise<void> {
  try {
    await apiRequest<{ success: boolean }>(`/api/saves/${id}`, {
      method: "DELETE",
    });
  } catch {
    deleteLocalSave(id);
  }
}
