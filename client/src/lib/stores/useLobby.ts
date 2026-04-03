import { create } from "zustand";

interface Lobby {
  id: number;
  name: string;
  code: string;
  hostUserId: number;
  maxPlayers: number;
  mapSize: string;
  status: string;
  gameState: unknown;
  createdAt: string;
}

interface Seat {
  id: number;
  lobbyId: number;
  seatIndex: number;
  userId: number | null;
  connectionId: string | null;
  playerName: string | null;
  factionId: string | null;
  isReady: boolean;
  isAI: boolean;
}

interface LobbyWithSeats extends Lobby {
  seats: Seat[];
}

interface LobbyStore {
  lobbies: Lobby[];
  currentLobby: LobbyWithSeats | null;
  loading: boolean;
  error: string | null;
  clearError: () => void;

  fetchLobbies: () => Promise<void>;
  createLobby: (name: string, maxPlayers: number, mapSize: string) => Promise<Lobby | null>;
  joinLobby: (code: string) => Promise<LobbyWithSeats | null>;
  fetchLobby: (id: number) => Promise<void>;
  claimSeat: (lobbyId: number, seatIndex: number, playerName: string) => Promise<boolean>;
  releaseSeat: (lobbyId: number, seatIndex: number) => Promise<boolean>;
  updateSeat: (
    lobbyId: number,
    seatIndex: number,
    updates: { factionId?: string | null; isReady?: boolean; playerName?: string | null }
  ) => Promise<boolean>;
  addAISeat: (lobbyId: number, seatIndex: number, factionId: string) => Promise<boolean>;
  removeAISeat: (lobbyId: number, seatIndex: number) => Promise<boolean>;
  leaveLobby: () => Promise<void>;
  startGame: () => Promise<LobbyWithSeats | null>;
}

