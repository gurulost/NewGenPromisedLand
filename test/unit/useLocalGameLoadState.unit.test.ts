import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/autosaveManager", () => ({
  markAutosaveDirty: vi.fn(),
  requestAutosave: vi.fn(),
}));

vi.mock("../../client/src/utils/telemetry/gameplayAnalytics", () => ({
  trackGameEnded: vi.fn(),
  trackGameLoaded: vi.fn(),
  trackGamePhaseChanged: vi.fn(),
  trackGameStarted: vi.fn(),
  trackGameplayActionApplied: vi.fn(),
  trackGameplayActionBlocked: vi.fn(),
  trackPlayerSetupChoices: vi.fn(),
}));

import { useLocalGame } from "../../client/src/lib/stores/useLocalGame";
import { useGameState } from "../../client/src/lib/stores/useGameState";
import type { GameState, PlayerState } from "../../shared/types/game";

const originalFetch = globalThis.fetch;

const makePlayer = (overrides: Partial<PlayerState> = {}): PlayerState => ({
  id: overrides.id ?? "player-1",
  name: overrides.name ?? "Player One",
  factionId: overrides.factionId ?? "NEPHITES",
  stars: overrides.stars ?? 10,
  stats: overrides.stats ?? { faith: 5, pride: 0, internalDissent: 0 },
  modifiers: overrides.modifiers ?? [],
  researchedTechs: overrides.researchedTechs ?? [],
  researchProgress: overrides.researchProgress ?? 0,
  researchInspiration: overrides.researchInspiration ?? 0,
  citiesOwned: overrides.citiesOwned ?? ["city-1"],
  constructionQueue: overrides.constructionQueue ?? [],
  visibilityMask: overrides.visibilityMask ?? [],
  exploredTiles: overrides.exploredTiles ?? [],
  abilityCooldowns: overrides.abilityCooldowns ?? {},
  currentResearch: overrides.currentResearch,
  isEliminated: overrides.isEliminated ?? false,
  turnOrder: overrides.turnOrder ?? 0,
  atWarWith: overrides.atWarWith ?? [],
  alliedWith: overrides.alliedWith ?? [],
  tradeRoutes: overrides.tradeRoutes ?? [],
});

const makeGameState = (overrides: Partial<GameState> = {}): GameState => ({
  id: overrides.id ?? "load-state-regression",
  rngSeed: overrides.rngSeed ?? 123,
  players: overrides.players ?? [makePlayer()],
  currentPlayerIndex: overrides.currentPlayerIndex ?? 0,
  turn: overrides.turn ?? 8,
  phase: overrides.phase ?? "playing",
  map: overrides.map ?? { tiles: [], width: 8, height: 8 },
  units: overrides.units ?? [],
  cities: overrides.cities ?? [],
  improvements: overrides.improvements ?? [],
  structures: overrides.structures ?? [],
  winner: overrides.winner,
  victoryType: overrides.victoryType,
});

const resetInteractionState = () => {
  useGameState.setState({
    selectedUnit: null,
    hoveredTile: null,
    reachableTiles: [],
    reachableCoordinates: [],
    abilityTargetMode: {
      isActive: false,
      abilityId: null,
      title: null,
      instructions: null,
      eligibleUnitIds: [],
      selectedUnitId: null,
      onSelectUnit: undefined,
    },
    constructionMode: {
      isActive: false,
      buildingType: null,
      buildingCategory: null,
      cityId: null,
      playerId: null,
    },
    spawnSelectionMode: {
      isActive: false,
      unitType: null,
      cityId: null,
      cityCoordinate: null,
      playerId: null,
      validSpawnTiles: [],
      onSelectTile: undefined,
    },
    isMovementMode: false,
    isAttackMode: false,
    attackableTargets: [],
    isRoadBuildMode: false,
    roadBuildUnitId: null,
    tileContextMenu: {
      isOpen: false,
      screenPosition: { x: 0, y: 0 },
      tileCoordinate: null,
      options: [],
    },
    showSpawnDebug: false,
  });
};

