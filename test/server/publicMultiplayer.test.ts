import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInitialGameState } from "../../shared/logic/initialGameState";
import type { GameLobby, PlayerSeat } from "../../shared/schema";

const storageMock = vi.hoisted(() => ({
  updateLobbyIfUnchanged: vi.fn(),
  createMultiplayerActionAudit: vi.fn(),
  createMultiplayerSnapshotCheckpoint: vi.fn(),
}));

vi.mock("../../server/storage", () => ({
  storage: storageMock,
}));

const { submitPublicAuthoritativeAction } = await import("../../server/publicMultiplayer");

function createSeats(): PlayerSeat[] {
  return [
    {
      id: 1,
      lobbyId: 10,
      seatIndex: 0,
      userId: 1,
      playerName: "Host",
      factionId: "NEPHITES",
      isReady: true,
      isAI: false,
      createdAt: new Date(),
    },
    {
      id: 2,
      lobbyId: 10,
      seatIndex: 1,
      userId: 2,
      playerName: "Guest",
      factionId: "LAMANITES",
      isReady: true,
      isAI: false,
      createdAt: new Date(),
    },
  ];
}

function createLobby(overrides: Record<string, unknown> = {}): GameLobby {
  const { gameState } = createInitialGameState({
    playerSetup: [
      { id: "player-1", name: "Host", factionId: "NEPHITES", turnOrder: 0 },
      { id: "player-2", name: "Guest", factionId: "LAMANITES", turnOrder: 1 },
    ],
    mapSize: "tiny",
    seed: 12345,
    gameId: "public-service-test",
  });

  return {
    id: 10,
    code: "ROOMA",
    name: "Room",
    hostUserId: 1,
    maxPlayers: 2,
    mapSize: "tiny",
    status: "playing",
    gameState: {
      multiplayerAuthorityMode: "public_authoritative",
      players: [
        { playerId: "player-1", seatIndex: 0, userId: 1, factionId: "NEPHITES", isAI: false, turnOrder: 0, lastSeenAt: 10_000 },
        { playerId: "player-2", seatIndex: 1, userId: 2, factionId: "LAMANITES", isAI: false, turnOrder: 1, lastSeenAt: 10_000 },
      ],
      actionVersion: 0,
      snapshotVersion: 0,
      actionLogBaseVersion: 0,
      actions: [],
      snapshot: gameState,
      expectedActorId: "player-1",
      ...overrides,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("public authoritative multiplayer service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMock.updateLobbyIfUnchanged.mockImplementation(async (_id, _expected, patch) => ({
      ...createLobby(),
      ...patch,
      updatedAt: new Date(),
    }));
    storageMock.createMultiplayerActionAudit.mockImplementation(async (audit) => ({ id: 1, createdAt: new Date(), ...audit }));
    storageMock.createMultiplayerSnapshotCheckpoint.mockImplementation(async (checkpoint) => ({ id: 1, createdAt: new Date(), ...checkpoint }));
  });

  it("applies a legal submitted action with the shared resolver and persists audit data", async () => {
    const lobby = createLobby();
    const result = await submitPublicAuthoritativeAction({
      lobby,
      seats: createSeats(),
      userId: 1,
      body: {
        clientActionId: "submit-1",
        baseActionVersion: 0,
        action: { type: "END_TURN", payload: { playerId: "player-1" } },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.actionVersion).toBe(1);
    expect(result.snapshotVersion).toBe(1);
    expect(storageMock.updateLobbyIfUnchanged).toHaveBeenCalledWith(10, lobby, expect.objectContaining({
      gameState: expect.objectContaining({
        actionVersion: 1,
        snapshotVersion: 1,
        expectedActorId: "player-2",
      }),
    }));
    expect(storageMock.createMultiplayerActionAudit).toHaveBeenCalledWith(expect.objectContaining({
      clientActionId: "submit-1",
      status: "accepted",
      actionVersion: 1,
      playerId: "player-1",
    }));
    expect(storageMock.createMultiplayerSnapshotCheckpoint).toHaveBeenCalledWith(expect.objectContaining({
      actionVersion: 1,
      snapshotVersion: 1,
    }));
  });

  it("rejects stale submissions before mutation", async () => {
    const lobby = createLobby({ actionVersion: 3, snapshotVersion: 3 });
    const result = await submitPublicAuthoritativeAction({
      lobby,
      seats: createSeats(),
      userId: 1,
      body: {
        clientActionId: "stale-1",
        baseActionVersion: 2,
        action: { type: "END_TURN", payload: { playerId: "player-1" } },
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(409);
    expect(result.reason).toBe("stale_action_version");
    expect(storageMock.updateLobbyIfUnchanged).not.toHaveBeenCalled();
    expect(storageMock.createMultiplayerActionAudit).toHaveBeenCalledWith(expect.objectContaining({
      clientActionId: "stale-1",
      status: "rejected",
      reason: "stale_action_version",
    }));
  });

  it("rejects actions from users who do not control the current actor", async () => {
    const lobby = createLobby();
    const result = await submitPublicAuthoritativeAction({
      lobby,
      seats: createSeats(),
      userId: 2,
      body: {
        clientActionId: "wrong-user-1",
        baseActionVersion: 0,
        action: { type: "END_TURN", payload: { playerId: "player-1" } },
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(403);
    expect(result.reason).toBe("actor_not_controlled");
    expect(storageMock.updateLobbyIfUnchanged).not.toHaveBeenCalled();
  });

  it("rejects public attacks against hidden enemy units", async () => {
    const lobby = createLobby();
    const lobbyState = lobby.gameState as { snapshot: ReturnType<typeof createInitialGameState>["gameState"] };
    const snapshot = lobbyState.snapshot;
    const enemy = snapshot.units.find((unit) => unit.playerId === "player-2");
    const attacker = snapshot.units.find((unit) => unit.playerId === "player-1");
    expect(enemy).toBeTruthy();
    expect(attacker).toBeTruthy();
    snapshot.players = snapshot.players.map((player) =>
      player.id === "player-1" ? { ...player, visibilityMask: [], exploredTiles: [] } : player,
    );
    const result = await submitPublicAuthoritativeAction({
      lobby,
      seats: createSeats(),
      userId: 1,
      body: {
        clientActionId: "hidden-attack-1",
        baseActionVersion: 0,
        action: { type: "ATTACK_UNIT", payload: { attackerId: attacker!.id, targetId: enemy!.id } },
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("target_not_visible");
    expect(storageMock.updateLobbyIfUnchanged).not.toHaveBeenCalled();
  });
});
