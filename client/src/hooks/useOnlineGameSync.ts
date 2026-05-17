import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocalGame } from "../lib/stores/useLocalGame";
import {
  applyCommittedEntriesSequentially,
  getCursorFromSnapshotVersion,
} from "./onlineSyncUtils";
import { subscribeLobbyRealtime } from "@/lib/lobbyRealtimeStream";
import {
  appendMultiplayerVersionQuery,
  multiplayerJsonHeaders,
  multiplayerVersionHeaders,
} from "@/lib/multiplayerVersion";

const MULTIPLAYER_MAINTENANCE_INTERVAL_MS = 5000;
const MULTIPLAYER_FALLBACK_SYNC_INTERVAL_MS = 15000;

type SyncRequest = {
  includeHostStatus: boolean;
  includeActionSync: boolean;
};

const EMPTY_SYNC_REQUEST: SyncRequest = {
  includeHostStatus: false,
  includeActionSync: false,
};

const mergeSyncRequests = (current: SyncRequest, next: SyncRequest): SyncRequest => ({
  includeHostStatus: current.includeHostStatus || next.includeHostStatus,
  includeActionSync: current.includeActionSync || next.includeActionSync,
});

const hasSyncWork = (request: SyncRequest): boolean => request.includeHostStatus || request.includeActionSync;

const getLatestRawEndTurnVersion = (entries: unknown[]): number | null => {
  let version: number | null = null;
  for (const entry of entries) {
    const record = entry && typeof entry === "object" ? entry as Record<string, unknown> : null;
    const action = record?.action && typeof record.action === "object"
      ? record.action as Record<string, unknown>
      : null;
    const entryVersion = Number(record?.version);
    if (action?.type === "END_TURN" && Number.isFinite(entryVersion) && entryVersion > 0) {
      version = version == null ? entryVersion : Math.max(version, entryVersion);
    }
  }
  return version;
};

type OnlineSessionSnapshot = {
  lobbyCode: string;
  userId: number;
  hostUserId: number;
  myPlayerIds: string[];
  authorityMode?: "private_demo_hosted" | "public_authoritative";
  actionVersion: number;
  queueVersion: number;
  hostEpoch: number;
};

