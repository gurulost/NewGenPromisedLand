import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import MemoryStore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { promises as fs } from "fs";
import path from "path";
import { pool } from "./db";
import {
  getExpectedActorId,
  getExpectedActorIdFromSnapshot,
  getNextExpectedActorId,
  needsSnapshotCatchup,
  type MultiplayerPlayerMeta,
} from "@shared/logic/multiplayerSync";

const MemoryStoreSession = MemoryStore(session);
const PgSessionStore = connectPgSimple(session);
const VALID_MAP_SIZES = new Set(["tiny", "small", "normal", "large", "huge"]);
const HOST_LEASE_MS = 30000;
const MAX_MULTIPLAYER_UPDATE_RETRIES = 5;
const ANIMATION_OVERRIDES_PATH = path.resolve(process.cwd(), "server", "animation-overrides.json");
const UNIT_ANIMATION_REGISTRY_PATH = path.resolve(process.cwd(), "client", "src", "utils", "unitAnimationRegistry.ts");
const ANIMATION_STATES = ["idle", "move", "celebrate", "death", "attack", "hit", "ability"] as const;

type AnimationState = typeof ANIMATION_STATES[number];

const escapeTsString = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const formatClipEntry = (entry: any): string => {
  if (!entry) return '""';
  if (typeof entry === "string") {
    return `"${escapeTsString(entry)}"`;
  }
  const name = escapeTsString(String(entry.name ?? ""));
  const weight = Number.isFinite(entry.weight) ? entry.weight : 1;
  const label = typeof entry.label === "string" ? entry.label.trim() : "";
  if (!label && weight === 1) return `"${name}"`;
  const parts = [`name: "${name}"`];
  if (weight !== 1) parts.push(`weight: ${weight}`);
  if (label) parts.push(`label: "${escapeTsString(label)}"`);
  return `{ ${parts.join(", ")} }`;
};

const formatClipList = (entries: any[], indentLevel: number): string => {
  if (!entries?.length) return "[]";
  const indent = "  ".repeat(indentLevel);
  const closingIndent = "  ".repeat(indentLevel - 1);
  const lines = entries.map((entry) => `${indent}${formatClipEntry(entry)},`);
  return `[\n${lines.join("\n")}\n${closingIndent}]`;
};

const formatNumberRecord = (record: Record<string, number> | undefined, indentLevel: number): string | null => {
  if (!record) return null;
  const keys = Object.keys(record).sort();
  if (!keys.length) return null;
  const indent = "  ".repeat(indentLevel);
  const closingIndent = "  ".repeat(indentLevel - 1);
  const lines = keys.map((key) => `${indent}"${escapeTsString(key)}": ${record[key]},`);
  return `{\n${lines.join("\n")}\n${closingIndent}}`;
};

const formatSpec = (spec: any, baseIndent: string): string => {
  const baseLevel = Math.max(0, Math.round(baseIndent.length / 2));
  const stateLevel = baseLevel + 2;
  const itemLevel = baseLevel + 3;
  const propIndent = `${baseIndent}  `;
  const lines: string[] = [];
  if (spec.animatedModelPath) {
    lines.push(`${propIndent}animatedModelPath: "${escapeTsString(spec.animatedModelPath)}",`);
  }
  lines.push(`${propIndent}clips: {`);
  ANIMATION_STATES.forEach((state) => {
    const list = spec.clips?.[state] ?? [];
    if (!list.length) return;
    lines.push(`${propIndent}  ${state}: ${formatClipList(list, itemLevel)},`);
  });
  lines.push(`${propIndent}},`);
  if (spec.moveSpeedTilesPerSec !== undefined) {
    lines.push(`${propIndent}moveSpeedTilesPerSec: ${spec.moveSpeedTilesPerSec},`);
  }
  if (spec.yawOffset !== undefined) {
    lines.push(`${propIndent}yawOffset: ${spec.yawOffset},`);
  }
  const eventDurations = formatNumberRecord(spec.eventDurationsMs, stateLevel);
  if (eventDurations) {
    lines.push(`${propIndent}eventDurationsMs: ${eventDurations},`);
  }
  const clipDurations = formatNumberRecord(spec.clipDurationsMs, stateLevel);
  if (clipDurations) {
    lines.push(`${propIndent}clipDurationsMs: ${clipDurations},`);
  }
  return `{\n${lines.join("\n")}\n${baseIndent}}`;
};