const normalizeLobbyErrorMessage = (message: string): string => {
  const trimmed = message.trim();
  if (!trimmed) {
    return "Something went wrong.";
  }
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

const getLobbyResponseError = async (res: Response, fallback: string): Promise<string> => {
  try {
    const data = await res.json();
    if (data && typeof data.error === "string" && data.error.trim()) {
      return normalizeLobbyErrorMessage(data.error);
    }
  } catch {
    // Ignore parsing errors and fall back to a normalized default.
  }

  return normalizeLobbyErrorMessage(`${fallback} (${res.status})`);
};

export const useLobby = create<LobbyStore>((set, get) => ({
  lobbies: [],
  currentLobby: null,
  loading: false,
  error: null,
  clearError: () => set({ error: null }),

  fetchLobbies: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/lobbies", { credentials: "include" });
      if (res.ok) {
        const lobbies = await res.json();
        set({ lobbies, loading: false, error: null });
      } else {
        set({ error: await getLobbyResponseError(res, "Failed to fetch lobbies"), loading: false });
      }
    } catch {
      set({ error: "Network error while fetching lobbies. Check your connection and try again.", loading: false });
    }
  },

  createLobby: async (name, maxPlayers, mapSize) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/lobbies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, maxPlayers, mapSize }),
        credentials: "include",
      });
      if (res.ok) {
        const lobby = await res.json();
        set({ loading: false, error: null });
        return lobby;
      } else {
        set({ error: await getLobbyResponseError(res, "Failed to create lobby"), loading: false });
        return null;
      }
    } catch {
      set({ error: "Network error while creating lobby. Check your connection and try again.", loading: false });
      return null;
    }
  },

  joinLobby: async (code) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`/api/lobbies/code/${code}`, { credentials: "include" });
      if (res.ok) {
        const lobby = await res.json();
        set({ currentLobby: lobby, loading: false, error: null });
        return lobby;
      } else {
        set({ error: await getLobbyResponseError(res, "Failed to join lobby"), loading: false });
        return null;
      }
    } catch {
      set({ error: "Network error while joining lobby. Check your connection and try again.", loading: false });
      return null;
    }
  },

  fetchLobby: async (id) => {
    set({ loading: true });
    try {
      const res = await fetch(`/api/lobbies/id/${id}`, { credentials: "include" });
      if (res.ok) {
        const lobby = await res.json();
        set({ currentLobby: lobby, loading: false });
      } else if (res.status === 404) {
        set({ currentLobby: null, error: "Lobby not found.", loading: false });
      } else {
        set({ error: await getLobbyResponseError(res, "Failed to refresh lobby"), loading: false });
      }
    } catch {
      set({ error: "Network error while refreshing lobby. Check your connection and try again.", loading: false });
    }
  },

  claimSeat: async (_lobbyId, seatIndex, playerName) => {
    const lobby = get().currentLobby;
    if (!lobby) {
      set({ error: "Lobby is no longer available." });
      return false;
    }
    set({ error: null });
    try {
      const res = await fetch(`/api/lobbies/${lobby.code}/seats/${seatIndex}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName }),
        credentials: "include",
      });
      if (res.ok) {
        const updatedLobby = await res.json();
        set({ currentLobby: updatedLobby, error: null });
        return true;
      }
      set({ error: await getLobbyResponseError(res, "Unable to claim this seat") });
      return false;
    } catch {
      set({ error: "Network error while claiming this seat. Check your connection and try again." });
      return false;
    }
  },

  releaseSeat: async (_lobbyId, seatIndex) => {
    const lobby = get().currentLobby;
    if (!lobby) {
      set({ error: "Lobby is no longer available." });
      return false;
    }
    set({ error: null });
    try {
      const res = await fetch(`/api/lobbies/${lobby.code}/seats/${seatIndex}/release`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const updatedLobby = await res.json();
        set({ currentLobby: updatedLobby, error: null });
        return true;
      }
      set({ error: await getLobbyResponseError(res, "Unable to leave this seat") });
      return false;
    } catch {
      set({ error: "Network error while leaving this seat. Check your connection and try again." });
      return false;
    }
  },

  updateSeat: async (_lobbyId, seatIndex, updates) => {
    const lobby = get().currentLobby;
    if (!lobby) {
      set({ error: "Lobby is no longer available." });
      return false;
    }
    set({ error: null });
    try {
      const res = await fetch(`/api/lobbies/${lobby.code}/seats/${seatIndex}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (res.ok) {
        const updatedLobby = await res.json();
        set({ currentLobby: updatedLobby, error: null });
        return true;
      }
      set({ error: await getLobbyResponseError(res, "Unable to update this seat") });
      return false;
    } catch {
      set({ error: "Network error while updating this seat. Check your connection and try again." });
      return false;
    }
  },

  addAISeat: async (_lobbyId, seatIndex, factionId) => {
    const lobby = get().currentLobby;
    if (!lobby) {
      set({ error: "Lobby is no longer available." });
      return false;
    }
    set({ error: null });
    try {
      const res = await fetch(`/api/lobbies/${lobby.code}/seats/${seatIndex}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factionId }),
        credentials: "include",
      });
      if (res.ok) {
        const updatedLobby = await res.json();
        set({ currentLobby: updatedLobby, error: null });
        return true;
      }
      set({ error: await getLobbyResponseError(res, "Unable to add an AI player") });
      return false;
    } catch {
      set({ error: "Network error while adding an AI player. Check your connection and try again." });
      return false;
    }
  },

  removeAISeat: async (_lobbyId, seatIndex) => {
    const lobby = get().currentLobby;
    if (!lobby) {
      set({ error: "Lobby is no longer available." });
      return false;
    }
    set({ error: null });
    try {
      const res = await fetch(`/api/lobbies/${lobby.code}/seats/${seatIndex}/ai`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        const updatedLobby = await res.json();
        set({ currentLobby: updatedLobby, error: null });
        return true;
      }
      set({ error: await getLobbyResponseError(res, "Unable to remove the AI player") });
      return false;
    } catch {
      set({ error: "Network error while removing the AI player. Check your connection and try again." });
      return false;
    }
  },

  leaveLobby: async () => {
    const lobby = get().currentLobby;
    if (!lobby) {
      set({ currentLobby: null, error: null });
      return;
    }
    try {
      await fetch(`/api/lobbies/${lobby.code}/leave`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      set({ currentLobby: null, error: null });
    }
  },

  startGame: async () => {
    const lobby = get().currentLobby;
    if (!lobby) {
      set({ error: "Lobby is no longer available." });
      return null;
    }
    set({ error: null });
    try {
      const res = await fetch(`/api/lobbies/${lobby.code}/start`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const updatedLobby = await res.json();
        set({ currentLobby: updatedLobby, error: null });
        return updatedLobby;
      }
      set({ error: await getLobbyResponseError(res, "Unable to start the game") });
      return null;
    } catch {
      set({ error: "Network error while starting the game. Check your connection and try again." });
      return null;
    }
  },
}));
