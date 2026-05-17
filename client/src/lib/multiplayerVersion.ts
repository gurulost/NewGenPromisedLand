import {
  buildMultiplayerVersionHeaders,
  buildMultiplayerVersionQuery,
  isStoredMultiplayerVersionCompatible,
} from "@shared/multiplayerVersion";

const env = import.meta.env as Record<string, string | undefined>;

export const CLIENT_MULTIPLAYER_BUILD_ID =
  env.VITE_MULTIPLAYER_BUILD_ID || undefined;

export function multiplayerVersionHeaders(): Record<string, string> {
  return buildMultiplayerVersionHeaders(CLIENT_MULTIPLAYER_BUILD_ID);
}

export function multiplayerJsonHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...multiplayerVersionHeaders(),
  };
}

export function appendMultiplayerVersionQuery(path: string): string {
  const params = buildMultiplayerVersionQuery(CLIENT_MULTIPLAYER_BUILD_ID);
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${params.toString()}`;
}

export function isCompatibleMultiplayerLobbyState(value: unknown): boolean {
  return isStoredMultiplayerVersionCompatible(value);
}
