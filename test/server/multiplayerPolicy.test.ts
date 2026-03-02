import {
  getTurnRecoveryStatus,
  reconcilePendingActionsAfterCommit,
  isForcedTimeoutEndTurnAllowed,
  validateMultiplayerAction,
} from "../../server/multiplayerPolicy";

describe("multiplayerPolicy", () => {
  it("validates multiplayer action payload shape and size", () => {
    const valid = validateMultiplayerAction(
      { type: "END_TURN", payload: { playerId: "player-2" } },
      1024,
    );
    const invalid = validateMultiplayerAction(
      { type: "NOT_A_REAL_ACTION", payload: {} },
      1024,
    );

    expect(valid.valid).toBe(true);
    expect(invalid.valid).toBe(false);
  });

  it("enforces action size in UTF-8 bytes", () => {
    const oversizedUnicodeAction = {
      type: "END_TURN",
      payload: { playerId: "😀😀😀😀😀😀😀😀😀😀" },
    };
    const serialized = JSON.stringify(oversizedUnicodeAction);
    const byteLength = Buffer.byteLength(serialized, "utf8");
    const charLength = serialized.length;

    expect(byteLength).toBeGreaterThan(charLength);
    const result = validateMultiplayerAction(oversizedUnicodeAction, charLength + 1);
    expect(result.valid).toBe(false);
  });

  it("computes host turn recovery eligibility after timeout", () => {
    const now = 100_000;
    const status = getTurnRecoveryStatus({
      playersMeta: [
        { playerId: "player-1", userId: 10, isAI: false, lastSeenAt: now - 1000 },
        { playerId: "player-2", userId: 11, isAI: false, lastSeenAt: now - 95_000 },
      ],
      expectedActorId: "player-2",
      requesterUserId: 10,
      hostUserId: 10,
      now,
      timeoutMs: 90_000,
      recoveryEnabled: true,
    });

    expect(status.actorId).toBe("player-2");
    expect(status.canForceEndTurn).toBe(true);
    expect(status.msUntilEligible).toBe(0);
  });

  it("does not allow forced timeout end turn before timeout", () => {
    const now = 100_000;
    const status = getTurnRecoveryStatus({
      playersMeta: [
        { playerId: "player-1", userId: 10, isAI: false, lastSeenAt: now - 1000 },
        { playerId: "player-2", userId: 11, isAI: false, lastSeenAt: now - 20_000 },
      ],
      expectedActorId: "player-2",
      requesterUserId: 10,
      hostUserId: 10,
      now,
      timeoutMs: 90_000,
      recoveryEnabled: true,
    });

    expect(status.canForceEndTurn).toBe(false);
    expect(status.msUntilEligible).toBe(70_000);
  });

  it("hides turn recovery actor when host is the current actor", () => {
    const now = 100_000;
    const status = getTurnRecoveryStatus({
      playersMeta: [
        { playerId: "player-1", userId: 10, isAI: false, lastSeenAt: now - 1000 },
        { playerId: "player-2", userId: 11, isAI: false, lastSeenAt: now - 95_000 },
      ],
      expectedActorId: "player-1",
      requesterUserId: 10,
      hostUserId: 10,
      now,
      timeoutMs: 90_000,
      recoveryEnabled: true,
    });

    expect(status.canForceEndTurn).toBe(false);
    expect(status.actorId).toBeNull();
  });

  it("hides turn recovery actor when recovery feature is disabled", () => {
    const status = getTurnRecoveryStatus({
      playersMeta: [{ playerId: "player-2", userId: 11, isAI: false, lastSeenAt: 1_000 }],
      expectedActorId: "player-2",
      requesterUserId: 10,
      hostUserId: 10,
      now: 100_000,
      timeoutMs: 90_000,
      recoveryEnabled: false,
    });

    expect(status.canForceEndTurn).toBe(false);
    expect(status.actorId).toBeNull();
  });

  it("allows queue-proof bypass only for valid host timeout END_TURN", () => {
    const allowed = isForcedTimeoutEndTurnAllowed({
      action: { type: "END_TURN", payload: { playerId: "player-2" } },
      actorId: "player-2",
      queueVersionProvided: false,
      playerMeta: { playerId: "player-2", userId: 11, isAI: false, lastSeenAt: 1_000 },
      expectedActorId: "player-2",
      requesterUserId: 10,
      hostUserId: 10,
      now: 100_000,
      timeoutMs: 90_000,
      recoveryEnabled: true,
    });

    const deniedWithQueueVersion = isForcedTimeoutEndTurnAllowed({
      action: { type: "END_TURN", payload: { playerId: "player-2" } },
      actorId: "player-2",
      queueVersionProvided: true,
      playerMeta: { playerId: "player-2", userId: 11, isAI: false, lastSeenAt: 1_000 },
      expectedActorId: "player-2",
      requesterUserId: 10,
      hostUserId: 10,
      now: 100_000,
      timeoutMs: 90_000,
      recoveryEnabled: true,
    });

    expect(allowed).toBe(true);
    expect(deniedWithQueueVersion).toBe(false);
  });

  it("reconciles pending actions and clears actor queue on turn-complete", () => {
    const next = reconcilePendingActionsAfterCommit({
      pendingActions: [
        { queueVersion: 1, id: "a", actorId: "player-2" },
        { queueVersion: 2, id: "b", actorId: "player-2" },
        { queueVersion: 3, id: "c", actorId: "player-3" },
      ],
      queueVersionProvided: true,
      queueVersion: 1,
      id: "a",
      actorId: "player-2",
      isTurnCompleteAction: true,
    });

    expect(next).toEqual([{ queueVersion: 3, id: "c", actorId: "player-3" }]);
  });
});
