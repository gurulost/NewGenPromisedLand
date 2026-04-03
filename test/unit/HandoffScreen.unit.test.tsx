import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import HandoffScreen from "../../client/src/components/ui/HandoffScreen";
import { useLocalGame } from "../../client/src/lib/stores/useLocalGame";
import { snapshotTurnPlayer } from "../../client/src/lib/turnPresentation";
import type { GameState, PlayerState } from "../../shared/types/game";

vi.mock("../../client/src/hooks/useHotkeys", () => ({
  useHotkeys: vi.fn(),
}));

vi.mock("../../client/src/components/primitives/GlowingButton", () => ({
  GlowingButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock("../../client/src/components/primitives/AvatarBadge", () => ({
  AvatarBadge: ({ playerName }: any) => <div data-testid="avatar-badge">{playerName}</div>,
}));

vi.mock("../../client/src/components/primitives/ContentShell", () => ({
  ContentShell: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("../../client/src/components/primitives/PanelHeader", () => ({
  PanelHeader: ({ title, description }: any) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  ),
}));

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

describe("HandoffScreen", () => {
  beforeEach(() => {
    const player1 = makePlayer({
      id: "player-1",
      name: "Player One",
      turnOrder: 0,
    });
    const player4 = makePlayer({
      id: "player-4",
      name: "Player Four",
      turnOrder: 3,
    });

    const gameState: GameState = {
      id: "handoff-regression",
      rngSeed: 1,
      players: [player1, player4],
      currentPlayerIndex: 9,
      turn: 7,
      phase: "playing",
      map: { tiles: [], width: 8, height: 8 },
      units: [],
      cities: [],
      improvements: [],
      structures: [],
      winner: undefined,
      victoryType: undefined,
    };

    useLocalGame.setState({
      gamePhase: "handoff",
      gameMode: "standard",
      gameState,
      turnPresentation: {
        phase: "handoff",
        player: snapshotTurnPlayer(player4),
      },
      onlineSession: null,
    });
  });

  it("renders the pending player from turn presentation when currentPlayerIndex is invalid", () => {
    render(<HandoffScreen />);

    expect(screen.getByText("Player Four's Turn")).toBeInTheDocument();
    expect(screen.getByTestId("handoff-start-turn-button")).toBeInTheDocument();
  });
});
