import type { Express, RequestHandler } from "express";
import { storage } from "./storage";
import {
  getExpectedActorId,
  needsSnapshotCatchup,
  type MultiplayerPlayerMeta,
} from "@shared/logic/multiplayerSync";
import {
  areMultiplayerActionsEquivalent,
  buildFailedMultiplayerActionEntry,
  getExpectedActorAfterCommit,
  isForcedTimeoutEndTurnAllowed,
  reconcilePendingActionsAfterCommit,
  validateMultiplayerAction,
  validateSnapshotUpload,
} from "./multiplayerPolicy";
import { publishLobbyRealtimeEvent } from "./lobbyRealtimeBroker";

const HOST_LEASE_MS = 30000;
const MAX_MULTIPLAYER_UPDATE_RETRIES = 5;
const MAX_MULTIPLAYER_FAILED_ACTIONS = 25;
const parsedActionBytes = Number.parseInt(process.env.MULTIPLAYER_MAX_ACTION_BYTES ?? "32768", 10);
const MAX_MULTIPLAYER_ACTION_BYTES =
  Number.isFinite(parsedActionBytes) && parsedActionBytes > 0 ? parsedActionBytes : 32768;
const parsedTurnTimeoutMs = Number.parseInt(process.env.MULTIPLAYER_TURN_TIMEOUT_MS ?? "90000", 10);
const MULTIPLAYER_TURN_TIMEOUT_MS =
  Number.isFinite(parsedTurnTimeoutMs) && parsedTurnTimeoutMs > 0 ? parsedTurnTimeoutMs : 90000;
const MULTIPLAYER_TURN_RECOVERY_ENABLED = process.env.MULTIPLAYER_TURN_RECOVERY !== "false";

type LobbyState = Record<string, unknown>;
type PendingAction = {
  queueVersion?: number;
  id?: string;
  actorId?: string;
  action?: unknown;
  baseActionVersion?: number;
};
type CommittedAction = {
  version?: number;
  id?: string;
  actorId?: string;
  action?: unknown;
};

function getHostMeta(lobbyState: LobbyState) {
  const hostEpoch = Number(lobbyState.hostEpoch ?? 0);
  const hostLastSeen = Number(lobbyState.hostLastSeen ?? 0);
  const leaseExpired = !hostLastSeen || Date.now() - hostLastSeen > HOST_LEASE_MS;
  return { hostEpoch, hostLastSeen, leaseExpired };
}

function appendFailedMultiplayerAction(lobbyState: LobbyState, entry: unknown): unknown[] {
  const failedActions = Array.isArray(lobbyState.failedActions) ? lobbyState.failedActions : [];
  return [...failedActions, entry].slice(-MAX_MULTIPLAYER_FAILED_ACTIONS);
}

function getPlayersMeta(lobbyState: LobbyState): MultiplayerPlayerMeta[] {
  return Array.isArray(lobbyState.players)
    ? lobbyState.players as MultiplayerPlayerMeta[]
    : [];
}

function getPendingActions(lobbyState: LobbyState): PendingAction[] {
  return Array.isArray(lobbyState.pendingActions)
    ? [...(lobbyState.pendingActions as PendingAction[])]
    : [];
}

function getCommittedActions(lobbyState: LobbyState): CommittedAction[] {
  return Array.isArray(lobbyState.actions)
    ? [...(lobbyState.actions as CommittedAction[])]
    : [];
}

function publishMultiplayerSyncEvent(lobbyCode: string, reason: "action-committed" | "queue-updated") {
  publishLobbyRealtimeEvent(lobbyCode, {
    type: "multiplayer-sync",
    lobbyCode,
    reason,
  });
}

const multiplayerTelemetry = {
  needsSnapshot: 0,
  forcedTimeoutEndTurn: 0,
};

function logMultiplayerTelemetry(event: keyof typeof multiplayerTelemetry, payload: Record<string, unknown>) {
  multiplayerTelemetry[event] += 1;
  console.info("[multiplayer:telemetry]", {
    event,
    count: multiplayerTelemetry[event],
    ...payload,
  });
}

async function isParticipant(lobbyId: number, hostUserId: number, userId: number): Promise<boolean> {
  const seats = await storage.getSeatsByLobbyId(lobbyId);
  return hostUserId === userId || seats.some((seat) => seat.userId === userId);
}

