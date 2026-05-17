import type { Express, Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
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
  type MultiplayerPlayerMeta,
} from "@shared/logic/multiplayerSync";
import { getTurnRecoveryStatus } from "./multiplayerPolicy";
import {
  appendMessage,
  appendReadEvent,
  appendTypingEvent,
  normalizeLobbyChatState,
  pruneTyping,
  validateIncomingChatMessage,
} from "./chatState";
import {
  R2_CONFIGURED,
  VOICE_LIMITS,
  isAllowedVoiceMimeType,
  isVoiceStorageUrl,
  isVoiceStorageUrlForLobby,
  createVoiceUploadUrl,
  isBugReportStorageUrlForSubmission,
  createBugReportUploadUrl,
  deleteBugReportObject,
} from "./r2";
import {
  buildBugReportDetailPayload,
  buildBugReportFingerprint,
  formatBugReportId,
  parseBugReportId,
  sanitizeBugReportDiagnostics,
  sendBugReportWebhook,
} from "./bugReports";
import {
  buildAnimationLabAccessStatus,
  clearAnimationLabSession,
  getAnimationLabAccessConfig,
  isAnimationLabAccessConfigured,
  unlockAnimationLabSession,
  verifyAnimationLabAnswer,
} from "./animationLabAccess";
import {
  BugReportScreenshotCleanupRequestSchema,
  BugReportScreenshotUploadRequestSchema,
  SubmitBugReportSchema,
} from "@shared/types/bugReport";
import type { LobbyRealtimeEvent } from "@shared/types/lobbyRealtime";
import type {
  ChatMessageEventPayload,
  ChatMessagesResponse,
  ChatEventsResponse,
  ChatReadUpdateEventPayload,
  ChatTypingEventPayload,
} from "@shared/types/chatEvents";
import { coerceFactionId } from "@shared/types/factionId";
import {
  getDuplicateFactionIds,
  isFactionTakenByAnotherEntry,
} from "@shared/utils/factionAssignments";
import { openLobbyRealtimeStream, publishLobbyRealtimeEvent } from "./lobbyRealtimeBroker";
import { SaveWriteRequestSchema } from "@shared/types/save";
import { createInitialGameState } from "@shared/logic/initialGameState";
import { registerMultiplayerActionRoutes } from "./multiplayerActionRoutes";

const MemoryStoreSession = MemoryStore(session);
const PgSessionStore = connectPgSimple(session);
const VALID_MAP_SIZES = new Set(["tiny", "small", "normal", "large", "huge"]);
const HOST_LEASE_MS = 30000;
const MAX_MULTIPLAYER_UPDATE_RETRIES = 5;
const parsedTurnTimeoutMs = Number.parseInt(process.env.MULTIPLAYER_TURN_TIMEOUT_MS ?? "90000", 10);
const MULTIPLAYER_TURN_TIMEOUT_MS =
  Number.isFinite(parsedTurnTimeoutMs) && parsedTurnTimeoutMs > 0 ? parsedTurnTimeoutMs : 90000;
const MULTIPLAYER_TURN_RECOVERY_ENABLED = process.env.MULTIPLAYER_TURN_RECOVERY !== "false";
const ANIMATION_OVERRIDES_PATH = path.resolve(process.cwd(), "server", "animation-overrides.json");
const UNIT_ANIMATION_REGISTRY_PATH = path.resolve(process.cwd(), "client", "src", "utils", "unitAnimationRegistry.ts");
const ANIMATION_STATES = ["idle", "move", "celebrate", "death", "attack", "hit", "ability"] as const;
const MIN_PASSWORD_LENGTH = Number.parseInt(process.env.MIN_PASSWORD_LENGTH ?? "8", 10);

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

function isChatEnabledLobbyStatus(status: unknown): boolean {
  return status === "waiting" || status === "playing";
}

function isLobbyParticipant(lobbyHostUserId: number, seats: Array<{ userId: number | null }>, userId: number): boolean {
  return lobbyHostUserId === userId || seats.some((seat) => seat.userId === userId);
}

function resolveChatSenderName({
  username,
  seats,
  userId,
}: {
  username: string | undefined;
  seats: Array<{ userId: number | null; playerName: string | null }>;
  userId: number;
}): string {
  const fromSeat = seats.find((seat) => seat.userId === userId && typeof seat.playerName === "string" && seat.playerName.trim());
  const fallback = username?.trim();
  return (fromSeat?.playerName?.trim() || fallback || `Player ${userId}`).slice(0, 64);
}

function resolveChatSenderFactionId({
  lobbyState,
  seats,
  userId,
}: {
  lobbyState: any;
  seats: Array<{ userId: number | null; factionId: string | null }>;
  userId: number;
}): string | undefined {
  const fromLobbyPlayers = Array.isArray(lobbyState?.players)
    ? lobbyState.players.find((entry: any) => entry?.userId === userId && typeof entry?.factionId === "string")
    : null;
  if (fromLobbyPlayers?.factionId) {
    return String(fromLobbyPlayers.factionId).slice(0, 64);
  }
  const fromSeat = seats.find((seat) => seat.userId === userId && typeof seat.factionId === "string" && seat.factionId.trim());
  return fromSeat?.factionId?.slice(0, 64);
}

type RateLimitOptions = {
  windowMs: number;
  maxHits: number;
  key: (req: Request) => string;
  label: string;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

function createRateLimitMiddleware({
  windowMs,
  maxHits,
  key,
  label,
}: RateLimitOptions) {
  const hits = new Map<string, RateLimitEntry>();
  let lastSweep = Date.now();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    if (now - lastSweep > windowMs) {
      hits.forEach((entry, entryKey) => {
        if (entry.resetAt <= now) {
          hits.delete(entryKey);
        }
      });
      lastSweep = now;
    }

    const rateKey = key(req);
    const current = hits.get(rateKey);
    if (!current || current.resetAt <= now) {
      hits.set(rateKey, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= maxHits) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      console.warn("[multiplayer:rate-limit]", {
        label,
        rateKey,
        maxHits,
      });
      return res.status(429).json({ error: "Too many requests. Please retry shortly." });
    }

    current.count += 1;
    next();
  };
}

function setPrivateNoStoreHeaders(res: Response): void {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Pragma", "no-cache");
}

