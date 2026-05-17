import type { LobbyRealtimeEvent } from "@shared/types/lobbyRealtime";
import { appendMultiplayerVersionQuery } from "./multiplayerVersion";

export type LobbyRealtimeConnectionState = "connecting" | "open" | "error" | "unsupported";

type EventListener = (event: LobbyRealtimeEvent) => void;
type StateListener = (state: LobbyRealtimeConnectionState) => void;

interface LobbyRealtimeEntry {
  lobbyCode: string;
  source: EventSource | null;
  eventListeners: Set<EventListener>;
  stateListeners: Set<StateListener>;
  state: LobbyRealtimeConnectionState;
}

const entriesByLobby = new Map<string, LobbyRealtimeEntry>();

const notifyState = (entry: LobbyRealtimeEntry, nextState: LobbyRealtimeConnectionState): void => {
  if (entry.state === nextState) return;
  entry.state = nextState;
  entry.stateListeners.forEach((listener) => listener(nextState));
};

const createEntry = (lobbyCode: string): LobbyRealtimeEntry => {
  const entry: LobbyRealtimeEntry = {
    lobbyCode,
    source: null,
    eventListeners: new Set(),
    stateListeners: new Set(),
    state: typeof window === "undefined" || typeof window.EventSource === "undefined"
      ? "unsupported"
      : "connecting",
  };

  if (typeof window !== "undefined" && typeof window.EventSource !== "undefined") {
    const source = new window.EventSource(
      appendMultiplayerVersionQuery(`/api/lobbies/${encodeURIComponent(lobbyCode)}/realtime`),
    );
    source.onopen = () => {
      notifyState(entry, "open");
    };
    source.onerror = () => {
      notifyState(entry, "error");
    };
    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as LobbyRealtimeEvent;
        if (!event || typeof event !== "object" || event.lobbyCode !== lobbyCode) {
          return;
        }
        entry.eventListeners.forEach((listener) => listener(event));
      } catch {
        // Ignore malformed realtime payloads and keep the stream alive.
      }
    };
    entry.source = source;
  }

  entriesByLobby.set(lobbyCode, entry);
  return entry;
};

const getOrCreateEntry = (lobbyCode: string): LobbyRealtimeEntry => entriesByLobby.get(lobbyCode) ?? createEntry(lobbyCode);

const maybeDisposeEntry = (entry: LobbyRealtimeEntry): void => {
  if (entry.eventListeners.size > 0 || entry.stateListeners.size > 0) {
    return;
  }

  entry.source?.close();
  entriesByLobby.delete(entry.lobbyCode);
};

export function subscribeLobbyRealtime(
  lobbyCode: string,
  onEvent: EventListener,
  onStateChange?: StateListener,
): () => void {
  const entry = getOrCreateEntry(lobbyCode);
  entry.eventListeners.add(onEvent);

  if (onStateChange) {
    entry.stateListeners.add(onStateChange);
    onStateChange(entry.state);
  }

  return () => {
    entry.eventListeners.delete(onEvent);
    if (onStateChange) {
      entry.stateListeners.delete(onStateChange);
    }
    maybeDisposeEntry(entry);
  };
}
