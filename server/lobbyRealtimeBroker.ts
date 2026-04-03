import type { Response } from "express";

import type { LobbyRealtimeEvent } from "@shared/types/lobbyRealtime";

const SSE_KEEPALIVE_MS = 25000;

interface LobbyStreamConnection {
  id: number;
  res: Response;
  keepAliveTimer: ReturnType<typeof setInterval>;
  closed: boolean;
}

const connectionsByLobby = new Map<string, Map<number, LobbyStreamConnection>>();
let nextConnectionId = 1;

const writeEvent = (res: Response, event: LobbyRealtimeEvent): void => {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
};

export function openLobbyRealtimeStream(lobbyCode: string, res: Response): void {
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
