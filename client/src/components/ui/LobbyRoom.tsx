import { useState, useEffect, useMemo } from "react";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { useAuth } from "../../lib/stores/useAuth";
import { useLobby } from "../../lib/stores/useLobby";
import { ContentShell } from "../primitives/ContentShell";
import { PanelHeader } from "../primitives/PanelHeader";
import { GlowingButton } from "../primitives/GlowingButton";
import { ArrowLeft, Users, Copy, Check, UserPlus, Bot, RefreshCw, Loader2, MessageSquare } from "lucide-react";
import { FACTIONS } from "@shared/data/factions";
import { coerceFactionId } from "@shared/types/factionId";
import type { MapSize } from "@shared/utils/mapGenerator";
import { getInitialActionVersionFromLobbyConfig } from "../../hooks/onlineSyncUtils";
import { ChatPanel } from "../chat/ChatPanel";
import { useMobileUI } from "../../hooks/useMobileUI";

function SeatSlot({
  seat,
  seatIndex,
  lobbyId,
  isHost,
  userId,
}: {
  seat: { id: number; userId: number | null; playerName: string | null; factionId: string | null; isReady: boolean; isAI: boolean } | null;
  seatIndex: number;
  lobbyId: number;
  isHost: boolean;
  userId: number;
}) {
  const { claimSeat, releaseSeat, updateSeat, addAISeat } = useLobby();
  const [playerName, setPlayerName] = useState("");
  const [showClaim, setShowClaim] = useState(false);

  const isMySeat = seat?.userId === userId;
  const isEmpty = !seat;
  const isAISeat = seat?.isAI;
  const seatFactionId = coerceFactionId(seat?.factionId);
  const seatFaction = seatFactionId ? FACTIONS[seatFactionId] : null;

  const handleClaim = async () => {
    if (playerName.trim()) {
      await claimSeat(lobbyId, seatIndex, playerName.trim());
      setShowClaim(false);
      setPlayerName("");
    }
  };

  const handleRelease = async () => {
    await releaseSeat(lobbyId, seatIndex);
  };

  const handleFactionChange = async (factionId: string) => {
    await updateSeat(lobbyId, seatIndex, { factionId });
  };

  const handleToggleReady = async () => {
    if (seat) {
      await updateSeat(lobbyId, seatIndex, { isReady: !seat.isReady });
    }
  };

  const handleAddAI = async () => {
    const factions = Object.keys(FACTIONS);
    const defaultFaction = factions[seatIndex % factions.length];
    await addAISeat(lobbyId, seatIndex, defaultFaction);
  };

  return (
    <div className={`p-3 rounded border ${
      isEmpty ? "border-amber-500/20 bg-slate-800/30" :
      isAISeat ? "border-purple-500/40 bg-purple-900/20" :
      isMySeat ? "border-amber-500/50 bg-amber-900/20" :
      "border-slate-500/30 bg-slate-800/40"
    }`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-amber-500 font-mono text-sm w-5">#{seatIndex + 1}</span>
          {isEmpty ? (
            showClaim ? (
              <div className="flex gap-2 flex-1">
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Your name"
                  className="flex-1 px-2 py-1 bg-slate-800 border border-amber-500/30 rounded text-amber-100 text-sm focus:outline-none focus:border-amber-500"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleClaim()}
                />
                <GlowingButton size="sm" onClick={handleClaim} disabled={!playerName.trim()}>
                  Join
                </GlowingButton>
                <button
                  onClick={() => setShowClaim(false)}
                  className="text-amber-400 hover:text-amber-300 text-sm"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-2 items-center flex-1">
                <span className="text-amber-100/50 text-sm">Empty Seat</span>
                <div className="ml-auto flex gap-1">
                  <button
                    onClick={() => setShowClaim(true)}
                    className="text-amber-400 hover:text-amber-300 transition-colors p-1"
                    title="Claim this seat"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                  {isHost && (
                    <button
                      onClick={handleAddAI}
                      className="text-purple-400 hover:text-purple-300 transition-colors p-1"
                      title="Add AI player"
                    >
                      <Bot className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          ) : (
            <>
              <span
                className={`px-2 py-0.5 rounded text-xs text-white ${seatFaction ? "" : "bg-slate-600"}`}
                style={seatFaction ? { backgroundColor: seatFaction.color } : undefined}
              >
                {seatFaction ? seatFaction.name : (seat?.factionId || "?")}
              </span>
              <span className="text-amber-100 text-sm truncate">
                {isAISeat ? `AI: ${seat.playerName || "Bot"}` : seat.playerName || "Unknown"}
              </span>
              {seat.isReady && (
                <span className="text-green-400 text-xs">Ready</span>
              )}
            </>
          )}
        </div>
        
        {isMySeat && !isEmpty && (
          <div className="flex items-center gap-2">
            <select
              value={seat.factionId || ""}
              onChange={(e) => handleFactionChange(e.target.value)}
              className="px-2 py-1 bg-slate-800 border border-amber-500/30 rounded text-amber-100 text-xs focus:outline-none focus:border-amber-500"
            >
              <option value="">Select Faction</option>
              {Object.entries(FACTIONS).map(([id, faction]) => (
                <option key={id} value={id}>{faction.name}</option>
              ))}
            </select>
            <GlowingButton
              size="sm"
              variant={seat.isReady ? "default" : "secondary"}
              onClick={handleToggleReady}
              disabled={!seat.factionId}
            >
              {seat.isReady ? "Ready!" : "Ready?"}
            </GlowingButton>
            <button
              onClick={handleRelease}
              className="text-red-400 hover:text-red-300 text-xs"
            >
              Leave
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LobbyRoom() {
  const { setGamePhase, setOnlineSession, clearOnlineSession, startLocalGame, loadGameState } = useLocalGame();
  const { user } = useAuth();
  const { currentLobby, leaveLobby, fetchLobby, startGame, error } = useLobby();
  const { isMobileUI } = useMobileUI();
  const lobbyId = currentLobby?.id;
  const lobbyCode = currentLobby?.code;
  const lobbyStatus = currentLobby?.status;
  const lobbyGameState = currentLobby?.gameState;
  const lobbyHostUserId = currentLobby?.hostUserId;
  const userId = user?.id;
  const [copied, setCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const chatIdentity = useMemo(() => {
    if (!currentLobby || !user) return null;
    const mySeat = currentLobby.seats.find((seat) => seat.userId === user.id);
    return {
      lobbyCode: currentLobby.code,
      userId: user.id,
      userName: user.username,
      senderFactionId: mySeat?.factionId ?? undefined,
    };
  }, [currentLobby, user]);

  useEffect(() => {
    if (!currentLobby) {
      setGamePhase('lobbies');
    }
  }, [currentLobby, setGamePhase]);

  useEffect(() => {
    if (lobbyId == null) return;
    if (lobbyStatus === "playing") return;

    const interval = setInterval(() => {
      fetchLobby(lobbyId);
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchLobby, lobbyId, lobbyStatus]);

  useEffect(() => {
    if (!lobbyCode) return;
    if (lobbyStatus !== "waiting") return;

    const handleBeforeUnload = () => {
      const url = `/api/lobbies/${lobbyCode}/leave`;
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, "");
      } else {
        fetch(url, { method: "POST", credentials: "include", keepalive: true });
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [lobbyCode, lobbyStatus]);

  useEffect(() => {
    if (!lobbyCode) return;
    if (lobbyHostUserId == null) return;
    if (!lobbyGameState) return;
    if (userId == null) return;
    if (lobbyStatus !== "playing") return;

    if (import.meta.env.DEV) {
      console.log("Lobby status changed to playing, initializing game...", lobbyGameState);
    }
    const gameConfig = lobbyGameState as {
      players: Array<{ playerId?: string; userId?: number | null; name: string; factionId: string; isAI: boolean; turnOrder: number }>;
      mapSize?: string;
      seed?: number;
      hostEpoch?: number;
      actionVersion?: number;
      pendingVersion?: number;
      snapshotVersion?: number;
      snapshot?: unknown;
    };
    const playerSetup = gameConfig.players.map((p, i) => ({
      id: p.playerId || `player-${i + 1}`,
      name: p.name,
      factionId: p.factionId,
      turnOrder: p.turnOrder,
      isAI: p.isAI,
      aiDifficulty: 'normal' as const,
    }));
    const rawMapSize = gameConfig.mapSize || "normal";
    const mapSize = (rawMapSize === "medium" ? "normal" : rawMapSize) as MapSize;
    const assignments = gameConfig.players.map((p, i) => ({
      playerId: p.playerId || `player-${i + 1}`,
      userId: p.userId ?? null,
      isAI: p.isAI,
    }));
    const myPlayerIds = assignments
      .filter((assignment) => assignment.userId === userId)
      .map((assignment) => assignment.playerId);
    const initialActionVersion = getInitialActionVersionFromLobbyConfig(gameConfig);
    const isHostSession = lobbyHostUserId === userId;

    setOnlineSession({
      lobbyCode,
      userId,
      hostUserId: lobbyHostUserId,
      myPlayerIds,
      actionVersion: initialActionVersion,
      queueVersion: isHostSession ? 0 : (gameConfig.pendingVersion ?? 0),
      hostEpoch: gameConfig.hostEpoch ?? 0,
    });

    if (gameConfig.snapshot) {
      loadGameState(gameConfig.snapshot as any);
    } else {
      startLocalGame(playerSetup, mapSize, gameConfig.seed);
    }
  }, [
    lobbyCode,
    lobbyGameState,
    lobbyHostUserId,
    lobbyStatus,
    loadGameState,
    setOnlineSession,
    startLocalGame,
    userId,
  ]);

  if (!currentLobby || !user) {
    return null;
  }

  const copyCode = () => {
    navigator.clipboard.writeText(currentLobby.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isHost = currentLobby.hostUserId === user.id;

  const handleBack = async () => {
    if (isHost && !window.confirm("Leave this lobby? This will end the game for everyone.")) {
      return;
    }
    await leaveLobby();
    clearOnlineSession();
    setGamePhase('lobbies');
  };

  const seatSlots = currentLobby.status === "waiting"
    ? Array.from({ length: currentLobby.maxPlayers }, (_, i) => {
        const seat = currentLobby.seats.find(s => s.seatIndex === i);
        return { seatIndex: i, seat: seat || null };
      })
    : currentLobby.seats.map(s => ({ seatIndex: s.seatIndex, seat: s }));

  const claimedSeats = seatSlots.filter(({ seat }) => seat && (seat.userId !== null || seat.isAI));
  const allClaimedReady = claimedSeats.every(({ seat }) => seat!.isReady && seat!.factionId);
  const canStart = isHost && allClaimedReady && claimedSeats.length >= 2;

  const handleStartGame = async () => {
    setIsStarting(true);
    const result = await startGame();
    setIsStarting(false);
    if (!result) {
      console.error("Failed to start game:", error);
    }
  };

  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 p-4">
      <div className={`w-full ${isMobileUI ? "max-w-lg" : "max-w-6xl grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 items-stretch"}`}>
        <div className="min-w-0">
          <ContentShell size="lg">
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBack}
                  className="text-amber-400 hover:text-amber-300 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <PanelHeader
                  icon={<Users />}
                  title={currentLobby.name}
                  description={`${currentLobby.mapSize} map · ${currentLobby.maxPlayers} players`}
                />
              </div>

              <div className="flex items-center justify-between bg-slate-800/50 rounded p-3 border border-amber-500/20">
                <div>
                  <span className="text-amber-100/60 text-sm">Room Code: </span>
                  <span className="text-amber-300 font-mono tracking-widest text-lg">{currentLobby.code}</span>
                </div>
                <div className="flex items-center gap-2">
                  {isMobileUI && chatIdentity && (
                    <button
                      onClick={() => setShowMobileChat(true)}
                      className="text-amber-400 hover:text-amber-300 transition-colors p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 rounded"
                      title="Open chat"
                      aria-label="Open chat"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={copyCode}
                    className="text-amber-400 hover:text-amber-300 transition-colors p-2"
                    title="Copy code"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => fetchLobby(currentLobby.id)}
                    className="text-amber-400 hover:text-amber-300 transition-colors p-2"
                    title="Refresh"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-amber-200 font-medium text-sm">Players ({claimedSeats.length}/{currentLobby.maxPlayers})</h3>
                {seatSlots.map(({ seatIndex, seat }) => (
                  <SeatSlot
                    key={seatIndex}
                    seat={seat}
                    seatIndex={seatIndex}
                    lobbyId={currentLobby.id}
                    isHost={isHost}
                    userId={user.id}
                  />
                ))}
              </div>

              {isHost && (
                <GlowingButton
                  className="w-full"
                  disabled={!canStart || isStarting}
                  onClick={handleStartGame}
                >
                  {isStarting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Starting...
                    </span>
                  ) : canStart ? "Start Game" : claimedSeats.length < 2 ? "Need at least 2 players" : "Waiting for players to ready up..."}
                </GlowingButton>
              )}

              {!isHost && (
                <p className="text-amber-100/60 text-sm text-center">
                  Waiting for host to start the game...
                </p>
              )}
            </div>
          </ContentShell>
        </div>

        {!isMobileUI && chatIdentity && (
          <div className="min-w-0">
            <ChatPanel
              identity={chatIdentity}
              isOpen={true}
              participantCount={claimedSeats.length}
              roomTitle={`Lobby • ${currentLobby.code}`}
              variant="docked"
            />
          </div>
        )}
      </div>

      {isMobileUI && chatIdentity && showMobileChat && (
        <div className="fixed inset-0 z-[var(--z-modal-backdrop)] pointer-events-auto bg-black/65 backdrop-blur-sm flex items-end">
          <ChatPanel
            identity={chatIdentity}
            isOpen={showMobileChat}
            onClose={() => setShowMobileChat(false)}
            participantCount={claimedSeats.length}
            roomTitle={`Lobby • ${currentLobby.code}`}
            variant="mobile"
            className="mobile-safe-top mobile-safe-bottom h-[calc(100dvh-0.5rem)] rounded-t-2xl border border-amber-500/25"
          />
        </div>
      )}
    </div>
  );
}
