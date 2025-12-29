import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import MemoryStore from "memorystore";
import bcrypt from "bcryptjs";

const MemoryStoreSession = MemoryStore(session);

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
      const { name, maxPlayers = 6, mapSize = "medium" } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Lobby name required" });
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
        maxPlayers,
        mapSize,
        status: "waiting",
      });
      
      // Create empty seats for the lobby
      for (let i = 0; i < maxPlayers; i++) {
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
  app.get("/api/lobbies/id/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const lobby = await storage.getLobbyById(id);
      if (!lobby) {
        return res.status(404).json({ error: "Lobby not found" });
      }
      const seats = await storage.getSeatsByLobbyId(lobby.id);
      res.json({ ...lobby, seats });
    } catch (error) {
      console.error("Failed to get lobby:", error);
      res.status(500).json({ error: "Failed to get lobby" });
    }
  });

  // Get lobby by code (for joining)
  app.get("/api/lobbies/code/:code", async (req, res) => {
    try {
      const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
      if (!lobby) {
        return res.status(404).json({ error: "Lobby not found" });
      }
      const seats = await storage.getSeatsByLobbyId(lobby.id);
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
        seatIndex: seat.seatIndex,
        name: seat.playerName || `Player ${seat.seatIndex + 1}`,
        factionId: seat.factionId!,
        isAI: seat.isAI,
        turnOrder: index,
      }));
      
      // Update lobby status to playing and store player config (game state will be initialized client-side)
      await storage.updateLobby(lobby.id, { 
        status: "playing",
        gameState: { players, mapSize: lobby.mapSize } as any,
      });
      
      const updatedLobby = await storage.getLobbyById(lobby.id);
      const updatedSeats = await storage.getSeatsByLobbyId(lobby.id);
      res.json({ ...updatedLobby, seats: updatedSeats });
    } catch (error) {
      console.error("Failed to start game:", error);
      res.status(500).json({ error: "Failed to start game" });
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
