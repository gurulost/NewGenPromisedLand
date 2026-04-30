import { GameActionSchema } from "@shared/types/game";
import {
  getNextExpectedActorId,
  type MultiplayerPlayerMeta,
} from "@shared/logic/multiplayerSync";

type ActionValidationResult =
  | { valid: true }
  | { valid: false; error: string };

type EndTurnAction = {
  type: "END_TURN";
  payload: {
    playerId: string;
  };
};

const isEndTurnResolutionAction = (
  action: unknown,
): action is {
  type: "END_TURN_RESOLUTION";
  payload: { endingPlayerId: string; nextPlayerId: string; events: unknown[] };
} => {
  if (!action || typeof action !== "object") return false;
  const entry = action as Record<string, unknown>;
  if (entry.type !== "END_TURN_RESOLUTION") return false;
  if (!entry.payload || typeof entry.payload !== "object") return false;
  const payload = entry.payload as Record<string, unknown>;
  return (
    typeof payload.endingPlayerId === "string" &&
    payload.endingPlayerId.length > 0 &&
    typeof payload.nextPlayerId === "string" &&
    payload.nextPlayerId.length > 0 &&
    Array.isArray(payload.events)
  );
};

export function validateMultiplayerAction(
  action: unknown,
  maxActionBytes: number,
): ActionValidationResult {
  if (!action || typeof action !== "object") {
    return { valid: false, error: "Action payload must be an object" };
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(action);
  } catch {
    return { valid: false, error: "Action payload must be JSON serializable" };
  }

  if (Buffer.byteLength(serialized, "utf8") > maxActionBytes) {
    return {
      valid: false,
      error: `Action payload exceeds limit (${maxActionBytes} bytes)`,
    };
  }

  if (GameActionSchema.safeParse(action).success) {
    return { valid: true };
  }
  if (isEndTurnResolutionAction(action)) {
    return { valid: true };
  }

  return { valid: false, error: "Invalid action payload" };
}

export type TurnRecoveryStatus = {
  canForceEndTurn: boolean;
  actorId: string | null;
  msUntilEligible: number;
  actorLastSeenAt: number | null;
};

type TurnRecoveryInput = {
  playersMeta: MultiplayerPlayerMeta[];
  expectedActorId: string | null;
  requesterUserId: number;
  hostUserId: number;
  now: number;
  timeoutMs: number;
  recoveryEnabled: boolean;
};

const normalizeTimestamp = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

export function getTurnRecoveryStatus({
  playersMeta,
  expectedActorId,
  requesterUserId,
  hostUserId,
  now,
  timeoutMs,
  recoveryEnabled,
}: TurnRecoveryInput): TurnRecoveryStatus {
  if (!recoveryEnabled || !expectedActorId) {
    return { canForceEndTurn: false, actorId: null, msUntilEligible: 0, actorLastSeenAt: null };
  }

  const actorMeta = playersMeta.find((entry) => entry.playerId === expectedActorId);
  if (!actorMeta || actorMeta.isAI || actorMeta.userId == null) {
    return { canForceEndTurn: false, actorId: null, msUntilEligible: 0, actorLastSeenAt: null };
  }

  if (actorMeta.userId === hostUserId) {
    return { canForceEndTurn: false, actorId: null, msUntilEligible: 0, actorLastSeenAt: null };
  }

  const actorLastSeenAt = normalizeTimestamp(actorMeta.lastSeenAt);
  if (actorLastSeenAt == null) {
    return {
      canForceEndTurn: false,
      actorId: expectedActorId,
      msUntilEligible: timeoutMs,
      actorLastSeenAt: null,
    };
  }

  const ageMs = Math.max(0, now - actorLastSeenAt);
  const msUntilEligible = Math.max(0, timeoutMs - ageMs);
  const canForceEndTurn = requesterUserId === hostUserId && msUntilEligible <= 0;

  return { canForceEndTurn, actorId: expectedActorId, msUntilEligible, actorLastSeenAt };
}

type PendingActionEntry = {
  queueVersion?: number;
  id?: string;
  actorId?: string;
};

