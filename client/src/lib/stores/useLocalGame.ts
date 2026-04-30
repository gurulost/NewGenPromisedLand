import { create } from "zustand";
import { GameState, PlayerState } from "@shared/types/game";
import type { HexCoordinate } from "@shared/types/coordinates";
import { hexDistance } from "@shared/utils/hex";
import { resolveAction } from "@shared/logic/resolveAction";
import {
  isRuinsRewardEvent,
  isVillageEncounterEvent,
  type ResolveResult,
} from "@shared/logic/actionResolution";
import { findPathAsync } from "../pathfindingClient";
import { buildPathfindingInputs } from "../pathfindingInputs";
import { MapGenerator, MapSize, MAP_SIZE_CONFIGS } from "@shared/utils/mapGenerator";
import { getRandomCityName, resetCityNames } from "@shared/data/cityNames";
import { FactionId } from "@shared/types/faction";
import { FACTIONS } from "@shared/data/factions";
import { coerceFactionId } from "@shared/types/factionId";
import { useGameState } from "./useGameState";
import { useUnitMotionStore } from "./useUnitMotionStore";
import { gameDebugger } from "../../utils/gameDebug";
import { clearAutosave } from "../autosaveStorage";
import { markAutosaveDirty, requestAutosave } from "../autosaveManager";
import {
  getTurnPresentationPhaseForGamePhase,
  type GamePhase,
  resolveGamePhaseForState,
} from "../localGamePhases";
import { getUnitAnimationMoveSpeed, hasUnitAnimationState } from "../../utils/unitAnimationRegistry";
import { useUnitAnimationEventStore } from "./useUnitAnimationEventStore";
import {
  INITIAL_TURN_PRESENTATION_STATE,
  type TurnPresentationState,
  reduceTurnPresentation,
  resolveUiTurnPlayer,
} from "../turnPresentation";
import {
  trackGameEnded,
  trackGameLoaded,
  trackGamePhaseChanged,
  trackGameStarted,
  trackGameplayActionApplied,
  trackGameplayActionBlocked,
  trackPlayerSetupChoices,
  type GameplayActionSource,
} from "../../utils/telemetry/gameplayAnalytics";
import { normalizeTurnPlayerIndex } from "@shared/logic/turnOrder";

const applyPlayerDefaults = (player: PlayerState): PlayerState => {
  const normalized: PlayerState = { ...player };
  normalized.factionId = coerceFactionId(player.factionId) ?? player.factionId;
  normalized.modifiers = player.modifiers ?? [];
  normalized.researchedTechs = player.researchedTechs ?? [];
  normalized.researchProgress = player.researchProgress ?? 0;
  normalized.researchInspiration = player.researchInspiration ?? 0;
  normalized.citiesOwned = player.citiesOwned ?? [];
  normalized.constructionQueue = player.constructionQueue ?? [];
  normalized.visibilityMask = player.visibilityMask ?? [];
  normalized.exploredTiles = player.exploredTiles ?? [];
  normalized.abilityCooldowns = player.abilityCooldowns ?? {};
  normalized.currentResearch = player.currentResearch;
  // Diplomatic relations defaults
  normalized.atWarWith = player.atWarWith ?? [];
  normalized.alliedWith = player.alliedWith ?? [];
  normalized.tradeRoutes = player.tradeRoutes ?? [];
  return normalized;
};

type GameMode = 'standard' | 'tutorialEpisode';

interface OnlineSession {
  lobbyCode: string;
  userId: number;
  hostUserId: number;
  myPlayerIds: string[];
  // Last committed action version that this client has successfully applied.
  actionVersion: number;
  queueVersion: number;
  hostEpoch: number;
}

interface ActionError {
  id: string;
  message: string;
  level: 'warning' | 'error';
}

const canAct = (gameState: GameState | null, onlineSession: OnlineSession | null): boolean => {
  if (!onlineSession) return true;
  if (!gameState) return false;
  if (gameState.phase === 'ended' || gameState.winner) return false;
  const currentPlayer = resolveUiTurnPlayer(gameState);
  if (!currentPlayer) return false;
  if (currentPlayer.isAI) {
    return onlineSession.userId === onlineSession.hostUserId;
  }
  return onlineSession.myPlayerIds.includes(currentPlayer.id);
};

const normalizeGameStateTurnPlayer = (gameState: GameState | null): GameState | null => {
  if (!gameState || gameState.players.length === 0) return gameState;

  const normalizedIndex = normalizeTurnPlayerIndex(
    gameState.players,
    gameState.currentPlayerIndex,
  );
  if (normalizedIndex < 0 || normalizedIndex === gameState.currentPlayerIndex) {
    return gameState;
  }

  return {
    ...gameState,
    currentPlayerIndex: normalizedIndex,
  };
};

interface LocalGameStore {
  gamePhase: GamePhase;
  gameMode: GameMode;
  gameState: GameState | null;
  turnPresentation: TurnPresentationState;
  onlineSession: OnlineSession | null;
  actionError: ActionError | null;
  hostLeaseExpired: boolean;
  hostLastSeen: number | null;
  onlineResyncRequestId: number;
  onlineResyncReason: string | null;
  lastOnlineResyncAt: number | null;
  isGeneratingMap: boolean;

  setGamePhase: (phase: GamePhase) => void;
  setGameState: (state: GameState | null) => void;
  beginTurnPresentationTransition: (player: PlayerState | null) => void;
  setOnlineSession: (session: OnlineSession) => void;
  clearOnlineSession: () => void;
  clearActionError: () => void;
  setOnlineHost: (hostUserId: number, hostEpoch: number) => void;
  setHostLeaseStatus: (lastSeen: number | null, leaseExpired: boolean) => void;
  setOnlineActionVersion: (version: number) => void;
  setOnlineQueueVersion: (version: number) => void;
  requestOnlineResync: (reason: string) => void;
  clearOnlineResyncRequest: () => void;
  markOnlineResyncComplete: () => void;
  applyRemoteAction: (
    action: any,
    options?: { actionId?: string; actionVersion?: number; queueVersion?: number }
  ) => boolean;
  startLocalGame: (playerSetup: Array<{
    id: string;
    name: string;
    factionId: string;
    turnOrder: number;
    isAI?: boolean;
    aiDifficulty?: 'easy' | 'normal' | 'hard';
  }>, mapSize?: MapSize, seed?: number) => void;
  startTutorialEpisode: () => void;
  endTurn: (playerId: string) => void;
  moveUnit: (unitId: string, targetCoordinate: any) => void;
  attackUnit: (attackerId: string, targetId: string) => void;
  useAbility: (playerId: string, abilityId: string) => void;
  dispatch: (action: any) => void;
  resetGame: () => void;
  loadGameState: (state: GameState, options?: { source?: string; saveId?: string | number }) => void;
  harvestResource: (unitId: string, resourceCoordinate: any, cityId: string) => void;
  declareWar: (targetPlayerId: string) => void;
  formAlliance: (targetPlayerId: string) => void;
  breakAlliance: (targetPlayerId: string) => void;
  establishTradeRoute: (fromCityId: string, toCityId: string) => void;
}

