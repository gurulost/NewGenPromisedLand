import { useState, useEffect, useMemo, useRef } from "react";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { useAuth } from "../../lib/stores/useAuth";
import { useLobby } from "../../lib/stores/useLobby";
import { ContentShell } from "../primitives/ContentShell";
import { PanelHeader } from "../primitives/PanelHeader";
import { GlowingButton } from "../primitives/GlowingButton";
import { Alert, AlertDescription } from "./alert";
import { useToastContext } from "./ToastProvider";
import { ArrowLeft, Users, Copy, Check, UserPlus, Bot, RefreshCw, Loader2, MessageSquare, AlertTriangle, X } from "lucide-react";
import { FACTIONS } from "@shared/data/factions";
import { isPublicAuthoritativeMultiplayer } from "@shared/multiplayerAuthority";
import { coerceFactionId, type FactionId } from "@shared/types/factionId";
import type { GameState } from "@shared/types/game";
import {
  getDuplicateFactionIds,
  getTakenFactionIds,
  isFactionTakenByAnotherEntry,
  type FactionAssignmentEntry,
} from "@shared/utils/factionAssignments";
import { getInitialActionVersionFromLobbyConfig } from "../../hooks/onlineSyncUtils";
import { isCompatibleMultiplayerLobbyState } from "../../lib/multiplayerVersion";
import { ChatPanel } from "../chat/ChatPanel";
import { useMobileUI } from "../../hooks/useMobileUI";
import BugReportSupportCallout from "./BugReportSupportCallout";

const DEBUG_LOBBY = import.meta.env.DEV && import.meta.env.VITE_GAMEPLAY_DEBUG === "true";

type LobbySeat = {
  id: number;
  userId: number | null;
  playerName: string | null;
  factionId: string | null;
  isReady: boolean;
  isAI: boolean;
};

