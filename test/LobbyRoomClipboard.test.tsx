import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const toastApi = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  combat: vi.fn(),
  discovery: vi.fn(),
  faith: vi.fn(),
  pride: vi.fn(),
  removeToast: vi.fn(),
};

const mockLocalGame = {
  setGamePhase: vi.fn(),
  setOnlineSession: vi.fn(),
  clearOnlineSession: vi.fn(),
  startLocalGame: vi.fn(),
  loadGameState: vi.fn(),
};

const mockLobbyState = {
  currentLobby: {
    id: 7,
    name: "Prophets Only",
    code: "ROOM42",
    hostUserId: 1,
    maxPlayers: 4,
    mapSize: "normal",
    status: "waiting",
    gameState: null,
    seats: [
      {
        id: 10,
        lobbyId: 7,
        seatIndex: 0,
        userId: 1,
        connectionId: "host",
        playerName: "HostPlayer",
        factionId: "NEPHITES",
        isReady: true,
        isAI: false,
      },
      {
        id: 11,
        lobbyId: 7,
        seatIndex: 1,
        userId: 2,
        connectionId: "guest",
        playerName: "GuestPlayer",
        factionId: "LAMANITES",
        isReady: false,
        isAI: false,
      },
    ],
  },
  leaveLobby: vi.fn(),
  fetchLobby: vi.fn(),
  startGame: vi.fn(),
  claimSeat: vi.fn(),
  releaseSeat: vi.fn(),
  updateSeat: vi.fn(),
  addAISeat: vi.fn(),
  error: null,
};

const selectionApi = {
  removeAllRanges: vi.fn(),
  addRange: vi.fn(),
};

const rangeApi = {
  selectNodeContents: vi.fn(),
};

const writeTextMock = vi.fn();
const execCommandMock = vi.fn();

vi.mock("../client/src/components/ui/ToastProvider", () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  useToastContext: () => toastApi,
}));

vi.mock("../client/src/lib/stores/useLocalGame", () => ({
  useLocalGame: () => mockLocalGame,
}));

vi.mock("../client/src/lib/stores/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      username: "HostPlayer",
    },
  }),
}));

vi.mock("../client/src/lib/stores/useLobby", () => ({
  useLobby: () => mockLobbyState,
}));

vi.mock("../client/src/hooks/useMobileUI", () => ({
  useMobileUI: () => ({
    isMobileUI: true,
  }),
}));

vi.mock("../client/src/components/primitives/ContentShell", () => ({
  ContentShell: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
}));

vi.mock("../client/src/components/primitives/PanelHeader", () => ({
  PanelHeader: ({ title, description }: { title: string; description: string }) =>
    React.createElement("div", null, title, description),
}));

vi.mock("../client/src/components/primitives/GlowingButton", () => ({
  GlowingButton: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) =>
    React.createElement("button", props, children),
}));

vi.mock("../client/src/components/chat/ChatPanel", () => ({
  ChatPanel: () => null,
}));

vi.mock("../client/src/components/ui/BugReportSupportCallout", () => ({
  default: () => null,
}));

import LobbyRoom from "../client/src/components/ui/LobbyRoom";

describe("LobbyRoom clipboard behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    });

    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommandMock,
    });

    Object.defineProperty(window, "getSelection", {
      configurable: true,
      value: vi.fn(() => selectionApi),
    });

    Object.defineProperty(document, "createRange", {
      configurable: true,
      value: vi.fn(() => rangeApi),
    });
  });

  it("shows a success toast only after clipboard copy succeeds", async () => {
    writeTextMock.mockResolvedValue(undefined);

    render(<LobbyRoom />);
    fireEvent.click(screen.getByTitle("Copy code"));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("ROOM42");
    });

    expect(toastApi.success).toHaveBeenCalledWith("Room code copied");
    expect(toastApi.error).not.toHaveBeenCalled();
    expect(rangeApi.selectNodeContents).not.toHaveBeenCalled();
    expect(execCommandMock).not.toHaveBeenCalled();
  });

  it("falls back to selecting the room code and shows a failure toast when clipboard copy is blocked", async () => {
    writeTextMock.mockRejectedValue(new Error("clipboard blocked"));
    execCommandMock.mockReturnValue(false);

    render(<LobbyRoom />);
    fireEvent.click(screen.getByTitle("Copy code"));

    await waitFor(() => {
      expect(rangeApi.selectNodeContents).toHaveBeenCalled();
    });

    expect(selectionApi.removeAllRanges).toHaveBeenCalled();
    expect(selectionApi.addRange).toHaveBeenCalledWith(rangeApi);
    expect(execCommandMock).toHaveBeenCalledWith("copy");
    expect(toastApi.success).not.toHaveBeenCalled();
    expect(toastApi.error).toHaveBeenCalledWith(
      "Copy failed",
      "Room code selected. Press Cmd+C or Ctrl+C to copy it."
    );
  });
});
