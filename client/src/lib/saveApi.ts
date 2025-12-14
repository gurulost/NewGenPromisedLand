import type { GameState } from "@shared/types/game";

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

function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(path, {
    ...options,
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
}

export async function listSaves(): Promise<ServerSave[]> {
  return apiRequest<ServerSave[]>("/api/saves");
}

export async function getSave(id: number): Promise<ServerSave> {
  return apiRequest<ServerSave>(`/api/saves/${id}`);
}

export async function createSave(
  name: string,
  gameState: GameState,
  metadata: SaveMetadata
): Promise<ServerSave> {
  return apiRequest<ServerSave>("/api/saves", {
    method: "POST",
    body: JSON.stringify({ name, gameState, metadata }),
  });
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
  await apiRequest<{ success: boolean }>(`/api/saves/${id}`, {
    method: "DELETE",
  });
}
