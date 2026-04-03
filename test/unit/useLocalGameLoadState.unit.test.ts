import { beforeEach, describe, expect, it, vi } from "vitest";

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
import type { GameState, PlayerState } from "../../shared/types/game";

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

describe("useLocalGame.loadGameState", () => {
  beforeEach(() => {
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
});