const setStaleInteractionState = () => {
  useGameState.setState({
    selectedUnit: {
      id: "stale-unit",
      type: "warrior",
      playerId: "old-player",
      coordinate: { q: 0, r: 0, s: 0 },
    } as any,
    hoveredTile: {
      x: 10,
      z: 20,
      tile: { coordinate: { q: 1, r: 0, s: -1 }, terrain: "plains" },
    } as any,
    reachableTiles: ["0,0"],
    reachableCoordinates: [{ q: 0, r: 0, s: 0 }],
    abilityTargetMode: {
      isActive: true,
      abilityId: "old-ability",
      title: "Old ability",
      instructions: "Pick a stale unit",
      eligibleUnitIds: ["stale-unit"],
      selectedUnitId: "stale-unit",
      onSelectUnit: vi.fn(),
    },
    constructionMode: {
      isActive: true,
      buildingType: "farm",
      buildingCategory: "improvements",
      cityId: "old-city",
      playerId: "old-player",
    },
    spawnSelectionMode: {
      isActive: true,
      unitType: "warrior",
      cityId: "old-city",
      cityCoordinate: { q: 0, r: 0, s: 0 },
      playerId: "old-player",
      validSpawnTiles: [{ q: 1, r: 0, s: -1 }],
      onSelectTile: vi.fn(),
    },
    isMovementMode: true,
    isAttackMode: true,
    attackableTargets: [{ q: 1, r: 0, s: -1 }],
    isRoadBuildMode: true,
    roadBuildUnitId: "stale-unit",
    tileContextMenu: {
      isOpen: true,
      screenPosition: { x: 42, y: 84 },
      tileCoordinate: { q: 0, r: 0 },
      options: [{ id: "old-option", label: "Old option", action: vi.fn() }],
    },
    showSpawnDebug: true,
  });
};

