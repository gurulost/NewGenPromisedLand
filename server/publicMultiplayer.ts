import { createHash } from "crypto";

import { executeAITurn } from "@shared/ai/aiEngine";
import type { AIDecision, AIDifficulty } from "@shared/ai/aiEngine";
import { getUnitSpawnCoordinate } from "@shared/logic/actions/spawnUtils";
import { createResolveResult, type ResolveResult } from "@shared/logic/actionResolution";
import { getExpectedActorIdFromSnapshot, type MultiplayerPlayerMeta } from "@shared/logic/multiplayerSync";
import { explainAction, explainFactionAbilityAction } from "@shared/logic/ruleQueries";
import { projectGameStateForPlayers } from "@shared/logic/stateProjection";
import { resolveAction, resolveActionState } from "@shared/logic/resolveAction";
import { GameActionSchema, GameStateSchema, type GameAction, type GameState } from "@shared/types/game";
import type { HexCoordinate } from "@shared/types/coordinates";
import type { PlayerSeat } from "@shared/schema";
import type { UnitType } from "@shared/types/unit";
import { isPublicAuthoritativeMultiplayer } from "@shared/multiplayerAuthority";

import { storage, type LobbyRecord } from "./storage";

export const PUBLIC_MULTIPLAYER_MAX_AI_ACTIONS_PER_TURN = 4;
const MAX_PUBLIC_MULTIPLAYER_AI_TURNS_PER_ADVANCE = 8;

export type PublicLobbyState = Record<string, unknown> & {
  players?: MultiplayerPlayerMeta[];
  snapshot?: unknown;
  actionVersion?: number;
  snapshotVersion?: number;
  actions?: unknown[];
  expectedActorId?: string | null;
};

export type PublicSubmitResult =
  | {
      ok: true;
      actionVersion: number;
      snapshotVersion: number;
      stateHash: string;
      state: ReturnType<typeof projectGameStateForPlayers>;
      aiAdvanced: number;
      duplicate?: boolean;
    }
  | {
      ok: false;
      status: number;
      error: string;
      reason: string;
      actionVersion?: number;
      snapshotVersion?: number;
      state?: ReturnType<typeof projectGameStateForPlayers>;
    };

export type PublicTimeoutResult =
  | {
      ok: true;
      applied: boolean;
      reason: string;
      actionVersion: number;
      snapshotVersion: number;
      stateHash: string;
      state: ReturnType<typeof projectGameStateForPlayers>;
    }
  | {
      ok: false;
      status: number;
      error: string;
      reason: string;
    };

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

export function hashGameState(state: GameState): string {
  return createHash("sha256").update(stableStringify(state)).digest("hex");
}

export function getControlledPlayerIds(
  lobbyState: PublicLobbyState,
  seats: PlayerSeat[],
  userId: number,
): string[] {
  const seatIndexes = new Set(
    seats
      .filter((seat) => seat.userId === userId)
      .map((seat) => seat.seatIndex),
  );
  const playersMeta = Array.isArray(lobbyState.players) ? lobbyState.players : [];
  return playersMeta
    .filter((player) => {
      if (player.userId !== undefined) return player.userId === userId;
      return typeof player.seatIndex === "number" && seatIndexes.has(player.seatIndex);
    })
    .map((player) => player.playerId)
    .filter((playerId): playerId is string => typeof playerId === "string" && playerId.length > 0);
}

export function isPublicAuthoritativeLobbyState(lobbyState: unknown): boolean {
  return isPublicAuthoritativeMultiplayer(
    lobbyState && typeof lobbyState === "object"
      ? (lobbyState as Record<string, unknown>).multiplayerAuthorityMode
      : undefined,
  );
}

export function projectLobbySnapshotForUser(
  lobbyState: PublicLobbyState,
  seats: PlayerSeat[],
  userId: number,
): ReturnType<typeof projectGameStateForPlayers> | null {
  const parsed = GameStateSchema.safeParse(lobbyState.snapshot);
  if (!parsed.success) return null;
  const controlledPlayerIds = getControlledPlayerIds(lobbyState, seats, userId);
  if (controlledPlayerIds.length === 0) return null;
  return projectGameStateForPlayers(parsed.data, controlledPlayerIds);
}

