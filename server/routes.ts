import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import MemoryStore from "memorystore";
import bcrypt from "bcryptjs";

const MemoryStoreSession = MemoryStore(session);
const VALID_MAP_SIZES = new Set(["tiny", "small", "normal", "large", "huge"]);
const HOST_LEASE_MS = 30000;

function getHostMeta(lobbyState: any) {
  const hostEpoch = Number(lobbyState?.hostEpoch ?? 0);
  const hostLastSeen = Number(lobbyState?.hostLastSeen ?? 0);
  const leaseExpired = !hostLastSeen || Date.now() - hostLastSeen > HOST_LEASE_MS;
  return { hostEpoch, hostLastSeen, leaseExpired };
}

// Password hashing with bcrypt (salted)
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Generate random lobby code
function generateLobbyCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Extend express-session types
declare module "express-session" {
  interface SessionData {
    userId?: number;
    username?: string;
  }
}

// Auth middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Session middleware - require SESSION_SECRET in production
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET environment variable is required in production");
  }
  
  app.use(
    session({
      cookie: { maxAge: 86400000 * 7 }, // 7 days
      store: new MemoryStoreSession({
        checkPeriod: 86400000, // prune expired entries every 24h
      }),
      resave: false,
      saveUninitialized: false,
      secret: sessionSecret || "dev-only-secret-not-for-production",
    })
  );

  // === AUTH ROUTES ===
  
  // Sign up
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }
      if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: "Username must be 3-20 characters" });
      }
      if (password.length < 4) {
        return res.status(400).json({ error: "Password must be at least 4 characters" });
      }
      
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ error: "Username already taken" });
      }
      
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({ username, password: hashedPassword });
      
      req.session.userId = user.id;
      req.session.username = user.username;
      
      res.status(201).json({ id: user.id, username: user.username });
    } catch (error) {
      console.error("Signup failed:", error);
      res.status(500).json({ error: "Signup failed" });
    }
  });
  
  // Log in
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }
      
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "Invalid username or password" });
      }
      
      const isValidPassword = await verifyPassword(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid username or password" });
      }
      
      req.session.userId = user.id;
      req.session.username = user.username;
      
      res.json({ id: user.id, username: user.username });
    } catch (error) {
      console.error("Login failed:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });
  
  // Log out
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ success: true });
    });
  });
  
  // Get current user
  app.get("/api/auth/me", (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    res.json({ id: req.session.userId, username: req.session.username });
  });

  // === LOBBY ROUTES ===

  // Create a new lobby
  app.post("/api/lobbies", requireAuth, async (req, res) => {
    try {
      const { name, maxPlayers = 6, mapSize = "normal" } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Lobby name required" });
      }
      const normalizedMapSize = String(mapSize).toLowerCase();
      const parsedMaxPlayers = Number(maxPlayers);
      if (!Number.isInteger(parsedMaxPlayers) || parsedMaxPlayers < 2 || parsedMaxPlayers > 8) {
        return res.status(400).json({ error: "Max players must be between 2 and 8" });
      }
      if (!VALID_MAP_SIZES.has(normalizedMapSize)) {
        return res.status(400).json({ error: "Invalid map size" });
      }
      
      let code = generateLobbyCode();
      let attempts = 0;
      while (await storage.getLobbyByCode(code) && attempts < 10) {
        code = generateLobbyCode();
        attempts++;
      }
      
      const lobby = await storage.createLobby({
        code,
        name,
        hostUserId: req.session.userId!,
        maxPlayers: parsedMaxPlayers,
        mapSize: normalizedMapSize,
        status: "waiting",
      });
      
      // Create empty seats for the lobby
      for (let i = 0; i < parsedMaxPlayers; i++) {
        await storage.createSeat({
          lobbyId: lobby.id,
          seatIndex: i,
          userId: null,
          factionId: null,
          isReady: false,
          isAI: false,
        });
      }
      
      // Auto-claim first seat for host
      const seats = await storage.getSeatsByLobbyId(lobby.id);
      if (seats.length > 0) {
        await storage.updateSeat(seats[0].id, { 
          userId: req.session.userId!,
          playerName: req.session.username || "Host"
        });
      }
      
      const updatedSeats = await storage.getSeatsByLobbyId(lobby.id);
      res.status(201).json({ ...lobby, seats: updatedSeats });
    } catch (error) {
      console.error("Failed to create lobby:", error);
      res.status(500).json({ error: "Failed to create lobby" });
    }
  });

  // List open lobbies
  app.get("/api/lobbies", async (req, res) => {
    try {
      const lobbies = await storage.getOpenLobbies();
      // Include seat counts
      const lobbiesWithSeats = await Promise.all(
        lobbies.map(async (lobby) => {
          const seats = await storage.getSeatsByLobbyId(lobby.id);
          const claimedSeats = seats.filter(s => s.userId !== null || s.isAI).length;
          return { ...lobby, claimedSeats, totalSeats: seats.length };
        })
      );
      res.json(lobbiesWithSeats);
    } catch (error) {
      console.error("Failed to list lobbies:", error);
      res.status(500).json({ error: "Failed to list lobbies" });
    }
  });

  // Get lobby by id (for refreshing)
  app.get("/api/lobbies/id/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const lobby = await storage.getLobbyById(id);
      if (!lobby) {
        return res.status(404).json({ error: "Lobby not found" });
      }
      const seats = await storage.getSeatsByLobbyId(lobby.id);
      const userId = req.session.userId!;
      const isParticipant = lobby.hostUserId === userId || seats.some((seat) => seat.userId === userId);
      if (lobby.status !== "waiting" && !isParticipant) {
        return res.status(409).json({ error: "Game already in progress" });
      }
      res.json({ ...lobby, seats });
    } catch (error) {
      console.error("Failed to get lobby:", error);
      res.status(500).json({ error: "Failed to get lobby" });
    }
  });

  // Get lobby by code (for joining)
  app.get("/api/lobbies/code/:code", requireAuth, async (req, res) => {
    try {
      const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
      if (!lobby) {
        return res.status(404).json({ error: "Lobby not found" });
      }
      const seats = await storage.getSeatsByLobbyId(lobby.id);
      const userId = req.session.userId!;
      const isParticipant = lobby.hostUserId === userId || seats.some((seat) => seat.userId === userId);
      if (lobby.status !== "waiting" && !isParticipant) {
        return res.status(409).json({ error: "Game already in progress" });
      }
      res.json({ ...lobby, seats });
    } catch (error) {
      console.error("Failed to get lobby:", error);
      res.status(500).json({ error: "Failed to get lobby" });
    }
  });

  // Claim a seat in a lobby
  app.post("/api/lobbies/:code/seats/:seatIndex/claim", requireAuth, async (req, res) => {
    try {
      const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
      if (!lobby) {
        return res.status(404).json({ error: "Lobby not found" });
      }
      if (lobby.status !== "waiting") {
        return res.status(400).json({ error: "Game already started" });
      }
      
      const seatIndex = parseInt(req.params.seatIndex);
      const seats = await storage.getSeatsByLobbyId(lobby.id);
      const seat = seats.find(s => s.seatIndex === seatIndex);
      
      if (!seat) {
        return res.status(404).json({ error: "Seat not found" });
      }
      if (seat.userId !== null) {
        return res.status(400).json({ error: "Seat already claimed" });
      }
      
      const { playerName } = req.body;
      await storage.updateSeat(seat.id, { 
        userId: req.session.userId!, 
        playerName: playerName || req.session.username || "Player",
        isAI: false,
        isReady: false 
      });
      
      const updatedSeats = await storage.getSeatsByLobbyId(lobby.id);
      res.json({ ...lobby, seats: updatedSeats });
    } catch (error) {
      console.error("Failed to claim seat:", error);
      res.status(500).json({ error: "Failed to claim seat" });
    }
  });

  // Release a seat
  app.post("/api/lobbies/:code/seats/:seatIndex/release", requireAuth, async (req, res) => {
    try {
      const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
      if (!lobby) {
        return res.status(404).json({ error: "Lobby not found" });
      }
      if (lobby.status !== "waiting") {
        return res.status(400).json({ error: "Lobby is not in waiting state" });
      }
      
      const seatIndex = parseInt(req.params.seatIndex);
      const seats = await storage.getSeatsByLobbyId(lobby.id);
      const seat = seats.find(s => s.seatIndex === seatIndex);
      
      if (!seat) {
        return res.status(404).json({ error: "Seat not found" });
      }
      if (seat.userId !== req.session.userId) {
        return res.status(403).json({ error: "Not your seat" });
      }
      
      await storage.updateSeat(seat.id, { 
        userId: null, 
        playerName: null,
        factionId: null,
        isReady: false 
      });
      
      const updatedSeats = await storage.getSeatsByLobbyId(lobby.id);
      res.json({ ...lobby, seats: updatedSeats });
    } catch (error) {
      console.error("Failed to release seat:", error);
      res.status(500).json({ error: "Failed to release seat" });
    }
  });

  // Update seat (faction, ready status)
  app.patch("/api/lobbies/:code/seats/:seatIndex", requireAuth, async (req, res) => {
    try {
      const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
      if (!lobby) {
        return res.status(404).json({ error: "Lobby not found" });
      }
      if (lobby.status !== "waiting") {
        return res.status(400).json({ error: "Lobby is not in waiting state" });
      }
      
      const seatIndex = parseInt(req.params.seatIndex);
      const seats = await storage.getSeatsByLobbyId(lobby.id);
      const seat = seats.find(s => s.seatIndex === seatIndex);
      
      if (!seat) {
        return res.status(404).json({ error: "Seat not found" });
      }
      if (seat.userId !== req.session.userId) {
        return res.status(403).json({ error: "Not your seat" });
      }
      
      const { factionId, isReady } = req.body;
      const updates: any = {};
      if (factionId !== undefined) updates.factionId = factionId;
      if (isReady !== undefined) updates.isReady = isReady;
      
      await storage.updateSeat(seat.id, updates);
      
      const updatedSeats = await storage.getSeatsByLobbyId(lobby.id);
      res.json({ ...lobby, seats: updatedSeats });
    } catch (error) {
      console.error("Failed to update seat:", error);
      res.status(500).json({ error: "Failed to update seat" });
    }
  });

  // Set a seat as AI
  app.post("/api/lobbies/:code/seats/:seatIndex/ai", requireAuth, async (req, res) => {
    try {
      const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
      if (!lobby) {
        return res.status(404).json({ error: "Lobby not found" });
      }
      if (lobby.status !== "waiting") {
        return res.status(400).json({ error: "Lobby is not in waiting state" });
      }
      if (lobby.hostUserId !== req.session.userId) {
        return res.status(403).json({ error: "Only host can add AI" });
      }
      
      const seatIndex = parseInt(req.params.seatIndex);
      const seats = await storage.getSeatsByLobbyId(lobby.id);
      const seat = seats.find(s => s.seatIndex === seatIndex);
      
      if (!seat) {
        return res.status(404).json({ error: "Seat not found" });
      }
      if (seat.userId !== null) {
        return res.status(400).json({ error: "Seat claimed by player" });
      }
      
      const { factionId } = req.body;
      await storage.updateSeat(seat.id, { 
        isAI: true, 
        factionId: factionId || null,
        isReady: true 
      });
      
      const updatedSeats = await storage.getSeatsByLobbyId(lobby.id);
      res.json({ ...lobby, seats: updatedSeats });
    } catch (error) {
      console.error("Failed to set AI:", error);
      res.status(500).json({ error: "Failed to set AI" });
    }
  });

  // Remove AI from seat
  app.delete("/api/lobbies/:code/seats/:seatIndex/ai", requireAuth, async (req, res) => {
    try {
      const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
      if (!lobby) {
        return res.status(404).json({ error: "Lobby not found" });
      }
      if (lobby.status !== "waiting") {
        return res.status(400).json({ error: "Lobby is not in waiting state" });
      }
      if (lobby.hostUserId !== req.session.userId) {
        return res.status(403).json({ error: "Only host can remove AI" });
      }
      
      const seatIndex = parseInt(req.params.seatIndex);
      const seats = await storage.getSeatsByLobbyId(lobby.id);
      const seat = seats.find(s => s.seatIndex === seatIndex);
      
      if (!seat) {
        return res.status(404).json({ error: "Seat not found" });
      }
      if (!seat.isAI) {
        return res.status(400).json({ error: "Seat is not AI" });
      }
      
      await storage.updateSeat(seat.id, { 
        isAI: false, 
        factionId: null,
        isReady: false 
      });
      
      const updatedSeats = await storage.getSeatsByLobbyId(lobby.id);
      res.json({ ...lobby, seats: updatedSeats });
    } catch (error) {
      console.error("Failed to remove AI:", error);
      res.status(500).json({ error: "Failed to remove AI" });
    }
  });

  // Leave lobby (release all your seats)
  app.post("/api/lobbies/:code/leave", requireAuth, async (req, res) => {
    try {
      const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
      if (!lobby) {
        return res.status(404).json({ error: "Lobby not found" });
      }
      if (lobby.status !== "waiting") {
        return res.status(400).json({ error: "Lobby is not in waiting state" });
      }
      if (lobby.hostUserId === req.session.userId) {
        await storage.deleteLobby(lobby.id);
        return res.json({ success: true, deleted: true });
      }
      
      await storage.deleteSeatsByUserId(lobby.id, req.session.userId!);
      
      // Re-create empty seats for released ones
      const seats = await storage.getSeatsByLobbyId(lobby.id);
      const takenIndexes = new Set(seats.map(s => s.seatIndex));
      for (let i = 0; i < lobby.maxPlayers; i++) {
        if (!takenIndexes.has(i)) {
          await storage.createSeat({
            lobbyId: lobby.id,
            seatIndex: i,
            userId: null,
            factionId: null,
            isReady: false,
            isAI: false,
          });
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to leave lobby:", error);
      res.status(500).json({ error: "Failed to leave lobby" });
    }
  });

  // Delete lobby (host only)
  app.delete("/api/lobbies/:code", requireAuth, async (req, res) => {
    try {
      const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
      if (!lobby) {
        return res.status(404).json({ error: "Lobby not found" });
      }
      if (lobby.hostUserId !== req.session.userId) {
        return res.status(403).json({ error: "Only host can delete lobby" });
      }
      
      await storage.deleteLobby(lobby.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete lobby:", error);
      res.status(500).json({ error: "Failed to delete lobby" });
    }
  });

  // Start game (host only)
  app.post("/api/lobbies/:code/start", requireAuth, async (req, res) => {
    try {
      const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
      if (!lobby) {
        return res.status(404).json({ error: "Lobby not found" });
      }
      if (lobby.hostUserId !== req.session.userId) {
        return res.status(403).json({ error: "Only host can start game" });
      }
      if (lobby.status !== "waiting") {
        return res.status(400).json({ error: "Game already started" });
      }
      
      const seats = await storage.getSeatsByLobbyId(lobby.id);
      const claimedSeats = seats.filter(s => s.userId !== null || s.isAI);
      const unclaimedSeats = seats.filter(s => s.userId === null && !s.isAI);
      
      if (claimedSeats.length < 2) {
        return res.status(400).json({ error: "Need at least 2 players to start" });
      }
      
      // Check all claimed seats are ready and have faction
      for (const seat of claimedSeats) {
        if (!seat.isReady) {
          return res.status(400).json({ error: "All players must be ready" });
        }
        if (!seat.factionId) {
          return res.status(400).json({ error: "All players must select a faction" });
        }
      }
      
      // Remove unclaimed seats before game start
      for (const seat of unclaimedSeats) {
        await storage.deleteSeat(seat.id);
      }
      
      // Build player data from seats
      const players = claimedSeats.map((seat, index) => ({
        playerId: `player-${index + 1}`,
        seatIndex: seat.seatIndex,
        userId: seat.userId,
        name: seat.playerName || `Player ${seat.seatIndex + 1}`,
        factionId: seat.factionId!,
        isAI: seat.isAI,
        turnOrder: index,
      }));

      const seed = Math.floor(Math.random() * 2 ** 32);
      const hostLastSeen = Date.now();

      // Update lobby status to playing and store player config (game state will be initialized client-side)
      await storage.updateLobby(lobby.id, { 
        status: "playing",
        gameState: {
          players,
          mapSize: lobby.mapSize,
          seed,
          hostEpoch: 1,
          hostLastSeen,
          actionVersion: 0,
          actions: [],
          pendingVersion: 0,
          pendingActions: [],
          snapshotVersion: 0,
          snapshot: null,
        } as any,
      });
      
      const updatedLobby = await storage.getLobbyById(lobby.id);
      const updatedSeats = await storage.getSeatsByLobbyId(lobby.id);
      res.json({ ...updatedLobby, seats: updatedSeats });
    } catch (error) {
      console.error("Failed to start game:", error);
      res.status(500).json({ error: "Failed to start game" });
    }
  });

  // Get host status for a lobby
  app.get("/api/lobbies/:code/host", requireAuth, async (req, res) => {
    try {
      const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
      if (!lobby) {
        return res.status(404).json({ error: "Lobby not found" });
      }
      if (lobby.status !== "playing") {
        return res.status(409).json({ error: "Game not in progress" });
      }

      const seats = await storage.getSeatsByLobbyId(lobby.id);
      const userId = req.session.userId!;
      const isParticipant = lobby.hostUserId === userId || seats.some((seat) => seat.userId === userId);
      if (!isParticipant) {
        return res.status(403).json({ error: "Not a participant" });
      }

      const lobbyState = (lobby.gameState as any) || {};
      const { hostEpoch, hostLastSeen, leaseExpired } = getHostMeta(lobbyState);

      res.json({
        hostUserId: lobby.hostUserId,
        hostEpoch,
        hostLastSeen: hostLastSeen || null,
        leaseExpired,
        leaseMs: HOST_LEASE_MS,
      });
    } catch (error) {
      console.error("Failed to get host status:", error);
      res.status(500).json({ error: "Failed to get host status" });
    }
  });

  // Host heartbeat to keep lease active
  app.post("/api/lobbies/:code/host/heartbeat", requireAuth, async (req, res) => {
    try {
      const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
      if (!lobby) {
        return res.status(404).json({ error: "Lobby not found" });
      }
      if (lobby.status !== "playing") {
        return res.status(409).json({ error: "Game not in progress" });
      }
      if (lobby.hostUserId !== req.session.userId) {
        return res.status(403).json({ error: "Only host can heartbeat" });
      }

      const lobbyState = (lobby.gameState as any) || {};
      const { hostEpoch } = getHostMeta(lobbyState);
      const { hostEpoch: bodyEpoch } = req.body || {};
      if (typeof bodyEpoch !== "number" || bodyEpoch !== hostEpoch) {
        return res.status(409).json({ error: "Host epoch mismatch", hostEpoch });
      }

      const hostLastSeen = Date.now();
      await storage.updateLobby(lobby.id, {
        gameState: { ...lobbyState, hostLastSeen } as any,
      });

      res.json({ hostEpoch, hostLastSeen });
    } catch (error) {
      console.error("Failed to heartbeat host:", error);
      res.status(500).json({ error: "Failed to heartbeat host" });
    }
  });

  // Claim host role if lease expired
  app.post("/api/lobbies/:code/host/claim", requireAuth, async (req, res) => {
    try {
      const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
      if (!lobby) {
        return res.status(404).json({ error: "Lobby not found" });
      }
      if (lobby.status !== "playing") {
        return res.status(409).json({ error: "Game not in progress" });
      }

      const seats = await storage.getSeatsByLobbyId(lobby.id);
      const userId = req.session.userId!;
      const isParticipant = lobby.hostUserId === userId || seats.some((seat) => seat.userId === userId);
      if (!isParticipant) {
        return res.status(403).json({ error: "Not a participant" });
      }

      const lobbyState = (lobby.gameState as any) || {};
      const { hostEpoch, leaseExpired } = getHostMeta(lobbyState);

      if (lobby.hostUserId === userId) {
        const hostLastSeen = Date.now();
        await storage.updateLobby(lobby.id, {
          gameState: { ...lobbyState, hostLastSeen } as any,
        });
        return res.json({ hostUserId: userId, hostEpoch, hostLastSeen });
      }

      if (!leaseExpired) {
        return res.status(409).json({ error: "Host still active", hostUserId: lobby.hostUserId });
      }

      const nextEpoch = hostEpoch + 1;
      const hostLastSeen = Date.now();
      await storage.updateLobby(lobby.id, {
        hostUserId: userId,
        gameState: { ...lobbyState, hostEpoch: nextEpoch, hostLastSeen } as any,
      });

      res.json({ hostUserId: userId, hostEpoch: nextEpoch, hostLastSeen });
    } catch (error) {
      console.error("Failed to claim host:", error);
      res.status(500).json({ error: "Failed to claim host" });
    }
  });

  // Get latest game state snapshot for a lobby
  app.get("/api/lobbies/:code/state", requireAuth, async (req, res) => {
    try {
      const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
      if (!lobby) {
        return res.status(404).json({ error: "Lobby not found" });
      }
      if (lobby.status !== "playing") {
        return res.status(409).json({ error: "Game not in progress" });
      }

      const seats = await storage.getSeatsByLobbyId(lobby.id);
      const userId = req.session.userId!;
      const isParticipant = lobby.hostUserId === userId || seats.some((seat) => seat.userId === userId);
      if (!isParticipant) {
        return res.status(403).json({ error: "Not a participant" });
      }

      const lobbyState = (lobby.gameState as any) || {};
      const snapshotVersion = Number(lobbyState.snapshotVersion ?? 0);
      const actionVersion = Number(lobbyState.actionVersion ?? 0);
      const since = Number(req.query.since ?? 0);

      if (Number.isFinite(since) && since >= snapshotVersion) {
        return res.json({ snapshotVersion, actionVersion, state: null });
      }

      res.json({ snapshotVersion, actionVersion, state: lobbyState.snapshot ?? null });
    } catch (error) {
      console.error("Failed to get game state:", error);
      res.status(500).json({ error: "Failed to get game state" });
    }
  });

  // Update game state snapshot (host only, end-of-turn only)
  app.put("/api/lobbies/:code/state", requireAuth, async (req, res) => {
    try {
      const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
      if (!lobby) {
        return res.status(404).json({ error: "Lobby not found" });
      }
      if (lobby.status !== "playing") {
        return res.status(409).json({ error: "Game not in progress" });
      }
      if (lobby.hostUserId !== req.session.userId) {
        return res.status(403).json({ error: "Only host can update snapshots" });
      }

      const lobbyState = (lobby.gameState as any) || {};
      const { state, version, hostEpoch } = req.body;
      if (!state || typeof version !== "number" || typeof hostEpoch !== "number") {
        return res.status(400).json({ error: "State, version, and hostEpoch required" });
      }

      const { hostEpoch: currentHostEpoch } = getHostMeta(lobbyState);
      if (hostEpoch !== currentHostEpoch) {
        return res.status(409).json({ error: "Host epoch mismatch", hostEpoch: currentHostEpoch });
      }

      const currentActionVersion = Number(lobbyState.actionVersion ?? 0);
      if (version !== currentActionVersion) {
        return res.status(409).json({ error: "Out of date", version: currentActionVersion });
      }

      const lastAction = state.lastAction;
      if (!lastAction || (lastAction.type !== "END_TURN" && lastAction.type !== "END_TURN_RESOLUTION")) {
        return res.status(400).json({ error: "Only end-of-turn updates allowed" });
      }

      await storage.updateLobby(lobby.id, {
        gameState: {
          ...lobbyState,
          snapshot: state,
          snapshotVersion: version,
          hostLastSeen: Date.now(),
        } as any,
      });

      res.json({ snapshotVersion: version, actionVersion: currentActionVersion });
    } catch (error) {
      console.error("Failed to update game state:", error);
      res.status(500).json({ error: "Failed to update game state" });
    }
  });

  // Queue player action for host processing
  app.post("/api/lobbies/:code/actions/queue", requireAuth, async (req, res) => {
    try {
      const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
      if (!lobby) {
        return res.status(404).json({ error: "Lobby not found" });
      }
      if (lobby.status !== "playing") {
        return res.status(409).json({ error: "Game not in progress" });
      }

      const lobbyState = (lobby.gameState as any) || {};
      const { action, actorId, id } = req.body;
      if (!action || !actorId || !id) {
        return res.status(400).json({ error: "Action, actorId, and id required" });
      }

      const playerMeta = (lobbyState.players || []).find((player: any) => player.playerId === actorId);
      if (!playerMeta) {
        return res.status(400).json({ error: "Unknown player" });
      }

      if (playerMeta.isAI) {
        return res.status(403).json({ error: "AI actions must be submitted by host" });
      }

      if (playerMeta.userId !== req.session.userId) {
        return res.status(403).json({ error: "Not your player" });
      }

      const pendingVersion = Number(lobbyState.pendingVersion ?? 0) + 1;
      const pendingActions = Array.isArray(lobbyState.pendingActions) ? [...lobbyState.pendingActions] : [];
      pendingActions.push({ queueVersion: pendingVersion, id, actorId, action });

      await storage.updateLobby(lobby.id, {
        gameState: { ...lobbyState, pendingVersion, pendingActions } as any,
      });

      res.json({ queueVersion: pendingVersion });
    } catch (error) {
      console.error("Failed to queue action:", error);
      res.status(500).json({ error: "Failed to queue action" });
    }
  });

  // Host fetches pending actions
  app.get("/api/lobbies/:code/actions/queue", requireAuth, async (req, res) => {
    try {
      const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
      if (!lobby) {
        return res.status(404).json({ error: "Lobby not found" });
      }
      if (lobby.status !== "playing") {
        return res.status(409).json({ error: "Game not in progress" });
      }
      if (lobby.hostUserId !== req.session.userId) {
        return res.status(403).json({ error: "Only host can fetch pending actions" });
      }

      const lobbyState = (lobby.gameState as any) || {};
      const pendingActions = Array.isArray(lobbyState.pendingActions) ? lobbyState.pendingActions : [];
      const pendingVersion = Number(lobbyState.pendingVersion ?? 0);
      const since = Number(req.query.since ?? 0);

      if (Number.isFinite(since) && since >= pendingVersion) {
        return res.json({ pendingVersion, actions: [] });
      }

      const actions = Number.isFinite(since)
        ? pendingActions.filter((entry: any) => entry.queueVersion > since)
        : pendingActions;

      res.json({ pendingVersion, actions });
    } catch (error) {
      console.error("Failed to fetch pending actions:", error);
      res.status(500).json({ error: "Failed to fetch pending actions" });
    }
  });

  // Host commits an action to the log
  app.post("/api/lobbies/:code/actions/commit", requireAuth, async (req, res) => {
    try {
      const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
      if (!lobby) {
        return res.status(404).json({ error: "Lobby not found" });
      }
      if (lobby.status !== "playing") {
        return res.status(409).json({ error: "Game not in progress" });
      }
      if (lobby.hostUserId !== req.session.userId) {
        return res.status(403).json({ error: "Only host can commit actions" });
      }

      const lobbyState = (lobby.gameState as any) || {};
      const { action, actorId, id, queueVersion, hostEpoch } = req.body;
      if (!action || !actorId || !id || typeof hostEpoch !== "number") {
        return res.status(400).json({ error: "Action, actorId, id, and hostEpoch required" });
      }

      const { hostEpoch: currentHostEpoch } = getHostMeta(lobbyState);
      if (hostEpoch !== currentHostEpoch) {
        return res.status(409).json({ error: "Host epoch mismatch", hostEpoch: currentHostEpoch });
      }

      const playerMeta = (lobbyState.players || []).find((player: any) => player.playerId === actorId);
      if (!playerMeta) {
        return res.status(400).json({ error: "Unknown player" });
      }

      const nextActionVersion = Number(lobbyState.actionVersion ?? 0) + 1;
      const actions = Array.isArray(lobbyState.actions) ? [...lobbyState.actions] : [];
      actions.push({ version: nextActionVersion, id, actorId, action });

      let pendingActions = Array.isArray(lobbyState.pendingActions) ? [...lobbyState.pendingActions] : [];
      if (queueVersion) {
        pendingActions = pendingActions.filter((entry: any) => entry.queueVersion !== queueVersion);
      } else {
        pendingActions = pendingActions.filter((entry: any) => entry.id !== id);
      }

      await storage.updateLobby(lobby.id, {
        gameState: {
          ...lobbyState,
          actionVersion: nextActionVersion,
          actions,
          pendingActions,
          hostLastSeen: Date.now(),
        } as any,
      });

      res.json({ actionVersion: nextActionVersion });
    } catch (error) {
      console.error("Failed to commit action:", error);
      res.status(500).json({ error: "Failed to commit action" });
    }
  });

  // Fetch committed actions
  app.get("/api/lobbies/:code/actions", requireAuth, async (req, res) => {
    try {
      const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
      if (!lobby) {
        return res.status(404).json({ error: "Lobby not found" });
      }
      if (lobby.status !== "playing") {
        return res.status(409).json({ error: "Game not in progress" });
      }

      const seats = await storage.getSeatsByLobbyId(lobby.id);
      const userId = req.session.userId!;
      const isParticipant = lobby.hostUserId === userId || seats.some((seat) => seat.userId === userId);
      if (!isParticipant) {
        return res.status(403).json({ error: "Not a participant" });
      }

      const lobbyState = (lobby.gameState as any) || {};
      const actionVersion = Number(lobbyState.actionVersion ?? 0);
      const actions = Array.isArray(lobbyState.actions) ? lobbyState.actions : [];
      const since = Number(req.query.since ?? 0);

      if (Number.isFinite(since) && since >= actionVersion) {
        return res.json({ actionVersion, actions: [] });
      }

      const newActions = Number.isFinite(since)
        ? actions.filter((entry: any) => entry.version > since)
        : actions;

      res.json({ actionVersion, actions: newActions });
    } catch (error) {
      console.error("Failed to fetch actions:", error);
      res.status(500).json({ error: "Failed to fetch actions" });
    }
  });

  // === GAME SAVES ROUTES ===
  
  app.get("/api/saves", async (req, res) => {
    try {
      const deviceId = req.headers["x-device-id"] as string;
      if (!deviceId) {
        return res.status(400).json({ error: "Device ID required" });
      }
      const saves = await storage.getGameSavesByDeviceId(deviceId);
      res.json(saves);
    } catch (error) {
      console.error("Failed to list saves:", error);
      res.status(500).json({ error: "Failed to list saves" });
    }
  });

  app.get("/api/saves/:id", async (req, res) => {
    try {
      const deviceId = req.headers["x-device-id"] as string;
      if (!deviceId) {
        return res.status(400).json({ error: "Device ID required" });
      }
      const id = parseInt(req.params.id);
      const save = await storage.getGameSaveById(id);
      if (!save) {
        return res.status(404).json({ error: "Save not found" });
      }
      if (save.deviceId !== deviceId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(save);
    } catch (error) {
      console.error("Failed to get save:", error);
      res.status(500).json({ error: "Failed to get save" });
    }
  });

  app.post("/api/saves", async (req, res) => {
    try {
      const deviceId = req.headers["x-device-id"] as string;
      if (!deviceId) {
        return res.status(400).json({ error: "Device ID required" });
      }
      const { name, gameState, metadata } = req.body;
      if (!name || !gameState || !metadata) {
        return res.status(400).json({ error: "Name, gameState, and metadata required" });
      }
      const save = await storage.createGameSave({
        deviceId,
        name,
        gameState,
        metadata
      });
      res.status(201).json(save);
    } catch (error) {
      console.error("Failed to create save:", error);
      res.status(500).json({ error: "Failed to create save" });
    }
  });

  app.put("/api/saves/:id", async (req, res) => {
    try {
      const deviceId = req.headers["x-device-id"] as string;
      if (!deviceId) {
        return res.status(400).json({ error: "Device ID required" });
      }
      const id = parseInt(req.params.id);
      const existingSave = await storage.getGameSaveById(id);
      if (!existingSave) {
        return res.status(404).json({ error: "Save not found" });
      }
      if (existingSave.deviceId !== deviceId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const { name, gameState, metadata } = req.body;
      const save = await storage.updateGameSave(id, { name, gameState, metadata });
      res.json(save);
    } catch (error) {
      console.error("Failed to update save:", error);
      res.status(500).json({ error: "Failed to update save" });
    }
  });

  app.delete("/api/saves/:id", async (req, res) => {
    try {
      const deviceId = req.headers["x-device-id"] as string;
      if (!deviceId) {
        return res.status(400).json({ error: "Device ID required" });
      }
      const id = parseInt(req.params.id);
      const existingSave = await storage.getGameSaveById(id);
      if (!existingSave) {
        return res.status(404).json({ error: "Save not found" });
      }
      if (existingSave.deviceId !== deviceId) {
        return res.status(403).json({ error: "Access denied" });
      }
      await storage.deleteGameSave(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete save:", error);
      res.status(500).json({ error: "Failed to delete save" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
