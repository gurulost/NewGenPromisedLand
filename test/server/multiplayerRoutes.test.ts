import express from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInitialGameState } from "../../shared/logic/initialGameState";
import {
  COVENANT_MULTIPLAYER_PROTOCOL_VERSION,
  COVENANT_MULTIPLAYER_RULES_VERSION,
  buildMultiplayerVersionHeaders,
} from "../../shared/multiplayerVersion";
import type { GameLobby, PlayerSeat } from "../../shared/schema";
import type { GameState } from "../../shared/types/game";

type TestLobbyGameState = {
  players?: ReturnType<typeof createPlayersMeta>;
  mapSize?: string;
  seed?: number;
  hostEpoch?: number;
  hostLastSeen?: number;
  actionVersion?: number;
  actions?: unknown[];
  actionLogBaseVersion?: number;
  pendingVersion?: number;
  pendingActions?: unknown[];
  failedActions?: unknown[];
  snapshotVersion?: number;
  snapshot?: GameState;
  expectedActorId?: string;
  turnResolutionPending?: boolean;
  chat?: unknown;
  multiplayerProtocolVersion?: number;
  multiplayerRulesVersion?: string;
  multiplayerMode?: string;
  multiplayerBuildId?: string;
  hostTransferRequiresSnapshot?: number;
  [key: string]: unknown;
};
type TestLobby = Omit<GameLobby, "gameState"> & { gameState: TestLobbyGameState };
type TestLobbyPatch = Partial<Omit<TestLobby, "gameState">> & { gameState?: TestLobbyGameState };
type JsonResponse<TBody> = { status: number; body: TBody };
type QueueResponseBody = { queueVersion?: number; stale?: boolean; error?: string };
type CommitResponseBody = { actionVersion?: number; error?: string };
type SnapshotResponseBody = { error?: string };
type ActionsResponseBody = { needsSnapshot?: boolean };
type StateResponseBody = { snapshotVersion?: number; state?: GameState };
type LobbyStartResponseBody = { gameState: TestLobbyGameState & { snapshot: GameState } };
type LobbyFetchResponseBody = TestLobby & { seats: PlayerSeat[] };

const routeMocks = vi.hoisted(() => {
  type UserRecord = { id: number; username: string; password: string };
  const state = {
    users: new Map<string, UserRecord>(),
    nextUserId: 1,
    lobby: null as TestLobby | null,
    seats: [] as PlayerSeat[],
  };

  const storage = {
    getUserByUsername: vi.fn(async (username: string) => state.users.get(username)),
    createUser: vi.fn(async (user: { username: string; password: string }) => {
      const record = { id: state.nextUserId, username: user.username, password: user.password };
      state.nextUserId += 1;
      state.users.set(record.username, record);
      return record;
    }),
    getLobbyByCode: vi.fn(async (code: string) =>
      state.lobby && state.lobby.code === code ? state.lobby : undefined,
    ),
    getSeatsByLobbyId: vi.fn(async () => state.seats),
    updateLobbyIfUnchanged: vi.fn(async (_id: number, _expected: unknown, patch: TestLobbyPatch) => {
      if (!state.lobby) return undefined;
      state.lobby = {
        ...state.lobby,
        ...patch,
        gameState: patch.gameState ?? state.lobby.gameState,
        updatedAt: new Date(),
      };
      return state.lobby;
    }),
    createLobby: vi.fn(),
    getUser: vi.fn(),
    getLobbyById: vi.fn(),
    getOpenLobbies: vi.fn(async () => []),
    updateLobby: vi.fn(),
    touchLobby: vi.fn(),
    deleteLobby: vi.fn(),
    createSeat: vi.fn(),
    getSeatById: vi.fn(),
    claimSeatIfAvailable: vi.fn(),
    updateSeat: vi.fn(),
    updateSeatWithGuards: vi.fn(),
    deleteSeat: vi.fn(),
    deleteSeatsByUserId: vi.fn(),
    createMultiplayerActionAudit: vi.fn(async (audit: Record<string, unknown>) => ({ id: 1, createdAt: new Date(), ...audit })),
    createMultiplayerSnapshotCheckpoint: vi.fn(async (checkpoint: Record<string, unknown>) => ({ id: 1, createdAt: new Date(), ...checkpoint })),
    getGameSavesByOwnerId: vi.fn(),
    getGameSaveById: vi.fn(),
    createGameSave: vi.fn(),
    updateGameSave: vi.fn(),
    deleteGameSave: vi.fn(),
    transferGameSaveOwnership: vi.fn(),
    getBugReportById: vi.fn(),
    getBugReportBySubmissionId: vi.fn(),
    createBugReport: vi.fn(),
    countBugReportsByFingerprintSince: vi.fn(),
  };

  return { state, storage };
});

