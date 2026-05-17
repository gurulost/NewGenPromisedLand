import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LobbyList from "../client/src/components/ui/LobbyList";

const mockUseLocalGame = vi.fn();
const mockUseAuth = vi.fn();
const mockUseLobby = vi.fn();

vi.mock("../client/src/lib/stores/useLocalGame", () => ({
  useLocalGame: () => mockUseLocalGame(),
}));

vi.mock("../client/src/lib/stores/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../client/src/lib/stores/useLobby", () => ({
  useLobby: () => mockUseLobby(),
}));

vi.mock("../client/src/components/primitives/ContentShell", () => ({
  ContentShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

describe("LobbyList automation hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseLocalGame.mockReturnValue({
      setGamePhase: vi.fn(),
    });
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: "HostPlayer" },
      checkAuth: vi.fn(),
      loading: false,
    });
    mockUseLobby.mockReturnValue({
      lobbies: [],
      fetchLobbies: vi.fn(),
      loading: false,
      currentLobby: null,
      createLobby: vi.fn(),
      joinLobby: vi.fn(),
      error: null,
      clearError: vi.fn(),
    });
  });

  it("exposes stable selectors for joining and creating multiplayer lobbies", () => {
    render(<LobbyList />);

    expect(screen.getByTestId("lobby-create-button")).toBeInTheDocument();
    expect(screen.getByTestId("lobby-join-code-input")).toBeInTheDocument();
    expect(screen.getByTestId("lobby-join-code-submit")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("lobby-create-button"));

    expect(screen.getByTestId("lobby-create-name-input")).toBeInTheDocument();
    expect(screen.getByTestId("lobby-create-max-players")).toBeInTheDocument();
    expect(screen.getByTestId("lobby-create-map-size")).toBeInTheDocument();
    expect(screen.getByTestId("lobby-create-submit")).toBeInTheDocument();
    expect(screen.getByTestId("lobby-create-cancel")).toBeInTheDocument();
  });
});
