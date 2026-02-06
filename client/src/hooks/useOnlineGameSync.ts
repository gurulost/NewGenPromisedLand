import { useEffect, useRef } from "react";
import { useLocalGame } from "../lib/stores/useLocalGame";

export function useOnlineGameSync() {
  const onlineSession = useLocalGame((state) => state.onlineSession);
  const applyRemoteAction = useLocalGame((state) => state.applyRemoteAction);
  const loadGameState = useLocalGame((state) => state.loadGameState);
  const setOnlineActionVersion = useLocalGame((state) => state.setOnlineActionVersion);
  const setOnlineQueueVersion = useLocalGame((state) => state.setOnlineQueueVersion);
  const setOnlineHost = useLocalGame((state) => state.setOnlineHost);
  const setHostLeaseStatus = useLocalGame((state) => state.setHostLeaseStatus);
  const syncingRef = useRef(false);
  const processedQueueRef = useRef<Map<string, boolean>>(new Map());
  const lastHeartbeatRef = useRef(0);

  useEffect(() => {
    if (!onlineSession) return;

    let isActive = true;
    processedQueueRef.current.clear();

    const poll = async () => {
      if (!isActive || syncingRef.current) return;
      syncingRef.current = true;

      try {
        const session = useLocalGame.getState().onlineSession;
        if (!session) return;

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
                status.leaseExpired
              );
            }
          }
        } catch {
          // Ignore host status errors; next poll will retry.
        }

        const latestSession = useLocalGame.getState().onlineSession;
        if (!latestSession) return;

        if (latestSession.userId === latestSession.hostUserId) {
          const now = Date.now();
          if (now - lastHeartbeatRef.current >= 5000) {
            lastHeartbeatRef.current = now;
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
          const pendingRes = await fetch(`/api/lobbies/${latestSession.lobbyCode}/actions/queue?since=${latestSession.queueVersion}`, {
            credentials: "include",
          });
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
                // Keep out-of-turn actions queued; the server now enforces turn authority.
                continue;
              }

              const processed = processedQueueRef.current.get(entry.id);
              if (!processed) {
                const applied = applyRemoteAction(entry.action);
                if (!applied) {
                  if (typeof entry.queueVersion === "number") {
                    setOnlineQueueVersion(entry.queueVersion);
                  }
                  processedQueueRef.current.delete(entry.id);
                  continue;
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

              if (commitRes.ok) {
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
                    await fetch(`/api/lobbies/${latestSession.lobbyCode}/state`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        state: latestState,
                        version: commitData.actionVersion,
                        hostEpoch: latestSession.hostEpoch,
                      }),
                      credentials: "include",
                    });
                  }
                }
              }
            }
          }
        }

        const committedRes = await fetch(`/api/lobbies/${latestSession.lobbyCode}/actions?since=${latestSession.actionVersion}`, {
          credentials: "include",
        });
        if (!committedRes.ok) return;

        const currentState = useLocalGame.getState().gameState;
        if (!currentState) return;

        const committedData = await committedRes.json();
        if (committedData?.needsSnapshot) {
          const snapshotRes = await fetch(`/api/lobbies/${latestSession.lobbyCode}/state`, {
            credentials: "include",
          });
          if (snapshotRes.ok) {
            const snapshotData = await snapshotRes.json();
            if (snapshotData?.state) {
              loadGameState(snapshotData.state);
            }
            if (typeof snapshotData?.actionVersion === "number") {
              setOnlineActionVersion(snapshotData.actionVersion);
            }
          }
          return;
        }

        const actions = Array.isArray(committedData.actions) ? committedData.actions : [];
        for (const entry of actions) {
          applyRemoteAction(entry.action);
        }

        if (typeof committedData.actionVersion === "number" && committedData.actionVersion > latestSession.actionVersion) {
          setOnlineActionVersion(committedData.actionVersion);
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
    onlineSession,
    onlineSession?.lobbyCode,
    onlineSession?.userId,
    onlineSession?.hostUserId,
    applyRemoteAction,
    setOnlineActionVersion,
    setOnlineQueueVersion,
    setOnlineHost,
    setHostLeaseStatus,
    loadGameState,
  ]);
}