const replaceOrInsertUnit = (source: string, unitKey: string, spec: any): string => {
  const token = `${unitKey}: {`;
  const index = source.indexOf(token);
  const registryIndex = source.indexOf("export const UNIT_ANIMATION_REGISTRY");
  if (registryIndex === -1) {
    throw new Error("UNIT_ANIMATION_REGISTRY not found");
  }
  const registryBrace = source.indexOf("{", registryIndex);
  if (registryBrace === -1) {
    throw new Error("UNIT_ANIMATION_REGISTRY block not found");
  }

  let baseIndent = "";
  if (index !== -1) {
    const indentLineStart = source.lastIndexOf("\n", index) + 1;
    baseIndent = source.slice(indentLineStart, index);
  } else {
    const registryLineStart = source.lastIndexOf("\n", registryBrace) + 1;
    const registryIndent = source.slice(registryLineStart, registryBrace);
    baseIndent = `${registryIndent}  `;
  }
  const formatted = `${baseIndent}${unitKey}: ${formatSpec(spec, baseIndent)},`;

  if (index === -1) {
    let depth = 0;
    let endIndex = -1;
    for (let i = registryBrace; i < source.length; i += 1) {
      if (source[i] === "{") depth += 1;
      else if (source[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          endIndex = i;
          break;
        }
      }
    }
    if (endIndex === -1) {
      throw new Error("Could not find end of UNIT_ANIMATION_REGISTRY block");
    }
    const insertAt = endIndex;
    return `${source.slice(0, insertAt)}\n${formatted}\n${source.slice(insertAt)}`;
  }

  const braceStart = source.indexOf("{", index);
  if (braceStart === -1) throw new Error(`Malformed block for ${unitKey}`);
  let depth = 0;
  let endIndex = -1;
  for (let i = braceStart; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        endIndex = i;
        break;
      }
    }
  }
  if (endIndex === -1) {
    throw new Error(`Could not find end of unit block for ${unitKey}`);
  }
  let replaceEnd = endIndex + 1;
  if (source[replaceEnd] === ",") replaceEnd += 1;
  return `${source.slice(0, index)}${formatted}${source.slice(replaceEnd)}`;
};

