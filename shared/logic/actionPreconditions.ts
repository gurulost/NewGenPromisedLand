import type { GameAction, GameState } from "../types/game";
import { getTurnPlayer } from "./turnOrder";
import type { ResolveContext } from "./actionResolution";

type ActionPayloadRecord = Record<string, unknown>;

export type CanonicalActionPreconditionReason =
  | "game_not_playing"
  | "missing_current_player"
  | "actor_context_mismatch"
  | "missing_actor_unit"
  | "payload_actor_mismatch"
  | "missing_actor"
  | "wrong_turn"
  | "city_not_owned";

export type CanonicalActionPreconditionResult =
  | {
      ok: true;
      actorPlayerId: string;
      currentPlayerId: string;
    }
  | {
      ok: false;
      reason: CanonicalActionPreconditionReason;
      details?: Record<string, unknown>;
    };

export const getActionPayload = (action: GameAction): ActionPayloadRecord =>
  ((action as { payload?: ActionPayloadRecord }).payload ?? {}) as ActionPayloadRecord;

export const getPayloadPlayerId = (action: GameAction): string | null => {
  const playerId = getActionPayload(action).playerId;
  return typeof playerId === "string" && playerId.length > 0 ? playerId : null;
};

export const getActionActorUnitId = (action: GameAction): string | null => {
  const payload = getActionPayload(action);
  if (typeof payload.attackerId === "string" && payload.attackerId.length > 0) {
    return payload.attackerId;
  }
  if (typeof payload.unitId === "string" && payload.unitId.length > 0) {
    return payload.unitId;
  }
  return null;
};

export const getRequiredOwnedCityIds = (action: GameAction): string[] => {
  const payload = getActionPayload(action);
  switch (action.type) {
    case "START_CONSTRUCTION":
    case "RENAME_CITY":
    case "HARVEST_RESOURCE":
      return typeof payload.cityId === "string" && payload.cityId.length > 0 ? [payload.cityId] : [];
    case "START_FAITH_PROJECT":
      return Array.isArray(payload.holyCityIds)
        ? payload.holyCityIds.filter((cityId): cityId is string => typeof cityId === "string" && cityId.length > 0)
        : [];
    case "ESTABLISH_TRADE_ROUTE":
      return [payload.fromCityId, payload.toCityId].filter(
        (cityId): cityId is string => typeof cityId === "string" && cityId.length > 0,
      );
    default:
      return [];
  }
};

export function checkCanonicalActionPreconditions(
  state: GameState,
  action: GameAction,
  ctx: ResolveContext = {},
): CanonicalActionPreconditionResult {
  if (state.phase !== "playing" || !!state.winner) {
    return { ok: false, reason: "game_not_playing" };
  }

  const currentPlayer = getTurnPlayer(state.players, state.currentPlayerIndex);
  if (!currentPlayer) return { ok: false, reason: "missing_current_player" };

  const payloadPlayerId = getPayloadPlayerId(action);
  if (ctx.actorId && payloadPlayerId && ctx.actorId !== payloadPlayerId) {
    return {
      ok: false,
      reason: "actor_context_mismatch",
      details: { actorId: ctx.actorId, payloadPlayerId },
    };
  }

  const actorUnitId = getActionActorUnitId(action);
  const actorUnit = actorUnitId
    ? state.units.find((unit) => unit.id === actorUnitId)
    : undefined;

  if (actorUnitId && !actorUnit) {
    return { ok: false, reason: "missing_actor_unit", details: { actorUnitId } };
  }

  if (payloadPlayerId && actorUnit && actorUnit.playerId !== payloadPlayerId) {
    return {
      ok: false,
      reason: "payload_actor_mismatch",
      details: { payloadPlayerId, unitPlayerId: actorUnit.playerId },
    };
  }

  const actorPlayerId = payloadPlayerId ?? actorUnit?.playerId ?? null;
  if (!actorPlayerId) {
    return { ok: false, reason: "missing_actor" };
  }

  if (ctx.actorId && ctx.actorId !== actorPlayerId) {
    return {
      ok: false,
      reason: "actor_context_mismatch",
      details: { actorId: ctx.actorId, actorPlayerId },
    };
  }

  if (actorPlayerId !== currentPlayer.id) {
    return {
      ok: false,
      reason: "wrong_turn",
      details: { actorPlayerId, currentPlayerId: currentPlayer.id },
    };
  }

  for (const cityId of getRequiredOwnedCityIds(action)) {
    const city = (state.cities || []).find((candidate) => candidate.id === cityId);
    if (!city || city.ownerId !== actorPlayerId) {
      return {
        ok: false,
        reason: "city_not_owned",
        details: { cityId, actorPlayerId },
      };
    }
  }

  return { ok: true, actorPlayerId, currentPlayerId: currentPlayer.id };
}

export function passesCanonicalActionPreconditions(
  state: GameState,
  action: GameAction,
  ctx: ResolveContext = {},
): boolean {
  return checkCanonicalActionPreconditions(state, action, ctx).ok;
}