function getCurrentActorId(snapshot: GameState): string | null {
  return getExpectedActorIdFromSnapshot(snapshot);
}

function coordinateKey(coordinate: { q: number; r: number }): string {
  return `${coordinate.q},${coordinate.r}`;
}

function getVisibleAndExploredKeys(state: GameState, actorId: string) {
  const actor = state.players.find((player) => player.id === actorId);
  return {
    visible: new Set(actor?.visibilityMask ?? []),
    explored: new Set(actor?.exploredTiles ?? []),
  };
}

function canTargetCoordinate(state: GameState, actorId: string, coordinate: { q: number; r: number }, options: { requireVisible?: boolean } = {}): boolean {
  const { visible, explored } = getVisibleAndExploredKeys(state, actorId);
  const key = coordinateKey(coordinate);
  if (visible.has(key)) return true;
  return !options.requireVisible && explored.has(key);
}

function isPublicActionTargetVisible(state: GameState, action: GameAction, actorId: string): boolean {
  switch (action.type) {
    case "ATTACK_UNIT": {
      const target = state.units.find((unit) => unit.id === action.payload.targetId);
      return Boolean(target && canTargetCoordinate(state, actorId, target.coordinate, { requireVisible: true }));
    }
    case "CONVERT_UNIT": {
      const target = state.units.find((unit) => unit.id === action.payload.targetUnitId);
      return Boolean(target && canTargetCoordinate(state, actorId, target.coordinate, { requireVisible: true }));
    }
    case "CAPTURE_CITY":
    case "CONVERT_CITY": {
      const city = state.cities.find((candidate) => candidate.id === action.payload.cityId);
      return Boolean(city && canTargetCoordinate(state, actorId, city.coordinate));
    }
    case "WORLD_ELEMENT_HARVEST":
    case "WORLD_ELEMENT_BUILD":
    case "EXPLORE_RUINS":
      return canTargetCoordinate(state, actorId, action.payload.coordinate, { requireVisible: true });
    case "USE_ABILITY": {
      const target = action.payload.target;
      if (!target) return true;
      if (typeof target === "string") {
        const unit = state.units.find((candidate) => candidate.id === target);
        if (unit) return canTargetCoordinate(state, actorId, unit.coordinate, { requireVisible: true });
        const city = state.cities.find((candidate) => candidate.id === target);
        return Boolean(city && canTargetCoordinate(state, actorId, city.coordinate));
      }
      if ("unitId" in target) {
        const unit = state.units.find((candidate) => candidate.id === target.unitId);
        return Boolean(unit && canTargetCoordinate(state, actorId, unit.coordinate, { requireVisible: true }));
      }
      if ("cityId" in target) {
        const city = state.cities.find((candidate) => candidate.id === target.cityId);
        return Boolean(city && canTargetCoordinate(state, actorId, city.coordinate));
      }
      return canTargetCoordinate(state, actorId, target, { requireVisible: true });
    }
    case "ACTIVATE_FACTION_ABILITY": {
      if (!action.payload.targetId) return true;
      const unit = state.units.find((candidate) => candidate.id === action.payload.targetId);
      if (unit) return canTargetCoordinate(state, actorId, unit.coordinate, { requireVisible: true });
      const city = state.cities.find((candidate) => candidate.id === action.payload.targetId);
      return Boolean(city && canTargetCoordinate(state, actorId, city.coordinate));
    }
    default:
      return true;
  }
}

function getPlayerMeta(lobbyState: PublicLobbyState, playerId: string | null): MultiplayerPlayerMeta | undefined {
  if (!playerId) return undefined;
  return (Array.isArray(lobbyState.players) ? lobbyState.players : []).find((player) => player.playerId === playerId);
}