function SeatSlot({
  seat,
  seatIndex,
  lobbyId,
  isHost,
  userId,
  claimedFactionEntries,
  takenFactionIds,
}: {
  seat: LobbySeat | null;
  seatIndex: number;
  lobbyId: number;
  isHost: boolean;
  userId: number;
  claimedFactionEntries: FactionAssignmentEntry[];
  takenFactionIds: Set<FactionId>;
}) {
  const { claimSeat, releaseSeat, updateSeat, addAISeat, removeAISeat } = useLobby();
  const [playerName, setPlayerName] = useState("");
  const [showClaim, setShowClaim] = useState(false);
  const [aiName, setAiName] = useState(seat?.playerName ?? "");

  useEffect(() => {
    setAiName(seat?.playerName ?? "");
  }, [seat?.id, seat?.playerName]);

  const isClaimedHumanSeat = seat?.userId != null;
  const isAISeat = Boolean(seat?.isAI);
  const isMySeat = isClaimedHumanSeat && seat?.userId === userId;
  const isEmpty = !seat || (!isClaimedHumanSeat && !isAISeat);
  const canManageAISeat = isHost && isAISeat;
  const showSeatControls = !isEmpty && (isMySeat || canManageAISeat);
  const seatFactionId = coerceFactionId(seat?.factionId);
  const seatFaction = seatFactionId ? FACTIONS[seatFactionId] : null;
  const seatHasFactionConflict = !!seat && !!seatFactionId && isFactionTakenByAnotherEntry(
    claimedFactionEntries,
    seatFactionId,
    seat.id,
  );
  const seatHasInvalidFaction = !!seat && !!seat.factionId && !seatFactionId;
  const seatHasSelectionIssue = seatHasFactionConflict || seatHasInvalidFaction;
  const validationMessage = seatHasInvalidFaction
    ? "Faction selection is invalid. Choose a valid faction."
    : seatHasFactionConflict
      ? "Faction already claimed by another seat. Choose a different faction."
      : null;
  const normalizedAiName = aiName.trim();
  const currentAiName = seat?.playerName?.trim() ?? "";
  const canSaveAiName = canManageAISeat && normalizedAiName !== currentAiName;

  const handleClaim = async () => {
    if (playerName.trim()) {
      const claimed = await claimSeat(lobbyId, seatIndex, playerName.trim());
      if (claimed) {
        setShowClaim(false);
        setPlayerName("");
      }
    }
  };

  const handleRelease = async () => {
    await releaseSeat(lobbyId, seatIndex);
  };

  const handleFactionChange = async (factionId: string) => {
    await updateSeat(lobbyId, seatIndex, { factionId: factionId || null });
  };

  const handleToggleReady = async () => {
    if (seat && seatFactionId && !seatHasSelectionIssue) {
      await updateSeat(lobbyId, seatIndex, { isReady: !seat.isReady });
    }
  };

  const handleAddAI = async () => {
    const defaultFaction = (Object.keys(FACTIONS) as FactionId[]).find(
      (factionId) => !takenFactionIds.has(factionId),
    );
    if (!defaultFaction) {
      return;
    }

    await addAISeat(lobbyId, seatIndex, defaultFaction);
  };

  const handleRenameAI = async () => {
    if (!seat || !canManageAISeat || !canSaveAiName) return;
    await updateSeat(lobbyId, seatIndex, { playerName: normalizedAiName || null });
  };

  const handleRemoveAI = async () => {
    await removeAISeat(lobbyId, seatIndex);
  };

  return (
    <div
      data-testid={`lobby-seat-${seatIndex}`}
      data-seat-state={isEmpty ? "empty" : isAISeat ? "ai" : "human"}
      className={`p-3 rounded border ${
      isEmpty ? "border-amber-500/20 bg-slate-800/30" :
      seatHasSelectionIssue ? "border-rose-500/40 bg-rose-900/20" :
      isAISeat ? "border-purple-500/40 bg-purple-900/20" :
      isMySeat ? "border-amber-500/50 bg-amber-900/20" :
      "border-slate-500/30 bg-slate-800/40"
    }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-amber-500 font-mono text-sm w-5">#{seatIndex + 1}</span>
          {isEmpty ? (
            showClaim ? (
              <div className="flex gap-2 flex-1">
                <input
                  data-testid={`lobby-seat-${seatIndex}-player-name`}
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Your name"
                  className="flex-1 px-2 py-1 bg-slate-800 border border-amber-500/30 rounded text-amber-100 text-sm focus:outline-none focus:border-amber-500"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleClaim()}
                />
                <GlowingButton
                  data-testid={`lobby-seat-${seatIndex}-join`}
                  size="sm"
                  onClick={handleClaim}
                  disabled={!playerName.trim()}
                >
                  Join
                </GlowingButton>
                <button
                  data-testid={`lobby-seat-${seatIndex}-claim-cancel`}
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
                    data-testid={`lobby-seat-${seatIndex}-claim`}
                    onClick={() => setShowClaim(true)}
                    className="text-amber-400 hover:text-amber-300 transition-colors p-1"
                    title="Claim this seat"
                    aria-label={`Claim seat ${seatIndex + 1}`}
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                  {isHost && (
                    <button
                      data-testid={`lobby-seat-${seatIndex}-add-ai`}
                      onClick={handleAddAI}
                      className="text-purple-400 hover:text-purple-300 transition-colors p-1"
                      title="Add AI player"
                      aria-label={`Add AI player to seat ${seatIndex + 1}`}
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
      </div>

      {showSeatControls && seat && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canManageAISeat && (
            <>
              <input
                data-testid={`lobby-seat-${seatIndex}-ai-name`}
                type="text"
                value={aiName}
                onChange={(e) => setAiName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleRenameAI()}
                placeholder="Bot name"
                className="min-w-[8rem] flex-1 px-2 py-1 bg-slate-800 border border-purple-500/30 rounded text-amber-100 text-xs focus:outline-none focus:border-purple-400"
              />
              <GlowingButton
                data-testid={`lobby-seat-${seatIndex}-rename-ai`}
                size="sm"
                variant="secondary"
                onClick={handleRenameAI}
                disabled={!canSaveAiName}
              >
                Rename
              </GlowingButton>
            </>
          )}

          <select
            data-testid={`lobby-seat-${seatIndex}-faction`}
            value={seat.factionId || ""}
            onChange={(e) => handleFactionChange(e.target.value)}
            className={`px-2 py-1 bg-slate-800 border rounded text-amber-100 text-xs focus:outline-none ${
              canManageAISeat
                ? "border-purple-500/30 focus:border-purple-400"
                : "border-amber-500/30 focus:border-amber-500"
            }`}
          >
            <option value="">Select Faction</option>
            {Object.entries(FACTIONS).map(([id, faction]) => {
              const factionTaken = takenFactionIds.has(id as FactionId) && seatFactionId !== id;
              return (
                <option key={id} value={id} disabled={factionTaken}>
                  {faction.name}
                </option>
              );
            })}
          </select>

          <GlowingButton
            data-testid={`lobby-seat-${seatIndex}-ready`}
            size="sm"
            variant={seat.isReady ? "default" : "secondary"}
            onClick={handleToggleReady}
            disabled={!seatFactionId || seatHasSelectionIssue}
          >
            {seat.isReady ? "Ready!" : "Ready?"}
          </GlowingButton>

          {canManageAISeat ? (
            <button
              data-testid={`lobby-seat-${seatIndex}-remove-ai`}
              onClick={handleRemoveAI}
              className="text-red-400 hover:text-red-300 text-xs"
            >
              Remove AI
            </button>
          ) : (
            <button
              data-testid={`lobby-seat-${seatIndex}-leave`}
              onClick={handleRelease}
              className="text-red-400 hover:text-red-300 text-xs"
            >
              Leave
            </button>
          )}
        </div>
      )}

      {!isEmpty && validationMessage && (
        <p className="mt-2 text-xs text-rose-200">
          {validationMessage}
        </p>
      )}
    </div>
  );
}

export default function LobbyRoom() {
  const { setGamePhase, setOnlineSession, clearOnlineSession, loadGameState } = useLocalGame();
  const { user } = useAuth();
  const { currentLobby, leaveLobby, fetchLobby, startGame, error, clearError } = useLobby();
  const { isMobileUI } = useMobileUI();
  const toast = useToastContext();
  const { success, error: showErrorToast } = toast;
  const lobbyId = currentLobby?.id;
  const lobbyCode = currentLobby?.code;
  const lobbyStatus = currentLobby?.status;
  const lobbyGameState = currentLobby?.gameState;
  const lobbyHostUserId = currentLobby?.hostUserId;
  const userId = user?.id;
  const [copied, setCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const roomCodeRef = useRef<HTMLSpanElement | null>(null);
  const copiedResetTimeoutRef = useRef<number | null>(null);
  const lastToastedErrorRef = useRef<string | null>(null);
  const missingSnapshotToastRef = useRef(false);
  const myLobbySeat = useMemo(() => {
    if (!currentLobby || !user) return null;
    return currentLobby.seats.find((seat) => seat.userId === user.id) ?? null;
  }, [currentLobby, user]);
  const isLobbyChatParticipant = Boolean(
    currentLobby &&
    user &&
    (currentLobby.hostUserId === user.id || myLobbySeat),
  );
  const chatIdentity = useMemo(() => {
    if (!currentLobby || !user) return null;
    if (!isLobbyChatParticipant) return null;
    return {
      lobbyCode: currentLobby.code,
      userId: user.id,
      userName: user.username,
      senderFactionId: myLobbySeat?.factionId ?? undefined,
    };
  }, [currentLobby, isLobbyChatParticipant, myLobbySeat?.factionId, user]);

  useEffect(() => {
    if (!currentLobby) {
      setGamePhase('lobbies');
    }
  }, [currentLobby, setGamePhase]);

  useEffect(() => {
    return () => {
      if (copiedResetTimeoutRef.current !== null) {
        window.clearTimeout(copiedResetTimeoutRef.current);
      }
    };
  }, []);

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

    if (DEBUG_LOBBY) {
      console.debug("Lobby status changed to playing, initializing game...", lobbyGameState);
    }
    if (!isCompatibleMultiplayerLobbyState(lobbyGameState)) {
      showErrorToast(
        "Refresh required",
        "This lobby was started with a different multiplayer rules version. Refresh the game or create a new lobby.",
      );
      return;
    }
    const gameConfig = lobbyGameState as {
      players: Array<{ playerId?: string; userId?: number | null; name: string; factionId: string; isAI: boolean; turnOrder: number }>;
      multiplayerAuthorityMode?: "private_demo_hosted" | "public_authoritative";
      hostEpoch?: number;
      actionVersion?: number;
      pendingVersion?: number;
      snapshotVersion?: number;
      snapshot?: unknown;
    };
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

    if (!gameConfig.snapshot) {
      if (!missingSnapshotToastRef.current) {
        showErrorToast(
          "Waiting for game state",
          "The server has not provided the canonical match snapshot yet.",
        );
        missingSnapshotToastRef.current = true;
      }
      if (lobbyId != null) {
        void fetchLobby(lobbyId);
      }
      return;
    }
    missingSnapshotToastRef.current = false;

    setOnlineSession({
      lobbyCode,
      userId,
      hostUserId: lobbyHostUserId,
      myPlayerIds,
      authorityMode: gameConfig.multiplayerAuthorityMode ?? "private_demo_hosted",
      actionVersion: initialActionVersion,
      queueVersion: isHostSession ? 0 : (gameConfig.pendingVersion ?? 0),
      hostEpoch: gameConfig.hostEpoch ?? 0,
    });

    loadGameState(gameConfig.snapshot as GameState, { source: 'online_lobby_snapshot' });
  }, [
    fetchLobby,
    lobbyCode,
    lobbyGameState,
    lobbyHostUserId,
    lobbyId,
    lobbyStatus,
    loadGameState,
    setOnlineSession,
    showErrorToast,
    userId,
  ]);

  useEffect(() => {
    if (!error) {
      lastToastedErrorRef.current = null;
      return;
    }
    if (lastToastedErrorRef.current === error) {
      return;
    }

    toast.error("Lobby action failed", error);
    lastToastedErrorRef.current = error;
  }, [error, toast]);

  if (!currentLobby || !user) {
    return null;
  }

  const showCopiedState = () => {
    setCopied(true);
    if (copiedResetTimeoutRef.current !== null) {
      window.clearTimeout(copiedResetTimeoutRef.current);
    }
    copiedResetTimeoutRef.current = window.setTimeout(() => {
      setCopied(false);
      copiedResetTimeoutRef.current = null;
    }, 2000);
  };

  const selectRoomCode = () => {
    try {
      if (!roomCodeRef.current) return false;
      const selection = window.getSelection();
      if (!selection) return false;

      const range = document.createRange();
      range.selectNodeContents(roomCodeRef.current);
      selection.removeAllRanges();
      selection.addRange(range);

      return true;
    } catch {
      return false;
    }
  };

  const copyCode = async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }

      await navigator.clipboard.writeText(currentLobby.code);
      showCopiedState();
      success("Room code copied");
      return;
    } catch {
      const selectedRoomCode = selectRoomCode();
      const legacyCopySucceeded =
        selectedRoomCode && typeof document.execCommand === "function"
          ? (() => {
              try {
                return document.execCommand("copy");
              } catch {
                return false;
              }
            })()
          : false;

      if (legacyCopySucceeded) {
        showCopiedState();
        success("Room code copied");
        return;
      }

      setCopied(false);
      showErrorToast(
        "Copy failed",
        selectedRoomCode
          ? "Room code selected. Press Cmd+C or Ctrl+C to copy it."
          : "Clipboard access is unavailable in this browser context."
      );
    }
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
  const claimedFactionEntries = claimedSeats.map(({ seat }) => ({
    id: seat!.id,
    factionId: seat!.factionId,
  }));
  const takenFactionIds = getTakenFactionIds(claimedFactionEntries);
  const duplicateFactionIds = getDuplicateFactionIds(claimedFactionEntries);
  const duplicateFactionNames = Array.from(duplicateFactionIds).map((factionId) => FACTIONS[factionId].name);
  const allClaimedReady = claimedSeats.every(({ seat }) => seat!.isReady && coerceFactionId(seat!.factionId));
  const canStart = isHost && allClaimedReady && claimedSeats.length >= 2 && duplicateFactionIds.size === 0;
  const isPublicAuthoritativeLobby = isPublicAuthoritativeMultiplayer(
    (lobbyGameState as { multiplayerAuthorityMode?: unknown } | null | undefined)?.multiplayerAuthorityMode,
  );

  const handleStartGame = async () => {
    setIsStarting(true);
    await startGame();
    setIsStarting(false);
  };

  return (
    <div
      data-testid="lobby-room"
      data-chat-scope={isLobbyChatParticipant ? "participant" : "viewer"}
      className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 p-4"
    >
      <div className={`w-full ${isMobileUI ? "max-w-lg" : "max-w-6xl grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 items-stretch"}`}>
        <div className="min-w-0">
          <ContentShell size="lg">
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-2">
                <button
                  data-testid="lobby-back-button"
                  onClick={handleBack}
                  className="text-amber-400 hover:text-amber-300 transition-colors"
                  aria-label="Leave lobby"
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
                  <span
                    ref={roomCodeRef}
                    data-testid="lobby-room-code"
                    className="text-amber-300 font-mono tracking-widest text-lg"
                  >
                    {currentLobby.code}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isMobileUI && chatIdentity && (
                    <button
                      data-testid="lobby-open-chat"
                      onClick={() => setShowMobileChat(true)}
                      className="text-amber-400 hover:text-amber-300 transition-colors p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 rounded"
                      title="Open chat"
                      aria-label="Open chat"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    data-testid="lobby-copy-code"
                    onClick={copyCode}
                    className="text-amber-400 hover:text-amber-300 transition-colors p-2"
                    title="Copy code"
                    aria-label="Copy room code"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    data-testid="lobby-refresh"
                    onClick={() => fetchLobby(currentLobby.id)}
                    className="text-amber-400 hover:text-amber-300 transition-colors p-2"
                    title="Refresh"
                    aria-label="Refresh lobby"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <Alert
                data-testid="lobby-authority-notice"
                className="border-amber-500/30 bg-amber-950/20 text-amber-100"
              >
                <AlertTriangle className="h-4 w-4 text-amber-300" />
                <AlertDescription className="text-sm text-amber-100/85">
                  {isPublicAuthoritativeLobby
                    ? "Public unranked multiplayer is server-authoritative. The server validates turns and returns player-scoped state for each seat."
                    : "Private/demo multiplayer is host-mediated and intended for trusted, unranked matches."}
                </AlertDescription>
              </Alert>

              {error && (
                <Alert
                  data-testid="lobby-error"
                  className="border-red-500/40 bg-red-950/35 text-red-100"
                >
                  <AlertTriangle className="h-4 w-4 text-red-300" />
                  <AlertDescription className="pr-8 text-sm text-red-100">
                    {error}
                  </AlertDescription>
                  <button
                    type="button"
                    onClick={clearError}
                    className="absolute right-3 top-3 text-red-200/80 transition-colors hover:text-red-100"
                    aria-label="Dismiss lobby error"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </Alert>
              )}

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
                    claimedFactionEntries={claimedFactionEntries}
                    takenFactionIds={takenFactionIds}
                  />
                ))}
              </div>

              {(duplicateFactionNames.length > 0 || error) && (
                <div
                  data-testid="lobby-faction-conflict"
                  className="rounded border border-rose-500/35 bg-rose-900/20 px-3 py-2 text-sm text-rose-100"
                >
                  {duplicateFactionNames.length > 0 && (
                    <p>
                      Resolve duplicate factions before starting: {duplicateFactionNames.join(", ")}.
                    </p>
                  )}
                  {error && (
                    <p className={duplicateFactionNames.length > 0 ? "mt-1" : undefined}>{error}</p>
                  )}
                </div>
              )}

              <BugReportSupportCallout />

              {isHost && (
                <GlowingButton
                  data-testid="lobby-start-game"
                  className="w-full"
                  disabled={!canStart || isStarting}
                  onClick={handleStartGame}
                >
                  {isStarting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Starting...
                    </span>
                  ) : canStart ? "Start Game" : claimedSeats.length < 2 ? "Need at least 2 players" : duplicateFactionIds.size > 0 ? "Resolve duplicate factions" : "Waiting for players to ready up..."}
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