type ReconcilePendingActionsInput = {
  pendingActions: PendingActionEntry[];
  queueVersionProvided: boolean;
  queueVersion?: number;
  id: string;
  actorId: string;
  isTurnCompleteAction: boolean;
};

export function reconcilePendingActionsAfterCommit({
  pendingActions,
  queueVersionProvided,
  queueVersion,
  id,
  actorId,
  isTurnCompleteAction,
}: ReconcilePendingActionsInput): PendingActionEntry[] {
  const withoutCommitted = queueVersionProvided && typeof queueVersion === "number"
    ? pendingActions.filter((entry) => entry.queueVersion !== queueVersion)
    : pendingActions.filter((entry) => entry.id !== id);

  if (!isTurnCompleteAction) {
    return withoutCommitted;
  }
  return withoutCommitted.filter((entry) => entry.actorId !== actorId);
}

type ExpectedActorAfterCommitInput = {
  lobbyState: unknown;
  actorId: string;
  action: unknown;
  currentExpectedActorId: string | null;
  isTurnCompleteAction: boolean;
};

export type ExpectedActorAfterCommitResult =
  | { valid: true; expectedActorId: string | null; requiresSnapshot: boolean }
  | { valid: false; error: string };

export function getExpectedActorAfterCommit({
  lobbyState,
  actorId,
  action,
  currentExpectedActorId,
  isTurnCompleteAction,
}: ExpectedActorAfterCommitInput): ExpectedActorAfterCommitResult {
  if (!isTurnCompleteAction) {
    return {
      valid: true,
      expectedActorId: currentExpectedActorId,
      requiresSnapshot: false,
    };
  }

  if (isEndTurnResolutionAction(action)) {
    if (action.payload.endingPlayerId !== actorId) {
      return { valid: false, error: "Resolved turn actor does not match committed actor" };
    }

    const state = lobbyState && typeof lobbyState === "object" ? lobbyState as { players?: unknown } : null;
    const playersMeta = (Array.isArray(state?.players) ? state.players : []) as MultiplayerPlayerMeta[];
    const nextActorExists = playersMeta.some((entry) => entry.playerId === action.payload.nextPlayerId);
    if (!nextActorExists) {
      return { valid: false, error: "Resolved next actor is not in this lobby" };
    }

    return {
      valid: true,
      expectedActorId: action.payload.nextPlayerId,
      requiresSnapshot: false,
    };
  }

  return {
    valid: true,
    expectedActorId: getNextExpectedActorId(lobbyState, actorId) ?? currentExpectedActorId,
    requiresSnapshot: true,
  };
}

type ForcedTimeoutEndTurnInput = {
  action: unknown;
  actorId: string;
  queueVersionProvided: boolean;
  playerMeta: MultiplayerPlayerMeta | undefined;
  expectedActorId: string | null;
  requesterUserId: number;
  hostUserId: number;
  now: number;
  timeoutMs: number;
  recoveryEnabled: boolean;
};

export function isForcedTimeoutEndTurnAllowed({
  action,
  actorId,
  queueVersionProvided,
  playerMeta,
  expectedActorId,
  requesterUserId,
  hostUserId,
  now,
  timeoutMs,
  recoveryEnabled,
}: ForcedTimeoutEndTurnInput): boolean {
  if (!recoveryEnabled || queueVersionProvided) return false;
  if (requesterUserId !== hostUserId) return false;
  if (!playerMeta || playerMeta.isAI || playerMeta.userId == null) return false;
  if (playerMeta.userId === hostUserId) return false;
  if (!expectedActorId || expectedActorId !== actorId) return false;

  const parsedAction = action as EndTurnAction | undefined;
  if (!parsedAction || parsedAction.type !== "END_TURN") return false;
  if (!parsedAction.payload || parsedAction.payload.playerId !== actorId) return false;

  const actorLastSeenAt = normalizeTimestamp(playerMeta.lastSeenAt);
  return actorLastSeenAt != null && now - actorLastSeenAt >= timeoutMs;
}
