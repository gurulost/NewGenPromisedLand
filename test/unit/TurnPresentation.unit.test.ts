import { describe, expect, it } from "vitest";
import {
  INITIAL_TURN_PRESENTATION_STATE,
  reduceTurnPresentation,
} from "../../client/src/lib/turnPresentation";
import type { GameState, PlayerState } from "../../shared/types/game";

const makePlayer = (overrides: Partial<PlayerState>): PlayerState => ({
  id: overrides.id ?? "player-1",
  name: overrides.name ?? "Player",
  factionId: overrides.factionId ?? "NEPHITES",
  stars: overrides.stars ?? 10,
  stats: overrides.stats ?? { faith: 5, pride: 2, internalDissent: 1 },
  modifiers: overrides.modifiers ?? [],
  researchedTechs: overrides.researchedTechs ?? [],
  researchProgress: overrides.researchProgress ?? 0,
  citiesOwned: overrides.citiesOwned ?? ["city-1"],
  constructionQueue: overrides.constructionQueue ?? [],
  visibilityMask: overrides.visibilityMask ?? [],
  exploredTiles: overrides.exploredTiles ?? [],
  isEliminated: overrides.isEliminated ?? false,
  turnOrder: overrides.turnOrder ?? 0,
});

describe("turn presentation state", () => {
  it("keeps the transition player through a handoff sync when the turn index is temporarily invalid", () => {
    const player4 = makePlayer({
      id: "player-4",
      name: "Player Four",
      turnOrder: 3,
    });

    const stateAfterTransition = reduceTurnPresentation(INITIAL_TURN_PRESENTATION_STATE, {
      type: "transition",
      player: player4,
    });

    const invalidHandoffState: GameState = {
      id: "turn-presentation",
      rngSeed: 1,
      players: [makePlayer({ id: "player-1" }), player4],
      currentPlayerIndex: 99,
      turn: 4,
      phase: "playing",
      map: { tiles: [], width: 8, height: 8 },
      units: [],
      cities: [],
      improvements: [],
      structures: [],
      winner: undefined,
      victoryType: undefined,
    };

    const handoffState = reduceTurnPresentation(stateAfterTransition, {
      type: "sync",
      gameState: invalidHandoffState,
      phase: "handoff",
    });

    expect(handoffState.phase).toBe("handoff");
    expect(handoffState.player?.id).toBe("player-4");
  });
});