function publishChatRealtimeEvent(lobbyCode: string, event: LobbyRealtimeEvent): void {
  publishLobbyRealtimeEvent(lobbyCode, event);
}

function publishMultiplayerSyncEvent(
  lobbyCode: string,
  reason: Extract<LobbyRealtimeEvent, { type: "multiplayer-sync" }>["reason"],
): void {
  publishLobbyRealtimeEvent(lobbyCode, {
    type: "multiplayer-sync",
    lobbyCode,
    reason,
  });
}

async function persistSession(req: Request): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    req.session.save((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function regenerateSession(req: Request): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function establishAuthenticatedSession(
  req: Request,
  user: { id: number; username: string },
): Promise<void> {
  const previousAnonymousOwnerId =
    req.session.userId == null && req.session.anonymousSaveOwnerId
      ? `anon:${req.session.anonymousSaveOwnerId}`
      : null;

  await regenerateSession(req);
  req.session.userId = user.id;
  req.session.username = user.username;
  await persistSession(req);

  if (previousAnonymousOwnerId) {
    try {
      await storage.transferGameSaveOwnership(previousAnonymousOwnerId, `user:${user.id}`);
    } catch (error) {
      console.error("Failed to migrate anonymous saves after login:", error);
    }
  }
}

async function getSaveOwnerId(req: Request): Promise<string> {
  if (req.session.userId) {
    return `user:${req.session.userId}`;
  }

  if (!req.session.anonymousSaveOwnerId) {
    req.session.anonymousSaveOwnerId = randomUUID();
    await persistSession(req);
  }

  return `anon:${req.session.anonymousSaveOwnerId}`;
}

const authRateLimit = createRateLimitMiddleware({
  windowMs: 10 * 60 * 1000,
  maxHits: 30,
  key: (req) => req.ip || "unknown",
  label: "auth",
});

const userRateLimit = (label: string, maxHits: number, windowMs = 60 * 1000) => createRateLimitMiddleware({
  windowMs,
  maxHits,
  key: (req) => `${req.ip || "unknown"}:${req.session.userId ?? "anonymous"}:${label}`,
  label,
});

const lobbyCreateRateLimit = userRateLimit("lobby-create", 20);
const lobbySeatWriteRateLimit = userRateLimit("lobby-seat", 120);
const queueRateLimit = userRateLimit("queue", 240);
const commitRateLimit = userRateLimit("commit", 240);
const hostHeartbeatRateLimit = userRateLimit("host-heartbeat", 120);
const hostClaimRateLimit = userRateLimit("host-claim", 30);
const playerHeartbeatRateLimit = userRateLimit("player-heartbeat", 240);
const chatWriteRateLimit = userRateLimit("chat-write", 180);
const chatTypingRateLimit = userRateLimit("chat-typing", 300);
const chatVoiceUploadRateLimit = userRateLimit("voice-upload", 20);
const bugReportRateLimit = userRateLimit("bug-report", 8);
const bugReportUploadRateLimit = userRateLimit("bug-report-upload", 8);

const bugReportReadRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000,
  maxHits: 30,
  key: (req) => `${req.ip || "unknown"}:bug-report-read`,
  label: "bug-report-read",
});

const animationLabUnlockRateLimit = userRateLimit("animation-lab-unlock", 10, 10 * 60 * 1000);

const multiplayerTelemetry = {
  needsSnapshot: 0,
  forcedTimeoutEndTurn: 0,
  hostTransfer: 0,
};

function logMultiplayerTelemetry(event: keyof typeof multiplayerTelemetry, payload: Record<string, unknown>) {
  multiplayerTelemetry[event] += 1;
  console.info("[multiplayer:telemetry]", {
    event,
    count: multiplayerTelemetry[event],
    ...payload,
  });
}

// Extend express-session types
declare module "express-session" {
  interface SessionData {
    userId?: number;
    username?: string;
    anonymousSaveOwnerId?: string;
    animationLabUnlockedAt?: number;
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
  const animationLabAccessConfig = getAnimationLabAccessConfig(process.env);
  
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
  app.get("/api/animation-lab/access", (req, res) => {
    setPrivateNoStoreHeaders(res);
    return res.json(buildAnimationLabAccessStatus(req.session, animationLabAccessConfig));
  });

  app.post("/api/animation-lab/unlock", animationLabUnlockRateLimit, async (req, res) => {
    setPrivateNoStoreHeaders(res);
    if (!animationLabAccessConfig.isProduction) {
      unlockAnimationLabSession(req.session);
      await persistSession(req);
      return res.json(buildAnimationLabAccessStatus(req.session, animationLabAccessConfig));
    }

    if (!isAnimationLabAccessConfigured(animationLabAccessConfig)) {
      return res.status(503).json({ error: "Animation Lab access is not configured on this deployment." });
    }

    const answer = typeof req.body?.answer === "string" ? req.body.answer : "";
    if (!verifyAnimationLabAnswer(answer, animationLabAccessConfig)) {
      clearAnimationLabSession(req.session);
      await persistSession(req);
      return res.status(401).json({ error: "Access denied." });
    }

    unlockAnimationLabSession(req.session);
    await persistSession(req);

    return res.json(buildAnimationLabAccessStatus(req.session, animationLabAccessConfig));
  });

