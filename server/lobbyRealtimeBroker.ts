import type { Response } from "express";

import type { LobbyRealtimeEvent } from "@shared/types/lobbyRealtime";

const SSE_KEEPALIVE_MS = 25000;
const POSTGRES_REALTIME_CHANNEL = "covenant_lobby_realtime";
const REALTIME_ADAPTER = String(process.env.MULTIPLAYER_REALTIME_ADAPTER ?? "memory").toLowerCase();

interface LobbyStreamConnection {
  id: number;
  res: Response;
  keepAliveTimer: ReturnType<typeof setInterval>;
  closed: boolean;
}

const connectionsByLobby = new Map<string, Map<number, LobbyStreamConnection>>();
let nextConnectionId = 1;
let postgresListenerStarted = false;
let postgresListenerStarting = false;

type PostgresRealtimePool = {
  connect?: () => Promise<{
    query: (sql: string) => Promise<unknown>;
    on: (event: "notification" | "error", listener: (message: { channel?: string; payload?: string } | unknown) => void) => void;
  }>;
  query?: (sql: string, params: string[]) => Promise<unknown>;
};

let realtimePoolPromise: Promise<PostgresRealtimePool | null> | null = null;

function getRealtimePool(): Promise<PostgresRealtimePool | null> {
  if (REALTIME_ADAPTER !== "postgres_notify") return Promise.resolve(null);
  realtimePoolPromise ??= import("./db")
    .then(({ pool }) => pool as PostgresRealtimePool)
    .catch((error: unknown) => {
      console.warn("[multiplayer:realtime] failed to load postgres realtime pool", error);
      return null;
    });
  return realtimePoolPromise;
}

const writeEvent = (res: Response, event: LobbyRealtimeEvent): void => {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
};

function publishLocalLobbyRealtimeEvent(lobbyCode: string, event: LobbyRealtimeEvent): void {
  const lobbyConnections = connectionsByLobby.get(lobbyCode);
  if (!lobbyConnections || lobbyConnections.size === 0) return;

  lobbyConnections.forEach((connection, connectionId) => {
    if (connection.closed || connection.res.writableEnded) {
      lobbyConnections.delete(connectionId);
      return;
    }

    try {
      writeEvent(connection.res, event);
    } catch {
      connection.closed = true;
      clearInterval(connection.keepAliveTimer);
      lobbyConnections.delete(connectionId);
    }
  });

  if (lobbyConnections.size === 0) {
    connectionsByLobby.delete(lobbyCode);
  }
}

async function ensurePostgresRealtimeListener(): Promise<void> {
  if (REALTIME_ADAPTER !== "postgres_notify") return;
  if (postgresListenerStarted || postgresListenerStarting) return;
  const realtimePool = await getRealtimePool();
  if (!realtimePool) return;
  if (typeof realtimePool.connect !== "function") return;

  postgresListenerStarting = true;
  try {
    const client = await realtimePool.connect();
    client.on("notification", (message) => {
      const notification = message as { channel?: string; payload?: string };
      if (notification.channel !== POSTGRES_REALTIME_CHANNEL || !notification.payload) return;
      try {
        const payload = JSON.parse(notification.payload) as { lobbyCode?: string; event?: LobbyRealtimeEvent };
        if (!payload.lobbyCode || !payload.event) return;
        publishLocalLobbyRealtimeEvent(payload.lobbyCode, payload.event);
      } catch {
        // Ignore malformed cross-process realtime payloads.
      }
    });
    client.on("error", (error: unknown) => {
      console.warn("[multiplayer:realtime] postgres listener error", error);
      postgresListenerStarted = false;
    });
    await client.query(`LISTEN ${POSTGRES_REALTIME_CHANNEL}`);
    postgresListenerStarted = true;
  } catch (error) {
    console.warn("[multiplayer:realtime] failed to start postgres listener", error);
  } finally {
    postgresListenerStarting = false;
  }
}

function publishPostgresLobbyRealtimeEvent(lobbyCode: string, event: LobbyRealtimeEvent): void {
  if (REALTIME_ADAPTER !== "postgres_notify") return;
  void getRealtimePool().then((realtimePool) => {
    if (!realtimePool || typeof realtimePool.query !== "function") return;
    return realtimePool.query("SELECT pg_notify($1, $2)", [
      POSTGRES_REALTIME_CHANNEL,
      JSON.stringify({ lobbyCode, event }),
    ]);
  }).catch((error: unknown) => {
    console.warn("[multiplayer:realtime] failed to publish postgres notification", error);
  });
}

export function openLobbyRealtimeStream(lobbyCode: string, res: Response): void {
  void ensurePostgresRealtimeListener();
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  res.write("retry: 2000\n\n");

  const connectionId = nextConnectionId++;
  const keepAliveTimer = setInterval(() => {
    if (!res.writableEnded) {
      res.write(`: keep-alive ${Date.now()}\n\n`);
    }
  }, SSE_KEEPALIVE_MS);

  const connection: LobbyStreamConnection = {
    id: connectionId,
    res,
    keepAliveTimer,
    closed: false,
  };

  const lobbyConnections = connectionsByLobby.get(lobbyCode) ?? new Map<number, LobbyStreamConnection>();
  lobbyConnections.set(connectionId, connection);
  connectionsByLobby.set(lobbyCode, lobbyConnections);

  writeEvent(res, {
    type: "ready",
    lobbyCode,
    sentAt: Date.now(),
  });

  const cleanup = () => {
    if (connection.closed) return;
    connection.closed = true;
    clearInterval(connection.keepAliveTimer);

    const currentLobbyConnections = connectionsByLobby.get(lobbyCode);
    if (!currentLobbyConnections) return;
    currentLobbyConnections.delete(connectionId);
    if (currentLobbyConnections.size === 0) {
      connectionsByLobby.delete(lobbyCode);
    }
  };

  res.on("close", cleanup);
  res.on("error", cleanup);
}

export function publishLobbyRealtimeEvent(lobbyCode: string, event: LobbyRealtimeEvent): void {
  publishLocalLobbyRealtimeEvent(lobbyCode, event);
  publishPostgresLobbyRealtimeEvent(lobbyCode, event);
}