export const useLocalGame = create<LocalGameStore>((set, get) => {
  let mapWorker: Worker | null = null;
  let mapRequestId = 0;
  const pendingMotionTokens = new Map<string, string>();
  const createMotionToken = () => `motion_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  type TrackedAction = { type: string; payload?: any };
  type ActionTelemetryMeta = {
    actionId: string;
    actionVersion?: number | null;
    queueVersion?: number | null;
    gameState?: GameState | null;
  };

  const createActionId = (): string => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `action_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  };

  const buildActionContext = (
    actionSource: GameplayActionSource,
    meta: ActionTelemetryMeta,
  ) => {
    const state = get();
    const sourceState = meta.gameState ?? state.gameState;
    const matchId = sourceState?.id ?? 'unknown_match';
    const turnId = sourceState ? `${sourceState.id}:turn:${sourceState.turn}` : 'unknown_turn';
    return {
      actionSource,
      gameMode: state.gameMode,
      isOnline: Boolean(state.onlineSession),
      correlation: {
        actionId: meta.actionId,
        turnId,
        matchId,
        actionVersion: meta.actionVersion ?? null,
        queueVersion: meta.queueVersion ?? null,
      },
    } as const;
  };

  const dispatchClientResolveEvents = (resolution: ResolveResult): void => {
    if (typeof window === "undefined" || resolution.events.length === 0) return;

    for (const event of resolution.events) {
      if (isVillageEncounterEvent(event)) {
        window.dispatchEvent(new CustomEvent('villageEncounter', { detail: event.payload }));
        continue;
      }

      if (isRuinsRewardEvent(event)) {
        window.dispatchEvent(new CustomEvent('ruinsReward', { detail: event.payload }));
      }
    }
  };

  const syncTurnPresentation = (
    gameState: GameState | null,
    gamePhase: GamePhase,
    currentTurnPresentation: TurnPresentationState,
  ): TurnPresentationState => {
    const presentationPhase = getTurnPresentationPhaseForGamePhase(gamePhase);
    if (!presentationPhase) {
      return INITIAL_TURN_PRESENTATION_STATE;
    }

    return reduceTurnPresentation(currentTurnPresentation, {
      type: "sync",
      gameState,
      phase: presentationPhase,
    });
  };

  const clearClientInteractionState = (): void => { useGameState.setState({ selectedUnit: null, hoveredTile: null, reachableTiles: [], reachableCoordinates: [], abilityTargetMode: { isActive: false, abilityId: null, title: null, instructions: null, eligibleUnitIds: [], selectedUnitId: null, onSelectUnit: undefined }, constructionMode: { isActive: false, buildingType: null, buildingCategory: null, cityId: null, playerId: null }, spawnSelectionMode: { isActive: false, unitType: null, cityId: null, cityCoordinate: null, playerId: null, validSpawnTiles: [], onSelectTile: undefined }, isMovementMode: false, isAttackMode: false, attackableTargets: [], isRoadBuildMode: false, roadBuildUnitId: null, tileContextMenu: { isOpen: false, screenPosition: { x: 0, y: 0 }, tileCoordinate: null, options: [] } }); };

  const applyActionToState = (
    action: TrackedAction,
    actionSource: GameplayActionSource,
    telemetryMeta: ActionTelemetryMeta,
  ): { applied: boolean; state?: GameState } => {
    const { gameState, gamePhase, turnPresentation } = get();
    const previousState = normalizeGameStateTurnPlayer(gameState);
    if (!previousState) return { applied: false };
    const resolution = resolveAction(previousState, action as any, { source: 'client' });
    const newGameState = resolution.state;
    if (
      newGameState === previousState &&
      resolution.events.length === 0 &&
      resolution.messages.length === 0
    ) {
      trackGameplayActionBlocked(
        action,
        'rules_rejected',
        buildActionContext(actionSource, { ...telemetryMeta, gameState: previousState }),
        previousState
      );
      return { applied: false };
    }

    if (action.type === 'MOVE_UNIT') {
      const movingUnit = previousState.units.find(unit => unit.id === action.payload?.unitId);
      if (movingUnit && action.payload?.targetCoordinate) {
        const motionToken = createMotionToken();
        pendingMotionTokens.set(movingUnit.id, motionToken);
        useUnitMotionStore.getState().holdMotion(movingUnit.id, movingUnit.coordinate);
        const { passableTiles, tileCosts } = buildPathfindingInputs(previousState, movingUnit);
        void findPathAsync({
          start: movingUnit.coordinate,
          goal: action.payload.targetCoordinate,
          passableTiles,
          tileCosts,
          maxCost: movingUnit.remainingMovement,
        })
          .then((path) => {
            if (pendingMotionTokens.get(movingUnit.id) !== motionToken) return;
            pendingMotionTokens.delete(movingUnit.id);
            const latestState = get().gameState;
            const unitStillExists = latestState?.units.some((unit) => unit.id === movingUnit.id);
            if (!unitStillExists) {
              useUnitMotionStore.getState().stopMotion(movingUnit.id);
              return;
            }
            if (path.length > 1) {
              const moveSpeed = getUnitAnimationMoveSpeed(movingUnit.type);
              useUnitMotionStore.getState().startMotion(movingUnit.id, path, moveSpeed);
              return;
            }
            useUnitMotionStore.getState().stopMotion(movingUnit.id);
          })
          .catch((error) => {
            pendingMotionTokens.delete(movingUnit.id);
            useUnitMotionStore.getState().stopMotion(movingUnit.id);
            if (import.meta.env.DEV) {
              console.warn("Visual pathfinding failed:", error);
            }
          });
      }
    }

    const emitCelebrate = (unitId: string, unitType: any, priority = 4) => {
      if (!hasUnitAnimationState(unitType, 'celebrate')) return;
      useUnitAnimationEventStore.getState().emitEvent({
        unitId,
        unitType,
        state: 'celebrate',
        priority,
      });
    };

    if (action.type === 'ATTACK_UNIT') {
      const attackerId = action.payload?.attackerId;
      const targetId = action.payload?.targetId;
      let attacker: typeof previousState.units[number] | undefined;
      if (attackerId) {
        attacker = previousState.units.find(unit => unit.id === attackerId);
        useUnitAnimationEventStore.getState().emitEvent({
          unitId: attackerId,
          unitType: attacker?.type,
          state: 'attack',
        });
      }
      if (targetId) {
        const targetBefore = previousState.units.find(unit => unit.id === targetId);
        const targetAfter = newGameState.units.find(unit => unit.id === targetId);
        if (!targetAfter && targetBefore) {
          useUnitAnimationEventStore.getState().emitEvent({
            unitId: targetId,
            unitType: targetBefore.type,
            state: 'death',
            priority: 5,
          });
          if (attacker) {
            emitCelebrate(attacker.id, attacker.type, 4);
          }
        } else if (targetAfter) {
          useUnitAnimationEventStore.getState().emitEvent({
            unitId: targetId,
            unitType: targetAfter.type,
            state: 'hit',
          });
        }
      }
    }

    if (action.type === 'CONQUER_VILLAGE' || action.type === 'CONVERT_VILLAGE') {
      const unitId = action.payload?.unitId;
      const unit = unitId ? previousState.units.find(u => u.id === unitId) : undefined;
      if (unit) {
        emitCelebrate(unit.id, unit.type, 3);
      }
    }

    if (action.type === 'CAPTURE_CITY') {
      const playerId = action.payload?.playerId;
      const unitId = action.payload?.unitId;
      const cityId = action.payload?.cityId;
      if (playerId && cityId) {
        const city = previousState.cities?.find(c => c.id === cityId);
        if (city) {
          const celebratingUnit = unitId
            ? previousState.units.find(u => u.id === unitId && hasUnitAnimationState(u.type, 'celebrate'))
            : previousState.units.find(u =>
              u.playerId === playerId &&
              hasUnitAnimationState(u.type, 'celebrate') &&
              Math.max(
                Math.abs(u.coordinate.q - city.coordinate.q),
                Math.abs(u.coordinate.r - city.coordinate.r),
                Math.abs((u.coordinate.s || -u.coordinate.q - u.coordinate.r) - (city.coordinate.s || -city.coordinate.q - city.coordinate.r))
              ) <= 1
            );
          if (celebratingUnit) {
            emitCelebrate(celebratingUnit.id, celebratingUnit.type, 3);
          }
        }
      }
    }

    const celebrationActions = new Set([
      'START_CONSTRUCTION',
      'HARVEST_RESOURCE',
      'BUILD_ROAD',
      'CLEAR_FOREST',
    ]);

    if (celebrationActions.has(action.type)) {
      const unitId = action.payload?.unitId ?? action.payload?.builderUnitId;
      const unit = unitId ? previousState.units.find(u => u.id === unitId) : undefined;
      if (unit && hasUnitAnimationState(unit.type, 'celebrate')) {
        useUnitAnimationEventStore.getState().emitEvent({
          unitId: unit.id,
          unitType: unit.type,
          state: 'celebrate',
        });
      }
    }

    const normalizedNextGameState = normalizeGameStateTurnPlayer(newGameState) ?? newGameState;
    const nextGamePhase = resolveGamePhaseForState(gamePhase, normalizedNextGameState);
    set((state) => ({
      gameState: normalizedNextGameState,
      gamePhase: nextGamePhase,
      turnPresentation: syncTurnPresentation(
        normalizedNextGameState,
        nextGamePhase,
        state.turnPresentation ?? turnPresentation,
      ),
    }));
    dispatchClientResolveEvents(resolution);
    trackGameplayActionApplied(
      action,
      previousState,
      normalizedNextGameState,
      buildActionContext(actionSource, { ...telemetryMeta, gameState: previousState })
    );
    if (!previousState.winner && normalizedNextGameState.winner) {
      trackGameEnded({ gameState: normalizedNextGameState, source: 'victory_condition' });
    }

    const selectionStore = useGameState.getState();
    const selected = selectionStore.selectedUnit;
    if (selected) {
      const updated = newGameState.units.find(unit => unit.id === selected.id);
      if (!updated) {
        selectionStore.setSelectedUnit(null);
      } else if (updated !== selected) {
        selectionStore.syncSelectedUnit(updated);
      }
    }
    markAutosaveDirty();
    return { applied: true, state: normalizedNextGameState };
  };

  let onlineActionChain = Promise.resolve();
  const optimisticHostActionIds = new Set<string>();

  const enqueueOnlineRequest = (task: () => Promise<void>): void => {
    onlineActionChain = onlineActionChain.then(task).catch(() => undefined);
  };

  const advanceOnlineActionVersion = (version: unknown): void => { if (typeof version !== "number" || !Number.isFinite(version)) return; set((state) => !state.onlineSession || version <= state.onlineSession.actionVersion ? {} : { onlineSession: { ...state.onlineSession, actionVersion: version } }); };

  const reportActionError = (message: string, level: ActionError['level'] = 'warning'): void => {
    set({
      actionError: {
        id: createActionId(),
        message,
        level,
      },
    });
  };

  const getResponseError = async (res: Response): Promise<string> => {
    try {
      const data = await res.json();
      if (data && typeof data.error === "string") {
        return data.error;
      }
    } catch {
      // Ignore parsing errors.
    }
    return `Request failed (${res.status})`;
  };

  const submitAction = async (action: any): Promise<void> => {
    const { onlineSession, gameState, gameMode } = get();
    const onlineActionSource: GameplayActionSource = onlineSession
      ? (onlineSession.userId === onlineSession.hostUserId ? 'online_host' : 'online_guest')
      : 'local_offline';
    const actionId = createActionId();

    if (!onlineSession) {
      if (gameState?.phase === "ended") {
        reportActionError("The match has concluded. Review the final world or return to the menu.", "warning");
        return;
      }
      const result = applyActionToState(action, 'local_offline', {
        actionId,
        gameState,
      });
      if (result.applied && action.type === 'END_TURN') {
        useGameState.getState().setSelectedUnit(null);
        const nextPhase: GamePhase =
          result.state?.phase === 'ended' || result.state?.winner
            ? 'gameOver'
            : gameMode === 'tutorialEpisode'
              ? 'playing'
              : 'handoff';
        set((state) => ({
          gamePhase: nextPhase,
          turnPresentation: syncTurnPresentation(
            result.state ?? state.gameState,
            nextPhase,
            state.turnPresentation,
          ),
        }));
        if (result.state) {
          requestAutosave(result.state, 'endTurn');
        }
      }
      return;
    }

    if (!gameState) {
      trackGameplayActionBlocked(
        action,
        'game_state_not_ready',
        buildActionContext(onlineActionSource, { actionId, gameState: null }),
        null
      );
      reportActionError("Game state is not ready yet.", "warning");
      return;
    }
    if (gameState.phase === "ended") {
      trackGameplayActionBlocked(
        action,
        "game_already_concluded",
        buildActionContext(onlineActionSource, { actionId, gameState }),
        gameState,
      );
      reportActionError("The match has concluded. Review the final world or return to the menu.", "warning");
      return;
    }
    if (!canAct(gameState, onlineSession)) {
      const currentPlayer = resolveUiTurnPlayer(gameState);
      const message = currentPlayer?.isAI
        ? "AI turn in progress. Please wait for the host to finish."
        : "It is not your turn yet.";
      trackGameplayActionBlocked(
        action,
        currentPlayer?.isAI ? 'ai_turn_in_progress' : 'not_player_turn',
        buildActionContext(onlineActionSource, { actionId, gameState }),
        gameState
      );
      reportActionError(message, "warning");
      return;
    }

    const actorId = resolveUiTurnPlayer(gameState)?.id;
    if (!actorId) {
      trackGameplayActionBlocked(
        action,
        'missing_actor_id',
        buildActionContext(onlineActionSource, { actionId, gameState }),
        gameState
      );
      return;
    }

    if (onlineSession.userId === onlineSession.hostUserId) {
      const result = applyActionToState(action, 'online_host', {
        actionId,
        gameState,
      });
      if (!result.applied) {
        reportActionError("Action rejected by game rules.", "warning");
        return;
      }
      if (action.type === 'END_TURN') {
        useGameState.getState().setSelectedUnit(null);
      }
      optimisticHostActionIds.add(actionId);

      const lobbyCode = onlineSession.lobbyCode;
      const hostEpoch = onlineSession.hostEpoch;
      const snapshotState = action.type === "END_TURN" ? result.state : undefined;
      enqueueOnlineRequest(async () => {
        try {
          const res = await fetch(`/api/lobbies/${lobbyCode}/actions/commit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, actorId, id: actionId, hostEpoch }),
            credentials: "include",
          });
          if (!res.ok) {
            reportActionError(await getResponseError(res), "error");
            get().requestOnlineResync("host_commit_failed");
            return;
          }

          const data = await res.json();
          advanceOnlineActionVersion(data.actionVersion);

          if (action.type === "END_TURN" && snapshotState) {
            const snapshotRes = await fetch(`/api/lobbies/${lobbyCode}/state`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ state: snapshotState, version: data.actionVersion, hostEpoch }),
              credentials: "include",
            });
            if (!snapshotRes.ok) {
              reportActionError(await getResponseError(snapshotRes), "error");
              get().requestOnlineResync("snapshot_upload_failed");
            }
          }
        } catch {
          reportActionError("Network error while sending action.", "error");
          get().requestOnlineResync("host_commit_network_error");
        }
      });
      return;
    }

    const lobbyCode = onlineSession.lobbyCode;
    enqueueOnlineRequest(async () => {
      try {
        const res = await fetch(`/api/lobbies/${lobbyCode}/actions/queue`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, actorId, id: actionId }),
          credentials: "include",
        });
        if (!res.ok) {
          trackGameplayActionBlocked(
            action,
            'queue_rejected',
            buildActionContext(onlineActionSource, { actionId, gameState }),
            gameState
          );
          reportActionError(await getResponseError(res), "error");
        }
      } catch {
        trackGameplayActionBlocked(
          action,
          'queue_network_error',
          buildActionContext(onlineActionSource, { actionId, gameState }),
          gameState
        );
        reportActionError("Network error while sending action.", "error");
      }
    });
  };

  return {
    gamePhase: 'menu',
    gameMode: 'standard',
    gameState: null,
    turnPresentation: INITIAL_TURN_PRESENTATION_STATE,
    onlineSession: null,
    actionError: null,
    hostLeaseExpired: false,
    hostLastSeen: null,
    onlineResyncRequestId: 0,
    onlineResyncReason: null,
    lastOnlineResyncAt: null,
    isGeneratingMap: false,

    setGamePhase: (phase) => {
      const previousPhase = get().gamePhase;
      gameDebugger.trackGamePhase(phase);
      gameDebugger.logUIInteraction(`Game phase changed to: ${phase}`, { phase });
      set((state) => ({
        gamePhase: phase,
        turnPresentation: syncTurnPresentation(state.gameState, phase, state.turnPresentation),
      }));
      if (previousPhase !== phase) {
        trackGamePhaseChanged(previousPhase, phase);
      }
    },

    setGameState: (state) => {
      gameDebugger.logUIInteraction(`Game state updated`, { hasState: !!state });
      const normalizedState = normalizeGameStateTurnPlayer(state);
      set((currentState) => ({
        gameState: normalizedState,
        gamePhase: resolveGamePhaseForState(currentState.gamePhase, normalizedState),
        turnPresentation: syncTurnPresentation(
          normalizedState,
          resolveGamePhaseForState(currentState.gamePhase, normalizedState),
          currentState.turnPresentation,
        ),
      }));
    },

    beginTurnPresentationTransition: (player) => {
      set((state) => ({
        turnPresentation: reduceTurnPresentation(state.turnPresentation, {
          type: "transition",
          player,
        }),
      }));
    },

    setOnlineSession: (session) => {
      optimisticHostActionIds.clear();
      set({ onlineSession: session, hostLeaseExpired: false, hostLastSeen: null });
    },

    clearOnlineSession: () => {
      optimisticHostActionIds.clear();
      set({
        onlineSession: null,
        hostLeaseExpired: false,
        hostLastSeen: null,
        onlineResyncReason: null,
      });
    },

    clearActionError: () => {
      set({ actionError: null });
    },

    setOnlineHost: (hostUserId, hostEpoch) => {
      set((state) => {
        if (!state.onlineSession) return {};
        const wasHost = state.onlineSession.userId === state.onlineSession.hostUserId;
        const isHost = state.onlineSession.userId === hostUserId;
        return {
          onlineSession: {
            ...state.onlineSession,
            hostUserId,
            hostEpoch,
            queueVersion: isHost && !wasHost ? 0 : state.onlineSession.queueVersion,
          }
        };
      });
    },

    setHostLeaseStatus: (lastSeen, leaseExpired) => {
      set({ hostLastSeen: lastSeen, hostLeaseExpired: leaseExpired });
    },

    setOnlineActionVersion: (version) => set((state) => state.onlineSession ? { onlineSession: { ...state.onlineSession, actionVersion: version } } : {}),

    setOnlineQueueVersion: (version) => set((state) => state.onlineSession ? { onlineSession: { ...state.onlineSession, queueVersion: version } } : {}),

    requestOnlineResync: (reason) => set((state) => ({ onlineResyncRequestId: state.onlineResyncRequestId + 1, onlineResyncReason: reason })),

    clearOnlineResyncRequest: () => {
      set({ onlineResyncReason: null });
    },

    markOnlineResyncComplete: () => {
      set({ lastOnlineResyncAt: Date.now() });
    },

    applyRemoteAction: (action, options) => {
      const session = get().onlineSession;
      if (session && typeof options?.actionVersion === "number" && options.actionVersion <= session.actionVersion) return true;
      if (session && session.userId === session.hostUserId && typeof options?.actionId === "string" && optimisticHostActionIds.has(options.actionId)) { advanceOnlineActionVersion(options.actionVersion); return true; }
      const result = applyActionToState(action, 'online_remote', {
        actionId: options?.actionId ?? createActionId(),
        actionVersion: options?.actionVersion ?? null,
        queueVersion: options?.queueVersion ?? null,
      });
      if (result.applied && (action.type === 'END_TURN' || action.type === 'END_TURN_RESOLUTION')) {
        useGameState.getState().setSelectedUnit(null);
      }
      return result.applied;
    },

    startLocalGame: (playerSetup, mapSize = 'normal', seed) => {
      const resolvedSeed = seed ?? Date.now();
      const isOnline = !!get().onlineSession; optimisticHostActionIds.clear(); clearClientInteractionState();
      // Starting a new standard game always exits tutorial episode mode.
      set({ gameMode: 'standard' });
      // Starting a new game invalidates any previous autosave resume target.
      void clearAutosave().catch(() => undefined);

      // Reset city name generator for fresh game
      const gameId = `local-${resolvedSeed}`;
      resetCityNames(gameId);

      // Create initial game state
      const players: PlayerState[] = playerSetup.map(setup => {
        // Canonicalize faction ids up front so all downstream faction checks are stable.
        // Fallback remains Nephites for malformed external data.
        const factionId = coerceFactionId(setup.factionId) ?? 'NEPHITES';

        return applyPlayerDefaults({
          // Faction defaults are authoritative for standard games.
          id: setup.id,
          name: setup.name,
          factionId,
          modifiers: [],
          stats: { ...FACTIONS[factionId].startingStats },
          visibilityMask: [],
          exploredTiles: [],
          isEliminated: false,
          isAI: setup.isAI ?? false,
          aiDifficulty: setup.aiDifficulty ?? 'normal',
          turnOrder: setup.turnOrder,
          stars: 10, // Starting currency
          researchedTechs: [], // No starting technologies
          researchProgress: 0,
          researchInspiration: 0,
          abilityCooldowns: {},
          constructionQueue: [],
          citiesOwned: [],
          currentResearch: undefined,
          // Diplomatic relations - start with none
          atWarWith: [],
          alliedWith: [],
          tradeRoutes: [],
          diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
        });
      });

      // Extract faction IDs for terrain generation
      const playerFactions = players.map(p => p.factionId);

      // Get map configuration based on selected size
      const resolvedMapSize = MAP_SIZE_CONFIGS[mapSize] ? mapSize : "normal";
      const mapConfig = MAP_SIZE_CONFIGS[resolvedMapSize];
      trackPlayerSetupChoices(
        players.map((player) => ({
          id: player.id,
          factionId: player.factionId,
          isAI: Boolean(player.isAI),
          aiDifficulty: player.aiDifficulty,
        })),
        resolvedMapSize
      );

      const finalizeGame = (map: any, capitalPositions: HexCoordinate[]) => {
        // Find city tiles from the generated map for player starting positions
        const cityTiles = map.tiles.filter((tile: any) => tile.hasCity);
        const capitalTiles = capitalPositions
          .map(pos => map.tiles.find((tile: any) =>
            tile.coordinate.q === pos.q &&
            tile.coordinate.r === pos.r &&
            tile.coordinate.s === pos.s
          ))
          .filter((tile: any): tile is typeof cityTiles[number] => !!tile);
        const startTiles = capitalTiles.length === players.length ? capitalTiles : cityTiles;

        // Assign cities to players (first cities generated are best positioned for players)
        const cities = players.map((player, index) => {
          const cityTile = startTiles[index] || cityTiles[index] || cityTiles[0]; // Fallback to first city if not enough

          return {
            id: `city-${player.id}`,
            name: getRandomCityName(player.factionId as FactionId, gameId),
            coordinate: cityTile.coordinate,
            ownerId: player.id,
            population: 1,
            maxPopulation: 4, // Population needed to level up
            level: 1,
            starProduction: 2, // Base star production
            unrestTurns: 0,
            improvements: [],
            structures: [],
            harvestedResources: [], // Track harvested resource tiles
          };
        });

        // Update player city ownership
        const playersWithCities = players.map((player, index) => ({
          ...player,
          citiesOwned: [cities[index].id],
        }));

        // Mark starting areas around player cities as explored
        const exploreAreaAroundCity = (cityCoord: HexCoordinate, playerId: string): void => {
          const exploreRadius = 2;

          for (const tile of map.tiles) {
            const distance = hexDistance(tile.coordinate, cityCoord);
            if (distance <= exploreRadius) {
              tile.exploredBy = [...(tile.exploredBy || []), playerId];
            }
          }
        };

        // Explore areas around each player's starting city
        cities.forEach((city, index) => {
          if (index < players.length) {
            exploreAreaAroundCity(city.coordinate, players[index].id);
          }
        });

        // Generate starting units for each player near their cities
        const units: any[] = players.flatMap((player, index) => {
          const city = cities[index];
          if (!city) return [];

          // Find suitable spawn position near the city (not on the city tile itself)
          const findUnitSpawnPosition = (cityCoord: HexCoordinate): HexCoordinate => {
            const adjacentTiles = [
              { q: cityCoord.q + 1, r: cityCoord.r, s: cityCoord.s - 1 },
              { q: cityCoord.q + 1, r: cityCoord.r - 1, s: cityCoord.s },
              { q: cityCoord.q, r: cityCoord.r - 1, s: cityCoord.s + 1 },
              { q: cityCoord.q - 1, r: cityCoord.r, s: cityCoord.s + 1 },
              { q: cityCoord.q - 1, r: cityCoord.r + 1, s: cityCoord.s },
              { q: cityCoord.q, r: cityCoord.r + 1, s: cityCoord.s - 1 },
            ];

            for (const coord of adjacentTiles) {
              const tile = map.tiles.find((t: any) =>
                t.coordinate.q === coord.q && t.coordinate.r === coord.r
              );
              if (tile && tile.terrain !== 'water' && tile.terrain !== 'mountain' && !tile.hasCity) {
                return coord;
              }
            }

            // Fallback to city coordinate if no adjacent suitable tile found
            return cityCoord;
          };

          const unitPosition = findUnitSpawnPosition(city.coordinate);

          return [
            {
              id: `unit-${player.id}-1`,
              type: 'warrior' as const,
              playerId: player.id,
              coordinate: unitPosition,
              hp: 25,
              maxHp: 25,
              attack: 6,
              defense: 4,
              movement: 3,
              remainingMovement: 3,
              maxActions: 1,
              actionsRemaining: 1,
              status: 'active' as const,
              abilities: [],
              level: 1,
              experience: 0,
              visionRadius: 2,
              attackRange: 1,
              hasAttacked: false,
            }
          ];
        });

        // Set initial visibility for starting units - give vision radius around each unit
        const getVisionTiles = (centerQ: number, centerR: number, radius: number = 2) => {
          const tiles = [];
          for (let q = centerQ - radius; q <= centerQ + radius; q++) {
            for (let r = centerR - radius; r <= centerR + radius; r++) {
              const s = -q - r;
              const distance = Math.max(Math.abs(q - centerQ), Math.abs(r - centerR), Math.abs(s - (-centerQ - centerR)));
              if (distance <= radius) {
                tiles.push(`${q},${r}`);
              }
            }
          }
          return tiles;
        };

        const updatedPlayers = playersWithCities.map((player) => {
          const playerUnits = units.filter(unit => unit.playerId === player.id);
          const allVisibleTiles: string[] = [];

          // Add vision around each unit for this player
          playerUnits.forEach(unit => {
            const visionTiles = getVisionTiles(unit.coordinate.q, unit.coordinate.r, 2);
            allVisibleTiles.push(...visionTiles);
          });

          const uniqueVisibleTiles = Array.from(new Set(allVisibleTiles));

          return {
            ...player,
            visibilityMask: uniqueVisibleTiles,
            exploredTiles: uniqueVisibleTiles // Initially, explored tiles are the same as visible tiles
          };
        });

        const gameState: GameState = {
          id: `local-${resolvedSeed}`,
          rngSeed: resolvedSeed >>> 0,
          players: updatedPlayers,
          currentPlayerIndex: 0,
          turn: 1,
          phase: 'playing',
          map,
          units,
          cities,
          improvements: [],
          structures: [],
          activeEffects: [],
          lastAction: undefined,
          winner: undefined,
          victoryType: undefined,
        };

        const gamePhase: GamePhase = isOnline ? 'playing' : 'handoff';
        set({
          gameState,
          gamePhase,
          turnPresentation: syncTurnPresentation(
            gameState,
            gamePhase,
            INITIAL_TURN_PRESENTATION_STATE,
          ),
          isGeneratingMap: false,
          gameMode: 'standard',
        });

        markAutosaveDirty();
        requestAutosave(gameState, 'startLocalGame');
        trackGameStarted({
          gameState,
          gameMode: 'standard',
          mapSize: resolvedMapSize,
          isOnline,
          seed: resolvedSeed,
        });
      };

      set({ isGeneratingMap: true });

      const generateMapSync = () => {
        const mapGenerator = new MapGenerator({
          width: mapConfig.dimensions,
          height: mapConfig.dimensions,
          seed: resolvedSeed,
          playerCount: players.length,
          mapSize: resolvedMapSize,
          minResourceDistance: 2,
          maxResourcesPerPlayer: 3
        }, playerFactions);

        return {
          map: mapGenerator.generateMap(),
          capitalPositions: mapGenerator.getCapitalPositions(),
        };
      };

      const requestId = ++mapRequestId;
      const canUseWorker = typeof Worker !== "undefined";

      if (canUseWorker) {
        try {
          if (mapWorker) {
            mapWorker.terminate();
            mapWorker = null;
          }

          mapWorker = new Worker(new URL("../../workers/mapGeneratorWorker.ts", import.meta.url), { type: "module" });
        } catch (error) {
          console.warn("Failed to start map worker:", error);
          const fallback = generateMapSync();
          finalizeGame(fallback.map, fallback.capitalPositions);
          return;
        }

        const activeWorker = mapWorker;

        activeWorker.onmessage = (event: MessageEvent<any>) => {
          const { status, map, capitalPositions, message, requestId: responseId } = event.data || {};
          if (responseId !== requestId) return;

          if (status === "success") {
            finalizeGame(map, capitalPositions);
          } else {
            console.warn("Map generation worker failed:", message);
            const fallback = generateMapSync();
            finalizeGame(fallback.map, fallback.capitalPositions);
          }

          activeWorker.terminate();
          if (mapWorker === activeWorker) {
            mapWorker = null;
          }
        };

        activeWorker.onerror = () => {
          if (requestId !== mapRequestId) return;
          const fallback = generateMapSync();
          finalizeGame(fallback.map, fallback.capitalPositions);
          activeWorker.terminate();
          if (mapWorker === activeWorker) {
            mapWorker = null;
          }
        };

        activeWorker.postMessage({
          requestId,
          mapSize: resolvedMapSize,
          seed: resolvedSeed,
          playerCount: players.length,
          playerFactions,
        });

        return;
      }

      const fallback = generateMapSync();
      finalizeGame(fallback.map, fallback.capitalPositions);
    },

    startTutorialEpisode: () => {
      const resolvedSeed = 613_031; // Fixed seed: deterministic scenario layout.
      const gameId = `tutorial-episode-v1-${Date.now()}`;
      const mapSize: MapSize = 'small'; optimisticHostActionIds.clear(); clearClientInteractionState();
      // Starting a new game invalidates any previous autosave resume target.
      void clearAutosave().catch(() => undefined);
      resetCityNames(gameId);

      // Always start offline in tutorial mode.
      set({ onlineSession: null, isGeneratingMap: true });

      const playerSetup = [
        {
          id: 'tutorial-player-1',
          name: 'Nephite Leader',
          factionId: 'NEPHITES',
          turnOrder: 0,
          isAI: false,
        },
        {
          id: 'tutorial-ai-1',
          name: 'Lamanite Patrol',
          factionId: 'LAMANITES',
          turnOrder: 1,
          isAI: true,
          aiDifficulty: 'easy' as const,
        },
      ];

      const players: PlayerState[] = playerSetup.map((setup) => applyPlayerDefaults({
        id: setup.id,
        name: setup.name,
        factionId: setup.factionId,
        modifiers: [],
        stats: {
          faith: 50,
          pride: 30,
          internalDissent: 10,
        },
        visibilityMask: [],
        exploredTiles: [],
        isEliminated: false,
        isAI: setup.isAI ?? false,
        aiDifficulty: setup.aiDifficulty ?? 'normal',
        turnOrder: setup.turnOrder,
        stars: setup.id === 'tutorial-player-1' ? 15 : 10,
        researchedTechs: [],
        researchProgress: 0,
        researchInspiration: 0,
        abilityCooldowns: {},
        constructionQueue: [],
        citiesOwned: [],
        currentResearch: undefined,
        atWarWith: [],
        alliedWith: [],
        tradeRoutes: [],
        diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
      }));

      const playerFactions = playerSetup.map((p) => p.factionId);
      const mapConfig = MAP_SIZE_CONFIGS[mapSize];
      trackPlayerSetupChoices(
        playerSetup.map((player) => ({
          id: player.id,
          factionId: player.factionId,
          isAI: Boolean(player.isAI),
          aiDifficulty: player.aiDifficulty,
        })),
        mapSize
      );

      const mapGenerator = new MapGenerator({
        width: mapConfig.dimensions,
        height: mapConfig.dimensions,
        seed: resolvedSeed,
        playerCount: players.length,
        mapSize,
        minResourceDistance: 2,
        maxResourcesPerPlayer: 3,
      }, playerFactions);

      const map = mapGenerator.generateMap();
      const capitalPositions = mapGenerator.getCapitalPositions();

      // Find city tiles from the generated map for player starting positions
      const cityTiles = map.tiles.filter((tile: any) => tile.hasCity);
      const capitalTiles = capitalPositions
        .map(pos => map.tiles.find((tile: any) =>
          tile.coordinate.q === pos.q &&
          tile.coordinate.r === pos.r &&
          tile.coordinate.s === pos.s
        ))
        .filter((tile: any): tile is typeof cityTiles[number] => !!tile);
      const startTiles = capitalTiles.length === players.length ? capitalTiles : cityTiles;

      const cities = players.map((player, index) => {
        const cityTile = startTiles[index] || cityTiles[index] || cityTiles[0];
        return {
          id: `city-${player.id}`,
          name: getRandomCityName(player.factionId as FactionId, gameId),
          coordinate: cityTile.coordinate,
          ownerId: player.id,
          population: 1,
          maxPopulation: 4,
          level: 1,
          starProduction: 2,
          unrestTurns: 0,
          improvements: [],
          structures: [],
          harvestedResources: [],
        };
      });

      const playersWithCities = players.map((player, index) => ({
        ...player,
        citiesOwned: [cities[index].id],
      }));

      const exploreAreaAroundCity = (cityCoord: HexCoordinate, playerId: string): void => {
        const exploreRadius = 2;
        for (const tile of map.tiles) {
          const distance = hexDistance(tile.coordinate, cityCoord);
          if (distance <= exploreRadius) {
            tile.exploredBy = [...(tile.exploredBy || []), playerId];
          }
        }
      };

      cities.forEach((city, index) => {
        if (index < players.length) {
          exploreAreaAroundCity(city.coordinate, players[index].id);
        }
      });

      const DIRECTIONS: HexCoordinate[] = [
        { q: 1, r: 0, s: -1 },
        { q: 1, r: -1, s: 0 },
        { q: 0, r: -1, s: 1 },
        { q: -1, r: 0, s: 1 },
        { q: -1, r: 1, s: 0 },
        { q: 0, r: 1, s: -1 },
      ];

      const coordKey = (coord: HexCoordinate) => `${coord.q},${coord.r}`;
      const tileIndex = new Map<string, any>();
      map.tiles.forEach((tile: any) => tileIndex.set(coordKey(tile.coordinate), tile));

      const setTile = (coord: HexCoordinate, patch: Partial<any>) => {
        const tile = tileIndex.get(coordKey(coord));
        if (!tile) return;
        Object.assign(tile, patch);
      };

      const addCoord = (base: HexCoordinate, dir: HexCoordinate, distance: number): HexCoordinate => ({
        q: base.q + dir.q * distance,
        r: base.r + dir.r * distance,
        s: base.s + dir.s * distance,
      });

      const isPassableForTutorial = (coord: HexCoordinate): boolean => {
        const tile = tileIndex.get(coordKey(coord));
        if (!tile) return false;
        if (tile.hasCity) return false;
        if (tile.terrain === 'water' || tile.terrain === 'mountain') return false;
        return true;
      };

      const humanCity = cities.find(c => c.ownerId === 'tutorial-player-1')!;
      const humanCityCoord = humanCity.coordinate;

      const getNeighbors = (coord: HexCoordinate): HexCoordinate[] =>
        DIRECTIONS
          .map((dir) => addCoord(coord, dir, 1))
          .filter((next) => tileIndex.has(coordKey(next)));

      const getReachableFrom = (start: HexCoordinate): Set<string> => {
        const reachable = new Set<string>();
        const queue: HexCoordinate[] = [start];
        reachable.add(coordKey(start));
        while (queue.length > 0) {
          const current = queue.shift()!;
          for (const next of getNeighbors(current)) {
            const key = coordKey(next);
            if (reachable.has(key)) continue;
            if (!isPassableForTutorial(next)) continue;
            reachable.add(key);
            queue.push(next);
          }
        }
        return reachable;
      };

      const humanSpawnDir =
        DIRECTIONS.find((dir) => isPassableForTutorial(addCoord(humanCityCoord, dir, 1))) ??
        DIRECTIONS.find((dir) => tileIndex.has(coordKey(addCoord(humanCityCoord, dir, 1)))) ??
        DIRECTIONS[0];
      let humanWarriorCoord = addCoord(humanCityCoord, humanSpawnDir, 1);
      if (!isPassableForTutorial(humanWarriorCoord)) {
        const fallback = getNeighbors(humanCityCoord).find((coord) => {
          const tile = tileIndex.get(coordKey(coord));
          if (!tile) return false;
          if (tile.hasCity) return false;
          return true;
        });
        if (fallback) {
          setTile(fallback, { terrain: 'plains', resources: [], feature: undefined });
          humanWarriorCoord = fallback;
        } else {
          humanWarriorCoord = humanCityCoord;
        }
      }

      const ensureNonCityCoord = (coord: HexCoordinate): HexCoordinate => {
        const tile = tileIndex.get(coordKey(coord));
        if (!tile || !tile.hasCity) return coord;

        const passableNeighbor = getNeighbors(coord).find((next) => isPassableForTutorial(next));
        if (passableNeighbor) return passableNeighbor;

        const anyNeighbor = getNeighbors(coord).find((next) => {
          const neighborTile = tileIndex.get(coordKey(next));
          return neighborTile && !neighborTile.hasCity;
        });
        return anyNeighbor ?? coord;
      };

      const grainDir =
        DIRECTIONS.find(dir => {
          const coord = addCoord(humanCityCoord, dir, 1);
          if (coord.q === humanWarriorCoord.q && coord.r === humanWarriorCoord.r) return false;
          return isPassableForTutorial(coord);
        }) ?? DIRECTIONS[1];
      let grainPatchCoord = isPassableForTutorial(addCoord(humanCityCoord, grainDir, 1))
        ? addCoord(humanCityCoord, grainDir, 1)
        : humanWarriorCoord;
      grainPatchCoord = ensureNonCityCoord(grainPatchCoord);

      const reachableFromWarrior = getReachableFrom(humanWarriorCoord);

      const findRuinCoord = (): HexCoordinate => {
        const byCoord = (a: any, b: any) =>
          a.coordinate.q - b.coordinate.q || a.coordinate.r - b.coordinate.r;

        const candidatesAtDistance = (distance: number) =>
          map.tiles
            .filter((tile: any) => {
              if (hexDistance(tile.coordinate, humanCityCoord) !== distance) return false;
              return reachableFromWarrior.has(coordKey(tile.coordinate));
            })
            .sort(byCoord);

        // Prefer a fog-hidden ruin within 3–5 tiles of the city.
        for (const distance of [3, 4, 5]) {
          for (const tile of candidatesAtDistance(distance)) {
            if (tile.hasCity) continue;
            if (tile.terrain === 'water' || tile.terrain === 'mountain') continue;
            if (hexDistance(tile.coordinate, humanWarriorCoord) <= 2) continue;
            return tile.coordinate;
          }
        }

        // Fallback: any safe land tile in that band, even if visible.
        for (const distance of [3, 4, 5]) {
          for (const tile of candidatesAtDistance(distance)) {
            if (tile.hasCity) continue;
            if (tile.terrain === 'water' || tile.terrain === 'mountain') continue;
            return tile.coordinate;
          }
        }

        return humanWarriorCoord;
      };

      let ruinCoord = findRuinCoord();
      ruinCoord = ensureNonCityCoord(ruinCoord);

      const findVillageCoord = (): HexCoordinate => {
        const preferred = addCoord(humanCityCoord, humanSpawnDir, 4);
        if (
          isPassableForTutorial(preferred) &&
          reachableFromWarrior.has(coordKey(preferred)) &&
          hexDistance(preferred, ruinCoord) >= 2
        ) {
          return preferred;
        }
        const byCoord = (a: any, b: any) =>
          a.coordinate.q - b.coordinate.q || a.coordinate.r - b.coordinate.r;

        const candidatesAtDistance = (distance: number) =>
          map.tiles
            .filter((tile: any) => {
              if (hexDistance(tile.coordinate, humanCityCoord) !== distance) return false;
              return reachableFromWarrior.has(coordKey(tile.coordinate));
            })
            .sort(byCoord);

        for (const distance of [4, 5, 6]) {
          for (const tile of candidatesAtDistance(distance)) {
            if (tile.hasCity) continue;
            if (tile.terrain === 'water' || tile.terrain === 'mountain') continue;
            if (hexDistance(tile.coordinate, ruinCoord) < 2) continue;
            return tile.coordinate;
          }
        }

        for (const distance of [4, 5, 6]) {
          for (const tile of candidatesAtDistance(distance)) {
            if (tile.hasCity) continue;
            if (tile.terrain === 'water' || tile.terrain === 'mountain') continue;
            return tile.coordinate;
          }
        }

        return tileIndex.has(coordKey(preferred)) ? preferred : humanWarriorCoord;
      };

      let villageCoord = findVillageCoord();
      villageCoord = ensureNonCityCoord(villageCoord);

      const findEnemyCoord = (): HexCoordinate => {
        const preferred = addCoord(villageCoord, humanSpawnDir, 1);
        if (isPassableForTutorial(preferred)) return preferred;
        for (const dir of DIRECTIONS) {
          const coord = addCoord(villageCoord, dir, 1);
          if (!isPassableForTutorial(coord)) continue;
          if (coord.q === humanCityCoord.q && coord.r === humanCityCoord.r) continue;
          if (coord.q === humanWarriorCoord.q && coord.r === humanWarriorCoord.r) continue;
          return coord;
        }
        // If every adjacent tile is blocked by water/mountains, pick an existing neighbor and flatten it to plains.
        for (const dir of DIRECTIONS) {
          const coord = addCoord(villageCoord, dir, 1);
          const tile = tileIndex.get(coordKey(coord));
          if (!tile) continue;
          if (tile.hasCity) continue;
          if (coord.q === humanCityCoord.q && coord.r === humanCityCoord.r) continue;
          if (coord.q === humanWarriorCoord.q && coord.r === humanWarriorCoord.r) continue;
          return coord;
        }

        return humanWarriorCoord;
      };

      const enemyCoord = findEnemyCoord();

      // Curated tutorial tiles (deterministic).
      setTile(grainPatchCoord, {
        terrain: 'plains',
        resources: ['grain_patch', 'tutorial:episode1:grain_patch_target'],
        feature: undefined,
        cityOwner: undefined,
        captureType: undefined,
        starBonus: undefined,
      });

      setTile(ruinCoord, {
        terrain: 'plains',
        resources: ['jaredite_ruins', 'tutorial:episode1:ruin_reward:stars:15'],
        feature: undefined,
        cityOwner: undefined,
        captureType: undefined,
        starBonus: undefined,
      });

      setTile(villageCoord, {
        terrain: 'plains',
        resources: ['tutorial:episode1:village_target'],
        feature: 'village',
        cityOwner: undefined,
        captureType: undefined,
        starBonus: undefined,
      });

      // Ensure the patrol's tile is walkable (in case of edge-case terrain).
      setTile(enemyCoord, {
        terrain: 'plains',
        resources: [],
        feature: undefined,
      });

      // Find suitable spawn position near a city (not on the city tile itself).
      const findUnitSpawnPosition = (cityCoord: HexCoordinate): HexCoordinate => {
        const adjacentTiles = DIRECTIONS.map(dir => addCoord(cityCoord, dir, 1));
        for (const coord of adjacentTiles) {
          if (!isPassableForTutorial(coord)) continue;
          return coord;
        }
        return cityCoord;
      };

      const units: any[] = [];

      // Human starting warrior.
      units.push({
        id: `unit-tutorial-player-1-1`,
        type: 'warrior' as const,
        playerId: 'tutorial-player-1',
        coordinate: humanWarriorCoord,
        hp: 25,
        maxHp: 25,
        attack: 6,
        defense: 4,
        movement: 3,
        remainingMovement: 3,
        maxActions: 1,
        actionsRemaining: 1,
        status: 'active' as const,
        abilities: [],
        level: 1,
        experience: 0,
        visionRadius: 2,
        attackRange: 1,
        hasAttacked: false,
      });

      // AI capital warrior (kept far away).
      const aiCity = cities.find(c => c.ownerId === 'tutorial-ai-1')!;
      units.push({
        id: `unit-tutorial-ai-1-1`,
        type: 'warrior' as const,
        playerId: 'tutorial-ai-1',
        coordinate: findUnitSpawnPosition(aiCity.coordinate),
        hp: 25,
        maxHp: 25,
        attack: 6,
        defense: 4,
        movement: 3,
        remainingMovement: 3,
        maxActions: 1,
        actionsRemaining: 1,
        status: 'active' as const,
        abilities: [],
        level: 1,
        experience: 0,
        visionRadius: 2,
        attackRange: 1,
        hasAttacked: false,
      });

      // Stationary patrol near the tutorial village.
      units.push({
        id: `unit-tutorial-ai-1-2`,
        type: 'warrior' as const,
        playerId: 'tutorial-ai-1',
        coordinate: enemyCoord,
        hp: 25,
        maxHp: 25,
        attack: 6,
        defense: 4,
        movement: 0,
        remainingMovement: 0,
        maxActions: 1,
        actionsRemaining: 0,
        status: 'active' as const,
        abilities: [],
        level: 1,
        experience: 0,
        visionRadius: 2,
        attackRange: 1,
        hasAttacked: false,
      });

      const getVisionTiles = (centerQ: number, centerR: number, radius: number = 2) => {
        const tiles: string[] = [];
        for (let q = centerQ - radius; q <= centerQ + radius; q++) {
          for (let r = centerR - radius; r <= centerR + radius; r++) {
            const s = -q - r;
            const distance = Math.max(
              Math.abs(q - centerQ),
              Math.abs(r - centerR),
              Math.abs(s - (-centerQ - centerR))
            );
            if (distance <= radius) {
              tiles.push(`${q},${r}`);
            }
          }
        }
        return tiles;
      };

      const updatedPlayers = playersWithCities.map((player) => {
        const playerUnits = units.filter(unit => unit.playerId === player.id);
        const allVisibleTiles: string[] = [];
        playerUnits.forEach((unit) => {
          const visionTiles = getVisionTiles(unit.coordinate.q, unit.coordinate.r, 2);
          allVisibleTiles.push(...visionTiles);
        });
        const uniqueVisibleTiles = Array.from(new Set(allVisibleTiles));
        return {
          ...player,
          visibilityMask: uniqueVisibleTiles,
          exploredTiles: uniqueVisibleTiles,
        };
      });

      const gameState: GameState = {
        id: gameId,
        rngSeed: resolvedSeed >>> 0,
        players: updatedPlayers,
        currentPlayerIndex: 0,
        turn: 1,
        phase: 'playing',
        map,
        units,
        cities,
        improvements: [],
        structures: [],
        activeEffects: [],
        lastAction: undefined,
        winner: undefined,
        victoryType: undefined,
      };

      pendingMotionTokens.clear();
      useUnitMotionStore.getState().clearAll();
      useUnitAnimationEventStore.getState().clearAll();

      set({
        gameState,
        gamePhase: 'playing',
        turnPresentation: syncTurnPresentation(
          gameState,
          'playing',
          INITIAL_TURN_PRESENTATION_STATE,
        ),
        gameMode: 'tutorialEpisode',
        isGeneratingMap: false,
      });

      markAutosaveDirty();
      requestAutosave(gameState, 'startTutorialEpisode');
      trackGameStarted({
        gameState,
        gameMode: 'tutorialEpisode',
        mapSize,
        isOnline: false,
        seed: resolvedSeed,
      });
    },

    endTurn: (playerId) => {
      void submitAction({
        type: 'END_TURN' as const,
        payload: { playerId }
      });
    },

    moveUnit: (unitId, targetCoordinate) => {
      if (import.meta.env.DEV && import.meta.env.VITE_GAMEPLAY_DEBUG === "true") console.debug('Moving unit:', unitId, 'to:', targetCoordinate);
      void submitAction({
        type: 'MOVE_UNIT' as const,
        payload: { unitId, targetCoordinate }
      });
    },

    attackUnit: (attackerId: string, targetId: string) => {
      if (import.meta.env.DEV && import.meta.env.VITE_GAMEPLAY_DEBUG === "true") console.debug('Unit attacking:', attackerId, 'target:', targetId);
      void submitAction({
        type: 'ATTACK_UNIT' as const,
        payload: { attackerId, targetId }
      });
    },

    useAbility: (playerId, abilityId) => {
      void submitAction({
        type: 'USE_ABILITY' as const,
        payload: { playerId, abilityId }
      });
    },

    dispatch: (action) => {
      void submitAction(action);
    },

    resetGame: () => {
      const existingState = get().gameState;
      if (existingState && !existingState.winner) {
        trackGameEnded({ gameState: existingState, source: 'reset_to_menu' });
      }
      optimisticHostActionIds.clear(); clearClientInteractionState();
      set({
        gamePhase: 'menu',
        gameMode: 'standard',
        gameState: null,
        turnPresentation: INITIAL_TURN_PRESENTATION_STATE,
        onlineSession: null,
        hostLeaseExpired: false,
        hostLastSeen: null,
        isGeneratingMap: false,
      });

      pendingMotionTokens.clear();
      useUnitMotionStore.getState().clearAll();
      useUnitAnimationEventStore.getState().clearAll();
      void clearAutosave().catch(() => undefined);
    },

    loadGameState: (state: GameState, options) => {
      optimisticHostActionIds.clear(); clearClientInteractionState();
      const normalizedPlayers = state.players.map(applyPlayerDefaults);
      const normalizedState = normalizeGameStateTurnPlayer({
        ...state,
        players: normalizedPlayers,
      }) ?? {
        ...state,
        players: normalizedPlayers,
      };
      const nextMode: GameMode = normalizedState.id?.startsWith('tutorial-episode-')
        ? 'tutorialEpisode'
        : 'standard';
      const nextPhase = normalizedState.phase === "ended" ? "gameOver" : "playing";
      set({
        gameState: normalizedState,
        gamePhase: nextPhase,
        turnPresentation: syncTurnPresentation(
          normalizedState,
          nextPhase,
          INITIAL_TURN_PRESENTATION_STATE,
        ),
        isGeneratingMap: false,
        gameMode: nextMode,
      });
      pendingMotionTokens.clear();
      useUnitMotionStore.getState().clearAll();
      useUnitAnimationEventStore.getState().clearAll();
      markAutosaveDirty();
      requestAutosave(normalizedState, 'loadGameState');
      trackGameLoaded({
        gameState: normalizedState,
        source: options?.source ?? 'unknown',
        saveId: options?.saveId,
      });
    },

    harvestResource: (unitId, resourceCoordinate, cityId) => {
      void submitAction({
        type: 'HARVEST_RESOURCE' as const,
        payload: { unitId, resourceCoordinate, cityId }
      });
    },

    declareWar: (targetPlayerId) => {
      const { gameState } = get();
      const playerId = resolveUiTurnPlayer(gameState)?.id;
      if (!playerId) return;
      if (import.meta.env.DEV && import.meta.env.VITE_GAMEPLAY_DEBUG === "true") console.debug('🤝 Diplomacy: DECLARE_WAR', { playerId, targetPlayerId });
      void submitAction({ type: 'DECLARE_WAR', payload: { playerId, targetPlayerId } });
    },

    formAlliance: (targetPlayerId) => {
      const { gameState } = get();
      const playerId = resolveUiTurnPlayer(gameState)?.id;
      if (!playerId) return;
      if (import.meta.env.DEV && import.meta.env.VITE_GAMEPLAY_DEBUG === "true") console.debug('🤝 Diplomacy: FORM_ALLIANCE', { playerId, targetPlayerId });
      void submitAction({ type: 'FORM_ALLIANCE', payload: { playerId, targetPlayerId } });
    },

    breakAlliance: (targetPlayerId) => {
      const { gameState } = get();
      const playerId = resolveUiTurnPlayer(gameState)?.id;
      if (!playerId) return;
      if (import.meta.env.DEV && import.meta.env.VITE_GAMEPLAY_DEBUG === "true") console.debug('🤝 Diplomacy: BREAK_ALLIANCE', { playerId, targetPlayerId });
      void submitAction({ type: 'BREAK_ALLIANCE', payload: { playerId, targetPlayerId } });
    },

    establishTradeRoute: (fromCityId, toCityId) => {
      const { gameState } = get();
      const playerId = resolveUiTurnPlayer(gameState)?.id;
      if (!playerId) return;
      if (import.meta.env.DEV && import.meta.env.VITE_GAMEPLAY_DEBUG === "true") console.debug('🤝 Diplomacy: ESTABLISH_TRADE_ROUTE', { playerId, fromCityId, toCityId });
      void submitAction({ type: 'ESTABLISH_TRADE_ROUTE', payload: { playerId, fromCityId, toCityId } });
    },
  };
});