  app.post("/api/animation-lab/lock", async (req, res) => {
    setPrivateNoStoreHeaders(res);
    clearAnimationLabSession(req.session);
    await persistSession(req);
    return res.json(buildAnimationLabAccessStatus(req.session, animationLabAccessConfig));
  });

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
  app.post("/api/auth/signup", authRateLimit, async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }
      if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: "Username must be 3-20 characters" });
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
      }
      
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ error: "Username already taken" });
      }
      
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({ username, password: hashedPassword });

      await establishAuthenticatedSession(req, user);
      res.status(201).json({ id: user.id, username: user.username });
    } catch (error) {
      console.error("Signup failed:", error);
      res.status(500).json({ error: "Signup failed" });
    }
  });
  
  // Log in
  app.post("/api/auth/login", authRateLimit, async (req, res) => {
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

      await establishAuthenticatedSession(req, user);
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
      res.clearCookie("connect.sid");
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
  app.post("/api/lobbies", requireAuth, lobbyCreateRateLimit, async (req, res) => {
    try {
      const { name, maxPlayers = 8, mapSize = "normal" } = req.body;
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
  app.post("/api/lobbies/:code/seats/:seatIndex/claim", requireAuth, lobbySeatWriteRateLimit, async (req, res) => {
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
  app.post("/api/lobbies/:code/seats/:seatIndex/release", requireAuth, lobbySeatWriteRateLimit, async (req, res) => {
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

      const released = await storage.updateSeatWithGuards(seat.id, { userId: null, playerName: null, factionId: null, isReady: false }, {
        lobbyId: lobby.id, expectedUserId: req.session.userId!, expectedIsAI: false,
      });
      if (!released) {
        return res.status(409).json({ error: "Seat changed while releasing. Refresh and try again." });
      }
      
      const updatedSeats = await storage.getSeatsByLobbyId(lobby.id);
      res.json({ ...lobby, seats: updatedSeats });
    } catch (error) {
      console.error("Failed to release seat:", error);
      res.status(500).json({ error: "Failed to release seat" });
    }
  });

  // Update seat (faction, ready status, player name)
  app.patch("/api/lobbies/:code/seats/:seatIndex", requireAuth, lobbySeatWriteRateLimit, async (req, res) => {
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
      const isSeatOwner = seat.userId === req.session.userId;
      const isHostManagingAI = lobby.hostUserId === req.session.userId && seat.isAI;
      if (!isSeatOwner && !isHostManagingAI) {
        return res.status(403).json({ error: "Not allowed to update this seat" });
      }

      const body = req.body ?? {};
      const updates: {
        factionId?: string | null;
        isReady?: boolean;
        playerName?: string | null;
      } = {};

      if (Object.prototype.hasOwnProperty.call(body, "factionId")) {
        if (body.factionId != null && typeof body.factionId !== "string") {
          return res.status(400).json({ error: "Invalid faction" });
        }
        const factionId = typeof body.factionId === "string" ? body.factionId.trim() : "";
        updates.factionId = factionId || null;
      }

      if (Object.prototype.hasOwnProperty.call(body, "isReady")) {
        if (typeof body.isReady !== "boolean") {
          return res.status(400).json({ error: "Invalid ready state" });
        }
        updates.isReady = body.isReady;
      }

      if (Object.prototype.hasOwnProperty.call(body, "playerName")) {
        if (body.playerName != null && typeof body.playerName !== "string") {
          return res.status(400).json({ error: "Invalid player name" });
        }
        const playerName = typeof body.playerName === "string" ? body.playerName.trim() : "";
        updates.playerName = playerName || null;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid seat updates" });
      }

      const claimedFactionEntries = seats
        .filter((entry) => entry.userId !== null || entry.isAI)
        .map((entry) => ({ id: entry.id, factionId: entry.factionId }));
      let nextFactionId = seat.factionId;

      if (Object.prototype.hasOwnProperty.call(body, "factionId")) {
        if (body.factionId === null || body.factionId === "") {
          nextFactionId = null;
        } else {
          const canonicalFactionId = coerceFactionId(body.factionId);
          if (!canonicalFactionId) {
            return res.status(400).json({ error: "Invalid faction selection" });
          }
          nextFactionId = canonicalFactionId;
        }

        if (
          nextFactionId &&
          isFactionTakenByAnotherEntry(claimedFactionEntries, nextFactionId, seat.id)
        ) {
          return res.status(409).json({ error: "That faction is already claimed by another seat" });
        }

        updates.factionId = nextFactionId;
        if (!nextFactionId) {
          updates.isReady = false;
        }
      }

      if (Object.prototype.hasOwnProperty.call(body, "isReady")) {
        if (body.isReady && !nextFactionId) {
          return res.status(400).json({ error: "Select a faction before readying up" });
        }
        if (
          body.isReady &&
          isFactionTakenByAnotherEntry(claimedFactionEntries, nextFactionId, seat.id)
        ) {
          return res.status(409).json({ error: "That faction is already claimed by another seat" });
        }

        updates.isReady = body.isReady;
      }
      
      const uniqueFactionId = nextFactionId && (Object.prototype.hasOwnProperty.call(body, "factionId") || updates.isReady === true)
        ? nextFactionId : null;
      const updatedSeat = await storage.updateSeatWithGuards(seat.id, updates, {
        lobbyId: lobby.id, expectedUserId: isHostManagingAI ? null : req.session.userId!, expectedIsAI: isHostManagingAI, uniqueFactionId,
      });
      if (!updatedSeat) {
        return res.status(409).json({ error: "Seat changed or faction was claimed by another player. Refresh and try again." });
      }
      
      const updatedSeats = await storage.getSeatsByLobbyId(lobby.id);
      res.json({ ...lobby, seats: updatedSeats });
    } catch (error) {
      console.error("Failed to update seat:", error);
      res.status(500).json({ error: "Failed to update seat" });
    }
  });

  // Set a seat as AI
  app.post("/api/lobbies/:code/seats/:seatIndex/ai", requireAuth, lobbySeatWriteRateLimit, async (req, res) => {
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
      if (seat.userId !== null || seat.isAI) {
        return res.status(400).json({ error: "Seat claimed by player" });
      }
      
      const { factionId } = req.body;
      const canonicalFactionId = coerceFactionId(factionId);
      if (!canonicalFactionId) {
        return res.status(400).json({ error: "AI seat needs a valid faction" });
      }

      const claimedFactionEntries = seats
        .filter((entry) => entry.userId !== null || entry.isAI)
        .map((entry) => ({ id: entry.id, factionId: entry.factionId }));
      if (isFactionTakenByAnotherEntry(claimedFactionEntries, canonicalFactionId, seat.id)) {
        return res.status(409).json({ error: "That faction is already claimed by another seat" });
      }

      const updatedSeat = await storage.updateSeatWithGuards(seat.id, { userId: null, playerName: null, isAI: true, factionId: canonicalFactionId, isReady: true }, {
        lobbyId: lobby.id, expectedUserId: null, expectedIsAI: false, uniqueFactionId: canonicalFactionId,
      });
      if (!updatedSeat) {
        return res.status(409).json({ error: "Seat changed or faction was claimed by another player. Refresh and try again." });
      }
      
      const updatedSeats = await storage.getSeatsByLobbyId(lobby.id);
      res.json({ ...lobby, seats: updatedSeats });
    } catch (error) {
      console.error("Failed to set AI:", error);
      res.status(500).json({ error: "Failed to set AI" });
    }
  });

  // Remove AI from seat
  app.delete("/api/lobbies/:code/seats/:seatIndex/ai", requireAuth, lobbySeatWriteRateLimit, async (req, res) => {
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
      
      const updatedSeat = await storage.updateSeatWithGuards(seat.id, { userId: null, playerName: null, isAI: false, factionId: null, isReady: false }, {
        lobbyId: lobby.id, expectedUserId: null, expectedIsAI: true,
      });
      if (!updatedSeat) {
        return res.status(409).json({ error: "Seat changed while removing AI. Refresh and try again." });
      }
      
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
        if (!coerceFactionId(seat.factionId)) {
          return res.status(400).json({ error: "All players must select a valid faction" });
        }
      }

      const claimedFactionEntries = claimedSeats.map((seat) => ({ id: seat.id, factionId: seat.factionId }));
      if (getDuplicateFactionIds(claimedFactionEntries).size > 0) {
        return res.status(400).json({ error: "Each player must select a unique faction" });
      }

      const existingLobbyState = (lobby.gameState as any) || {};
      const existingChatState = normalizeLobbyChatState(existingLobbyState.chat);
      const hostLastSeen = Date.now();
      
      // Build player data from seats
      const players = claimedSeats.map((seat, index) => ({
        playerId: `player-${index + 1}`,
        seatIndex: seat.seatIndex,
        userId: seat.userId,
        name: seat.playerName || `Player ${seat.seatIndex + 1}`,
        factionId: coerceFactionId(seat.factionId)!,
        isAI: seat.isAI,
        turnOrder: index,
        lastSeenAt: hostLastSeen,
      }));

      const seed = Math.floor(Math.random() * 2 ** 32);
      const { gameState: initialSnapshot } = createInitialGameState({
        playerSetup: players.map((player) => ({
          id: player.playerId,
          name: player.name,
          factionId: player.factionId,
          turnOrder: player.turnOrder,
          isAI: player.isAI,
          aiDifficulty: "normal",
        })),
        mapSize: lobby.mapSize,
        seed,
        gameId: `online-${lobby.code}-${seed}`,
      });
      const expectedActorId = getExpectedActorIdFromSnapshot(initialSnapshot) ?? players[0]?.playerId ?? null;

      // Update lobby status to playing with a server-created canonical initial snapshot.
      const updated = await storage.updateLobbyIfUnchanged(lobby.id, lobby, {
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
          failedActions: [],
          snapshotVersion: 0,
          snapshot: initialSnapshot,
          expectedActorId,
          turnResolutionPending: false,
          chat: existingChatState,
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

  // Fetch chat message history (lobby waiting + online match)
  app.get("/api/lobbies/:code/chat/messages", requireAuth, async (req, res) => {
    try {
      const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
      if (!lobby) {
        return res.status(404).json({ error: "Lobby not found" });
      }
      if (!isChatEnabledLobbyStatus(lobby.status)) {
        return res.status(409).json({ error: "Chat unavailable for this lobby state" });
      }

      const seats = await storage.getSeatsByLobbyId(lobby.id);
      const userId = req.session.userId!;
      if (!isLobbyParticipant(lobby.hostUserId, seats, userId)) {
        return res.status(403).json({ error: "Not a participant" });
      }

      const sinceRaw = Number(req.query.since ?? 0);
      const sinceVersion = Number.isFinite(sinceRaw) ? Math.max(0, Math.floor(sinceRaw)) : 0;
      const lobbyState = (lobby.gameState as any) || {};
      const chatState = normalizeLobbyChatState(lobbyState.chat);
      const messages = sinceVersion > 0
        ? chatState.messages.filter((entry) => entry.version > sinceVersion)
        : chatState.messages;

      const payload: ChatMessagesResponse = {
        messageVersion: chatState.messageVersion,
        eventVersion: chatState.eventVersion,
        messages,
      };
      return res.json(payload);
    } catch (error) {
      console.error("Failed to fetch chat messages:", error);
      return res.status(500).json({ error: "Failed to fetch chat messages" });
    }
  });

  // Fetch chat realtime events
  app.get("/api/lobbies/:code/chat/events", requireAuth, async (req, res) => {
    try {
      const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
      if (!lobby) {
        return res.status(404).json({ error: "Lobby not found" });
      }
      if (!isChatEnabledLobbyStatus(lobby.status)) {
        return res.status(409).json({ error: "Chat unavailable for this lobby state" });
      }

      const seats = await storage.getSeatsByLobbyId(lobby.id);
      const userId = req.session.userId!;
      if (!isLobbyParticipant(lobby.hostUserId, seats, userId)) {
        return res.status(403).json({ error: "Not a participant" });
      }

      const sinceRaw = Number(req.query.since ?? 0);
      const sinceVersion = Number.isFinite(sinceRaw) ? Math.max(0, Math.floor(sinceRaw)) : 0;
      const lobbyState = (lobby.gameState as any) || {};
      const chatState = pruneTyping(normalizeLobbyChatState(lobbyState.chat), Date.now());
      const oldestEventVersion = chatState.events[0]?.version ?? chatState.eventVersion;
      const eventsTruncated =
        sinceVersion > 0 &&
        chatState.events.length > 0 &&
        sinceVersion < oldestEventVersion - 1;
      const events = eventsTruncated
        ? []
        : (sinceVersion > 0
          ? chatState.events.filter((entry) => entry.version > sinceVersion)
          : chatState.events);

      const payload: ChatEventsResponse = {
        eventVersion: chatState.eventVersion,
        events,
        eventsTruncated,
      };
      return res.json(payload);
    } catch (error) {
      console.error("Failed to fetch chat events:", error);
      return res.status(500).json({ error: "Failed to fetch chat events" });
    }
  });

  // Shared realtime stream for chat + multiplayer invalidation events
  app.get("/api/lobbies/:code/realtime", requireAuth, async (req, res) => {
    try {
      const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
      if (!lobby) {
        return res.status(404).json({ error: "Lobby not found" });
      }

      const seats = await storage.getSeatsByLobbyId(lobby.id);
      const userId = req.session.userId!;
      if (!isLobbyParticipant(lobby.hostUserId, seats, userId)) {
        return res.status(403).json({ error: "Not a participant" });
      }

      setPrivateNoStoreHeaders(res);
      openLobbyRealtimeStream(lobby.code, res);
    } catch (error) {
      console.error("Failed to open realtime stream:", error);
      return res.status(500).json({ error: "Failed to open realtime stream" });
    }
  });

  // Request a presigned R2 upload URL for a voice note
  app.post("/api/lobbies/:code/chat/voice-upload", requireAuth, chatVoiceUploadRateLimit, async (req, res) => {
    if (!R2_CONFIGURED) {
      return res.status(503).json({ error: "Voice storage not configured" });
    }
    try {
      const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
      if (!lobby) return res.status(404).json({ error: "Lobby not found" });
      if (!isChatEnabledLobbyStatus(lobby.status)) {
        return res.status(409).json({ error: "Chat unavailable for this lobby state" });
      }
      const seats = await storage.getSeatsByLobbyId(lobby.id);
      const userId = req.session.userId!;
      if (!isLobbyParticipant(lobby.hostUserId, seats, userId)) {
        return res.status(403).json({ error: "Not a participant" });
      }

      const { messageId, mimeType, contentLength, durationMs } = req.body;
      if (!messageId || typeof messageId !== "string") {
        return res.status(400).json({ error: "messageId required (max 128 chars)" });
      }
      const normalizedMessageId = messageId.trim();
      if (!normalizedMessageId || normalizedMessageId.length > 128) {
        return res.status(400).json({ error: "messageId required (max 128 chars)" });
      }
      if (!/^[a-zA-Z0-9\-_]+$/.test(normalizedMessageId)) {
        return res.status(400).json({ error: "messageId must use only letters, numbers, '-' and '_'" });
      }
      const lobbyState = (lobby.gameState as any) || {};
      const chatState = normalizeLobbyChatState(lobbyState.chat);
      if (chatState.messages.some((entry) => entry.id === normalizedMessageId)) {
        return res.status(409).json({ error: "messageId already exists" });
      }
      if (!mimeType || typeof mimeType !== "string") {
        return res.status(400).json({ error: "mimeType required" });
      }
      if (!isAllowedVoiceMimeType(mimeType)) {
        return res.status(415).json({ error: `Unsupported audio type` });
      }
      const parsedLength = Number(contentLength);
      if (!Number.isFinite(parsedLength) || parsedLength <= 0) {
        return res.status(400).json({ error: "contentLength must be a positive number" });
      }
      if (parsedLength > VOICE_LIMITS.maxBytes) {
        return res.status(413).json({
          error: `Voice note too large (max ${Math.round(VOICE_LIMITS.maxBytes / 1024 / 1024)} MB)`,
          maxBytes: VOICE_LIMITS.maxBytes,
        });
      }
      const parsedDuration = Number(durationMs);
      if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
        return res.status(400).json({
          error: "durationMs must be a positive number",
          maxDurationMs: VOICE_LIMITS.maxDurationMs,
        });
      }
      if (parsedDuration > VOICE_LIMITS.maxDurationMs) {
        return res.status(400).json({
          error: `Voice note too long (max ${VOICE_LIMITS.maxDurationMs / 1000}s)`,
          maxDurationMs: VOICE_LIMITS.maxDurationMs,
        });
      }

      const result = await createVoiceUploadUrl({
        lobbyCode: lobby.code,
        messageId: normalizedMessageId,
        mimeType,
        contentLength: parsedLength,
      });

      return res.json(result);
    } catch (err: any) {
      if (err?.status === 413) return res.status(413).json({ error: err.message, maxBytes: VOICE_LIMITS.maxBytes });
      if (err?.status === 415) return res.status(415).json({ error: err.message });
      if (err?.status === 400) return res.status(400).json({ error: err.message });
      if (err?.status === 503) return res.status(503).json({ error: err.message });
      console.error("Failed to create voice upload URL:", err);
      return res.status(500).json({ error: "Failed to create voice upload URL" });
    }
  });

  // Send text/voice chat message
  app.post("/api/lobbies/:code/chat/messages", requireAuth, chatWriteRateLimit, async (req, res) => {
    try {
      const validated = validateIncomingChatMessage(req.body);
      if (!validated.valid) {
        return res.status(400).json({ error: validated.error });
      }
      if (validated.message.type === "voice") {
        if (!R2_CONFIGURED) {
          return res.status(503).json({ error: "Voice storage not configured" });
        }
        if (!isVoiceStorageUrl(validated.message.audioUrl ?? "")) {
          return res.status(400).json({ error: "Invalid voice storage URL" });
        }
      }

      for (let attempt = 0; attempt < MAX_MULTIPLAYER_UPDATE_RETRIES; attempt += 1) {
        const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
        if (!lobby) {
          return res.status(404).json({ error: "Lobby not found" });
        }
        if (validated.message.type === "voice" && !isVoiceStorageUrlForLobby(validated.message.audioUrl ?? "", lobby.code)) {
          return res.status(400).json({ error: "Invalid voice storage URL for lobby" });
        }
        if (!isChatEnabledLobbyStatus(lobby.status)) {
          return res.status(409).json({ error: "Chat unavailable for this lobby state" });
        }

        const seats = await storage.getSeatsByLobbyId(lobby.id);
        const userId = req.session.userId!;
        if (!isLobbyParticipant(lobby.hostUserId, seats, userId)) {
          return res.status(403).json({ error: "Not a participant" });
        }

        const lobbyState = (lobby.gameState as any) || {};
        const chatState = pruneTyping(normalizeLobbyChatState(lobbyState.chat), Date.now());
        const existing = chatState.messages.find((entry) => entry.id === validated.message.id);
        if (existing) {
          return res.json({
            duplicate: true,
            messageVersion: chatState.messageVersion,
            eventVersion: chatState.eventVersion,
            message: existing,
          });
        }

        const senderName = resolveChatSenderName({
          username: req.session.username,
          seats,
          userId,
        });
        const senderFactionId = resolveChatSenderFactionId({
          lobbyState,
          seats,
          userId,
        });
        const payload: ChatMessageEventPayload = {
          id: validated.message.id,
          lobbyCode: lobby.code,
          senderUserId: userId,
          senderName,
          senderFactionId,
          type: validated.message.type,
          text: validated.message.text,
          audioUrl: validated.message.audioUrl,
          audioDurationMs: validated.message.audioDurationMs,
          waveformPeaks: validated.message.waveformPeaks,
          createdAt: validated.message.createdAt,
        };
        const nextChat = appendMessage(chatState, payload);

        const updated = await storage.updateLobbyIfUnchanged(lobby.id, lobby, {
          gameState: {
            ...lobbyState,
            chat: nextChat,
          } as any,
        });
        if (updated) {
          const latestEvent = nextChat.events[nextChat.events.length - 1];
          if (latestEvent) {
            publishChatRealtimeEvent(lobby.code, {
              type: "chat-event",
              lobbyCode: lobby.code,
              event: latestEvent,
            });
          }
          return res.json({
            duplicate: false,
            messageVersion: nextChat.messageVersion,
            eventVersion: nextChat.eventVersion,
            message: {
              ...payload,
              version: nextChat.messageVersion,
            },
          });
        }
      }

      return res.status(409).json({ error: "Concurrent lobby update. Retry chat send." });
    } catch (error) {
      console.error("Failed to send chat message:", error);
      return res.status(500).json({ error: "Failed to send chat message" });
    }
  });

  // Broadcast typing start/stop
  app.post("/api/lobbies/:code/chat/typing", requireAuth, chatTypingRateLimit, async (req, res) => {
    try {
      const isTyping = req.body?.isTyping;
      if (typeof isTyping !== "boolean") {
        return res.status(400).json({ error: "isTyping boolean required" });
      }

      for (let attempt = 0; attempt < MAX_MULTIPLAYER_UPDATE_RETRIES; attempt += 1) {
        const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
        if (!lobby) {
          return res.status(404).json({ error: "Lobby not found" });
        }
        if (!isChatEnabledLobbyStatus(lobby.status)) {
          return res.status(409).json({ error: "Chat unavailable for this lobby state" });
        }

        const seats = await storage.getSeatsByLobbyId(lobby.id);
        const userId = req.session.userId!;
        if (!isLobbyParticipant(lobby.hostUserId, seats, userId)) {
          return res.status(403).json({ error: "Not a participant" });
        }

        const lobbyState = (lobby.gameState as any) || {};
        const chatState = pruneTyping(normalizeLobbyChatState(lobbyState.chat), Date.now());
        const key = String(userId);
        const existingTyping = chatState.typingByUserId[key];

        if (!isTyping && !existingTyping) {
          return res.json({ ok: true, eventVersion: chatState.eventVersion });
        }
        if (isTyping && existingTyping && Date.now() - existingTyping.startedAt < 1200) {
          return res.json({ ok: true, eventVersion: chatState.eventVersion });
        }

        const payload: ChatTypingEventPayload = {
          lobbyCode: lobby.code,
          userId,
          userName: resolveChatSenderName({
            username: req.session.username,
            seats,
            userId,
          }),
          startedAt: Date.now(),
        };

        const nextChat = appendTypingEvent(chatState, payload, isTyping);
        const updated = await storage.updateLobbyIfUnchanged(lobby.id, lobby, {
          gameState: {
            ...lobbyState,
            chat: nextChat,
          } as any,
        });
        if (updated) {
          const latestEvent = nextChat.events[nextChat.events.length - 1];
          if (latestEvent) {
            publishChatRealtimeEvent(lobby.code, {
              type: "chat-event",
              lobbyCode: lobby.code,
              event: latestEvent,
            });
          }
          return res.json({ ok: true, eventVersion: nextChat.eventVersion });
        }
      }

      return res.status(409).json({ error: "Concurrent lobby update. Retry typing event." });
    } catch (error) {
      console.error("Failed to publish typing event:", error);
      return res.status(500).json({ error: "Failed to publish typing event" });
    }
  });

  // Broadcast read receipt updates
  app.post("/api/lobbies/:code/chat/read", requireAuth, chatWriteRateLimit, async (req, res) => {
    try {
      const bodyReadAt = Number(req.body?.readAt);
      const readAt = Number.isFinite(bodyReadAt) ? Math.max(0, Math.floor(bodyReadAt)) : Date.now();

      for (let attempt = 0; attempt < MAX_MULTIPLAYER_UPDATE_RETRIES; attempt += 1) {
        const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
        if (!lobby) {
          return res.status(404).json({ error: "Lobby not found" });
        }
        if (!isChatEnabledLobbyStatus(lobby.status)) {
          return res.status(409).json({ error: "Chat unavailable for this lobby state" });
        }

        const seats = await storage.getSeatsByLobbyId(lobby.id);
        const userId = req.session.userId!;
        if (!isLobbyParticipant(lobby.hostUserId, seats, userId)) {
          return res.status(403).json({ error: "Not a participant" });
        }

        const lobbyState = (lobby.gameState as any) || {};
        const chatState = pruneTyping(normalizeLobbyChatState(lobbyState.chat), Date.now());
        const previousRead = Number(chatState.readByUserId[String(userId)] ?? 0);
        if (readAt <= previousRead) {
          return res.json({ ok: true, eventVersion: chatState.eventVersion, readAt: previousRead });
        }

        const payload: ChatReadUpdateEventPayload = {
          lobbyCode: lobby.code,
          userId,
          readAt,
        };
        const nextChat = appendReadEvent(chatState, payload);
        const updated = await storage.updateLobbyIfUnchanged(lobby.id, lobby, {
          gameState: {
            ...lobbyState,
            chat: nextChat,
          } as any,
        });
        if (updated) {
          const latestEvent = nextChat.events[nextChat.events.length - 1];
          if (latestEvent) {
            publishChatRealtimeEvent(lobby.code, {
              type: "chat-event",
              lobbyCode: lobby.code,
              event: latestEvent,
            });
          }
          return res.json({ ok: true, eventVersion: nextChat.eventVersion, readAt });
        }
      }

      return res.status(409).json({ error: "Concurrent lobby update. Retry read update." });
    } catch (error) {
      console.error("Failed to publish read update:", error);
      return res.status(500).json({ error: "Failed to publish read update" });
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
  app.post("/api/lobbies/:code/host/heartbeat", requireAuth, hostHeartbeatRateLimit, async (req, res) => {
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
        const updated = await storage.updateLobbyIfUnchanged(lobby.id, lobby, {
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
  app.post("/api/lobbies/:code/host/claim", requireAuth, hostClaimRateLimit, async (req, res) => {
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
          const updated = await storage.updateLobbyIfUnchanged(lobby.id, lobby, {
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

        const suggestedHostUserId = selectNextHost(lobbyState, lobby.hostUserId);
        if (suggestedHostUserId !== null && suggestedHostUserId !== userId) {
          return res.status(409).json({
            error: "Another participant has priority to claim host",
            suggestedHostUserId,
          });
        }

        const nextEpoch = hostEpoch + 1;
        const updated = await storage.updateLobbyIfUnchanged(lobby.id, lobby, {
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
          logMultiplayerTelemetry("hostTransfer", {
            lobbyCode: lobby.code,
            fromHostUserId: lobby.hostUserId,
            toHostUserId: userId,
            hostEpoch: nextEpoch,
          });
          publishMultiplayerSyncEvent(lobby.code, "host-claimed");
          return res.json({ hostUserId: userId, hostEpoch: nextEpoch, hostLastSeen });
        }
      }

      return res.status(409).json({ error: "Concurrent lobby update. Retry host claim." });
    } catch (error) {
      console.error("Failed to claim host:", error);
      res.status(500).json({ error: "Failed to claim host" });
    }
  });

  // Player heartbeat to support timeout-based turn recovery
  app.post("/api/lobbies/:code/players/heartbeat", requireAuth, playerHeartbeatRateLimit, async (req, res) => {
    try {
      const { playerId } = req.body || {};
      if (typeof playerId !== "string" || !playerId) {
        return res.status(400).json({ error: "playerId required" });
      }

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
        const playersMeta = Array.isArray(lobbyState.players) ? [...lobbyState.players] : [];
        const index = playersMeta.findIndex((entry: any) => entry?.playerId === playerId);
        if (index === -1) {
          return res.status(404).json({ error: "Unknown player" });
        }

        const playerMeta = playersMeta[index] as MultiplayerPlayerMeta;
        if (playerMeta.userId !== userId || playerMeta.isAI) {
          return res.status(403).json({ error: "Not your player" });
        }

        const lastSeenAt = Date.now();
        playersMeta[index] = {
          ...playerMeta,
          lastSeenAt,
        };

        const updated = await storage.updateLobbyIfUnchanged(lobby.id, lobby, {
          gameState: {
            ...lobbyState,
            players: playersMeta,
          } as any,
        });
        if (updated) {
          return res.json({ ok: true, lastSeenAt });
        }
      }

      return res.status(409).json({ error: "Concurrent lobby update. Retry player heartbeat." });
    } catch (error) {
      console.error("Failed to heartbeat player:", error);
      res.status(500).json({ error: "Failed to heartbeat player" });
    }
  });

  // Host can recover stalled turns after remote player heartbeat timeout
  app.get("/api/lobbies/:code/turn-recovery", requireAuth, async (req, res) => {
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
      const expectedActorId = getExpectedActorId(lobbyState);
      const playersMeta = (Array.isArray(lobbyState.players) ? lobbyState.players : []) as MultiplayerPlayerMeta[];
      const now = Date.now();
      const turnRecovery = getTurnRecoveryStatus({
        playersMeta,
        expectedActorId,
        requesterUserId: userId,
        hostUserId: lobby.hostUserId,
        now,
        timeoutMs: MULTIPLAYER_TURN_TIMEOUT_MS,
        recoveryEnabled: MULTIPLAYER_TURN_RECOVERY_ENABLED,
      });

      return res.json(turnRecovery);
    } catch (error) {
      console.error("Failed to get turn recovery status:", error);
      res.status(500).json({ error: "Failed to get turn recovery status" });
    }
  });

  registerMultiplayerActionRoutes(app, {
    requireAuth,
    queueRateLimit,
    commitRateLimit,
  });

  // === GAME SAVES ROUTES ===
  const isSaveApiDisabled = process.env.DISABLE_SAVE_API === "true";
  const respondSaveApiDisabled = (res: Response) => {
    setPrivateNoStoreHeaders(res);
    return res.status(503).json({ error: "Save API unavailable" });
  };
  
  app.get("/api/saves", async (req, res) => {
    if (isSaveApiDisabled) {
      return respondSaveApiDisabled(res);
    }
    try {
      setPrivateNoStoreHeaders(res);
      const ownerId = await getSaveOwnerId(req);
      const saves = await storage.getGameSavesByOwnerId(ownerId);
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
      setPrivateNoStoreHeaders(res);
      const ownerId = await getSaveOwnerId(req);
      const id = parseIntParam(req.params.id);
      if (id === null) {
        return res.status(400).json({ error: "Invalid ID" });
      }
      const save = await storage.getGameSaveById(id);
      if (!save) {
        return res.status(404).json({ error: "Save not found" });
      }
      if (save.deviceId !== ownerId) {
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
      setPrivateNoStoreHeaders(res);
      const ownerId = await getSaveOwnerId(req);
      const parsed = SaveWriteRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid save payload" });
      }

      const { name, gameState, metadata } = parsed.data;
      const save = await storage.createGameSave({
        deviceId: ownerId,
        name,
        gameState,
        metadata,
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
      setPrivateNoStoreHeaders(res);
      const ownerId = await getSaveOwnerId(req);
      const id = parseIntParam(req.params.id);
      if (id === null) {
        return res.status(400).json({ error: "Invalid ID" });
      }
      const existingSave = await storage.getGameSaveById(id);
      if (!existingSave) {
        return res.status(404).json({ error: "Save not found" });
      }
      if (existingSave.deviceId !== ownerId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const parsed = SaveWriteRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid save payload" });
      }
      const { name, gameState, metadata } = parsed.data;
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
      setPrivateNoStoreHeaders(res);
      const ownerId = await getSaveOwnerId(req);
      const id = parseIntParam(req.params.id);
      if (id === null) {
        return res.status(400).json({ error: "Invalid ID" });
      }
      const existingSave = await storage.getGameSaveById(id);
      if (!existingSave) {
        return res.status(404).json({ error: "Save not found" });
      }
      if (existingSave.deviceId !== ownerId) {
        return res.status(403).json({ error: "Access denied" });
      }
      await storage.deleteGameSave(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete save:", error);
      res.status(500).json({ error: "Failed to delete save" });
    }
  });

  // === BUG REPORT ROUTES ===
  const readBugReportViewToken = (req: Request): string => {
    const fromQuery = typeof req.query.token === "string" ? req.query.token : "";
    if (fromQuery.trim()) return fromQuery.trim();
    const fromHeader = req.headers["x-bug-report-view-token"];
    return typeof fromHeader === "string" ? fromHeader.trim() : "";
  };

  app.get("/api/bug-reports/:reportId", bugReportReadRateLimit, async (req, res) => {
    const expectedToken = process.env.BUG_REPORT_VIEW_TOKEN?.trim();
    if (!expectedToken) {
      return res.status(404).json({ error: "Bug report viewer is not configured" });
    }

    if (readBugReportViewToken(req) !== expectedToken) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const numericReportId = parseBugReportId(String(req.params.reportId ?? ""));
    if (!numericReportId) {
      return res.status(400).json({ error: "Invalid bug report id" });
    }

    try {
      const report = await storage.getBugReportById(numericReportId);
      if (!report) {
        return res.status(404).json({ error: "Bug report not found" });
      }

      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("X-Robots-Tag", "noindex, nofollow");

      return res.json(buildBugReportDetailPayload({
        report,
        reportId: formatBugReportId(report.id),
        publicBaseUrl: process.env.BUG_REPORT_PUBLIC_URL,
        viewToken: process.env.BUG_REPORT_VIEW_TOKEN,
        dbUrlTemplate: process.env.BUG_REPORT_DB_URL_TEMPLATE,
      }));
    } catch (error) {
      console.error("Failed to fetch bug report:", error);
      return res.status(500).json({ error: "Failed to load bug report" });
    }
  });

  app.post("/api/bug-reports/screenshot-upload", bugReportUploadRateLimit, async (req, res) => {
    if (!R2_CONFIGURED) {
      return res.status(503).json({ error: "Screenshot storage not configured" });
    }

    const parsed = BugReportScreenshotUploadRequestSchema.safeParse({
      submissionId: req.body?.submissionId,
      mimeType: req.body?.mimeType,
      contentLength: Number(req.body?.contentLength),
    });
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid screenshot upload payload" });
    }

    try {
      const upload = await createBugReportUploadUrl(parsed.data);
      return res.json(upload);
    } catch (error: any) {
      if (error?.status) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error("Failed to create bug report upload URL:", error);
      return res.status(500).json({ error: "Failed to create screenshot upload URL" });
    }
  });

  app.post("/api/bug-reports/screenshot-cleanup", bugReportUploadRateLimit, async (req, res) => {
    if (!R2_CONFIGURED) {
      return res.status(503).json({ error: "Screenshot storage not configured" });
    }

    const parsed = BugReportScreenshotCleanupRequestSchema.safeParse({
      submissionId: req.body?.submissionId,
      screenshotUrl: req.body?.screenshotUrl,
    });
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid screenshot cleanup payload" });
    }

    if (!isBugReportStorageUrlForSubmission(parsed.data.screenshotUrl, parsed.data.submissionId)) {
      return res.status(400).json({ error: "Screenshot URL does not match the uploaded report asset" });
    }

    try {
      await deleteBugReportObject(parsed.data.screenshotUrl);
      return res.status(204).end();
    } catch (error) {
      console.error("Failed to clean up bug report screenshot:", error);
      return res.status(500).json({ error: "Failed to clean up screenshot upload" });
    }
  });

  app.post("/api/bug-reports", bugReportRateLimit, async (req, res) => {
    const parsed = SubmitBugReportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid bug report payload" });
    }

    try {
      const payload = parsed.data;
      const existing = await storage.getBugReportBySubmissionId(payload.submissionId);
      if (existing) {
        return res.json({
          reportId: formatBugReportId(existing.id),
          duplicateCount24h: existing.duplicateCount24h,
          fingerprint: existing.fingerprint,
          receivedAt: existing.createdAt.toISOString(),
        });
      }

      if (payload.screenshotUrl) {
        if (!payload.includeScreenshot) {
          return res.status(400).json({ error: "Screenshot URL provided while screenshot attachment is disabled" });
        }
        if (!R2_CONFIGURED) {
          return res.status(400).json({ error: "Screenshot uploads are not configured on this server" });
        }
        if (!isBugReportStorageUrlForSubmission(payload.screenshotUrl, payload.submissionId)) {
          return res.status(400).json({ error: "Screenshot URL does not match the uploaded report asset" });
        }
      }

      const deviceIdHeader = req.headers["x-device-id"];
      const deviceId = typeof deviceIdHeader === "string" && deviceIdHeader.trim()
        ? deviceIdHeader.trim().slice(0, 128)
        : null;
      const diagnostics = payload.includeDiagnostics
        ? sanitizeBugReportDiagnostics(payload.diagnostics)
        : undefined;
      const fingerprint = buildBugReportFingerprint(payload, diagnostics);
      const duplicateCount24h = await storage.countBugReportsByFingerprintSince(
        fingerprint,
        new Date(Date.now() - 24 * 60 * 60 * 1000),
      ) + 1;

      const created = await storage.createBugReport({
        submissionId: payload.submissionId,
        userId: req.session.userId ?? null,
        deviceId,
        source: payload.source,
        category: payload.category,
        status: "open",
        playerMessage: payload.playerMessage,
        expectedBehavior: payload.expectedBehavior ?? null,
        reproFrequency: payload.reproFrequency,
        contact: payload.contact ?? null,
        includeDiagnostics: payload.includeDiagnostics,
        includeScreenshot: payload.includeScreenshot,
        screenshotUrl: payload.screenshotUrl ?? null,
        fingerprint,
        duplicateCount24h,
        diagnostics: diagnostics ?? null,
      });
      const reportId = formatBugReportId(created.id);

      void sendBugReportWebhook({
        webhookUrl: process.env.BUG_REPORT_WEBHOOK_URL,
        report: created,
        reportId,
        publicBaseUrl: process.env.BUG_REPORT_PUBLIC_URL,
        viewToken: process.env.BUG_REPORT_VIEW_TOKEN,
        dbUrlTemplate: process.env.BUG_REPORT_DB_URL_TEMPLATE,
      });

      return res.status(201).json({
        reportId,
        duplicateCount24h,
        fingerprint,
        receivedAt: created.createdAt.toISOString(),
      });
    } catch (error) {
      console.error("Failed to create bug report:", error);
      return res.status(500).json({ error: "Failed to create bug report" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
