import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocalGame } from "../lib/stores/useLocalGame";
import {
  applyCommittedEntriesSequentially,
  getCursorFromSnapshotVersion,
} from "./onlineSyncUtils";

type OnlineSessionSnapshot = {
  lobbyCode: string;
  userId: number;
  hostUserId: number;
  myPlayerIds: string[];
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
      const snapshotRes = await fetch(`/api/lobbies/${session.lobbyCode}/state`, {
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

      const committedRes = await fetch(`/api/lobbies/${session.lobbyCode}/actions?since=${snapshotVersion}`, {
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
        applyRemoteAction,
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

  useEffect(() => {
    if (!syncLobbyCode || syncUserId == null || syncHostUserId == null) return;

    let isActive = true;
    processedQueueRef.current.clear();

    const poll = async () => {
      if (!isActive || syncingRef.current) return;
      syncingRef.current = true;

      try {
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

        try {
          const statusRes = await fetch(`/api/lobbies/${session.lobbyCode}/host`, {
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
          // Ignore host status errors; next poll will retry.
        }

        const latestSession = useLocalGame.getState().onlineSession;
        if (!latestSession) return;

        const now = Date.now();
        if (now - lastPlayerHeartbeatRef.current >= 5000) {
          lastPlayerHeartbeatRef.current = now;
          for (const playerId of latestSession.myPlayerIds) {
            void fetch(`/api/lobbies/${latestSession.lobbyCode}/players/heartbeat`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ playerId }),
              credentials: "include",
            }).catch(() => undefined);
          }
        }

        if (latestSession.userId === latestSession.hostUserId) {
          if (now - lastHostHeartbeatRef.current >= 5000) {
            lastHostHeartbeatRef.current = now;
            try {
              await fetch(`/api/lobbies/${latestSession.lobbyCode}/host/heartbeat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ hostEpoch: latestSession.hostEpoch }),
                credentials: "include",
              });
            } catch {
              // Ignore heartbeat errors; next poll will retry.
            }
          }
        }

        if (latestSession.userId === latestSession.hostUserId) {
          const pendingRes = await fetch(
            `/api/lobbies/${latestSession.lobbyCode}/actions/queue?since=${latestSession.queueVersion}`,
            { credentials: "include" },
          );
          if (pendingRes.ok) {
            const pendingData = await pendingRes.json();
            const pendingActions = Array.isArray(pendingData.actions) ? pendingData.actions : [];

            for (const entry of pendingActions) {
              const state = useLocalGame.getState().gameState;
              const currentPlayerId = state?.players?.[state.currentPlayerIndex]?.id;
              if (!currentPlayerId) {
                break;
              }

              if (currentPlayerId !== entry.actorId) {
                continue;
              }

              const processed = processedQueueRef.current.get(entry.id);
              if (!processed) {
                const applied = applyRemoteAction(entry.action);
                if (!applied) {
                  requestOnlineResync("queued_action_apply_failed");
                  logTelemetry("queue_apply_failed", { actionId: entry.id });
                  break;
                }
                processedQueueRef.current.set(entry.id, true);
              }

              const commitRes = await fetch(`/api/lobbies/${latestSession.lobbyCode}/actions/commit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
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
                    headers: { "Content-Type": "application/json" },
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
          `/api/lobbies/${freshSession.lobbyCode}/actions?since=${freshSession.actionVersion}`,
          { credentials: "include" },
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

        if (!strictResyncEnabled) {
          for (const entry of actions) {
            applyRemoteAction(entry.action);
          }
          if (
            typeof committedData.actionVersion === "number" &&
            committedData.actionVersion > freshSession.actionVersion
          ) {
            setOnlineActionVersion(committedData.actionVersion);
          }
          return;
        }

        const applyResult = applyCommittedEntriesSequentially(
          actions,
          freshSession.actionVersion,
          applyRemoteAction,
        );
        if (applyResult.needsResync) {
          requestOnlineResync(`committed_${applyResult.reason}`);
          logTelemetry("strict_apply_failed", { reason: applyResult.reason });
          return;
        }
        if (applyResult.nextVersion > freshSession.actionVersion) {
          setOnlineActionVersion(applyResult.nextVersion);
        }
      } catch {
        // Ignore polling errors; next poll will retry.
      } finally {
        syncingRef.current = false;
      }
    };

    poll();
    const interval = setInterval(poll, 1000);
    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [
    syncLobbyCode,
    syncUserId,
    syncHostUserId,
    applyRemoteAction,
    setOnlineActionVersion,
    setOnlineQueueVersion,
    setOnlineHost,
    setHostLeaseStatus,
    loadGameState,
    requestOnlineResync,
    clearOnlineResyncRequest,
    markOnlineResyncComplete,
    strictResyncEnabled,
    performAuthoritativeResync,
    logTelemetry,
  ]);
}
