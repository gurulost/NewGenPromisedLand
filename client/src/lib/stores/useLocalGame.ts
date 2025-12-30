import { create } from "zustand";
import { GameState, PlayerState } from "@shared/types/game";
import { HexCoordinate } from "@shared/types/coordinates";
import { hexDistance } from "@shared/utils/hex";
import { gameReducer } from "@shared/logic/gameReducer";
import { MapGenerator, MapSize, MAP_SIZE_CONFIGS } from "@shared/utils/mapGenerator";
import { useGameState } from "./useGameState";
import { gameDebugger } from "../../utils/gameDebug";
import { clearAutosave } from "../autosaveStorage";
import { markAutosaveDirty, requestAutosave } from "../autosaveManager";

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

type GamePhase = 'menu' | 'playerSetup' | 'handoff' | 'playing' | 'gameOver' | 'lobbies' | 'lobbyRoom';

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
  gameState: GameState | null;
  onlineSession: OnlineSession | null;
  actionError: ActionError | null;
  hostLeaseExpired: boolean;
  hostLastSeen: number | null;

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
  const applyActionToState = (action: any): { applied: boolean; state?: GameState } => {
    const { gameState } = get();
    if (!gameState) return { applied: false };
    const newGameState = gameReducer(gameState, action);
    if (newGameState === gameState) return { applied: false };
    set({ gameState: newGameState });
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
    const { onlineSession, gameState } = get();
    if (!onlineSession) {
      const result = applyActionToState(action);
      if (result.applied && action.type === 'END_TURN') {
        useGameState.getState().setSelectedUnit(null);
        set({ gamePhase: 'handoff' });
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
    gameState: null,
    onlineSession: null,
    actionError: null,
    hostLeaseExpired: false,
    hostLastSeen: null,

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
      // Starting a new game invalidates any previous autosave resume target.
      void clearAutosave().catch(() => undefined);

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

    // Generate balanced map with faction-biased terrain generation
    const mapGenerator = new MapGenerator({
      width: mapConfig.dimensions,
      height: mapConfig.dimensions,
      seed: resolvedSeed,
      playerCount: players.length,
      mapSize: resolvedMapSize,
      minResourceDistance: 2,
      maxResourcesPerPlayer: 3
    }, playerFactions);

    const map = mapGenerator.generateMap();

    // Find city tiles from the generated map for player starting positions
    const cityTiles = map.tiles.filter(tile => tile.hasCity);

    // Assign cities to players (first cities generated are best positioned for players)
    const cities = players.map((player, index) => {
      const cityTile = cityTiles[index] || cityTiles[0]; // Fallback to first city if not enough

      return {
        id: `city-${player.id}`,
        name: `${player.name}'s Capital`,
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
          const tile = map.tiles.find(t =>
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

    const updatedPlayers = playersWithCities.map((player, index) => {
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
    };

    set({
      gameState,
      gamePhase: isOnline ? 'playing' : 'handoff'
    });

    markAutosaveDirty();
    requestAutosave(gameState, 'startLocalGame');
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
        gameState: null,
        onlineSession: null,
        hostLeaseExpired: false,
        hostLastSeen: null,
      });

      void clearAutosave().catch(() => undefined);
    },

    loadGameState: (state: GameState) => {
      const normalizedPlayers = state.players.map(applyPlayerDefaults);
      const normalizedState = { ...state, players: normalizedPlayers };
      set({
        gameState: normalizedState,
        gamePhase: 'playing'
      });
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
