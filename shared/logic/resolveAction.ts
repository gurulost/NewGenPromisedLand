import { GameAction, GameState } from "../types/game";
import {
  handleApplyStealth,
  handleBuildRoad,
  handleClearForest,
  handleCoastalExplore,
  handleFormationFighting,
  handleHealUnit,
  handleReconnaissance,
  handleRallyTroops,
  handleSiegeMode,
} from "./unitActionHandlers";
import { handleMoveUnit, handleAttackUnit } from "./actions/movementCombat";
import { handleEndTurn } from "./actions/turns";
import { handleResearchTech, handleResearchTechnology } from "./actions/research";
import {
  handleStartConstruction,
  handleCaptureCity,
  handleHarvestResource,
  handleRenameCity,
  handleUpgradeUnit,
} from "./actions/construction";
import {
  handleExploreRuins,
  handleWorldElementHarvest,
  handleWorldElementBuild,
  handleConquerVillage,
  handleConvertVillage,
} from "./actions/worldElements";
import {
  handleEstablishTradeRoute,
  handleDeclareWar,
  handleFormAlliance,
  handleBreakAlliance,
} from "./actions/diplomacy";
import { handleConvertCity, handleConvertUnit } from "./actions/conversion";
import {
  handleUseAbility,
  handleActivateFactionAbility,
} from "./actions/abilities";
import { getTurnPlayer } from "./turnOrder";
import { createResolveResult, type ResolveContext, type ResolveResult } from "./actionResolution";

export type {
  GameEvent,
  GameMessage,
  ResolveContext,
  ResolveResult,
  ResolveSource,
} from "./actionResolution";

type ActionPayloadRecord = Record<string, unknown>;

const withLastAction = (prev: GameState, next: GameState, action: GameAction): GameState => {
  if (next === prev) return prev;
  if (action.type === 'END_TURN') return next;
  return {
    ...next,
    lastAction: { type: action.type as any, payload: (action as any).payload },
  };
};

const getActionPayload = (action: GameAction): ActionPayloadRecord =>
  ((action as { payload?: ActionPayloadRecord }).payload ?? {}) as ActionPayloadRecord;

const getPayloadPlayerId = (action: GameAction): string | null => {
  const playerId = getActionPayload(action).playerId;
  return typeof playerId === "string" && playerId.length > 0 ? playerId : null;
};

const getActionActorUnitId = (action: GameAction): string | null => {
  const payload = getActionPayload(action);
  if (typeof payload.attackerId === "string" && payload.attackerId.length > 0) {
    return payload.attackerId;
  }
  if (typeof payload.unitId === "string" && payload.unitId.length > 0) {
    return payload.unitId;
  }
  return null;
};

const getRequiredOwnedCityIds = (action: GameAction): string[] => {
  const payload = getActionPayload(action);
  switch (action.type) {
    case "START_CONSTRUCTION":
    case "RENAME_CITY":
    case "HARVEST_RESOURCE":
      return typeof payload.cityId === "string" && payload.cityId.length > 0 ? [payload.cityId] : [];
    case "ESTABLISH_TRADE_ROUTE":
      return [payload.fromCityId, payload.toCityId].filter(
        (cityId): cityId is string => typeof cityId === "string" && cityId.length > 0,
      );
    default:
      return [];
  }
};

function passesCanonicalActionPreconditions(
  state: GameState,
  action: GameAction,
  ctx: ResolveContext,
): boolean {
  if (state.phase !== "playing" || !!state.winner) {
    return false;
  }

  const currentPlayer = getTurnPlayer(state.players, state.currentPlayerIndex);
  if (!currentPlayer) return false;

  const payloadPlayerId = getPayloadPlayerId(action);
  if (ctx.actorId && payloadPlayerId && ctx.actorId !== payloadPlayerId) {
    return false;
  }

  const actorUnitId = getActionActorUnitId(action);
  const actorUnit = actorUnitId
    ? state.units.find((unit) => unit.id === actorUnitId)
    : undefined;

  if (actorUnitId && !actorUnit) {
    return false;
  }

  if (payloadPlayerId && actorUnit && actorUnit.playerId !== payloadPlayerId) {
    return false;
  }

  const actorPlayerId = payloadPlayerId ?? actorUnit?.playerId ?? null;
  if (!actorPlayerId) {
    return false;
  }

  if (ctx.actorId && ctx.actorId !== actorPlayerId) {
    return false;
  }

  if (actorPlayerId !== currentPlayer.id) {
    return false;
  }

  for (const cityId of getRequiredOwnedCityIds(action)) {
    const city = (state.cities || []).find((candidate) => candidate.id === cityId);
    if (!city || city.ownerId !== actorPlayerId) {
      return false;
    }
  }

  return true;
}

/**
 * Canonical action resolver entry point.
 *
 * Canonical action resolver.
 * All action handling flows through this switch to avoid split-brain logic.
 */
