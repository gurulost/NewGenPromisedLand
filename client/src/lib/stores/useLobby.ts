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

  fetchLobbies: () => Promise<void>;
  createLobby: (name: string, maxPlayers: number, mapSize: string) => Promise<Lobby | null>;
  joinLobby: (code: string) => Promise<LobbyWithSeats | null>;
  fetchLobby: (id: number) => Promise<void>;
  claimSeat: (lobbyId: number, seatIndex: number, playerName: string) => Promise<boolean>;
  releaseSeat: (lobbyId: number, seatIndex: number) => Promise<boolean>;
  updateSeat: (lobbyId: number, seatIndex: number, updates: { factionId?: string; isReady?: boolean }) => Promise<boolean>;
  addAISeat: (lobbyId: number, seatIndex: number, factionId: string) => Promise<boolean>;
  leaveLobby: () => Promise<void>;
  startGame: () => Promise<LobbyWithSeats | null>;
}

export const useLobby = create<LobbyStore>((set, get) => ({
  lobbies: [],
  currentLobby: null,
  loading: false,
  error: null,

  fetchLobbies: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/lobbies", { credentials: "include" });
      if (res.ok) {
        const lobbies = await res.json();
        set({ lobbies, loading: false });
      } else {
        set({ error: "Failed to fetch lobbies", loading: false });
      }
    } catch {
      set({ error: "Network error", loading: false });
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
        set({ loading: false });
        return lobby;
      } else {
        const data = await res.json();
        set({ error: data.error || "Failed to create lobby", loading: false });
        return null;
      }
    } catch {
      set({ error: "Network error", loading: false });
      return null;
    }
  },

  joinLobby: async (code) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`/api/lobbies/code/${code}`, { credentials: "include" });
      if (res.ok) {
        const lobby = await res.json();
        set({ currentLobby: lobby, loading: false });
        return lobby;
      } else {
        const data = await res.json();
        set({ error: data.error || "Lobby not found", loading: false });
        return null;
      }
    } catch {
      set({ error: "Network error", loading: false });
      return null;
    }
  },

  fetchLobby: async (id) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`/api/lobbies/id/${id}`, { credentials: "include" });
      if (res.ok) {
        const lobby = await res.json();
        set({ currentLobby: lobby, loading: false });
      } else if (res.status === 404) {
        set({ currentLobby: null, error: "Lobby not found", loading: false });
      } else {
        set({ error: "Lobby not found", loading: false });
      }
    } catch {
      set({ error: "Network error", loading: false });
    }
  },

  claimSeat: async (lobbyId, seatIndex, playerName) => {
    const lobby = get().currentLobby;
    if (!lobby) return false;
    try {
      const res = await fetch(`/api/lobbies/${lobby.code}/seats/${seatIndex}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName }),
        credentials: "include",
      });
      if (res.ok) {
        await get().fetchLobby(lobbyId);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  releaseSeat: async (lobbyId, seatIndex) => {
    const lobby = get().currentLobby;
    if (!lobby) return false;
    try {
      const res = await fetch(`/api/lobbies/${lobby.code}/seats/${seatIndex}/release`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        await get().fetchLobby(lobbyId);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  updateSeat: async (lobbyId, seatIndex, updates) => {
    const lobby = get().currentLobby;
    if (!lobby) return false;
    try {
      const res = await fetch(`/api/lobbies/${lobby.code}/seats/${seatIndex}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (res.ok) {
        await get().fetchLobby(lobbyId);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  addAISeat: async (lobbyId, seatIndex, factionId) => {
    const lobby = get().currentLobby;
    if (!lobby) return false;
    try {
      const res = await fetch(`/api/lobbies/${lobby.code}/seats/${seatIndex}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factionId }),
        credentials: "include",
      });
      if (res.ok) {
        await get().fetchLobby(lobbyId);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  leaveLobby: async () => {
    const lobby = get().currentLobby;
    if (!lobby) {
      set({ currentLobby: null });
      return;
    }
    try {
      await fetch(`/api/lobbies/${lobby.code}/leave`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      set({ currentLobby: null });
    }
  },

  startGame: async () => {
    const lobby = get().currentLobby;
    if (!lobby) return null;
    try {
      const res = await fetch(`/api/lobbies/${lobby.code}/start`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const updatedLobby = await res.json();
        set({ currentLobby: updatedLobby });
        return updatedLobby;
      }
      const data = await res.json();
      set({ error: data.error || "Failed to start game" });
      return null;
    } catch {
      set({ error: "Network error" });
      return null;
    }
  },
}));