export function useOnlineGameSync() {
  const onlineSession = useLocalGame((state) => state.onlineSession);
  const syncLobbyCode = onlineSession?.lobbyCode;
  const syncUserId = onlineSession?.userId;
  const syncHostUserId = onlineSession?.hostUserId;
  const applyRemoteAction = useLocalGame((state) => state.applyRemoteAction);
  const loadGameState = useLocalGame((state) => state.loadGameState);
  const setOnlineActionVersion = useLocalGame((state) => state.setOnlineActionVersion);
  const setOnlineQueueVersion = useLocalGame((state) => state.setOnlineQueueVersion);
  const setOnlineHost = useLocalGame((state) => state.setOnlineHost);
  const setHostLeaseStatus = useLocalGame((state) => state.setHostLeaseStatus);
  const requestOnlineResync = useLocalGame((state) => state.requestOnlineResync);
  const clearOnlineResyncRequest = useLocalGame((state) => state.clearOnlineResyncRequest);
  const markOnlineResyncComplete = useLocalGame((state) => state.markOnlineResyncComplete);
  const strictResyncEnabled = useMemo(() => {
    const env = import.meta.env as Record<string, string | undefined>;
    return env.VITE_MULTIPLAYER_STRICT_RESYNC !== "false" && env.MULTIPLAYER_STRICT_RESYNC !== "false";
  }, []);

  const syncingRef = useRef(false);
  const resyncingRef = useRef(false);
  const processedQueueRef = useRef<Map<string, boolean>>(new Map());
  const queuedSyncRef = useRef<SyncRequest>(EMPTY_SYNC_REQUEST);
  const lastHostHeartbeatRef = useRef(0);
  const lastPlayerHeartbeatRef = useRef(0);
  const telemetryRef = useRef<Record<string, number>>({});

  const logTelemetry = useCallback((event: string, payload: Record<string, unknown> = {}) => {
    telemetryRef.current[event] = (telemetryRef.current[event] ?? 0) + 1;
    console.info("[online-sync]", {
      event,
      count: telemetryRef.current[event],
      ...payload,
    });
  }, []);

  const performAuthoritativeResync = useCallback(async (
    session: OnlineSessionSnapshot,
    reason: string,
  ): Promise<boolean> => {
    if (resyncingRef.current) {
      return false;
    }
    resyncingRef.current = true;
    logTelemetry("forced_resync_start", { reason, lobbyCode: session.lobbyCode });

    try {
      const snapshotRes = await fetch(appendMultiplayerVersionQuery(`/api/lobbies/${session.lobbyCode}/state`), {
        headers: multiplayerVersionHeaders(),
        credentials: "include",
      });
      if (!snapshotRes.ok) {
        logTelemetry("forced_resync_snapshot_failed", { status: snapshotRes.status, reason });
        return false;
      }

      const snapshotData = await snapshotRes.json();
      const snapshotVersion = getCursorFromSnapshotVersion(snapshotData?.snapshotVersion);
      if (snapshotData?.state) {
        loadGameState(snapshotData.state, { source: 'online_forced_resync', saveId: `snapshot:${snapshotVersion}` });
      }
      setOnlineActionVersion(snapshotVersion);

      if (session.authorityMode === "public_authoritative") {
        if (typeof snapshotData?.actionVersion === "number") {
          setOnlineActionVersion(snapshotData.actionVersion);
        }
        processedQueueRef.current.clear();
        markOnlineResyncComplete();
        logTelemetry("forced_resync_complete", {
          reason,
          snapshotVersion,
          publicAuthoritative: true,
        });
        return true;
      }

      const committedRes = await fetch(appendMultiplayerVersionQuery(`/api/lobbies/${session.lobbyCode}/actions?since=${snapshotVersion}`), {
        headers: multiplayerVersionHeaders(),
        credentials: "include",
      });
      if (!committedRes.ok) {
        logTelemetry("forced_resync_actions_failed", { status: committedRes.status, reason });
        return false;
      }

      const committedData = await committedRes.json();
      if (committedData?.needsSnapshot) {
        logTelemetry("forced_resync_needs_snapshot_retry", {
          reason,
          snapshotVersion,
          actionLogBaseVersion: committedData?.actionLogBaseVersion,
        });
        return false;
      }
      const committedActions = Array.isArray(committedData.actions) ? committedData.actions : [];
      const applyResult = applyCommittedEntriesSequentially(
        committedActions,
        snapshotVersion,
        (action, entry) =>
          applyRemoteAction(action, {
            actionId: typeof entry?.id === "string" ? entry.id : undefined,
            actionVersion: typeof entry?.version === "number" ? entry.version : undefined,
          }),
      );
      if (applyResult.needsResync) {
        logTelemetry("forced_resync_apply_failed", {
          reason,
          applyFailure: applyResult.reason,
          snapshotVersion,
        });
        return false;
      }

      setOnlineActionVersion(applyResult.nextVersion);
      processedQueueRef.current.clear();
      markOnlineResyncComplete();
      logTelemetry("forced_resync_complete", {
        reason,
        snapshotVersion,
        nextVersion: applyResult.nextVersion,
      });
      return true;
    } catch {
      logTelemetry("forced_resync_exception", { reason });
      return false;
    } finally {
      resyncingRef.current = false;
    }
  }, [applyRemoteAction, loadGameState, logTelemetry, markOnlineResyncComplete, setOnlineActionVersion]);

  const uploadHostTurnSnapshot = useCallback(async (
    session: OnlineSessionSnapshot,
    actionVersion: number,
    reason: string,
  ): Promise<boolean> => {
    const latestState = useLocalGame.getState().gameState;
    if (!latestState || !Number.isFinite(actionVersion) || actionVersion <= 0) {
      requestOnlineResync(`${reason}_missing_snapshot_state`);
      return false;
    }

    try {
      const snapshotRes = await fetch(`/api/lobbies/${session.lobbyCode}/state`, {
        method: "PUT",
        headers: multiplayerJsonHeaders(),
        body: JSON.stringify({
          state: latestState,
          version: actionVersion,
          hostEpoch: session.hostEpoch,
        }),
        credentials: "include",
      });
      if (!snapshotRes.ok) {
        logTelemetry("host_snapshot_upload_failed", { status: snapshotRes.status, reason, actionVersion });
        requestOnlineResync(`${reason}_snapshot_upload_failed`);
        return false;
      }
      logTelemetry("host_snapshot_upload_complete", { reason, actionVersion });
      return true;
    } catch {
      logTelemetry("host_snapshot_upload_exception", { reason, actionVersion });
      requestOnlineResync(`${reason}_snapshot_upload_exception`);
      return false;
    }
  }, [logTelemetry, requestOnlineResync]);

  const runSyncCycle = useCallback(async (request: SyncRequest) => {
    const session = useLocalGame.getState().onlineSession;
    if (!session) return;

    const pendingResyncReason = useLocalGame.getState().onlineResyncReason;
    if (pendingResyncReason) {
      const synced = await performAuthoritativeResync(
        session as OnlineSessionSnapshot,
        pendingResyncReason,
      );
      if (synced) {
        clearOnlineResyncRequest();
      }
      return;
    }

    if (request.includeHostStatus) {
      try {
        const statusRes = await fetch(appendMultiplayerVersionQuery(`/api/lobbies/${session.lobbyCode}/host`), {
          headers: multiplayerVersionHeaders(),
          credentials: "include",
        });
        if (statusRes.ok) {
          const status = await statusRes.json();
          if (typeof status.hostUserId === "number" && typeof status.hostEpoch === "number") {
            setOnlineHost(status.hostUserId, status.hostEpoch);
          }
          if (typeof status.leaseExpired === "boolean") {
            setHostLeaseStatus(
              typeof status.hostLastSeen === "number" ? status.hostLastSeen : null,
              status.leaseExpired,
            );
          }
        }
      } catch {
        // Ignore host status errors; next sync attempt will retry.
      }
    }

    const latestSession = useLocalGame.getState().onlineSession;
    if (!latestSession) return;

    const now = Date.now();
    if (now - lastPlayerHeartbeatRef.current >= MULTIPLAYER_MAINTENANCE_INTERVAL_MS) {
      lastPlayerHeartbeatRef.current = now;
      for (const playerId of latestSession.myPlayerIds) {
        void fetch(`/api/lobbies/${latestSession.lobbyCode}/players/heartbeat`, {
          method: "POST",
          headers: multiplayerJsonHeaders(),
          body: JSON.stringify({ playerId }),
          credentials: "include",
        }).catch(() => undefined);
      }
    }

    if (latestSession.userId === latestSession.hostUserId && latestSession.authorityMode !== "public_authoritative") {
      if (now - lastHostHeartbeatRef.current >= MULTIPLAYER_MAINTENANCE_INTERVAL_MS) {
        lastHostHeartbeatRef.current = now;
        try {
          await fetch(`/api/lobbies/${latestSession.lobbyCode}/host/heartbeat`, {
            method: "POST",
            headers: multiplayerJsonHeaders(),
            body: JSON.stringify({ hostEpoch: latestSession.hostEpoch }),
            credentials: "include",
          });
        } catch {
          // Ignore heartbeat errors; next maintenance tick will retry.
        }
      }
    }

    if (!request.includeActionSync) {
      return;
    }

    if (latestSession.authorityMode === "public_authoritative") {
      const stateRes = await fetch(
        appendMultiplayerVersionQuery(`/api/lobbies/${latestSession.lobbyCode}/state?since=${latestSession.actionVersion}`),
        { headers: multiplayerVersionHeaders(), credentials: "include" },
      );
      if (!stateRes.ok) return;
      const stateData = await stateRes.json().catch(() => null);
      if (stateData?.state) {
        const snapshotVersion = getCursorFromSnapshotVersion(stateData.snapshotVersion);
        loadGameState(stateData.state, { source: 'online_public_sync', saveId: `snapshot:${snapshotVersion}` });
      }
      if (typeof stateData?.actionVersion === "number") {
        setOnlineActionVersion(stateData.actionVersion);
      }
      markOnlineResyncComplete();
      return;
    }

    if (latestSession.userId === latestSession.hostUserId) {
      const pendingRes = await fetch(
        appendMultiplayerVersionQuery(`/api/lobbies/${latestSession.lobbyCode}/actions/queue?since=${latestSession.queueVersion}`),
        { headers: multiplayerVersionHeaders(), credentials: "include" },
      );
      if (pendingRes.ok) {
        const pendingData = await pendingRes.json();
        const pendingActions = Array.isArray(pendingData.actions) ? pendingData.actions : [];
        const rejectPendingAction = async (entry: Record<string, unknown>, reason: string): Promise<boolean> => {
          if (
            typeof entry.queueVersion !== "number" ||
            typeof entry.id !== "string" ||
            typeof entry.actorId !== "string"
          ) {
            return false;
          }

          const rejectRes = await fetch(`/api/lobbies/${latestSession.lobbyCode}/actions/queue/reject`, {
            method: "POST",
            headers: multiplayerJsonHeaders(),
            body: JSON.stringify({
              queueVersion: entry.queueVersion,
              id: entry.id,
              actorId: entry.actorId,
              hostEpoch: latestSession.hostEpoch,
              reason,
            }),
            credentials: "include",
          });
          if (!rejectRes.ok) return false;
          const rejectData = await rejectRes.json().catch(() => null);
          if (typeof rejectData?.pendingVersion === "number") {
            setOnlineQueueVersion(rejectData.pendingVersion);
          }
          processedQueueRef.current.delete(entry.id);
          return true;
        };

        if (!pendingActions.length && typeof pendingData.pendingVersion === "number") {
          setOnlineQueueVersion(pendingData.pendingVersion);
        }

        for (const entry of pendingActions) {
          const pendingEntry = entry as Record<string, unknown>;
          const currentActionVersion = useLocalGame.getState().onlineSession?.actionVersion ?? latestSession.actionVersion;
          const baseActionVersion = typeof pendingEntry.baseActionVersion === "number"
            ? pendingEntry.baseActionVersion
            : null;
          if (baseActionVersion == null || baseActionVersion !== currentActionVersion) {
            const rejected = await rejectPendingAction(
              pendingEntry,
              baseActionVersion == null ? "missing_base_action_version" : "stale_pending_action",
            );
            if (!rejected) {
              requestOnlineResync("stale_pending_reject_failed");
              logTelemetry("queue_reject_failed", { actionId: pendingEntry.id });
              break;
            }
            logTelemetry("queue_rejected_stale", { actionId: pendingEntry.id, baseActionVersion, currentActionVersion });
            continue;
          }

          const state = useLocalGame.getState().gameState;
          const currentPlayerId = state?.players?.[state.currentPlayerIndex]?.id;
          if (!currentPlayerId) {
            requestOnlineResync("host_missing_current_actor");
            logTelemetry("queue_missing_current_actor", { actionId: pendingEntry.id });
            break;
          }

          if (currentPlayerId !== entry.actorId) {
            requestOnlineResync("host_queue_actor_mismatch");
            logTelemetry("queue_actor_mismatch", {
              actionId: pendingEntry.id,
              currentPlayerId,
              queuedActorId: pendingEntry.actorId,
            });
            break;
          }

          const processed = processedQueueRef.current.get(entry.id);
          if (!processed) {
            const applied = applyRemoteAction(entry.action, {
              actionId: typeof entry.id === "string" ? entry.id : undefined,
              queueVersion: typeof entry.queueVersion === "number" ? entry.queueVersion : undefined,
            });
            if (!applied) {
              await rejectPendingAction(pendingEntry, "host_apply_failed");
              requestOnlineResync("queued_action_apply_failed");
              logTelemetry("queue_apply_failed", { actionId: entry.id });
              break;
            }
            processedQueueRef.current.set(entry.id, true);
          }

          const commitRes = await fetch(`/api/lobbies/${latestSession.lobbyCode}/actions/commit`, {
            method: "POST",
            headers: multiplayerJsonHeaders(),
            body: JSON.stringify({
              action: entry.action,
              actorId: entry.actorId,
              id: entry.id,
              queueVersion: entry.queueVersion,
              hostEpoch: latestSession.hostEpoch,
            }),
            credentials: "include",
          });

          if (!commitRes.ok) {
            requestOnlineResync("host_commit_rejected");
            logTelemetry("queue_commit_failed", { status: commitRes.status, actionId: entry.id });
            break;
          }

          const commitData = await commitRes.json();
          if (typeof commitData.actionVersion === "number") {
            setOnlineActionVersion(commitData.actionVersion);
          }
          if (typeof entry.queueVersion === "number") {
            setOnlineQueueVersion(entry.queueVersion);
          }
          processedQueueRef.current.delete(entry.id);

          if (entry.action?.type === "END_TURN") {
            const latestState = useLocalGame.getState().gameState;
            if (latestState && typeof commitData.actionVersion === "number") {
              const snapshotRes = await fetch(`/api/lobbies/${latestSession.lobbyCode}/state`, {
                method: "PUT",
                headers: multiplayerJsonHeaders(),
                body: JSON.stringify({
                  state: latestState,
                  version: commitData.actionVersion,
                  hostEpoch: latestSession.hostEpoch,
                }),
                credentials: "include",
              });
              if (!snapshotRes.ok) {
                requestOnlineResync("snapshot_upload_failed");
                logTelemetry("snapshot_upload_failed", { status: snapshotRes.status });
                break;
              }
            }
          }
        }
      }
    }

    const freshSession = useLocalGame.getState().onlineSession;
    if (!freshSession) return;

    const committedRes = await fetch(
      appendMultiplayerVersionQuery(`/api/lobbies/${freshSession.lobbyCode}/actions?since=${freshSession.actionVersion}`),
      { headers: multiplayerVersionHeaders(), credentials: "include" },
    );
    if (!committedRes.ok) return;

    const committedData = await committedRes.json();
    if (committedData?.needsSnapshot) {
      logTelemetry("needs_snapshot", {
        since: freshSession.actionVersion,
        snapshotVersion: committedData.snapshotVersion,
      });
      const synced = await performAuthoritativeResync(
        freshSession as OnlineSessionSnapshot,
        "needs_snapshot",
      );
      if (!synced) {
        requestOnlineResync("needs_snapshot_retry");
      }
      return;
    }

    const actions = Array.isArray(committedData.actions) ? committedData.actions : [];
    if (!actions.length) return;
    const latestRawEndTurnVersion = getLatestRawEndTurnVersion(actions);
    const shouldUploadReplaySnapshot =
      freshSession.userId === freshSession.hostUserId && latestRawEndTurnVersion != null;

    if (!strictResyncEnabled) {
      for (const entry of actions) {
        applyRemoteAction(entry.action, {
          actionId: typeof entry.id === "string" ? entry.id : undefined,
          actionVersion: typeof entry.version === "number" ? entry.version : undefined,
        });
      }
      if (
        typeof committedData.actionVersion === "number" &&
        committedData.actionVersion > freshSession.actionVersion
      ) {
        setOnlineActionVersion(committedData.actionVersion);
      }
      if (shouldUploadReplaySnapshot) {
        await uploadHostTurnSnapshot(
          freshSession as OnlineSessionSnapshot,
          latestRawEndTurnVersion,
          "host_replayed_end_turn",
        );
      }
      return;
    }

    const applyResult = applyCommittedEntriesSequentially(
      actions,
      freshSession.actionVersion,
      (action, entry) =>
        applyRemoteAction(action, {
          actionId: typeof entry?.id === "string" ? entry.id : undefined,
          actionVersion: typeof entry?.version === "number" ? entry.version : undefined,
        }),
    );
    if (applyResult.needsResync) {
      requestOnlineResync(`committed_${applyResult.reason}`);
      logTelemetry("strict_apply_failed", { reason: applyResult.reason });
      return;
    }
    if (applyResult.nextVersion > freshSession.actionVersion) {
      setOnlineActionVersion(applyResult.nextVersion);
    }
    if (shouldUploadReplaySnapshot) {
      await uploadHostTurnSnapshot(
        freshSession as OnlineSessionSnapshot,
        latestRawEndTurnVersion,
        "host_replayed_end_turn",
      );
    }
  }, [
    applyRemoteAction,
    clearOnlineResyncRequest,
    loadGameState,
    logTelemetry,
    markOnlineResyncComplete,
    performAuthoritativeResync,
    requestOnlineResync,
    setHostLeaseStatus,
    setOnlineActionVersion,
    setOnlineHost,
    setOnlineQueueVersion,
    strictResyncEnabled,
    uploadHostTurnSnapshot,
  ]);

  const flushSync = useCallback(async (request: SyncRequest) => {
    if (!hasSyncWork(request)) return;
    if (syncingRef.current) {
      queuedSyncRef.current = mergeSyncRequests(queuedSyncRef.current, request);
      return;
    }

    syncingRef.current = true;
    try {
      await runSyncCycle(request);
    } catch {
      // Ignore sync errors; fallback timers and future realtime invalidations will retry.
    } finally {
      syncingRef.current = false;
      if (hasSyncWork(queuedSyncRef.current)) {
        const nextRequest = queuedSyncRef.current;
        queuedSyncRef.current = EMPTY_SYNC_REQUEST;
        void flushSync(nextRequest);
      }
    }
  }, [runSyncCycle]);

  const requestSync = useCallback((request: SyncRequest) => {
    void flushSync(request);
  }, [flushSync]);

  useEffect(() => {
    if (!syncLobbyCode || syncUserId == null || syncHostUserId == null) return;

    processedQueueRef.current.clear();
    queuedSyncRef.current = EMPTY_SYNC_REQUEST;

    requestSync({ includeHostStatus: true, includeActionSync: true });

    const unsubscribeRealtime = subscribeLobbyRealtime(syncLobbyCode, (event) => {
      if (event.type === "ready") {
        requestSync({ includeHostStatus: true, includeActionSync: true });
        return;
      }
      if (event.type !== "multiplayer-sync") return;

      if (event.reason === "host-claimed") {
        requestSync({ includeHostStatus: true, includeActionSync: true });
        return;
      }

      const latestSession = useLocalGame.getState().onlineSession;
      if (!latestSession || latestSession.lobbyCode !== syncLobbyCode) return;
      if (event.reason === "queue-updated" && latestSession.userId !== latestSession.hostUserId) {
        return;
      }
      requestSync({ includeHostStatus: false, includeActionSync: true });
    });

    const maintenanceInterval = setInterval(() => {
      requestSync({ includeHostStatus: true, includeActionSync: false });
    }, MULTIPLAYER_MAINTENANCE_INTERVAL_MS);

    const fallbackInterval = setInterval(() => {
      requestSync({ includeHostStatus: true, includeActionSync: true });
    }, MULTIPLAYER_FALLBACK_SYNC_INTERVAL_MS);

    return () => {
      unsubscribeRealtime();
      clearInterval(maintenanceInterval);
      clearInterval(fallbackInterval);
      queuedSyncRef.current = EMPTY_SYNC_REQUEST;
    };
  }, [
    syncLobbyCode,
    syncUserId,
    syncHostUserId,
    requestSync,
  ]);
}