export function resolveAction(
  state: GameState,
  action: GameAction,
  _ctx: ResolveContext = {}
): ResolveResult {
  if (state.phase === "ended" || state.winner) {
    return createResolveResult(state, {
      messages: [{ kind: "warning", text: "Game has already ended." }],
    });
  }

  if (!passesCanonicalActionPreconditions(state, action, _ctx)) {
    return createResolveResult(state);
  }

  const withLastActionResult = (result: ResolveResult): ResolveResult => ({
    ...result,
    state: withLastAction(state, result.state, action),
  });
  switch (action.type) {
    case 'HEAL_UNIT':
      return createResolveResult(withLastAction(state, handleHealUnit(state, action.payload), action));
    case 'APPLY_STEALTH':
      return createResolveResult(withLastAction(state, handleApplyStealth(state, action.payload), action));
    case 'RECONNAISSANCE':
      return createResolveResult(withLastAction(state, handleReconnaissance(state, action.payload), action));
    case 'FORMATION_FIGHTING':
      return createResolveResult(withLastAction(state, handleFormationFighting(state, action.payload), action));
    case 'SIEGE_MODE':
      return createResolveResult(withLastAction(state, handleSiegeMode(state, action.payload), action));
    case 'RALLY_TROOPS':
      return createResolveResult(withLastAction(state, handleRallyTroops(state, action.payload), action));
    case 'CLEAR_FOREST':
      return createResolveResult(withLastAction(state, handleClearForest(state, action.payload), action));
    case 'BUILD_ROAD':
      return createResolveResult(withLastAction(state, handleBuildRoad(state, action.payload), action));
    case 'COASTAL_EXPLORE':
      return createResolveResult(withLastAction(state, handleCoastalExplore(state, action.payload), action));
    case 'ACTIVATE_FACTION_ABILITY':
      return createResolveResult(withLastAction(state, handleActivateFactionAbility(state, action.payload), action));
    case 'HARVEST_RESOURCE':
      return createResolveResult(withLastAction(state, handleHarvestResource(state, action.payload), action));
    case 'MOVE_UNIT':
      return withLastActionResult(handleMoveUnit(state, action.payload));
    case 'ATTACK_UNIT':
      return createResolveResult(withLastAction(state, handleAttackUnit(state, action.payload), action));
    case 'END_TURN':
      return createResolveResult(handleEndTurn(state, action.payload));
    case 'RESEARCH_TECH':
      return createResolveResult(withLastAction(state, handleResearchTech(state, action.payload), action));
    case 'RESEARCH_TECHNOLOGY':
      return createResolveResult(withLastAction(state, handleResearchTechnology(state, action.payload), action));
    case 'START_CONSTRUCTION':
      return createResolveResult(withLastAction(state, handleStartConstruction(state, action.payload), action));
    case 'CAPTURE_CITY':
      return createResolveResult(withLastAction(state, handleCaptureCity(state, action.payload), action));
    case 'CONQUER_VILLAGE':
      return createResolveResult(withLastAction(state, handleConquerVillage(state, action.payload), action));
    case 'CONVERT_VILLAGE':
      return createResolveResult(withLastAction(state, handleConvertVillage(state, action.payload), action));
    case 'EXPLORE_RUINS':
      return withLastActionResult(handleExploreRuins(state, action.payload));
    case 'WORLD_ELEMENT_HARVEST':
      return withLastActionResult(handleWorldElementHarvest(state, action.payload));
    case 'WORLD_ELEMENT_BUILD':
      return createResolveResult(withLastAction(state, handleWorldElementBuild(state, action.payload), action));
    case 'USE_ABILITY':
      return createResolveResult(withLastAction(state, handleUseAbility(state, action.payload), action));
    case 'ESTABLISH_TRADE_ROUTE':
      return createResolveResult(withLastAction(state, handleEstablishTradeRoute(state, action.payload), action));
    case 'DECLARE_WAR':
      return createResolveResult(withLastAction(state, handleDeclareWar(state, action.payload), action));
    case 'FORM_ALLIANCE':
      return createResolveResult(withLastAction(state, handleFormAlliance(state, action.payload), action));
    case 'BREAK_ALLIANCE':
      return createResolveResult(withLastAction(state, handleBreakAlliance(state, action.payload), action));
    case 'CONVERT_CITY':
      return createResolveResult(withLastAction(state, handleConvertCity(state, action.payload), action));
    case 'CONVERT_UNIT':
      return createResolveResult(withLastAction(state, handleConvertUnit(state, action.payload), action));
    case 'RENAME_CITY':
      return createResolveResult(withLastAction(state, handleRenameCity(state, action.payload), action));
    case 'UPGRADE_UNIT':
      return createResolveResult(withLastAction(state, handleUpgradeUnit(state, action.payload), action));
    default:
      {
        const _exhaustive: never = action;
        void _exhaustive;
      }
      return createResolveResult(state);
  }
}

export function resolveActionState(
  state: GameState,
  action: GameAction,
  ctx: ResolveContext = {}
): GameState {
  return resolveAction(state, action, ctx).state;
}