describe("useLocalGame.loadGameState", () => {
  beforeEach(() => {
    resetInteractionState();
    useLocalGame.setState({
      gamePhase: "menu",
      gameMode: "standard",
      gameState: null,
      turnPresentation: {
        phase: "idle",
        player: null,
      },
      onlineSession: null,
      actionError: null,
      hostLeaseExpired: false,
      hostLastSeen: null,
      onlineResyncRequestId: 0,
      onlineResyncReason: null,
      lastOnlineResyncAt: null,
      isGeneratingMap: false,
    });
  });

  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
    vi.restoreAllMocks();
    resetInteractionState();
  });

  it("keeps loaded ended matches in the game-over phase", () => {
    const endedState = makeGameState({
      phase: "ended",
      winner: "player-1",
      victoryType: "faith",
    });

    useLocalGame.getState().loadGameState(endedState, { source: "test" });

    const store = useLocalGame.getState();
    expect(store.gameState?.phase).toBe("ended");
    expect(store.gamePhase).toBe("gameOver");
    expect(store.turnPresentation.phase).toBe("idle");
  });

  it("keeps active saves in the playing phase", () => {
    const activeState = makeGameState();

    useLocalGame.getState().loadGameState(activeState, { source: "test" });

    const store = useLocalGame.getState();
    expect(store.gameState?.phase).toBe("playing");
    expect(store.gamePhase).toBe("playing");
    expect(store.turnPresentation.phase).toBe("idle");
  });

  it("clears transient interaction state when loading a save", () => {
    setStaleInteractionState();
    const activeState = makeGameState();

    useLocalGame.getState().loadGameState(activeState, { source: "test" });

    const interaction = useGameState.getState();
    expect(interaction.selectedUnit).toBeNull();
    expect(interaction.hoveredTile).toBeNull();
    expect(interaction.reachableTiles).toEqual([]);
    expect(interaction.reachableCoordinates).toEqual([]);
    expect(interaction.abilityTargetMode).toEqual({
      isActive: false,
      abilityId: null,
      title: null,
      instructions: null,
      eligibleUnitIds: [],
      selectedUnitId: null,
      onSelectUnit: undefined,
    });
    expect(interaction.constructionMode.isActive).toBe(false);
    expect(interaction.spawnSelectionMode).toEqual({
      isActive: false,
      unitType: null,
      cityId: null,
      cityCoordinate: null,
      playerId: null,
      validSpawnTiles: [],
      onSelectTile: undefined,
    });
    expect(interaction.isMovementMode).toBe(false);
    expect(interaction.isAttackMode).toBe(false);
    expect(interaction.attackableTargets).toEqual([]);
    expect(interaction.isRoadBuildMode).toBe(false);
    expect(interaction.roadBuildUnitId).toBeNull();
    expect(interaction.tileContextMenu.isOpen).toBe(false);
    expect(interaction.tileContextMenu.options).toEqual([]);
    expect(interaction.showSpawnDebug).toBe(true);
  });

  it("clears transient interaction state when resetting to the menu", () => {
    setStaleInteractionState();
    useLocalGame.setState({
      gameState: makeGameState(),
      gamePhase: "playing",
    });

    useLocalGame.getState().resetGame();

    const interaction = useGameState.getState();
    expect(interaction.selectedUnit).toBeNull();
    expect(interaction.abilityTargetMode.isActive).toBe(false);
    expect(interaction.spawnSelectionMode.isActive).toBe(false);
    expect(interaction.tileContextMenu.isOpen).toBe(false);
    expect(interaction.isMovementMode).toBe(false);
    expect(interaction.isAttackMode).toBe(false);
    expect(interaction.isRoadBuildMode).toBe(false);
    expect(interaction.showSpawnDebug).toBe(true);
  });

  it("does not replay host optimistic actions when the committed entry arrives first", async () => {
    let resolveCommit: (response: Response) => void = () => undefined;
    let commitStarted = false;
    const commitResponse = new Promise<Response>((resolve) => {
      resolveCommit = resolve;
    });
    const fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      if (href.includes("/actions/commit")) {
        commitStarted = true;
        expect(String(init?.body)).toContain("host-action-1");
        return commitResponse;
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      } as Response);
    });
    (globalThis as any).fetch = fetchMock;

    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("host-action-1");
    useLocalGame.setState({
      gameState: makeGameState({
        players: [
          makePlayer({ id: "player-1", turnOrder: 0 }),
          makePlayer({ id: "player-2", name: "Player Two", factionId: "LAMANITES", turnOrder: 1 }),
        ],
        currentPlayerIndex: 0,
        turn: 1,
      }),
      gamePhase: "playing",
      onlineSession: {
        lobbyCode: "ROOM",
        userId: 1,
        hostUserId: 1,
        myPlayerIds: ["player-1"],
        actionVersion: 0,
        queueVersion: 0,
        hostEpoch: 1,
      },
    });

    useLocalGame.getState().dispatch({
      type: "END_TURN",
      payload: { playerId: "player-1" },
    });

    await Promise.resolve();
    expect(commitStarted).toBe(true);

    const afterOptimistic = useLocalGame.getState().gameState;
    const applied = useLocalGame.getState().applyRemoteAction(
      { type: "END_TURN", payload: { playerId: "player-1" } },
      { actionId: "host-action-1", actionVersion: 1 },
    );

    expect(applied).toBe(true);
    expect(useLocalGame.getState().gameState?.currentPlayerIndex).toBe(afterOptimistic?.currentPlayerIndex);
    expect(useLocalGame.getState().gameState?.turn).toBe(afterOptimistic?.turn);
    expect(useLocalGame.getState().onlineSession?.actionVersion).toBe(1);

    resolveCommit({
      ok: true,
      json: async () => ({ actionVersion: 1 }),
    } as Response);
    await Promise.resolve();
    await Promise.resolve();
  });
});
