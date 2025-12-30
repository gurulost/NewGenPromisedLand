import { useEffect, useRef } from "react";
import { useLocalGame } from "../lib/stores/useLocalGame";

export function useOnlineGameSync() {
  const onlineSession = useLocalGame((state) => state.onlineSession);
  const applyRemoteAction = useLocalGame((state) => state.applyRemoteAction);
  const setOnlineActionVersion = useLocalGame((state) => state.setOnlineActionVersion);
  const setOnlineQueueVersion = useLocalGame((state) => state.setOnlineQueueVersion);
  const syncingRef = useRef(false);
  const processedQueueRef = useRef<Map<string, boolean>>(new Map());

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

        if (session.userId === session.hostUserId) {
          const pendingRes = await fetch(`/api/lobbies/${session.lobbyCode}/actions/queue?since=${session.queueVersion}`, {
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
                if (typeof entry.queueVersion === "number") {
                  setOnlineQueueVersion(entry.queueVersion);
                }
                processedQueueRef.current.delete(entry.id);
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

              const commitRes = await fetch(`/api/lobbies/${session.lobbyCode}/actions/commit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: entry.action,
                  actorId: entry.actorId,
                  id: entry.id,
                  queueVersion: entry.queueVersion,
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
                    await fetch(`/api/lobbies/${session.lobbyCode}/state`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ state: latestState, version: commitData.actionVersion }),
                      credentials: "include",
                    });
                  }
                }
              }
            }
          }
        }

        const latestSession = useLocalGame.getState().onlineSession;
        if (!latestSession) return;

        const committedRes = await fetch(`/api/lobbies/${latestSession.lobbyCode}/actions?since=${latestSession.actionVersion}`, {
          credentials: "include",
        });
        if (!committedRes.ok) return;

        const currentState = useLocalGame.getState().gameState;
        if (!currentState) return;

        const committedData = await committedRes.json();
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
  }, [onlineSession?.lobbyCode, onlineSession?.userId, onlineSession?.hostUserId, applyRemoteAction, setOnlineActionVersion, setOnlineQueueVersion]);
}