vi.mock("../../server/db", () => ({
  pool: {},
  db: {},
}));

vi.mock("../../server/storage", () => ({
  storage: routeMocks.storage,
}));

const { registerRoutes } = await import("../../server/routes");

type TestServer = {
  baseUrl: string;
  server: Server;
};

let signUpRequestIndex = 1;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function startServer(): Promise<TestServer> {
  const app = express();
  app.set("trust proxy", true);
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: false }));
  const server = await registerRoutes(app);

  await new Promise<void>((resolve, reject) => {
    const handleListenError = (error: Error) => reject(error);
    server.once("error", handleListenError);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", handleListenError);
      resolve();
    });
  });
  const address = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${address.port}`, server };
}

async function stopServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function signUp(baseUrl: string, username: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": `203.0.113.${signUpRequestIndex}`,
    },
    body: JSON.stringify({ username, password: "password123" }),
  });
  signUpRequestIndex += 1;
  expect(response.status).toBe(201);
  const setCookie = response.headers.get("set-cookie");
  expect(setCookie).toBeTruthy();
  return setCookie!.split(";")[0];
}

async function jsonRequest<TBody = unknown>(
  baseUrl: string,
  path: string,
  {
    method = "GET",
    cookie,
    body,
    versionHeaders = true,
  }: {
    method?: string;
    cookie: string;
    body?: unknown;
    versionHeaders?: boolean;
  },
): Promise<JsonResponse<TBody>> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(versionHeaders ? buildMultiplayerVersionHeaders() : {}),
      Cookie: cookie,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: (text ? JSON.parse(text) : null) as TBody,
  };
}

function currentLobby(): TestLobby {
  const lobby = routeMocks.state.lobby;
  if (!lobby) throw new Error("Expected test lobby to be configured");
  return lobby;
}

function createSeats(): PlayerSeat[] {
  return [
    {
      id: 1,
      lobbyId: 10,
      seatIndex: 0,
      userId: 1,
      playerName: "Host",
      factionId: "NEPHITES",
      isReady: true,
      isAI: false,
      createdAt: new Date(),
    },
    {
      id: 2,
      lobbyId: 10,
      seatIndex: 1,
      userId: 2,
      playerName: "Guest",
      factionId: "LAMANITES",
      isReady: true,
      isAI: false,
      createdAt: new Date(),
    },
  ];
}

function createPlayersMeta() {
  return [
    {
      playerId: "player-1",
      seatIndex: 0,
      userId: 1,
      name: "Host",
      factionId: "NEPHITES",
      isAI: false,
      turnOrder: 0,
      lastSeenAt: 10_000,
    },
    {
      playerId: "player-2",
      seatIndex: 1,
      userId: 2,
      name: "Guest",
      factionId: "LAMANITES",
      isAI: false,
      turnOrder: 1,
      lastSeenAt: 10_000,
    },
  ];
}

function createSnapshot(currentPlayerIndex = 0): GameState {
  const { gameState } = createInitialGameState({
    playerSetup: [
      { id: "player-1", name: "Host", factionId: "NEPHITES", turnOrder: 0 },
      { id: "player-2", name: "Guest", factionId: "LAMANITES", turnOrder: 1 },
    ],
    mapSize: "tiny",
    seed: 12345,
    gameId: "online-ROOMA-12345",
  });
  return { ...gameState, currentPlayerIndex };
}

function configureWaitingLobby() {
  routeMocks.state.lobby = {
    id: 10,
    code: "ROOMA",
    name: "Test Room",
    hostUserId: 1,
    maxPlayers: 2,
    mapSize: "tiny",
    status: "waiting",
    gameState: { chat: undefined },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  routeMocks.state.seats = createSeats();
}

function configurePlayingLobby(overrides: Record<string, unknown> = {}) {
  const players = createPlayersMeta();
  routeMocks.state.lobby = {
    id: 10,
    code: "ROOMA",
    name: "Test Room",
    hostUserId: 1,
    maxPlayers: 2,
    mapSize: "tiny",
    status: "playing",
    gameState: {
      players,
      mapSize: "tiny",
      seed: 12345,
      hostEpoch: 1,
      hostLastSeen: 10_000,
      actionVersion: 0,
      actions: [],
      actionLogBaseVersion: 0,
      pendingVersion: 0,
      pendingActions: [],
      failedActions: [],
      snapshotVersion: 0,
      snapshot: createSnapshot(),
      expectedActorId: "player-1",
      turnResolutionPending: false,
      multiplayerProtocolVersion: COVENANT_MULTIPLAYER_PROTOCOL_VERSION,
      multiplayerRulesVersion: COVENANT_MULTIPLAYER_RULES_VERSION,
      multiplayerMode: "private-demo-host-mediated",
      chat: {},
      ...overrides,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  routeMocks.state.seats = createSeats();
}

function configurePublicAuthoritativeLobby(overrides: Record<string, unknown> = {}) {
  configurePlayingLobby({
    multiplayerAuthorityMode: "public_authoritative",
    ...overrides,
  });
}

describe("multiplayer lobby routes", () => {
  let testServer: TestServer;

  beforeEach(async () => {
    routeMocks.state.users.clear();
    routeMocks.state.nextUserId = 1;
    routeMocks.state.lobby = null;
    routeMocks.state.seats = [];
    vi.clearAllMocks();
    testServer = await startServer();
  });

  afterEach(async () => {
    if (testServer?.server) {
      await stopServer(testServer.server);
    }
  });

  it("returns an unavailable save API response when cloud saves are disabled", async () => {
    const previousDisableSaveApi = process.env.DISABLE_SAVE_API;
    await stopServer(testServer.server);
    process.env.DISABLE_SAVE_API = "true";
    testServer = await startServer();

    try {
      const cookie = await signUp(testServer.baseUrl, "saveuser");
      const response = await fetch(`${testServer.baseUrl}/api/saves`, {
        headers: { cookie },
      });

      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(await response.json()).toEqual({ error: "Save API unavailable" });
      expect(routeMocks.storage.getGameSavesByOwnerId).not.toHaveBeenCalled();

      const writeResponse = await fetch(`${testServer.baseUrl}/api/saves`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({}),
      });

      expect(writeResponse.status).toBe(503);
      expect(await writeResponse.json()).toEqual({ error: "Save API unavailable" });
      expect(routeMocks.storage.createGameSave).not.toHaveBeenCalled();
    } finally {
      if (previousDisableSaveApi === undefined) {
        delete process.env.DISABLE_SAVE_API;
      } else {
        process.env.DISABLE_SAVE_API = previousDisableSaveApi;
      }
    }
  });

  it("creates and persists a canonical initial snapshot when the host starts a lobby", async () => {
    const hostCookie = await signUp(testServer.baseUrl, "hostuser");
    configureWaitingLobby();

    const response = await jsonRequest<LobbyStartResponseBody>(testServer.baseUrl, "/api/lobbies/ROOMA/start", {
      method: "POST",
      cookie: hostCookie,
    });

    expect(response.status).toBe(200);
    expect(response.body.gameState.snapshotVersion).toBe(0);
    expect(response.body.gameState.actionVersion).toBe(0);
    expect(response.body.gameState.multiplayerProtocolVersion).toBe(COVENANT_MULTIPLAYER_PROTOCOL_VERSION);
    expect(response.body.gameState.multiplayerRulesVersion).toBe(COVENANT_MULTIPLAYER_RULES_VERSION);
    expect(response.body.gameState.multiplayerMode).toBe("private-demo-host-mediated");
    expect(response.body.gameState.snapshot).toBeTruthy();
    expect(response.body.gameState.snapshot.id).toMatch(/^online-ROOMA-/);
    expect(response.body.gameState.snapshot.map.tiles.length).toBeGreaterThan(0);
    expect(response.body.gameState.expectedActorId).toBe(response.body.gameState.snapshot.players[0].id);
    expect(currentLobby().gameState.snapshot?.id).toBe(response.body.gameState.snapshot.id);
    expect(currentLobby().gameState.snapshot?.rngSeed).toBe(response.body.gameState.snapshot.rngSeed);

    const stateResponse = await jsonRequest<StateResponseBody>(testServer.baseUrl, "/api/lobbies/ROOMA/state", {
      cookie: hostCookie,
    });
    expect(stateResponse.status).toBe(200);
    expect(stateResponse.body.snapshotVersion).toBe(0);
    expect(stateResponse.body.state?.id).toBe(response.body.gameState.snapshot.id);

    const mutatedInitialSnapshot = clone(response.body.gameState.snapshot);
    mutatedInitialSnapshot.players[0].stars += 100;
    const replaceResponse = await jsonRequest<SnapshotResponseBody>(testServer.baseUrl, "/api/lobbies/ROOMA/state", {
      method: "PUT",
      cookie: hostCookie,
      body: {
        state: mutatedInitialSnapshot,
        version: 0,
        hostEpoch: response.body.gameState.hostEpoch ?? 1,
      },
    });
    expect(replaceResponse.status).toBe(400);
    expect(currentLobby().gameState.snapshot?.players[0].stars).toBe(response.body.gameState.snapshot.players[0].stars);
  });

  it("rejects starting a multiplayer match from a client without the current protocol headers", async () => {
    const hostCookie = await signUp(testServer.baseUrl, "hostuser");
    configureWaitingLobby();

    const response = await jsonRequest(testServer.baseUrl, "/api/lobbies/ROOMA/start", {
      method: "POST",
      cookie: hostCookie,
      versionHeaders: false,
    });

    expect(response.status).toBe(409);
    expect((response.body as { error?: string }).error).toContain("protocol");
    expect(routeMocks.storage.updateLobbyIfUnchanged).not.toHaveBeenCalled();
  });

  it("rejects state access for lobbies started under an incompatible rules version", async () => {
    const hostCookie = await signUp(testServer.baseUrl, "hostuser");
    await signUp(testServer.baseUrl, "guestuser");
    configurePlayingLobby({
      multiplayerProtocolVersion: COVENANT_MULTIPLAYER_PROTOCOL_VERSION,
      multiplayerRulesVersion: "older-rules",
    });

    const response = await jsonRequest(testServer.baseUrl, "/api/lobbies/ROOMA/state", {
      cookie: hostCookie,
    });

    expect(response.status).toBe(409);
    expect((response.body as { error?: string }).error).toContain("incompatible multiplayer rules version");
  });

  it("stores guest queued actions with their base action version", async () => {
    await signUp(testServer.baseUrl, "hostuser");
    const guestCookie = await signUp(testServer.baseUrl, "guestuser");
    configurePlayingLobby({ expectedActorId: "player-2" });

    const response = await jsonRequest<QueueResponseBody>(testServer.baseUrl, "/api/lobbies/ROOMA/actions/queue", {
      method: "POST",
      cookie: guestCookie,
      body: {
        id: "guest-end-turn",
        actorId: "player-2",
        baseActionVersion: 0,
        action: { type: "END_TURN", payload: { playerId: "player-2" } },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.queueVersion).toBe(1);
    expect(currentLobby().gameState.pendingActions).toMatchObject([
      {
        queueVersion: 1,
        id: "guest-end-turn",
        actorId: "player-2",
        baseActionVersion: 0,
      },
    ]);
  });

  it("tombstones stale guest actions instead of leaving them in the pending queue", async () => {
    await signUp(testServer.baseUrl, "hostuser");
    const guestCookie = await signUp(testServer.baseUrl, "guestuser");
    configurePlayingLobby({ actionVersion: 2, expectedActorId: "player-2" });

    const response = await jsonRequest<QueueResponseBody>(testServer.baseUrl, "/api/lobbies/ROOMA/actions/queue", {
      method: "POST",
      cookie: guestCookie,
      body: {
        id: "stale-action",
        actorId: "player-2",
        baseActionVersion: 1,
        action: { type: "END_TURN", payload: { playerId: "player-2" } },
      },
    });

    expect(response.status).toBe(409);
    expect(response.body.stale).toBe(true);
    expect(currentLobby().gameState.pendingActions).toEqual([]);
    expect(currentLobby().gameState.failedActions).toMatchObject([
      {
        id: "stale-action",
        actorId: "player-2",
        reason: "stale_base_action_version",
        baseActionVersion: 1,
        currentActionVersion: 2,
      },
    ]);
  });

  it("rejects host commits that mutate a queue-backed guest action", async () => {
    const hostCookie = await signUp(testServer.baseUrl, "hostuser");
    await signUp(testServer.baseUrl, "guestuser");
    configurePlayingLobby({
      expectedActorId: "player-2",
      pendingVersion: 1,
      pendingActions: [
        {
          queueVersion: 1,
          id: "guest-end-turn",
          actorId: "player-2",
          baseActionVersion: 0,
          action: { type: "END_TURN", payload: { playerId: "player-2" } },
        },
      ],
    });

    const response = await jsonRequest<CommitResponseBody>(testServer.baseUrl, "/api/lobbies/ROOMA/actions/commit", {
      method: "POST",
      cookie: hostCookie,
      body: {
        id: "guest-end-turn",
        actorId: "player-2",
        queueVersion: 1,
        hostEpoch: 1,
        action: { type: "END_TURN", payload: { playerId: "player-1" } },
      },
    });

    expect(response.status).toBe(409);
    expect(response.body.error).toContain("payload mismatch");
    expect(currentLobby().gameState.actions).toEqual([]);
    expect(currentLobby().gameState.pendingActions).toHaveLength(1);
  });

  it("tombstones stale pending actions before applying turn ownership checks", async () => {
    const hostCookie = await signUp(testServer.baseUrl, "hostuser");
    await signUp(testServer.baseUrl, "guestuser");
    configurePlayingLobby({
      actionVersion: 1,
      expectedActorId: "player-1",
      pendingVersion: 1,
      pendingActions: [
        {
          queueVersion: 1,
          id: "old-guest-action",
          actorId: "player-2",
          baseActionVersion: 0,
          action: { type: "END_TURN", payload: { playerId: "player-2" } },
        },
      ],
    });

    const response = await jsonRequest<QueueResponseBody>(testServer.baseUrl, "/api/lobbies/ROOMA/actions/commit", {
      method: "POST",
      cookie: hostCookie,
      body: {
        id: "old-guest-action",
        actorId: "player-2",
        queueVersion: 1,
        hostEpoch: 1,
        action: { type: "END_TURN", payload: { playerId: "player-2" } },
      },
    });

    expect(response.status).toBe(409);
    expect(response.body.stale).toBe(true);
    expect(currentLobby().gameState.pendingActions).toEqual([]);
    expect(currentLobby().gameState.failedActions).toMatchObject([
      {
        id: "old-guest-action",
        actorId: "player-2",
        reason: "stale_pending_action",
        baseActionVersion: 0,
        currentActionVersion: 1,
      },
    ]);
  });

  it("rejects resolved turn metadata as an action-log commit", async () => {
    const hostCookie = await signUp(testServer.baseUrl, "hostuser");
    await signUp(testServer.baseUrl, "guestuser");
    configurePlayingLobby({ expectedActorId: "player-1" });

    const response = await jsonRequest<CommitResponseBody>(testServer.baseUrl, "/api/lobbies/ROOMA/actions/commit", {
      method: "POST",
      cookie: hostCookie,
      body: {
        id: "resolved-turn",
        actorId: "player-1",
        hostEpoch: 1,
        action: {
          type: "END_TURN_RESOLUTION",
          payload: { endingPlayerId: "player-1", nextPlayerId: "player-2", events: [] },
        },
      },
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("Invalid action payload");
    expect(currentLobby().gameState.actions).toEqual([]);
  });

  it("rejects snapshots with invalid lobby player invariants", async () => {
    const hostCookie = await signUp(testServer.baseUrl, "hostuser");
    await signUp(testServer.baseUrl, "guestuser");
    const snapshot = createSnapshot(1);
    snapshot.lastAction = { type: "END_TURN", payload: { playerId: "player-1" } };
    snapshot.players[0] = { ...snapshot.players[0], factionId: "LAMANITES" };
    configurePlayingLobby({
      actionVersion: 1,
      expectedActorId: "player-2",
      turnResolutionPending: true,
      actions: [
        {
          version: 1,
          id: "host-end-turn",
          actorId: "player-1",
          action: { type: "END_TURN", payload: { playerId: "player-1" } },
        },
      ],
    });

    const response = await jsonRequest<SnapshotResponseBody>(testServer.baseUrl, "/api/lobbies/ROOMA/state", {
      method: "PUT",
      cookie: hostCookie,
      body: {
        state: snapshot,
        version: 1,
        hostEpoch: 1,
      },
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("faction assignment");
  });

  it("rejects resolved-turn snapshots whose next actor disagrees with current actor", async () => {
    const hostCookie = await signUp(testServer.baseUrl, "hostuser");
    await signUp(testServer.baseUrl, "guestuser");
    const snapshot = createSnapshot(1);
    snapshot.lastAction = {
      type: "END_TURN_RESOLUTION",
      payload: { endingPlayerId: "player-1", nextPlayerId: "player-1", events: [] },
    };
    configurePlayingLobby({
      actionVersion: 1,
      expectedActorId: "player-2",
      turnResolutionPending: true,
      actions: [
        {
          version: 1,
          id: "host-end-turn",
          actorId: "player-1",
          action: { type: "END_TURN", payload: { playerId: "player-1" } },
        },
      ],
    });

    const response = await jsonRequest<SnapshotResponseBody>(testServer.baseUrl, "/api/lobbies/ROOMA/state", {
      method: "PUT",
      cookie: hostCookie,
      body: {
        state: snapshot,
        version: 1,
        hostEpoch: 1,
      },
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("next actor");
  });

  it("supports queue to host commit to snapshot to guest catch-up", async () => {
    const hostCookie = await signUp(testServer.baseUrl, "hostuser");
    const guestCookie = await signUp(testServer.baseUrl, "guestuser");
    configurePlayingLobby({ expectedActorId: "player-2", snapshot: createSnapshot(1) });

    const queueResponse = await jsonRequest<QueueResponseBody>(testServer.baseUrl, "/api/lobbies/ROOMA/actions/queue", {
      method: "POST",
      cookie: guestCookie,
      body: {
        id: "guest-end-turn",
        actorId: "player-2",
        baseActionVersion: 0,
        action: { type: "END_TURN", payload: { playerId: "player-2" } },
      },
    });
    expect(queueResponse.status).toBe(200);

    const commitResponse = await jsonRequest<CommitResponseBody>(testServer.baseUrl, "/api/lobbies/ROOMA/actions/commit", {
      method: "POST",
      cookie: hostCookie,
      body: {
        id: "guest-end-turn",
        actorId: "player-2",
        queueVersion: 1,
        hostEpoch: 1,
        action: { type: "END_TURN", payload: { playerId: "player-2" } },
      },
    });
    expect(commitResponse.status).toBe(200);
    expect(commitResponse.body.actionVersion).toBe(1);
    expect(currentLobby().gameState.turnResolutionPending).toBe(true);

    const pendingQueueResponse = await jsonRequest<QueueResponseBody>(testServer.baseUrl, "/api/lobbies/ROOMA/actions/queue", {
      method: "POST",
      cookie: hostCookie,
      body: {
        id: "blocked-during-resolution",
        actorId: "player-1",
        baseActionVersion: 1,
        action: { type: "END_TURN", payload: { playerId: "player-1" } },
      },
    });
    expect(pendingQueueResponse.status).toBe(409);
    expect(pendingQueueResponse.body.error).toContain("Waiting for host turn snapshot");

    const resolvedSnapshot = clone(currentLobby().gameState.snapshot);
    resolvedSnapshot.currentPlayerIndex = 0;
    resolvedSnapshot.lastAction = {
      type: "END_TURN_RESOLUTION",
      payload: { endingPlayerId: "player-2", nextPlayerId: "player-1", events: [] },
    };

    const snapshotResponse = await jsonRequest<SnapshotResponseBody>(testServer.baseUrl, "/api/lobbies/ROOMA/state", {
      method: "PUT",
      cookie: hostCookie,
      body: {
        state: resolvedSnapshot,
        version: 1,
        hostEpoch: 1,
      },
    });
    expect(snapshotResponse.status).toBe(200);
    expect(currentLobby().gameState.turnResolutionPending).toBe(false);
    expect(currentLobby().gameState.actionLogBaseVersion).toBe(1);

    const catchupResponse = await jsonRequest<ActionsResponseBody>(testServer.baseUrl, "/api/lobbies/ROOMA/actions?since=0", {
      cookie: guestCookie,
    });
    expect(catchupResponse.status).toBe(200);
    expect(catchupResponse.body.needsSnapshot).toBe(true);

    const stateResponse = await jsonRequest<StateResponseBody>(testServer.baseUrl, "/api/lobbies/ROOMA/state?since=0", {
      cookie: guestCookie,
    });
    expect(stateResponse.status).toBe(200);
    expect(stateResponse.body.snapshotVersion).toBe(1);
    expect(stateResponse.body.state?.lastAction).toMatchObject({ payload: { endingPlayerId: "player-2" } });
  });

  it("projects public-authoritative state for the requesting player", async () => {
    await signUp(testServer.baseUrl, "hostuser");
    const guestCookie = await signUp(testServer.baseUrl, "guestuser");
    const snapshot = createSnapshot();
    const hostUnit = snapshot.units.find((unit) => unit.playerId === "player-1");
    expect(hostUnit).toBeTruthy();
    snapshot.players = snapshot.players.map((player) =>
      player.id === "player-2"
        ? { ...player, visibilityMask: [], exploredTiles: [] }
        : player,
    );
    snapshot.map = {
      ...snapshot.map,
      tiles: snapshot.map.tiles.map((tile) => ({
        ...tile,
        exploredBy: (tile.exploredBy ?? []).filter((playerId) => playerId !== "player-2"),
      })),
    };
    configurePublicAuthoritativeLobby({ snapshot });

    const response = await jsonRequest<StateResponseBody & { authorityMode?: string }>(
      testServer.baseUrl,
      "/api/lobbies/ROOMA/state",
      { cookie: guestCookie },
    );

    expect(response.status).toBe(200);
    expect(response.body.authorityMode).toBe("public_authoritative");
    expect(response.body.state?.units.some((unit) => unit.playerId === "player-1")).toBe(false);
    expect(response.body.state?.units.some((unit) => unit.playerId === "player-2")).toBe(true);
  });

  it("redacts public-authoritative lobby action logs from lobby refresh responses", async () => {
    await signUp(testServer.baseUrl, "hostuser");
    const guestCookie = await signUp(testServer.baseUrl, "guestuser");
    const snapshot = createSnapshot();
    snapshot.players = snapshot.players.map((player) =>
      player.id === "player-2"
        ? { ...player, visibilityMask: [], exploredTiles: [] }
        : player,
    );
    configurePublicAuthoritativeLobby({
      snapshot,
      actions: [
        {
          version: 1,
          id: "hidden-attack",
          actorId: "player-1",
          action: { type: "ATTACK_UNIT", payload: { attackerId: "unit-1", targetId: "unit-2" } },
        },
      ],
      pendingActions: [{ id: "pending-hidden", action: { type: "END_TURN", payload: { playerId: "player-1" } } }],
      failedActions: [{ id: "failed-hidden", action: { type: "END_TURN", payload: { playerId: "player-1" } } }],
    });

    const response = await jsonRequest<LobbyFetchResponseBody>(
      testServer.baseUrl,
      "/api/lobbies/code/ROOMA",
      { cookie: guestCookie },
    );

    expect(response.status).toBe(200);
    expect(response.body.gameState.actions).toEqual([]);
    expect(response.body.gameState.pendingActions).toEqual([]);
    expect(response.body.gameState.failedActions).toEqual([]);
    expect(response.body.gameState.actionLogRedacted).toBe(true);
    expect(response.body.gameState.snapshot.units.some((unit) => unit.playerId === "player-1")).toBe(false);
  });

  it("submits public-authoritative actions through the server resolver and rejects legacy host commit", async () => {
    const hostCookie = await signUp(testServer.baseUrl, "hostuser");
    await signUp(testServer.baseUrl, "guestuser");
    configurePublicAuthoritativeLobby();

    const submitResponse = await jsonRequest<{ actionVersion?: number; snapshotVersion?: number; state?: GameState }>(
      testServer.baseUrl,
      "/api/lobbies/ROOMA/actions/submit",
      {
        method: "POST",
        cookie: hostCookie,
        body: {
          clientActionId: "public-end-turn-1",
          baseActionVersion: 0,
          action: { type: "END_TURN", payload: { playerId: "player-1" } },
        },
      },
    );

    expect(submitResponse.status).toBe(200);
    expect(submitResponse.body.actionVersion).toBe(1);
    expect(submitResponse.body.snapshotVersion).toBe(1);
    expect(currentLobby().gameState.actionVersion).toBe(1);
    expect(currentLobby().gameState.snapshotVersion).toBe(1);
    expect(currentLobby().gameState.expectedActorId).toBe("player-2");
    expect(routeMocks.storage.createMultiplayerActionAudit).toHaveBeenCalledWith(expect.objectContaining({
      clientActionId: "public-end-turn-1",
      status: "accepted",
      actionVersion: 1,
    }));
    expect(routeMocks.storage.createMultiplayerSnapshotCheckpoint).toHaveBeenCalledWith(expect.objectContaining({
      actionVersion: 1,
      snapshotVersion: 1,
    }));

    const legacyCommitResponse = await jsonRequest<CommitResponseBody>(
      testServer.baseUrl,
      "/api/lobbies/ROOMA/actions/commit",
      {
        method: "POST",
        cookie: hostCookie,
        body: {
          action: { type: "END_TURN", payload: { playerId: "player-2" } },
          actorId: "player-2",
          id: "legacy-public-commit",
          hostEpoch: 1,
        },
      },
    );

    expect(legacyCommitResponse.status).toBe(409);
  });

  it("rejects stale public-authoritative submissions without mutating state", async () => {
    const hostCookie = await signUp(testServer.baseUrl, "hostuser");
    await signUp(testServer.baseUrl, "guestuser");
    configurePublicAuthoritativeLobby({ actionVersion: 2, snapshotVersion: 2 });

    const response = await jsonRequest<{ reason?: string; actionVersion?: number }>(
      testServer.baseUrl,
      "/api/lobbies/ROOMA/actions/submit",
      {
        method: "POST",
        cookie: hostCookie,
        body: {
          clientActionId: "stale-public-action",
          baseActionVersion: 1,
          action: { type: "END_TURN", payload: { playerId: "player-1" } },
        },
      },
    );

    expect(response.status).toBe(409);
    expect(response.body.reason).toBe("stale_action_version");
    expect(response.body.actionVersion).toBe(2);
    expect(currentLobby().gameState.actionVersion).toBe(2);
    expect(routeMocks.storage.createMultiplayerActionAudit).toHaveBeenCalledWith(expect.objectContaining({
      clientActionId: "stale-public-action",
      status: "rejected",
      reason: "stale_action_version",
    }));
  });

  it("preserves pending turn-resolution recovery state when host transfers after a missing snapshot", async () => {
    await signUp(testServer.baseUrl, "hostuser");
    const guestCookie = await signUp(testServer.baseUrl, "guestuser");
    configurePlayingLobby({
      hostLastSeen: 1,
      hostEpoch: 3,
      actionVersion: 1,
      snapshotVersion: 0,
      expectedActorId: "player-2",
      turnResolutionPending: true,
      pendingVersion: 4,
      pendingActions: [
        {
          queueVersion: 4,
          id: "stale-during-host-transfer",
          actorId: "player-2",
          baseActionVersion: 1,
          action: { type: "END_TURN", payload: { playerId: "player-2" } },
        },
      ],
      actions: [
        {
          version: 1,
          id: "host-end-turn",
          actorId: "player-1",
          action: { type: "END_TURN", payload: { playerId: "player-1" } },
        },
      ],
    });

    const response = await jsonRequest(testServer.baseUrl, "/api/lobbies/ROOMA/host/claim", {
      method: "POST",
      cookie: guestCookie,
      body: { hostEpoch: 3 },
    });

    expect(response.status).toBe(200);
    expect(currentLobby().hostUserId).toBe(2);
    expect(currentLobby().gameState.hostEpoch).toBe(4);
    expect(currentLobby().gameState.turnResolutionPending).toBe(true);
    expect(currentLobby().gameState.hostTransferRequiresSnapshot).toEqual(expect.any(Number));
    expect(currentLobby().gameState.pendingActions).toEqual([]);
    expect(currentLobby().gameState.actions).toHaveLength(1);
  });
});
