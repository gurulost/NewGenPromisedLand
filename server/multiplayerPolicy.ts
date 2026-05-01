import { GameActionSchema, GameStateSchema, type GameState } from "@shared/types/game";
import {
  getNextExpectedActorId,
  getExpectedActorIdFromSnapshot,
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
  action?: unknown;
  baseActionVersion?: number;
};

type CommittedActionEntry = {
  version?: number;
  id?: string;
  actorId?: string;
  action?: unknown;
};

export type FailedMultiplayerActionEntry = {
  queueVersion?: number;
  id: string;
  actorId: string;
  action?: unknown;
  baseActionVersion?: number;
  failedAt: number;
  reason: string;
  currentActionVersion?: number;
};

export function areMultiplayerActionsEquivalent(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right) return false;
  if (left == null || right == null) return left === right;
  if (typeof left !== "object" || typeof right !== "object") return false;

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    return left.every((entry, index) => areMultiplayerActionsEquivalent(entry, right[index]));
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  for (let i = 0; i < leftKeys.length; i += 1) {
    if (leftKeys[i] !== rightKeys[i]) return false;
    if (!areMultiplayerActionsEquivalent(leftRecord[leftKeys[i]], rightRecord[rightKeys[i]])) {
      return false;
    }
  }
  return true;
}

export function buildFailedMultiplayerActionEntry({
  pendingAction,
  id,
  actorId,
  action,
  baseActionVersion,
  reason,
  currentActionVersion,
  failedAt,
}: {
  pendingAction?: PendingActionEntry;
  id: string;
  actorId: string;
  action?: unknown;
  baseActionVersion?: number;
  reason: string;
  currentActionVersion?: number;
  failedAt: number;
}): FailedMultiplayerActionEntry {
  return {
    queueVersion: pendingAction?.queueVersion,
    id,
    actorId,
    action: pendingAction?.action ?? action,
    baseActionVersion: pendingAction?.baseActionVersion ?? baseActionVersion,
    reason,
    currentActionVersion,
    failedAt,
  };
}

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

  const endingActor = getCommittedEndingActor(action);
  if (!endingActor || endingActor !== actorId) {
    return { valid: false, error: "End turn actor does not match committed actor" };
  }

  return {
    valid: true,
    expectedActorId: getNextExpectedActorId(lobbyState, actorId) ?? currentExpectedActorId,
    requiresSnapshot: true,
  };
}

export type SnapshotValidationResult =
  | { valid: true; state: GameState; expectedActorId: string }
  | { valid: false; error: string };

function getCommittedEndingActor(action: unknown): string | null {
  if (!action || typeof action !== "object") return null;
  const entry = action as Record<string, unknown>;
  const payload = entry.payload && typeof entry.payload === "object"
    ? entry.payload as Record<string, unknown>
    : null;

  if (entry.type === "END_TURN") {
    return typeof payload?.playerId === "string" ? payload.playerId : null;
  }
  if (entry.type === "END_TURN_RESOLUTION") {
    return typeof payload?.endingPlayerId === "string" ? payload.endingPlayerId : null;
  }
  return null;
}

function getResolvedNextActor(action: unknown): string | null {
  if (!action || typeof action !== "object") return null;
  const entry = action as Record<string, unknown>;
  if (entry.type !== "END_TURN_RESOLUTION") return null;
  const payload = entry.payload && typeof entry.payload === "object"
    ? entry.payload as Record<string, unknown>
    : null;
  return typeof payload?.nextPlayerId === "string" ? payload.nextPlayerId : null;
}

export function validateSnapshotUpload({
  snapshot,
  lobbyState,
  version,
}: {
  snapshot: unknown;
  lobbyState: unknown;
  version: number;
}): SnapshotValidationResult {
  const parsed = GameStateSchema.safeParse(snapshot);
  if (!parsed.success) {
    return { valid: false, error: "Invalid game state snapshot" };
  }

  const state = parsed.data;
  const stateRecord = lobbyState && typeof lobbyState === "object"
    ? lobbyState as Record<string, unknown>
    : {};
  const playersMeta = Array.isArray(stateRecord.players)
    ? stateRecord.players as MultiplayerPlayerMeta[]
    : [];

  if (state.players.length !== playersMeta.length) {
    return { valid: false, error: "Snapshot player count does not match lobby" };
  }

  for (const meta of playersMeta) {
    if (typeof meta.playerId !== "string" || !meta.playerId) {
      return { valid: false, error: "Lobby player metadata is incomplete" };
    }

    const player = state.players.find((entry) => entry.id === meta.playerId);
    if (!player) {
      return { valid: false, error: "Snapshot is missing a lobby player" };
    }
    if (typeof meta.factionId === "string" && player.factionId !== meta.factionId) {
      return { valid: false, error: "Snapshot faction assignment does not match lobby" };
    }
    if (Boolean(player.isAI) !== Boolean(meta.isAI)) {
      return { valid: false, error: "Snapshot AI assignment does not match lobby" };
    }
  }

  const expectedActorId = getExpectedActorIdFromSnapshot(state);
  if (!expectedActorId || !playersMeta.some((entry) => entry.playerId === expectedActorId)) {
    return { valid: false, error: "Snapshot current actor is not in this lobby" };
  }

  if (version === 0) {
    if (state.lastAction !== undefined) {
      return { valid: false, error: "Initial snapshot cannot include a committed action" };
    }
    return { valid: true, state, expectedActorId };
  }

  const actions = Array.isArray(stateRecord.actions) ? stateRecord.actions as CommittedActionEntry[] : [];
  const committedAction = actions.find((entry) => Number(entry?.version) === version);
  if (!committedAction) {
    return { valid: false, error: "Snapshot version does not match a committed action" };
  }

  const committedEndingActor = getCommittedEndingActor(committedAction.action);
  if (!committedEndingActor || committedEndingActor !== committedAction.actorId) {
    return { valid: false, error: "Committed turn action is inconsistent" };
  }

  const snapshotEndingActor = getCommittedEndingActor(state.lastAction);
  if (!snapshotEndingActor || snapshotEndingActor !== committedAction.actorId) {
    return { valid: false, error: "Snapshot last action does not match committed turn" };
  }
  const snapshotNextActor = getResolvedNextActor(state.lastAction);
  if (snapshotNextActor && snapshotNextActor !== expectedActorId) {
    return { valid: false, error: "Snapshot resolved next actor does not match current actor" };
  }

  return { valid: true, state, expectedActorId };
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
