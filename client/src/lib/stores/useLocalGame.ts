import { create } from "zustand";
import { GameState, PlayerState } from "@shared/types/game";
import type { HexCoordinate } from "@shared/types/coordinates";
import { hexDistance } from "@shared/utils/hex";
import { resolveActionState } from "@shared/logic/resolveAction";
import { findPathAsync } from "../pathfindingClient";
import { buildPathfindingInputs } from "../pathfindingInputs";
import { MapGenerator, MapSize, MAP_SIZE_CONFIGS } from "@shared/utils/mapGenerator";
import { getRandomCityName, resetCityNames } from "@shared/data/cityNames";
import { FactionId } from "@shared/types/faction";
import { useGameState } from "./useGameState";
import { useUnitMotionStore } from "./useUnitMotionStore";
import { gameDebugger } from "../../utils/gameDebug";
import { clearAutosave } from "../autosaveStorage";
import { markAutosaveDirty, requestAutosave } from "../autosaveManager";
import { getUnitAnimationMoveSpeed, hasUnitAnimationState } from "../../utils/unitAnimationRegistry";
import { useUnitAnimationEventStore } from "./useUnitAnimationEventStore";

const applyPlayerDefaults = (player: PlayerState): PlayerState => {
  const normalized: PlayerState = { ...player };
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

type GamePhase =
  | 'menu'
  | 'tutorialEpisodeIntro'
  | 'playerSetup'
  | 'handoff'
  | 'playing'
  | 'gameOver'
  | 'lobbies'
  | 'lobbyRoom';
type GameMode = 'standard' | 'tutorialEpisode';

interface OnlineSession {
  lobbyCode: string;
  userId: number;
  hostUserId: number;
  myPlayerIds: string[];
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
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  if (!currentPlayer) return false;
  if (currentPlayer.isAI) {
    return onlineSession.userId === onlineSession.hostUserId;
  }
  return onlineSession.myPlayerIds.includes(currentPlayer.id);
};

interface LocalGameStore {
  gamePhase: GamePhase;
  gameMode: GameMode;
  gameState: GameState | null;
  onlineSession: OnlineSession | null;
  actionError: ActionError | null;
  hostLeaseExpired: boolean;
  hostLastSeen: number | null;
  isGeneratingMap: boolean;

  setGamePhase: (phase: GamePhase) => void;
  setGameState: (state: GameState | null) => void;
  setOnlineSession: (session: OnlineSession) => void;
  clearOnlineSession: () => void;
  clearActionError: () => void;
  setOnlineHost: (hostUserId: number, hostEpoch: number) => void;
  setHostLeaseStatus: (lastSeen: number | null, leaseExpired: boolean) => void;
  setOnlineActionVersion: (version: number) => void;
  setOnlineQueueVersion: (version: number) => void;
  applyRemoteAction: (action: any) => boolean;
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
  loadGameState: (state: GameState) => void;
  harvestResource: (unitId: string, resourceCoordinate: any, cityId: string) => void;
}

export const useLocalGame = create<LocalGameStore>((set, get) => {
  let mapWorker: Worker | null = null;
  let mapRequestId = 0;
  const pendingMotionTokens = new Map<string, string>();
  const createMotionToken = () => `motion_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const applyActionToState = (action: any): { applied: boolean; state?: GameState } => {
    const { gameState } = get();
    if (!gameState) return { applied: false };
    const newGameState = resolveActionState(gameState, action, { source: 'client' });
    if (newGameState === gameState) return { applied: false };

    if (action.type === 'MOVE_UNIT') {
      const movingUnit = gameState.units.find(unit => unit.id === action.payload?.unitId);
      if (movingUnit && action.payload?.targetCoordinate) {
        const motionToken = createMotionToken();
        pendingMotionTokens.set(movingUnit.id, motionToken);
        useUnitMotionStore.getState().holdMotion(movingUnit.id, movingUnit.coordinate);
        const { passableTiles, tileCosts } = buildPathfindingInputs(gameState, movingUnit);
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
      let attacker: typeof gameState.units[number] | undefined;
      if (attackerId) {
        attacker = gameState.units.find(unit => unit.id === attackerId);
        useUnitAnimationEventStore.getState().emitEvent({
          unitId: attackerId,
          unitType: attacker?.type,
          state: 'attack',
        });
      }
      if (targetId) {
        const targetBefore = gameState.units.find(unit => unit.id === targetId);
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
      const unit = unitId ? gameState.units.find(u => u.id === unitId) : undefined;
      if (unit) {
        emitCelebrate(unit.id, unit.type, 3);
      }
    }

    if (action.type === 'CAPTURE_CITY') {
      const playerId = action.payload?.playerId;
      const cityId = action.payload?.cityId;
      if (playerId && cityId) {
        const city = gameState.cities?.find(c => c.id === cityId);
        if (city) {
          const celebratingUnit = gameState.units.find(u =>
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
      'BUILD_IMPROVEMENT',
      'HARVEST_RESOURCE',
      'BUILD_ROAD',
      'CLEAR_FOREST',
    ]);

    if (celebrationActions.has(action.type)) {
      const unitId = action.payload?.unitId;
      const unit = unitId ? gameState.units.find(u => u.id === unitId) : undefined;
      if (unit && hasUnitAnimationState(unit.type, 'celebrate')) {
        useUnitAnimationEventStore.getState().emitEvent({
          unitId: unit.id,
          unitType: unit.type,
          state: 'celebrate',
        });
      }
    }

    set({ gameState: newGameState });
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
    return { applied: true, state: newGameState };
  };

  const createActionId = (): string => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `action_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  };

  let onlineActionChain = Promise.resolve();

  const enqueueOnlineRequest = (task: () => Promise<void>): void => {
    onlineActionChain = onlineActionChain.then(task).catch(() => undefined);
  };

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
    if (!onlineSession) {
      const result = applyActionToState(action);
      if (result.applied && action.type === 'END_TURN') {
        useGameState.getState().setSelectedUnit(null);
        set({ gamePhase: gameMode === 'tutorialEpisode' ? 'playing' : 'handoff' });
        if (result.state) {
          requestAutosave(result.state, 'endTurn');
        }
      }
      return;
    }

    if (!gameState) {
      reportActionError("Game state is not ready yet.", "warning");
      return;
    }
    if (!canAct(gameState, onlineSession)) {
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      const message = currentPlayer?.isAI
        ? "AI turn in progress. Please wait for the host to finish."
        : "It is not your turn yet.";
      reportActionError(message, "warning");
      return;
    }

    const actorId = gameState.players[gameState.currentPlayerIndex]?.id;
    if (!actorId) return;

    const actionId = createActionId();

    if (onlineSession.userId === onlineSession.hostUserId) {
      const result = applyActionToState(action);
      if (!result.applied) {
        reportActionError("Action rejected by game rules.", "warning");
        return;
      }
      if (action.type === 'END_TURN') {
        useGameState.getState().setSelectedUnit(null);
      }

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
            return;
          }

          const data = await res.json();
          set((state) => state.onlineSession
            ? { onlineSession: { ...state.onlineSession, actionVersion: data.actionVersion } }
            : {}
          );

          if (action.type === "END_TURN" && snapshotState) {
            const snapshotRes = await fetch(`/api/lobbies/${lobbyCode}/state`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ state: snapshotState, version: data.actionVersion, hostEpoch }),
              credentials: "include",
            });
            if (!snapshotRes.ok) {
              reportActionError(await getResponseError(snapshotRes), "error");
            }
          }
        } catch {
          reportActionError("Network error while sending action.", "error");
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
          reportActionError(await getResponseError(res), "error");
        }
      } catch {
        reportActionError("Network error while sending action.", "error");
      }
    });
  };

  return {
    gamePhase: 'menu',
    gameMode: 'standard',
    gameState: null,
    onlineSession: null,
    actionError: null,
    hostLeaseExpired: false,
    hostLastSeen: null,
    isGeneratingMap: false,

    setGamePhase: (phase) => {
      gameDebugger.trackGamePhase(phase);
      gameDebugger.logUIInteraction(`Game phase changed to: ${phase}`, { phase });
      set({ gamePhase: phase });
    },

    setGameState: (state) => {
      gameDebugger.logUIInteraction(`Game state updated`, { hasState: !!state });
      set({ gameState: state });
    },

    setOnlineSession: (session) => {
      set({ onlineSession: session, hostLeaseExpired: false, hostLastSeen: null });
    },

    clearOnlineSession: () => {
      set({ onlineSession: null, hostLeaseExpired: false, hostLastSeen: null });
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

    setOnlineActionVersion: (version) => {
      set((state) => state.onlineSession
        ? { onlineSession: { ...state.onlineSession, actionVersion: version } }
        : {}
      );
    },

    setOnlineQueueVersion: (version) => {
      set((state) => state.onlineSession
        ? { onlineSession: { ...state.onlineSession, queueVersion: version } }
        : {}
      );
    },

    applyRemoteAction: (action) => {
      const result = applyActionToState(action);
      if (result.applied && (action.type === 'END_TURN' || action.type === 'END_TURN_RESOLUTION')) {
        useGameState.getState().setSelectedUnit(null);
      }
      return result.applied;
    },

    startLocalGame: (playerSetup, mapSize = 'normal', seed) => {
      const resolvedSeed = seed ?? Date.now();
      const isOnline = !!get().onlineSession;
      // Starting a new standard game always exits tutorial episode mode.
      set({ gameMode: 'standard' });
      // Starting a new game invalidates any previous autosave resume target.
      void clearAutosave().catch(() => undefined);

      // Reset city name generator for fresh game
      const gameId = `local-${resolvedSeed}`;
      resetCityNames(gameId);

      // Create initial game state
      const players: PlayerState[] = playerSetup.map(setup => applyPlayerDefaults({
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
      }));

      // Extract faction IDs for terrain generation
      const playerFactions = playerSetup.map(p => p.factionId);

      // Get map configuration based on selected size
      const resolvedMapSize = MAP_SIZE_CONFIGS[mapSize] ? mapSize : "normal";
      const mapConfig = MAP_SIZE_CONFIGS[resolvedMapSize];

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
          lastAction: undefined,
          winner: undefined,
          victoryType: undefined,
        };

        set({
          gameState,
          gamePhase: isOnline ? 'playing' : 'handoff',
          isGeneratingMap: false,
          gameMode: 'standard',
        });

        markAutosaveDirty();
        requestAutosave(gameState, 'startLocalGame');
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
      const mapSize: MapSize = 'small';

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

      const humanSpawnDir = DIRECTIONS.find(dir => isPassableForTutorial(addCoord(humanCityCoord, dir, 1))) ?? DIRECTIONS[0];
      const humanWarriorCoord = isPassableForTutorial(addCoord(humanCityCoord, humanSpawnDir, 1))
        ? addCoord(humanCityCoord, humanSpawnDir, 1)
        : humanCityCoord;

      const grainDir =
        DIRECTIONS.find(dir => {
          const coord = addCoord(humanCityCoord, dir, 1);
          if (coord.q === humanWarriorCoord.q && coord.r === humanWarriorCoord.r) return false;
          return isPassableForTutorial(coord);
        }) ?? DIRECTIONS[1];
      const grainPatchCoord = isPassableForTutorial(addCoord(humanCityCoord, grainDir, 1))
        ? addCoord(humanCityCoord, grainDir, 1)
        : humanWarriorCoord;

      const findRuinCoord = (): HexCoordinate => {
        const byCoord = (a: any, b: any) =>
          a.coordinate.q - b.coordinate.q || a.coordinate.r - b.coordinate.r;

        const candidatesAtDistance = (distance: number) =>
          map.tiles
            .filter((tile: any) => hexDistance(tile.coordinate, humanCityCoord) === distance)
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

      const ruinCoord = findRuinCoord();

      const findVillageCoord = (): HexCoordinate => {
        const preferred = addCoord(humanCityCoord, humanSpawnDir, 4);
        if (isPassableForTutorial(preferred) && hexDistance(preferred, ruinCoord) >= 2) {
          return preferred;
        }
        const byCoord = (a: any, b: any) =>
          a.coordinate.q - b.coordinate.q || a.coordinate.r - b.coordinate.r;

        const candidatesAtDistance = (distance: number) =>
          map.tiles
            .filter((tile: any) => hexDistance(tile.coordinate, humanCityCoord) === distance)
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

      const villageCoord = findVillageCoord();

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

      const setTile = (coord: HexCoordinate, patch: Partial<any>) => {
        const tile = tileIndex.get(coordKey(coord));
        if (!tile) return;
        Object.assign(tile, patch);
      };

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
        gameMode: 'tutorialEpisode',
        isGeneratingMap: false,
      });

      markAutosaveDirty();
      requestAutosave(gameState, 'startTutorialEpisode');
    },

    endTurn: (playerId) => {
      void submitAction({
        type: 'END_TURN' as const,
        payload: { playerId }
      });
    },

    moveUnit: (unitId, targetCoordinate) => {
      if (import.meta.env.DEV) console.log('Moving unit:', unitId, 'to:', targetCoordinate);
      void submitAction({
        type: 'MOVE_UNIT' as const,
        payload: { unitId, targetCoordinate }
      });
    },

    attackUnit: (attackerId: string, targetId: string) => {
      if (import.meta.env.DEV) console.log('Unit attacking:', attackerId, 'target:', targetId);
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
      set({
        gamePhase: 'menu',
        gameMode: 'standard',
        gameState: null,
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

    loadGameState: (state: GameState) => {
      const normalizedPlayers = state.players.map(applyPlayerDefaults);
      const normalizedState = { ...state, players: normalizedPlayers };
      const nextMode: GameMode = normalizedState.id?.startsWith('tutorial-episode-')
        ? 'tutorialEpisode'
        : 'standard';
      set({
        gameState: normalizedState,
        gamePhase: 'playing',
        isGeneratingMap: false,
        gameMode: nextMode,
      });
      pendingMotionTokens.clear();
      useUnitMotionStore.getState().clearAll();
      useUnitAnimationEventStore.getState().clearAll();
      markAutosaveDirty();
      requestAutosave(normalizedState, 'loadGameState');
    },

    harvestResource: (unitId, resourceCoordinate, cityId) => {
      void submitAction({
        type: 'HARVEST_RESOURCE' as const,
        payload: { unitId, resourceCoordinate, cityId }
      });
    },
  };
});