function isUserAllowedToAct(lobbyState: PublicLobbyState, seats: PlayerSeat[], userId: number, actorId: string): boolean {
  return getControlledPlayerIds(lobbyState, seats, userId).includes(actorId);
}

function sanitizeClientActionId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 128) return null;
  return trimmed;
}

async function auditPublicAction(input: {
  lobby: LobbyRecord;
  clientActionId: string;
  userId: number;
  playerId?: string | null;
  status: "accepted" | "rejected";
  reason?: string;
  actionVersion?: number | null;
  baseActionVersion?: number | null;
  preStateHash?: string | null;
  postStateHash?: string | null;
  action?: unknown;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await storage.createMultiplayerActionAudit({
      lobbyId: input.lobby.id,
      lobbyCode: input.lobby.code,
      actionVersion: input.actionVersion ?? null,
      clientActionId: input.clientActionId,
      userId: input.userId,
      playerId: input.playerId ?? null,
      status: input.status,
      reason: input.reason ?? null,
      baseActionVersion: input.baseActionVersion ?? null,
      preStateHash: input.preStateHash ?? null,
      postStateHash: input.postStateHash ?? null,
      action: input.action ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (error) {
    console.warn("[multiplayer:public] failed to write action audit", {
      lobbyCode: input.lobby.code,
      clientActionId: input.clientActionId,
      error: error instanceof Error ? error.message : error,
    });
  }
}

async function persistSnapshotCheckpoint(input: {
  lobby: LobbyRecord;
  actionVersion: number;
  snapshotVersion: number;
  stateHash: string;
  snapshot: GameState;
}): Promise<void> {
  try {
    await storage.createMultiplayerSnapshotCheckpoint({
      lobbyId: input.lobby.id,
      lobbyCode: input.lobby.code,
      actionVersion: input.actionVersion,
      snapshotVersion: input.snapshotVersion,
      stateHash: input.stateHash,
      snapshot: input.snapshot,
    });
  } catch (error) {
    console.warn("[multiplayer:public] failed to write snapshot checkpoint", {
      lobbyCode: input.lobby.code,
      actionVersion: input.actionVersion,
      error: error instanceof Error ? error.message : error,
    });
  }
}

function translateAIDecisionToAction(state: GameState, decision: AIDecision, aiPlayerId: string): GameAction | null {
  switch (decision.type) {
    case "MOVE_UNIT":
      return decision.unitId && decision.targetCoordinate
        ? { type: "MOVE_UNIT", payload: { unitId: decision.unitId, targetCoordinate: decision.targetCoordinate } }
        : null;
    case "ATTACK_UNIT":
      return decision.unitId && decision.targetId
        ? { type: "ATTACK_UNIT", payload: { attackerId: decision.unitId, targetId: decision.targetId } }
        : null;
    case "CAPTURE_CITY":
      return decision.unitId && decision.cityId
        ? { type: "CAPTURE_CITY", payload: { playerId: aiPlayerId, unitId: decision.unitId, cityId: decision.cityId } }
        : null;
    case "CONQUER_VILLAGE":
      return decision.unitId ? { type: "CONQUER_VILLAGE", payload: { unitId: decision.unitId, playerId: aiPlayerId } } : null;
    case "CONVERT_VILLAGE":
      return decision.unitId ? { type: "CONVERT_VILLAGE", payload: { unitId: decision.unitId, playerId: aiPlayerId } } : null;
    case "EXPLORE_RUINS":
      return decision.unitId && decision.targetCoordinate
        ? { type: "EXPLORE_RUINS", payload: { unitId: decision.unitId, playerId: aiPlayerId, coordinate: decision.targetCoordinate } }
        : null;
    case "WORLD_ELEMENT_HARVEST":
      return decision.unitId && decision.elementId && decision.targetCoordinate
        ? { type: "WORLD_ELEMENT_HARVEST", payload: { playerId: aiPlayerId, unitId: decision.unitId, elementId: decision.elementId, coordinate: decision.targetCoordinate } }
        : null;
    case "WORLD_ELEMENT_BUILD":
      return decision.unitId && decision.elementId && decision.targetCoordinate
        ? { type: "WORLD_ELEMENT_BUILD", payload: { playerId: aiPlayerId, unitId: decision.unitId, elementId: decision.elementId, coordinate: decision.targetCoordinate } }
        : null;
    case "RESEARCH_TECH":
      return decision.techId ? { type: "RESEARCH_TECH", payload: { playerId: aiPlayerId, techId: decision.techId } } : null;
    case "START_CONSTRUCTION": {
      if (!decision.cityId || !decision.buildingType) return null;
      const payload: Extract<GameAction, { type: "START_CONSTRUCTION" }>["payload"] = {
        playerId: aiPlayerId,
        buildingType: decision.buildingType,
        cityId: decision.cityId,
        category: decision.constructionCategory ?? "structures",
      };
      if (decision.builderUnitId) payload.builderUnitId = decision.builderUnitId;
      if (decision.targetCoordinate) {
        payload.coordinate = decision.targetCoordinate;
      } else if (payload.category === "units") {
        const city = state.cities?.find((candidate) => candidate.id === decision.cityId);
        const coordinate = city
          ? getUnitSpawnCoordinate(state, decision.buildingType as UnitType, city.coordinate)
          : null;
        if (!coordinate) return null;
        payload.coordinate = coordinate;
      }
      return { type: "START_CONSTRUCTION", payload };
    }
    case "START_FAITH_PROJECT":
      return decision.holyCityIds
        ? { type: "START_FAITH_PROJECT", payload: { playerId: aiPlayerId, holyCityIds: decision.holyCityIds } }
        : null;
    case "USE_ABILITY": {
      if (!decision.abilityId) return null;
      const { availability, check } = explainFactionAbilityAction(state, aiPlayerId, decision.abilityId);
      return availability.available && check.legal
        ? { type: "USE_ABILITY", payload: { playerId: aiPlayerId, abilityId: decision.abilityId } }
        : null;
    }
    case "HEAL_UNIT":
      return decision.unitId ? { type: "HEAL_UNIT", payload: { unitId: decision.unitId, playerId: aiPlayerId } } : null;
    case "APPLY_STEALTH":
      return decision.unitId ? { type: "APPLY_STEALTH", payload: { unitId: decision.unitId, playerId: aiPlayerId } } : null;
    case "FORMATION_FIGHTING":
      return decision.unitId ? { type: "FORMATION_FIGHTING", payload: { unitId: decision.unitId, playerId: aiPlayerId } } : null;
    case "SIEGE_MODE":
      return decision.unitId ? { type: "SIEGE_MODE", payload: { unitId: decision.unitId, playerId: aiPlayerId } } : null;
    case "RALLY_TROOPS":
      return decision.unitId ? { type: "RALLY_TROOPS", payload: { unitId: decision.unitId, playerId: aiPlayerId } } : null;
    default:
      return null;
  }
}

function getMaxActionsForDifficulty(difficulty: AIDifficulty | undefined): number {
  switch (difficulty) {
    case "easy":
      return 2;
    case "hard":
      return 4;
    case "normal":
    default:
      return 3;
  }
}

function resolvePublicAIActor(state: GameState): { result: ResolveResult; actions: GameAction[] } {
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer?.isAI || currentPlayer.isEliminated) {
    return { result: createResolveResult(state), actions: [] };
  }

  let workingState = state;
  const actions: GameAction[] = [];
  const maxActions = Math.min(getMaxActionsForDifficulty(currentPlayer.aiDifficulty as AIDifficulty | undefined), PUBLIC_MULTIPLAYER_MAX_AI_ACTIONS_PER_TURN);

  for (let index = 0; index < maxActions; index += 1) {
    const actor = workingState.players[workingState.currentPlayerIndex];
    if (!actor || actor.id !== currentPlayer.id) break;
    const decisions = executeAITurn(workingState, actor);
    let applied = false;
    for (const decision of decisions) {
      const action = translateAIDecisionToAction(workingState, decision, actor.id);
      if (!action) continue;
      const check = explainAction(workingState, action, { actorId: actor.id });
      if (!check.legal) continue;
      const nextState = resolveActionState(workingState, action, { source: "server", actorId: actor.id });
      if (nextState === workingState) continue;
      workingState = nextState;
      actions.push(action);
      applied = true;
      break;
    }
    if (!applied) break;
  }

  const endActor = workingState.players[workingState.currentPlayerIndex];
  if (endActor?.id === currentPlayer.id) {
    const endTurnAction: GameAction = { type: "END_TURN", payload: { playerId: currentPlayer.id } };
    const check = explainAction(workingState, endTurnAction, { actorId: currentPlayer.id });
    if (check.legal) {
      const result = resolveAction(workingState, endTurnAction, { source: "server", actorId: currentPlayer.id });
      if (result.state !== workingState) {
        actions.push(endTurnAction);
        return { result, actions };
      }
    }
  }

  return { result: createResolveResult(workingState), actions };
}

function advancePublicAIActors(state: GameState): { state: GameState; actions: GameAction[] } {
  let workingState = state;
  const actions: GameAction[] = [];

  for (let turns = 0; turns < MAX_PUBLIC_MULTIPLAYER_AI_TURNS_PER_ADVANCE; turns += 1) {
    const actor = workingState.players[workingState.currentPlayerIndex];
    if (!actor?.isAI || actor.isEliminated || workingState.phase === "ended") break;
    const result = resolvePublicAIActor(workingState);
    if (result.result.state === workingState && result.actions.length === 0) break;
    workingState = result.result.state;
    actions.push(...result.actions);
  }

  return { state: workingState, actions };
}

function appendActionEntries(lobbyState: PublicLobbyState, entries: unknown[]): unknown[] {
  const current = Array.isArray(lobbyState.actions) ? lobbyState.actions : [];
  return [...current, ...entries].slice(-200);
}

function buildActionEntry(input: {
  version: number;
  id: string;
  actorId: string;
  action: GameAction;
  source: "human" | "ai" | "timeout";
  userId?: number;
  stateHash: string;
}) {
  return {
    version: input.version,
    id: input.id,
    actorId: input.actorId,
    action: input.action,
    source: input.source,
    userId: input.userId,
    stateHash: input.stateHash,
    committedAt: Date.now(),
  };
}

export async function submitPublicAuthoritativeAction(input: {
  lobby: LobbyRecord;
  seats: PlayerSeat[];
  userId: number;
  body: unknown;
}): Promise<PublicSubmitResult> {
  const lobbyState = ((input.lobby.gameState as PublicLobbyState) ?? {}) as PublicLobbyState;
  if (!isPublicAuthoritativeLobbyState(lobbyState)) {
    return { ok: false, status: 400, error: "Lobby is not public-authoritative", reason: "wrong_authority_mode" };
  }

  const parsedSnapshot = GameStateSchema.safeParse(lobbyState.snapshot);
  if (!parsedSnapshot.success) {
    return { ok: false, status: 409, error: "Canonical snapshot unavailable", reason: "missing_snapshot" };
  }

  const body = input.body && typeof input.body === "object" ? input.body as Record<string, unknown> : {};
  const clientActionId = sanitizeClientActionId(body.clientActionId);
  if (!clientActionId) {
    return { ok: false, status: 400, error: "clientActionId is required", reason: "missing_client_action_id" };
  }

  const baseActionVersion = Number(body.baseActionVersion);
  const currentActionVersion = Number(lobbyState.actionVersion ?? 0);
  const currentSnapshotVersion = Number(lobbyState.snapshotVersion ?? 0);
  const duplicate = (Array.isArray(lobbyState.actions) ? lobbyState.actions : [])
    .find((entry) => entry && typeof entry === "object" && (entry as Record<string, unknown>).id === clientActionId) as Record<string, unknown> | undefined;
  const controlledPlayerIds = getControlledPlayerIds(lobbyState, input.seats, input.userId);
  const projectedSnapshot = projectGameStateForPlayers(parsedSnapshot.data, controlledPlayerIds);

  if (duplicate) {
    return {
      ok: true,
      actionVersion: Number(duplicate.version ?? currentActionVersion),
      snapshotVersion: currentSnapshotVersion,
      stateHash: typeof duplicate.stateHash === "string" ? duplicate.stateHash : hashGameState(parsedSnapshot.data),
      state: projectedSnapshot,
      aiAdvanced: 0,
      duplicate: true,
    };
  }

  const actionParse = GameActionSchema.safeParse(body.action);
  if (!actionParse.success) {
    await auditPublicAction({
      lobby: input.lobby,
      clientActionId,
      userId: input.userId,
      status: "rejected",
      reason: "invalid_action_schema",
      action: body.action,
      baseActionVersion: Number.isFinite(baseActionVersion) ? baseActionVersion : null,
    });
    return { ok: false, status: 400, error: "Invalid action payload", reason: "invalid_action_schema", actionVersion: currentActionVersion, snapshotVersion: currentSnapshotVersion, state: projectedSnapshot };
  }

  if (!Number.isInteger(baseActionVersion) || baseActionVersion !== currentActionVersion) {
    await auditPublicAction({
      lobby: input.lobby,
      clientActionId,
      userId: input.userId,
      status: "rejected",
      reason: "stale_action_version",
      action: actionParse.data,
      baseActionVersion: Number.isFinite(baseActionVersion) ? baseActionVersion : null,
    });
    return { ok: false, status: 409, error: "Action was based on stale state", reason: "stale_action_version", actionVersion: currentActionVersion, snapshotVersion: currentSnapshotVersion, state: projectedSnapshot };
  }

  const actorId = getCurrentActorId(parsedSnapshot.data);
  if (!actorId) {
    return { ok: false, status: 409, error: "Current actor unavailable", reason: "missing_actor", actionVersion: currentActionVersion, snapshotVersion: currentSnapshotVersion, state: projectedSnapshot };
  }
  const actorMeta = getPlayerMeta(lobbyState, actorId);
  if (actorMeta?.isAI) {
    return { ok: false, status: 409, error: "Server is resolving the AI turn", reason: "ai_turn", actionVersion: currentActionVersion, snapshotVersion: currentSnapshotVersion, state: projectedSnapshot };
  }
  if (!isUserAllowedToAct(lobbyState, input.seats, input.userId, actorId)) {
    await auditPublicAction({
      lobby: input.lobby,
      clientActionId,
      userId: input.userId,
      playerId: actorId,
      status: "rejected",
      reason: "actor_not_controlled",
      action: actionParse.data,
      baseActionVersion,
    });
    return { ok: false, status: 403, error: "You do not control the current actor", reason: "actor_not_controlled", actionVersion: currentActionVersion, snapshotVersion: currentSnapshotVersion, state: projectedSnapshot };
  }

  if (!isPublicActionTargetVisible(parsedSnapshot.data, actionParse.data, actorId)) {
    await auditPublicAction({
      lobby: input.lobby,
      clientActionId,
      userId: input.userId,
      playerId: actorId,
      status: "rejected",
      reason: "target_not_visible",
      action: actionParse.data,
      baseActionVersion,
    });
    return { ok: false, status: 422, error: "Action target is not visible to this player", reason: "target_not_visible", actionVersion: currentActionVersion, snapshotVersion: currentSnapshotVersion, state: projectedSnapshot };
  }

  const check = explainAction(parsedSnapshot.data, actionParse.data, { actorId });
  if (!check.legal) {
    await auditPublicAction({
      lobby: input.lobby,
      clientActionId,
      userId: input.userId,
      playerId: actorId,
      status: "rejected",
      reason: check.reason,
      action: actionParse.data,
      baseActionVersion,
      metadata: { check },
    });
    return { ok: false, status: 422, error: check.message ?? "Action is not legal", reason: check.reason, actionVersion: currentActionVersion, snapshotVersion: currentSnapshotVersion, state: projectedSnapshot };
  }

  const preStateHash = hashGameState(parsedSnapshot.data);
  const resolution = resolveAction(parsedSnapshot.data, actionParse.data, { source: "server", actorId });
  if (resolution.state === parsedSnapshot.data && resolution.events.length === 0 && resolution.messages.length === 0) {
    await auditPublicAction({
      lobby: input.lobby,
      clientActionId,
      userId: input.userId,
      playerId: actorId,
      status: "rejected",
      reason: "resolver_noop",
      action: actionParse.data,
      baseActionVersion,
      preStateHash,
    });
    return { ok: false, status: 422, error: "Action was rejected by the resolver", reason: "resolver_noop", actionVersion: currentActionVersion, snapshotVersion: currentSnapshotVersion, state: projectedSnapshot };
  }

  const aiAdvance = advancePublicAIActors(resolution.state);
  const finalState = aiAdvance.state;
  const finalStateHash = hashGameState(finalState);
  const acceptedVersion = currentActionVersion + 1;
  let nextVersion = acceptedVersion;
  const actionEntries = [
    buildActionEntry({
      version: acceptedVersion,
      id: clientActionId,
      actorId,
      action: actionParse.data,
      source: "human",
      userId: input.userId,
      stateHash: finalStateHash,
    }),
  ];
  for (const aiAction of aiAdvance.actions) {
    const aiActorId = "payload" in aiAction && aiAction.payload && typeof aiAction.payload === "object" && "playerId" in aiAction.payload
      ? String((aiAction.payload as Record<string, unknown>).playerId)
      : getExpectedActorIdFromSnapshot(finalState) ?? "ai";
    nextVersion += 1;
    actionEntries.push(buildActionEntry({
      version: nextVersion,
      id: `server-ai-${input.lobby.code}-${nextVersion}`,
      actorId: aiActorId,
      action: aiAction,
      source: "ai",
      stateHash: finalStateHash,
    }));
  }

  const nextSnapshotVersion = currentSnapshotVersion + actionEntries.length;
  const updated = await storage.updateLobbyIfUnchanged(input.lobby.id, input.lobby, {
    gameState: {
      ...lobbyState,
      actionVersion: nextVersion,
      snapshotVersion: nextSnapshotVersion,
      actionLogBaseVersion: Number(lobbyState.actionLogBaseVersion ?? 0),
      actions: appendActionEntries(lobbyState, actionEntries),
      snapshot: finalState,
      expectedActorId: getExpectedActorIdFromSnapshot(finalState),
      turnResolutionPending: false,
    },
  });
  if (!updated) {
    return { ok: false, status: 409, error: "Lobby changed while applying action", reason: "concurrent_update", actionVersion: currentActionVersion, snapshotVersion: currentSnapshotVersion, state: projectedSnapshot };
  }

  await auditPublicAction({
    lobby: input.lobby,
    clientActionId,
    userId: input.userId,
    playerId: actorId,
    status: "accepted",
    actionVersion: acceptedVersion,
    baseActionVersion,
    preStateHash,
    postStateHash: finalStateHash,
    action: actionParse.data,
    metadata: { events: resolution.events, messages: resolution.messages, aiAdvanced: aiAdvance.actions.length },
  });
  await persistSnapshotCheckpoint({
    lobby: input.lobby,
    actionVersion: nextVersion,
    snapshotVersion: nextSnapshotVersion,
    stateHash: finalStateHash,
    snapshot: finalState,
  });

  return {
    ok: true,
    actionVersion: nextVersion,
    snapshotVersion: nextSnapshotVersion,
    stateHash: finalStateHash,
    state: projectGameStateForPlayers(finalState, controlledPlayerIds),
    aiAdvanced: aiAdvance.actions.length,
  };
}

export async function requestPublicTurnTimeout(input: {
  lobby: LobbyRecord;
  seats: PlayerSeat[];
  userId: number;
  now: number;
  timeoutMs: number;
}): Promise<PublicTimeoutResult> {
  const lobbyState = ((input.lobby.gameState as PublicLobbyState) ?? {}) as PublicLobbyState;
  if (!isPublicAuthoritativeLobbyState(lobbyState)) {
    return { ok: false, status: 400, error: "Lobby is not public-authoritative", reason: "wrong_authority_mode" };
  }
  const parsedSnapshot = GameStateSchema.safeParse(lobbyState.snapshot);
  if (!parsedSnapshot.success) {
    return { ok: false, status: 409, error: "Canonical snapshot unavailable", reason: "missing_snapshot" };
  }
  const actorId = getCurrentActorId(parsedSnapshot.data);
  const actorMeta = getPlayerMeta(lobbyState, actorId);
  if (!actorId || !actorMeta || actorMeta.isAI) {
    return { ok: false, status: 409, error: "No timeout-eligible human actor", reason: "not_timeout_eligible" };
  }
  const actorLastSeenAt = Number(actorMeta.lastSeenAt ?? 0);
  if (!Number.isFinite(actorLastSeenAt) || actorLastSeenAt <= 0 || input.now - actorLastSeenAt < input.timeoutMs) {
    return { ok: false, status: 409, error: "Turn timeout is not eligible yet", reason: "timeout_not_elapsed" };
  }

  const controlledPlayerIds = getControlledPlayerIds(lobbyState, input.seats, input.userId);
  const currentActionVersion = Number(lobbyState.actionVersion ?? 0);
  const currentSnapshotVersion = Number(lobbyState.snapshotVersion ?? 0);
  const action: GameAction = { type: "END_TURN", payload: { playerId: actorId } };
  const preStateHash = hashGameState(parsedSnapshot.data);
  const resolution = resolveAction(parsedSnapshot.data, action, { source: "server", actorId });
  if (resolution.state === parsedSnapshot.data) {
    return { ok: false, status: 422, error: "Timeout action was rejected by the resolver", reason: "resolver_noop" };
  }

  const aiAdvance = advancePublicAIActors(resolution.state);
  const finalState = aiAdvance.state;
  const finalStateHash = hashGameState(finalState);
  const actionEntries: unknown[] = [
    buildActionEntry({
      version: currentActionVersion + 1,
      id: `server-timeout-${input.lobby.code}-${currentActionVersion + 1}`,
      actorId,
      action,
      source: "timeout",
      userId: input.userId,
      stateHash: finalStateHash,
    }),
  ];
  let nextVersion = currentActionVersion + 1;
  for (const aiAction of aiAdvance.actions) {
    nextVersion += 1;
    actionEntries.push(buildActionEntry({
      version: nextVersion,
      id: `server-ai-${input.lobby.code}-${nextVersion}`,
      actorId: getExpectedActorIdFromSnapshot(finalState) ?? "ai",
      action: aiAction,
      source: "ai",
      stateHash: finalStateHash,
    }));
  }
  const nextSnapshotVersion = currentSnapshotVersion + actionEntries.length;
  const updated = await storage.updateLobbyIfUnchanged(input.lobby.id, input.lobby, {
    gameState: {
      ...lobbyState,
      actionVersion: nextVersion,
      snapshotVersion: nextSnapshotVersion,
      actions: appendActionEntries(lobbyState, actionEntries),
      snapshot: finalState,
      expectedActorId: getExpectedActorIdFromSnapshot(finalState),
      turnResolutionPending: false,
    },
  });
  if (!updated) {
    return { ok: false, status: 409, error: "Lobby changed while applying timeout", reason: "concurrent_update" };
  }
  await persistSnapshotCheckpoint({
    lobby: input.lobby,
    actionVersion: nextVersion,
    snapshotVersion: nextSnapshotVersion,
    stateHash: finalStateHash,
    snapshot: finalState,
  });

  return {
    ok: true,
    applied: true,
    reason: "timeout_applied",
    actionVersion: nextVersion,
    snapshotVersion: nextSnapshotVersion,
    stateHash: finalStateHash,
    state: projectGameStateForPlayers(finalState, controlledPlayerIds),
  };
}