async function readAnimationOverrides() {
  try {
    const data = await fs.readFile(ANIMATION_OVERRIDES_PATH, "utf8");
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeAnimationOverrides(payload: unknown) {
  await fs.mkdir(path.dirname(ANIMATION_OVERRIDES_PATH), { recursive: true });
  const data = JSON.stringify(payload ?? {}, null, 2);
  await fs.writeFile(ANIMATION_OVERRIDES_PATH, data, "utf8");
}

function getHostMeta(lobbyState: any) {
  const hostEpoch = Number(lobbyState?.hostEpoch ?? 0);
  const hostLastSeen = Number(lobbyState?.hostLastSeen ?? 0);
  const leaseExpired = !hostLastSeen || Date.now() - hostLastSeen > HOST_LEASE_MS;
  return { hostEpoch, hostLastSeen, leaseExpired };
}

function selectNextHost(lobbyState: any, currentHostUserId: number): number | null {
  const playersMeta = (Array.isArray(lobbyState?.players) ? lobbyState.players : []) as MultiplayerPlayerMeta[];
  const byPlayerId = new Map<string, MultiplayerPlayerMeta>();

  for (const player of playersMeta) {
    if (player.playerId) {
      byPlayerId.set(player.playerId, player);
    }
  }
  const snapshot = lobbyState?.snapshot;

  if (snapshot && Array.isArray(snapshot.players)) {
    const currentIndex = Number(snapshot.currentPlayerIndex ?? 0);
    const total = snapshot.players.length;
    for (let offset = 0; offset < total; offset += 1) {
      const idx = (currentIndex + offset) % total;
      const snapPlayer = snapshot.players[idx];
      const meta = byPlayerId.get(snapPlayer?.id);
      if (!meta || meta.isAI || meta.userId == null) continue;
      if (meta.userId === currentHostUserId) continue;
      return meta.userId;
    }
  }

  const ordered = [...playersMeta].sort((a: any, b: any) => (a.turnOrder ?? 0) - (b.turnOrder ?? 0));
  for (const meta of ordered) {
    if (meta?.isAI || meta?.userId == null) continue;
    if (meta.userId === currentHostUserId) continue;
    return meta.userId;
  }

  return null;
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

// Parse and validate integer parameters
function parseIntParam(value: string): number | null {
  if (!/^-?\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
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
  
  const isProduction = process.env.NODE_ENV === "production";
  
  // Trust the reverse proxy (required for secure cookies behind HTTPS proxy)
  if (isProduction) {
    app.set("trust proxy", 1);
  }

  const sessionStore = isProduction
    ? new PgSessionStore({
        pool,
        tableName: "user_sessions",
        createTableIfMissing: true,
      })
    : new MemoryStoreSession({
        checkPeriod: 86400000, // prune expired entries every 24h
      });
  
  app.use(
    session({
      cookie: { 
        maxAge: 86400000 * 7, // 7 days
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction, // Only send cookie over HTTPS in production
      },
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      secret: sessionSecret || "dev-only-secret-not-for-production",
      unset: "destroy",
    })
  );

  // === ANIMATION LAB OVERRIDES (DEV TOOLING) ===
  app.get("/api/animation-overrides", async (_req, res) => {
    if (isProduction) {
      return res.status(403).json({ error: "Animation overrides are disabled in production" });
    }
    const overrides = await readAnimationOverrides();
    return res.json(overrides);
  });

  app.post("/api/animation-overrides", async (req, res) => {
    if (isProduction) {
      return res.status(403).json({ error: "Animation overrides are disabled in production" });
    }
    const payload = req.body;
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ error: "Invalid animation overrides payload" });
    }
    await writeAnimationOverrides(payload);
    return res.json({ ok: true });
  });

  app.post("/api/animation-overrides/apply", async (req, res) => {
    if (isProduction) {
      return res.status(403).json({ error: "Apply-to-registry is disabled in production" });
    }
    const payload = req.body;
    const units = payload?.units;
    if (!units || typeof units !== "object") {
      return res.status(400).json({ error: "Invalid apply payload" });
    }
    const unitKeys = Object.keys(units);
    if (unitKeys.length === 0) {
      return res.status(400).json({ error: "No units provided" });
    }
    let source = await fs.readFile(UNIT_ANIMATION_REGISTRY_PATH, "utf8");
    unitKeys.forEach((unitKey) => {
      source = replaceOrInsertUnit(source, unitKey, units[unitKey]);
    });
    await fs.writeFile(UNIT_ANIMATION_REGISTRY_PATH, source, "utf8");
    return res.json({ ok: true, updated: unitKeys });
  });

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
      const id = parseIntParam(req.params.id);
      if (id === null) {
        return res.status(400).json({ error: "Invalid lobby ID" });
      }
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
      
      const seatIndex = parseIntParam(req.params.seatIndex);
      if (seatIndex === null) {
        return res.status(400).json({ error: "Invalid seat index" });
      }
      const seats = await storage.getSeatsByLobbyId(lobby.id);
      const seat = seats.find(s => s.seatIndex === seatIndex);

      if (!seat) {
        return res.status(404).json({ error: "Seat not found" });
      }
      if (seat.userId !== null || seat.isAI) {
        return res.status(400).json({ error: "Seat already claimed" });
      }
      
      const { playerName } = req.body;
      const claimed = await storage.claimSeatIfAvailable(
        lobby.id,
        seatIndex,
        req.session.userId!,
        playerName || req.session.username || "Player",
      );
      if (!claimed) {
        return res.status(409).json({ error: "Seat was claimed by another player. Refresh and try again." });
      }
      await storage.touchLobby(lobby.id);
      
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
      
      const seatIndex = parseIntParam(req.params.seatIndex);
      if (seatIndex === null) {
        return res.status(400).json({ error: "Invalid seat index" });
      }
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
      await storage.touchLobby(lobby.id);
      
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
      
      const seatIndex = parseIntParam(req.params.seatIndex);
      if (seatIndex === null) {
        return res.status(400).json({ error: "Invalid seat index" });
      }
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
      await storage.touchLobby(lobby.id);
      
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
      
      const seatIndex = parseIntParam(req.params.seatIndex);
      if (seatIndex === null) {
        return res.status(400).json({ error: "Invalid seat index" });
      }
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
      await storage.touchLobby(lobby.id);
      
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
      
      const seatIndex = parseIntParam(req.params.seatIndex);
      if (seatIndex === null) {
        return res.status(400).json({ error: "Invalid seat index" });
      }
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
      await storage.touchLobby(lobby.id);
      
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
      await storage.touchLobby(lobby.id);
      
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
      const updated = await storage.updateLobbyIfUnchanged(lobby.id, lobby.updatedAt, { 
        status: "playing",
        gameState: {
          players,
          mapSize: lobby.mapSize,
          seed,
          hostEpoch: 1,
          hostLastSeen,
          actionVersion: 0,
          actions: [],
          actionLogBaseVersion: 0,
          pendingVersion: 0,
          pendingActions: [],
          snapshotVersion: 0,
          snapshot: null,
          expectedActorId: players[0]?.playerId ?? null,
        } as any,
      });
      if (!updated) {
        return res.status(409).json({ error: "Lobby changed while starting game. Refresh and try again." });
      }
      
      const updatedSeats = await storage.getSeatsByLobbyId(lobby.id);
      res.json({ ...updated, seats: updatedSeats });
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
      const suggestedHostUserId = leaseExpired ? selectNextHost(lobbyState, lobby.hostUserId) : null;

      res.json({
        hostUserId: lobby.hostUserId,
        hostEpoch,
        hostLastSeen: hostLastSeen || null,
        leaseExpired,
        leaseMs: HOST_LEASE_MS,
        suggestedHostUserId,
      });
    } catch (error) {
      console.error("Failed to get host status:", error);
      res.status(500).json({ error: "Failed to get host status" });
    }
  });

  // Host heartbeat to keep lease active
  app.post("/api/lobbies/:code/host/heartbeat", requireAuth, async (req, res) => {
    try {
      const { hostEpoch: bodyEpoch } = req.body || {};
      for (let attempt = 0; attempt < MAX_MULTIPLAYER_UPDATE_RETRIES; attempt += 1) {
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
        if (typeof bodyEpoch !== "number" || bodyEpoch !== hostEpoch) {
          return res.status(409).json({ error: "Host epoch mismatch", hostEpoch });
        }

        const hostLastSeen = Date.now();
        const updated = await storage.updateLobbyIfUnchanged(lobby.id, lobby.updatedAt, {
          gameState: { ...lobbyState, hostLastSeen } as any,
        });
        if (updated) {
          return res.json({ hostEpoch, hostLastSeen });
        }
      }

      return res.status(409).json({ error: "Concurrent lobby update. Retry heartbeat." });
    } catch (error) {
      console.error("Failed to heartbeat host:", error);
      res.status(500).json({ error: "Failed to heartbeat host" });
    }
  });

  // Claim host role if lease expired
  app.post("/api/lobbies/:code/host/claim", requireAuth, async (req, res) => {
    try {
      const requestedEpoch = req.body?.hostEpoch;

      for (let attempt = 0; attempt < MAX_MULTIPLAYER_UPDATE_RETRIES; attempt += 1) {
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
        if (typeof requestedEpoch === "number" && requestedEpoch !== hostEpoch) {
          return res.status(409).json({ error: "Host epoch mismatch", hostEpoch });
        }

        const hostLastSeen = Date.now();
        if (lobby.hostUserId === userId) {
          const updated = await storage.updateLobbyIfUnchanged(lobby.id, lobby.updatedAt, {
            gameState: { ...lobbyState, hostLastSeen } as any,
          });
          if (updated) {
            return res.json({ hostUserId: userId, hostEpoch, hostLastSeen });
          }
          continue;
        }

        if (!leaseExpired) {
          return res.status(409).json({ error: "Host still active", hostUserId: lobby.hostUserId });
        }

        const nextEpoch = hostEpoch + 1;
        const updated = await storage.updateLobbyIfUnchanged(lobby.id, lobby.updatedAt, {
          hostUserId: userId,
          gameState: {
            ...lobbyState,
            hostEpoch: nextEpoch,
            hostLastSeen,
            pendingVersion: 0,
            pendingActions: [],
          } as any,
        });
        if (updated) {
          return res.json({ hostUserId: userId, hostEpoch: nextEpoch, hostLastSeen });
        }
      }

      return res.status(409).json({ error: "Concurrent lobby update. Retry host claim." });
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
      const { state, version, hostEpoch } = req.body;
      if (!state || typeof version !== "number" || typeof hostEpoch !== "number") {
        return res.status(400).json({ error: "State, version, and hostEpoch required" });
      }

      const lastAction = state.lastAction;
      if (!lastAction || (lastAction.type !== "END_TURN" && lastAction.type !== "END_TURN_RESOLUTION")) {
        return res.status(400).json({ error: "Only end-of-turn updates allowed" });
      }

      const expectedActorId = getExpectedActorIdFromSnapshot(state);
      for (let attempt = 0; attempt < MAX_MULTIPLAYER_UPDATE_RETRIES; attempt += 1) {
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
        const { hostEpoch: currentHostEpoch } = getHostMeta(lobbyState);
        if (hostEpoch !== currentHostEpoch) {
          return res.status(409).json({ error: "Host epoch mismatch", hostEpoch: currentHostEpoch });
        }

        const currentActionVersion = Number(lobbyState.actionVersion ?? 0);
        if (version !== currentActionVersion) {
          return res.status(409).json({ error: "Out of date", version: currentActionVersion });
        }

        const actions = Array.isArray(lobbyState.actions)
          ? lobbyState.actions.filter((entry: any) => Number(entry?.version) > version)
          : [];

        const updated = await storage.updateLobbyIfUnchanged(lobby.id, lobby.updatedAt, {
          gameState: {
            ...lobbyState,
            snapshot: state,
            snapshotVersion: version,
            actions,
            actionLogBaseVersion: version,
            expectedActorId: expectedActorId ?? getExpectedActorId(lobbyState),
            hostLastSeen: Date.now(),
          } as any,
        });
        if (updated) {
          return res.json({ snapshotVersion: version, actionVersion: currentActionVersion });
        }
      }

      return res.status(409).json({ error: "Concurrent lobby update. Retry snapshot upload." });
    } catch (error) {
      console.error("Failed to update game state:", error);
      res.status(500).json({ error: "Failed to update game state" });
    }
  });

  // Queue player action for host processing
  app.post("/api/lobbies/:code/actions/queue", requireAuth, async (req, res) => {
    try {
      const { action, actorId, id } = req.body;
      if (!action || typeof actorId !== "string" || typeof id !== "string" || !actorId || !id) {
        return res.status(400).json({ error: "Action, actorId, and id required" });
      }

      for (let attempt = 0; attempt < MAX_MULTIPLAYER_UPDATE_RETRIES; attempt += 1) {
        const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
        if (!lobby) {
          return res.status(404).json({ error: "Lobby not found" });
        }
        if (lobby.status !== "playing") {
          return res.status(409).json({ error: "Game not in progress" });
        }

        const lobbyState = (lobby.gameState as any) || {};
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

        const expectedActorId = getExpectedActorId(lobbyState);
        if (expectedActorId && actorId !== expectedActorId) {
          return res.status(409).json({ error: "Not this player's turn", expectedActorId });
        }

        const pendingActions = Array.isArray(lobbyState.pendingActions) ? [...lobbyState.pendingActions] : [];
        const existingPending = pendingActions.find((entry: any) => entry.id === id);
        if (existingPending) {
          return res.json({ queueVersion: existingPending.queueVersion, duplicate: true });
        }
        const committedActions = Array.isArray(lobbyState.actions) ? lobbyState.actions : [];
        const existingCommitted = committedActions.find((entry: any) => entry.id === id);
        if (existingCommitted) {
          return res.status(409).json({ error: "Action already committed", actionVersion: existingCommitted.version });
        }

        const pendingVersion = Number(lobbyState.pendingVersion ?? 0) + 1;
        pendingActions.push({ queueVersion: pendingVersion, id, actorId, action });

        const updated = await storage.updateLobbyIfUnchanged(lobby.id, lobby.updatedAt, {
          gameState: { ...lobbyState, pendingVersion, pendingActions } as any,
        });
        if (updated) {
          return res.json({ queueVersion: pendingVersion });
        }
      }

      return res.status(409).json({ error: "Concurrent lobby update. Retry queue request." });
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
      const { action, actorId, id, queueVersion, hostEpoch } = req.body;
      if (!action || typeof actorId !== "string" || typeof id !== "string" || !actorId || !id || typeof hostEpoch !== "number") {
        return res.status(400).json({ error: "Action, actorId, id, and hostEpoch required" });
      }
      if (queueVersion !== undefined && typeof queueVersion !== "number") {
        return res.status(400).json({ error: "queueVersion must be a number when provided" });
      }

      for (let attempt = 0; attempt < MAX_MULTIPLAYER_UPDATE_RETRIES; attempt += 1) {
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
        const { hostEpoch: currentHostEpoch } = getHostMeta(lobbyState);
        if (hostEpoch !== currentHostEpoch) {
          return res.status(409).json({ error: "Host epoch mismatch", hostEpoch: currentHostEpoch });
        }

        const playerMeta = (lobbyState.players || []).find((player: any) => player.playerId === actorId);
        if (!playerMeta) {
          return res.status(400).json({ error: "Unknown player" });
        }
        const queueVersionProvided = queueVersion !== undefined;
        const requiresQueueProof = !playerMeta.isAI && playerMeta.userId !== req.session.userId;
        if (requiresQueueProof && !queueVersionProvided) {
          return res.status(409).json({ error: "Remote player actions must be queue-backed." });
        }

        const expectedActorId = getExpectedActorId(lobbyState);
        if (expectedActorId && actorId !== expectedActorId) {
          return res.status(409).json({ error: "Not this player's turn", expectedActorId });
        }

        const actions = Array.isArray(lobbyState.actions) ? [...lobbyState.actions] : [];
        const existingCommitted = actions.find((entry: any) => entry.id === id);
        if (existingCommitted) {
          return res.json({ actionVersion: Number(existingCommitted.version ?? lobbyState.actionVersion ?? 0), duplicate: true });
        }

        let pendingActions = Array.isArray(lobbyState.pendingActions) ? [...lobbyState.pendingActions] : [];
        if (queueVersionProvided) {
          const queueMatch = pendingActions.some(
            (entry: any) =>
              entry.queueVersion === queueVersion &&
              entry.id === id &&
              entry.actorId === actorId
          );
          if (!queueMatch) {
            return res.status(409).json({ error: "Pending action mismatch. Refresh pending queue." });
          }
          pendingActions = pendingActions.filter((entry: any) => entry.queueVersion !== queueVersion);
        } else {
          pendingActions = pendingActions.filter((entry: any) => entry.id !== id);
        }

        const nextActionVersion = Number(lobbyState.actionVersion ?? 0) + 1;
        actions.push({ version: nextActionVersion, id, actorId, action });

        const isTurnCompleteAction =
          action?.type === "END_TURN" || action?.type === "END_TURN_RESOLUTION";
        const nextExpectedActorId = isTurnCompleteAction
          ? (getNextExpectedActorId(lobbyState, actorId) ?? expectedActorId)
          : expectedActorId;

        const updated = await storage.updateLobbyIfUnchanged(lobby.id, lobby.updatedAt, {
          gameState: {
            ...lobbyState,
            actionVersion: nextActionVersion,
            actions,
            pendingActions,
            expectedActorId: nextExpectedActorId,
            hostLastSeen: Date.now(),
          } as any,
        });
        if (updated) {
          return res.json({ actionVersion: nextActionVersion });
        }
      }

      return res.status(409).json({ error: "Concurrent lobby update. Retry commit." });
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
      const actionLogBaseVersion = Number(lobbyState.actionLogBaseVersion ?? 0);
      const snapshotVersion = Number(lobbyState.snapshotVersion ?? 0);
      const since = Number(req.query.since ?? 0);

      if (Number.isFinite(since) && since >= actionVersion) {
        return res.json({ actionVersion, actions: [] });
      }
      if (needsSnapshotCatchup(since, actionLogBaseVersion)) {
        return res.json({
          actionVersion,
          actions: [],
          needsSnapshot: true,
          snapshotVersion,
          actionLogBaseVersion,
        });
      }

      const newActions = Number.isFinite(since)
        ? actions.filter((entry: any) => entry.version > since)
        : actions;

      res.json({
        actionVersion,
        actions: newActions,
        needsSnapshot: false,
        snapshotVersion,
        actionLogBaseVersion,
      });
    } catch (error) {
      console.error("Failed to fetch actions:", error);
      res.status(500).json({ error: "Failed to fetch actions" });
    }
  });

  // === GAME SAVES ROUTES ===
  const isSaveApiDisabled = process.env.DISABLE_SAVE_API === "true";
  const respondSaveApiDisabled = (res: Response) =>
    res.status(503).json({ error: "Save API unavailable" });
  
  app.get("/api/saves", async (req, res) => {
    if (isSaveApiDisabled) {
      return respondSaveApiDisabled(res);
    }
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
    if (isSaveApiDisabled) {
      return respondSaveApiDisabled(res);
    }
    try {
      const deviceId = req.headers["x-device-id"] as string;
      if (!deviceId) {
        return res.status(400).json({ error: "Device ID required" });
      }
      const id = parseIntParam(req.params.id);
      if (id === null) {
        return res.status(400).json({ error: "Invalid ID" });
      }
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
    if (isSaveApiDisabled) {
      return respondSaveApiDisabled(res);
    }
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
    if (isSaveApiDisabled) {
      return respondSaveApiDisabled(res);
    }
    try {
      const deviceId = req.headers["x-device-id"] as string;
      if (!deviceId) {
        return res.status(400).json({ error: "Device ID required" });
      }
      const id = parseIntParam(req.params.id);
      if (id === null) {
        return res.status(400).json({ error: "Invalid ID" });
      }
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
    if (isSaveApiDisabled) {
      return respondSaveApiDisabled(res);
    }
    try {
      const deviceId = req.headers["x-device-id"] as string;
      if (!deviceId) {
        return res.status(400).json({ error: "Device ID required" });
      }
      const id = parseIntParam(req.params.id);
      if (id === null) {
        return res.status(400).json({ error: "Invalid ID" });
      }
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
