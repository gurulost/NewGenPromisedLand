import type { ButtonHTMLAttributes, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LobbyRoom from "../client/src/components/ui/LobbyRoom";

const mockUseLobby = vi.fn();
const mockUseAuth = vi.fn();
const mockUseLocalGame = vi.fn();

vi.mock("../client/src/lib/stores/useLobby", () => ({
  useLobby: () => mockUseLobby(),
}));

vi.mock("../client/src/lib/stores/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../client/src/lib/stores/useLocalGame", () => ({
  useLocalGame: () => mockUseLocalGame(),
}));

vi.mock("../client/src/hooks/useMobileUI", () => ({
  useMobileUI: () => ({ isMobileUI: false }),
}));

vi.mock("../client/src/components/primitives/ContentShell", () => ({
  ContentShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("../client/src/components/primitives/PanelHeader", () => ({
  PanelHeader: ({ title, description }: { title: string; description?: string }) => (
    <div>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
  ),
}));

vi.mock("../client/src/components/primitives/GlowingButton", () => ({
  GlowingButton: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

vi.mock("../client/src/components/chat/ChatPanel", () => ({
  ChatPanel: () => <div data-testid="chat-panel" />,
}));

vi.mock("../client/src/components/ui/BugReportSupportCallout", () => ({
  default: () => <div data-testid="bug-report-support" />,
}));

type TestSeat = {
  id: number;
  lobbyId: number;
  seatIndex: number;
  userId: number | null;
  connectionId: string | null;
  playerName: string | null;
  factionId: string | null;
  isReady: boolean;
  isAI: boolean;
};

function buildLobby(seats: TestSeat[], overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 7,
    name: "Test Lobby",
    code: "ABCD",
    hostUserId: 1,
    maxPlayers: 4,
    mapSize: "normal",
    status: "waiting",
    gameState: null,
    createdAt: "2026-04-03T12:00:00.000Z",
    seats,
    ...overrides,
  };
}

describe("LobbyRoom faction selection", () => {
  const baseLobbyApi = {
    leaveLobby: vi.fn(),
    fetchLobby: vi.fn(),
    startGame: vi.fn(),
    claimSeat: vi.fn(),
    releaseSeat: vi.fn(),
    updateSeat: vi.fn(),
    addAISeat: vi.fn(),
    error: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAuth.mockReturnValue({
      user: { id: 1, username: "tester" },
    });

    mockUseLocalGame.mockReturnValue({
      setGamePhase: vi.fn(),
      setOnlineSession: vi.fn(),
      clearOnlineSession: vi.fn(),
      startLocalGame: vi.fn(),
      loadGameState: vi.fn(),
    });
  });

  it("disables factions already claimed by another seat", () => {
    mockUseLobby.mockReturnValue({
      ...baseLobbyApi,
      currentLobby: buildLobby([
        {
          id: 101,
          lobbyId: 7,
          seatIndex: 0,
          userId: 1,
          connectionId: null,
          playerName: "Tester",
          factionId: "NEPHITES",
          isReady: false,
          isAI: false,
        },
        {
          id: 102,
          lobbyId: 7,
          seatIndex: 1,
          userId: 2,
          connectionId: null,
          playerName: "Other",
          factionId: "LAMANITES",
          isReady: true,
          isAI: false,
        },
      ]),
    });

    render(<LobbyRoom />);

    expect(screen.getByRole("option", { name: "Lamanites" })).toBeDisabled();
    expect(screen.getByRole("option", { name: "Nephites" })).not.toBeDisabled();
  });

  it("shows inline validation and blocks start when duplicate factions exist", () => {
    mockUseLobby.mockReturnValue({
      ...baseLobbyApi,
      currentLobby: buildLobby([
        {
          id: 201,
          lobbyId: 7,
          seatIndex: 0,
          userId: 1,
          connectionId: null,
          playerName: "Host",
          factionId: "NEPHITES",
          isReady: true,
          isAI: false,
        },
        {
          id: 202,
          lobbyId: 7,
          seatIndex: 1,
          userId: 2,
          connectionId: null,
          playerName: "Guest",
          factionId: "NEPHITES",
          isReady: true,
          isAI: false,
        },
      ]),
    });

    render(<LobbyRoom />);

    expect(
      screen.getAllByText("Faction already claimed by another seat. Choose a different faction."),
    ).toHaveLength(2);
    expect(screen.getByText("Resolve duplicate factions before starting: Nephites.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resolve duplicate factions" })).toBeDisabled();
  });
});