export function registerMultiplayerActionRoutes(
  app: Express,
  {
    requireAuth,
    queueRateLimit,
    commitRateLimit,
  }: {
    requireAuth: RequestHandler;
    queueRateLimit: RequestHandler;
    commitRateLimit: RequestHandler;
  },
): void {
  app.get("/api/lobbies/:code/state", requireAuth, async (req, res) => {
    try {
      const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
      if (!lobby) return res.status(404).json({ error: "Lobby not found" });
      if (lobby.status !== "playing") return res.status(409).json({ error: "Game not in progress" });
      const userId = req.session.userId!;
      if (!(await isParticipant(lobby.id, lobby.hostUserId, userId))) {
        return res.status(403).json({ error: "Not a participant" });
      }

      const lobbyState = (lobby.gameState as LobbyState) || {};
      const snapshotVersion = Number(lobbyState.snapshotVersion ?? 0);
      const actionVersion = Number(lobbyState.actionVersion ?? 0);
      const since = typeof req.query.since === "string" ? Number(req.query.since) : Number.NaN;
      if (Number.isFinite(since) && since >= snapshotVersion) {
        return res.json({ snapshotVersion, actionVersion, state: null });
      }
      return res.json({ snapshotVersion, actionVersion, state: lobbyState.snapshot ?? null });
    } catch (error) {
      console.error("Failed to get game state:", error);
      return res.status(500).json({ error: "Failed to get game state" });
    }
  });

  app.put("/api/lobbies/:code/state", requireAuth, async (req, res) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const { state, version, hostEpoch } = body;
      if (!state || typeof version !== "number" || typeof hostEpoch !== "number") {
        return res.status(400).json({ error: "State, version, and hostEpoch required" });
      }
      if (version <= 0) {
        return res.status(400).json({ error: "Snapshot upload requires a committed action version" });
      }

      for (let attempt = 0; attempt < MAX_MULTIPLAYER_UPDATE_RETRIES; attempt += 1) {
        const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
        if (!lobby) return res.status(404).json({ error: "Lobby not found" });
        if (lobby.status !== "playing") return res.status(409).json({ error: "Game not in progress" });
        if (lobby.hostUserId !== req.session.userId) {
          return res.status(403).json({ error: "Only host can update snapshots" });
        }

        const lobbyState = (lobby.gameState as LobbyState) || {};
        const { hostEpoch: currentHostEpoch } = getHostMeta(lobbyState);
        if (hostEpoch !== currentHostEpoch) {
          return res.status(409).json({ error: "Host epoch mismatch", hostEpoch: currentHostEpoch });
        }

        const currentActionVersion = Number(lobbyState.actionVersion ?? 0);
        if (version !== currentActionVersion) {
          return res.status(409).json({ error: "Out of date", version: currentActionVersion });
        }

        const snapshotValidation = validateSnapshotUpload({ snapshot: state, lobbyState, version });
        if (!snapshotValidation.valid) {
          return res.status(400).json({ error: snapshotValidation.error });
        }

        const actions = getCommittedActions(lobbyState).filter((entry) => Number(entry.version) > version);
        const updated = await storage.updateLobbyIfUnchanged(lobby.id, lobby, {
          gameState: {
            ...lobbyState,
            snapshot: snapshotValidation.state,
            snapshotVersion: version,
            actions,
            actionLogBaseVersion: version,
            expectedActorId: snapshotValidation.expectedActorId,
            turnResolutionPending: false,
            hostLastSeen: Date.now(),
          },
        });
        if (updated) {
          return res.json({ snapshotVersion: version, actionVersion: currentActionVersion });
        }
      }

      return res.status(409).json({ error: "Concurrent lobby update. Retry snapshot upload." });
    } catch (error) {
      console.error("Failed to update game state:", error);
      return res.status(500).json({ error: "Failed to update game state" });
    }
  });

  app.post("/api/lobbies/:code/actions/queue", requireAuth, queueRateLimit, async (req, res) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const { action, actorId, id, baseActionVersion } = body;
      if (!action || typeof actorId !== "string" || typeof id !== "string" || !actorId || !id) {
        return res.status(400).json({ error: "Action, actorId, and id required" });
      }
      if (typeof baseActionVersion !== "number" || !Number.isFinite(baseActionVersion) || baseActionVersion < 0) {
        return res.status(400).json({ error: "baseActionVersion required" });
      }
      const actionValidation = validateMultiplayerAction(action, MAX_MULTIPLAYER_ACTION_BYTES);
      if (!actionValidation.valid) return res.status(400).json({ error: actionValidation.error });

      for (let attempt = 0; attempt < MAX_MULTIPLAYER_UPDATE_RETRIES; attempt += 1) {
        const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
        if (!lobby) return res.status(404).json({ error: "Lobby not found" });
        if (lobby.status !== "playing") return res.status(409).json({ error: "Game not in progress" });

        const lobbyState = (lobby.gameState as LobbyState) || {};
        const playerMeta = getPlayersMeta(lobbyState).find((player) => player.playerId === actorId);
        if (!playerMeta) return res.status(400).json({ error: "Unknown player" });
        if (playerMeta.isAI) return res.status(403).json({ error: "AI actions must be submitted by host" });
        if (playerMeta.userId !== req.session.userId) return res.status(403).json({ error: "Not your player" });
        if (lobbyState.turnResolutionPending === true) {
          return res.status(409).json({ error: "Waiting for host turn snapshot" });
        }

        const currentActionVersion = Number(lobbyState.actionVersion ?? 0);
        if (baseActionVersion !== currentActionVersion) {
          const pendingVersion = Number(lobbyState.pendingVersion ?? 0) + 1;
          const failedActions = appendFailedMultiplayerAction(
            lobbyState,
            buildFailedMultiplayerActionEntry({
              id,
              actorId,
              action,
              baseActionVersion,
              reason: "stale_base_action_version",
              currentActionVersion,
              failedAt: Date.now(),
            }),
          );
          const updated = await storage.updateLobbyIfUnchanged(lobby.id, lobby, {
            gameState: { ...lobbyState, pendingVersion, failedActions },
          });
          if (updated) {
            publishMultiplayerSyncEvent(lobby.code, "queue-updated");
            return res.status(409).json({
              error: "Action is stale. Re-sync and try again.",
              stale: true,
              currentActionVersion,
              pendingVersion,
            });
          }
          continue;
        }

        const expectedActorId = getExpectedActorId(lobbyState);
        if (expectedActorId && actorId !== expectedActorId) {
          return res.status(409).json({ error: "Not this player's turn", expectedActorId });
        }

        const pendingActions = getPendingActions(lobbyState);
        const existingPending = pendingActions.find((entry) => entry.id === id);
        if (existingPending) return res.json({ queueVersion: existingPending.queueVersion, duplicate: true });
        const existingCommitted = getCommittedActions(lobbyState).find((entry) => entry.id === id);
        if (existingCommitted) {
          return res.status(409).json({ error: "Action already committed", actionVersion: existingCommitted.version });
        }

        const pendingVersion = Number(lobbyState.pendingVersion ?? 0) + 1;
        pendingActions.push({ queueVersion: pendingVersion, id, actorId, action, baseActionVersion });
        const playersMeta = getPlayersMeta(lobbyState);
        const playerIndex = playersMeta.findIndex((entry) => entry.playerId === actorId);
        if (playerIndex >= 0) {
          playersMeta[playerIndex] = { ...playersMeta[playerIndex], lastSeenAt: Date.now() };
        }

        const updated = await storage.updateLobbyIfUnchanged(lobby.id, lobby, {
          gameState: { ...lobbyState, pendingVersion, pendingActions, players: playersMeta },
        });
        if (updated) {
          publishMultiplayerSyncEvent(lobby.code, "queue-updated");
          return res.json({ queueVersion: pendingVersion });
        }
      }

      return res.status(409).json({ error: "Concurrent lobby update. Retry queue request." });
    } catch (error) {
      console.error("Failed to queue action:", error);
      return res.status(500).json({ error: "Failed to queue action" });
    }
  });

  app.get("/api/lobbies/:code/actions/queue", requireAuth, async (req, res) => {
    try {
      const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
      if (!lobby) return res.status(404).json({ error: "Lobby not found" });
      if (lobby.status !== "playing") return res.status(409).json({ error: "Game not in progress" });
      if (lobby.hostUserId !== req.session.userId) {
        return res.status(403).json({ error: "Only host can fetch pending actions" });
      }

      const lobbyState = (lobby.gameState as LobbyState) || {};
      const pendingVersion = Number(lobbyState.pendingVersion ?? 0);
      const since = Number(req.query.since ?? 0);
      if (Number.isFinite(since) && since >= pendingVersion) {
        return res.json({ pendingVersion, actions: [] });
      }
      const actions = Number.isFinite(since)
        ? getPendingActions(lobbyState).filter((entry) => Number(entry.queueVersion) > since)
        : getPendingActions(lobbyState);
      return res.json({ pendingVersion, actions });
    } catch (error) {
      console.error("Failed to fetch pending actions:", error);
      return res.status(500).json({ error: "Failed to fetch pending actions" });
    }
  });

  app.post("/api/lobbies/:code/actions/queue/reject", requireAuth, commitRateLimit, async (req, res) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const { queueVersion, id, actorId, hostEpoch, reason } = body;
      if (
        typeof queueVersion !== "number" ||
        typeof id !== "string" ||
        typeof actorId !== "string" ||
        typeof hostEpoch !== "number"
      ) {
        return res.status(400).json({ error: "queueVersion, id, actorId, and hostEpoch required" });
      }

      for (let attempt = 0; attempt < MAX_MULTIPLAYER_UPDATE_RETRIES; attempt += 1) {
        const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
        if (!lobby) return res.status(404).json({ error: "Lobby not found" });
        if (lobby.status !== "playing") return res.status(409).json({ error: "Game not in progress" });
        if (lobby.hostUserId !== req.session.userId) {
          return res.status(403).json({ error: "Only host can reject pending actions" });
        }

        const lobbyState = (lobby.gameState as LobbyState) || {};
        const { hostEpoch: currentHostEpoch } = getHostMeta(lobbyState);
        if (hostEpoch !== currentHostEpoch) {
          return res.status(409).json({ error: "Host epoch mismatch", hostEpoch: currentHostEpoch });
        }

        const pendingActions = getPendingActions(lobbyState);
        const pendingAction = pendingActions.find(
          (entry) => entry.queueVersion === queueVersion && entry.id === id && entry.actorId === actorId,
        );
        if (!pendingAction) return res.status(404).json({ error: "Pending action not found" });

        const pendingVersion = Number(lobbyState.pendingVersion ?? 0) + 1;
        const failedActions = appendFailedMultiplayerAction(
          lobbyState,
          buildFailedMultiplayerActionEntry({
            pendingAction,
            id,
            actorId,
            reason: typeof reason === "string" && reason ? reason.slice(0, 80) : "host_apply_failed",
            currentActionVersion: Number(lobbyState.actionVersion ?? 0),
            failedAt: Date.now(),
          }),
        );
        const updated = await storage.updateLobbyIfUnchanged(lobby.id, lobby, {
          gameState: {
            ...lobbyState,
            pendingVersion,
            pendingActions: pendingActions.filter((entry) => entry.queueVersion !== queueVersion),
            failedActions,
            hostLastSeen: Date.now(),
          },
        });
        if (updated) {
          publishMultiplayerSyncEvent(lobby.code, "queue-updated");
          return res.json({ pendingVersion });
        }
      }

      return res.status(409).json({ error: "Concurrent lobby update. Retry queue rejection." });
    } catch (error) {
      console.error("Failed to reject pending action:", error);
      return res.status(500).json({ error: "Failed to reject pending action" });
    }
  });

  app.post("/api/lobbies/:code/actions/commit", requireAuth, commitRateLimit, async (req, res) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const { action, actorId, id, queueVersion, hostEpoch } = body;
      if (!action || typeof actorId !== "string" || typeof id !== "string" || !actorId || !id || typeof hostEpoch !== "number") {
        return res.status(400).json({ error: "Action, actorId, id, and hostEpoch required" });
      }
      if (queueVersion !== undefined && typeof queueVersion !== "number") {
        return res.status(400).json({ error: "queueVersion must be a number when provided" });
      }
      const actionValidation = validateMultiplayerAction(action, MAX_MULTIPLAYER_ACTION_BYTES);
      if (!actionValidation.valid) return res.status(400).json({ error: actionValidation.error });

      for (let attempt = 0; attempt < MAX_MULTIPLAYER_UPDATE_RETRIES; attempt += 1) {
        const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
        if (!lobby) return res.status(404).json({ error: "Lobby not found" });
        if (lobby.status !== "playing") return res.status(409).json({ error: "Game not in progress" });
        if (lobby.hostUserId !== req.session.userId) return res.status(403).json({ error: "Only host can commit actions" });

        const lobbyState = (lobby.gameState as LobbyState) || {};
        const { hostEpoch: currentHostEpoch } = getHostMeta(lobbyState);
        if (hostEpoch !== currentHostEpoch) {
          return res.status(409).json({ error: "Host epoch mismatch", hostEpoch: currentHostEpoch });
        }

        const playerMeta = getPlayersMeta(lobbyState).find((player) => player.playerId === actorId);
        if (!playerMeta) return res.status(400).json({ error: "Unknown player" });
        const queueVersionProvided = queueVersion !== undefined;
        const requiresQueueProof = !playerMeta.isAI && playerMeta.userId !== req.session.userId;
        const forcedTimeoutEndTurnAllowed = isForcedTimeoutEndTurnAllowed({
          action,
          actorId,
          queueVersionProvided,
          playerMeta,
          expectedActorId: getExpectedActorId(lobbyState),
          requesterUserId: req.session.userId!,
          hostUserId: lobby.hostUserId,
          now: Date.now(),
          timeoutMs: MULTIPLAYER_TURN_TIMEOUT_MS,
          recoveryEnabled: MULTIPLAYER_TURN_RECOVERY_ENABLED,
        });
        if (requiresQueueProof && !queueVersionProvided && !forcedTimeoutEndTurnAllowed) {
          return res.status(409).json({ error: "Remote player actions must be queue-backed." });
        }

        const actions = getCommittedActions(lobbyState);
        const existingCommitted = actions.find((entry) => entry.id === id);
        if (existingCommitted) {
          return res.json({ actionVersion: Number(existingCommitted.version ?? lobbyState.actionVersion ?? 0), duplicate: true });
        }

        let pendingActions = getPendingActions(lobbyState);
        let canonicalAction: unknown = action;
        if (queueVersionProvided) {
          const queueMatch = pendingActions.find(
            (entry) => entry.queueVersion === queueVersion && entry.id === id && entry.actorId === actorId,
          );
          if (!queueMatch) return res.status(409).json({ error: "Pending action mismatch. Refresh pending queue." });
          const currentActionVersion = Number(lobbyState.actionVersion ?? 0);
          if (typeof queueMatch.baseActionVersion !== "number" || queueMatch.baseActionVersion !== currentActionVersion) {
            const failedActions = appendFailedMultiplayerAction(
              lobbyState,
              buildFailedMultiplayerActionEntry({
                pendingAction: queueMatch,
                id,
                actorId,
                action: queueMatch.action,
                baseActionVersion: queueMatch.baseActionVersion,
                reason: typeof queueMatch.baseActionVersion === "number"
                  ? "stale_pending_action"
                  : "missing_base_action_version",
                currentActionVersion,
                failedAt: Date.now(),
              }),
            );
            pendingActions = pendingActions.filter((entry) => entry.queueVersion !== queueVersion);
            const pendingVersion = Number(lobbyState.pendingVersion ?? 0) + 1;
            const updated = await storage.updateLobbyIfUnchanged(lobby.id, lobby, {
              gameState: { ...lobbyState, pendingVersion, pendingActions, failedActions, hostLastSeen: Date.now() },
            });
            if (updated) {
              publishMultiplayerSyncEvent(lobby.code, "queue-updated");
              return res.status(409).json({ error: "Pending action is stale. Re-sync and try again.", stale: true, currentActionVersion, pendingVersion });
            }
            continue;
          }
          if (!areMultiplayerActionsEquivalent(queueMatch.action, action)) {
            return res.status(409).json({ error: "Queued action payload mismatch. Refresh pending queue." });
          }
          canonicalAction = queueMatch.action;
        }
        if (lobbyState.turnResolutionPending === true) {
          return res.status(409).json({ error: "Waiting for host turn snapshot" });
        }

        const expectedActorId = getExpectedActorId(lobbyState);
        if (expectedActorId && actorId !== expectedActorId) {
          return res.status(409).json({ error: "Not this player's turn", expectedActorId });
        }

        const isTurnCompleteAction =
          (canonicalAction as { type?: unknown }).type === "END_TURN" ||
          (canonicalAction as { type?: unknown }).type === "END_TURN_RESOLUTION";
        const expectedActorAfterCommit = getExpectedActorAfterCommit({
          lobbyState,
          actorId,
          action: canonicalAction,
          currentExpectedActorId: expectedActorId,
          isTurnCompleteAction,
        });
        if (!expectedActorAfterCommit.valid) return res.status(400).json({ error: expectedActorAfterCommit.error });

        pendingActions = reconcilePendingActionsAfterCommit({
          pendingActions,
          queueVersionProvided,
          queueVersion,
          id,
          actorId,
          isTurnCompleteAction,
        });

        const nextActionVersion = Number(lobbyState.actionVersion ?? 0) + 1;
        actions.push({ version: nextActionVersion, id, actorId, action: canonicalAction });
        const playersMeta = getPlayersMeta(lobbyState);
        const playerIndex = playersMeta.findIndex((entry) => entry.playerId === actorId);
        if (playerIndex >= 0) playersMeta[playerIndex] = { ...playersMeta[playerIndex], lastSeenAt: Date.now() };

        const updated = await storage.updateLobbyIfUnchanged(lobby.id, lobby, {
          gameState: {
            ...lobbyState,
            actionVersion: nextActionVersion,
            actions,
            pendingActions,
            expectedActorId: expectedActorAfterCommit.expectedActorId,
            turnResolutionPending: expectedActorAfterCommit.requiresSnapshot,
            players: playersMeta,
            hostLastSeen: Date.now(),
          },
        });
        if (updated) {
          if (forcedTimeoutEndTurnAllowed) {
            logMultiplayerTelemetry("forcedTimeoutEndTurn", { lobbyCode: lobby.code, actorId, hostUserId: lobby.hostUserId });
          }
          publishMultiplayerSyncEvent(lobby.code, "action-committed");
          return res.json({ actionVersion: nextActionVersion });
        }
      }

      return res.status(409).json({ error: "Concurrent lobby update. Retry commit." });
    } catch (error) {
      console.error("Failed to commit action:", error);
      return res.status(500).json({ error: "Failed to commit action" });
    }
  });

  app.get("/api/lobbies/:code/actions", requireAuth, async (req, res) => {
    try {
      const lobby = await storage.getLobbyByCode(req.params.code.toUpperCase());
      if (!lobby) return res.status(404).json({ error: "Lobby not found" });
      if (lobby.status !== "playing") return res.status(409).json({ error: "Game not in progress" });
      const userId = req.session.userId!;
      if (!(await isParticipant(lobby.id, lobby.hostUserId, userId))) {
        return res.status(403).json({ error: "Not a participant" });
      }

      const lobbyState = (lobby.gameState as LobbyState) || {};
      const actionVersion = Number(lobbyState.actionVersion ?? 0);
      const actions = getCommittedActions(lobbyState);
      const actionLogBaseVersion = Number(lobbyState.actionLogBaseVersion ?? 0);
      const snapshotVersion = Number(lobbyState.snapshotVersion ?? 0);
      const since = Number(req.query.since ?? 0);

      if (Number.isFinite(since) && since >= actionVersion) return res.json({ actionVersion, actions: [] });
      if (needsSnapshotCatchup(since, actionLogBaseVersion)) {
        logMultiplayerTelemetry("needsSnapshot", { lobbyCode: lobby.code, since, actionVersion, actionLogBaseVersion });
        return res.json({ actionVersion, actions: [], needsSnapshot: true, snapshotVersion, actionLogBaseVersion });
      }

      const newActions = Number.isFinite(since)
        ? actions.filter((entry) => Number(entry.version) > since)
        : actions;
      return res.json({ actionVersion, actions: newActions, needsSnapshot: false, snapshotVersion, actionLogBaseVersion });
    } catch (error) {
      console.error("Failed to fetch actions:", error);
      return res.status(500).json({ error: "Failed to fetch actions" });
    }
  });
}
