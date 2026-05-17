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
import { checkVictoryConditions, handleEndTurn } from "./actions/turns";
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
import { startFaithProject } from "./faithProject";
import { createResolveResult, type GameEvent, type ResolveContext, type ResolveResult } from "./actionResolution";
import { passesCanonicalActionPreconditions } from "./actionPreconditions";

export type {
  GameEvent,
  GameMessage,
  ResolveContext,
  ResolveResult,
  ResolveSource,
} from "./actionResolution";

const withLastAction = (prev: GameState, next: GameState, action: GameAction): GameState => {
  if (next === prev) return prev;
  if (action.type === 'END_TURN') return next;
  if (action.type === 'USE_ABILITY' && next.lastAction && next.lastAction !== prev.lastAction) {
    return next;
  }
  return {
    ...next,
    lastAction: { type: action.type as any, payload: (action as any).payload },
  };
};

const withActionResolutionLastAction = (
  prev: GameState,
  next: GameState,
  action: GameAction,
  events: GameEvent[],
): GameState => {
  if (events.length === 0) return withLastAction(prev, next, action);
  return {
    ...next,
    lastAction: {
      type: 'ACTION_RESOLUTION',
      payload: {
        action: { type: action.type, payload: (action as { payload?: unknown }).payload },
        events,
      },
    },
  };
};

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
  const withActionResolutionResult = (result: ResolveResult): ResolveResult => ({
    ...result,
    state: withActionResolutionLastAction(state, result.state, action, result.events),
  });
  const applyImmediateVictory = (nextState: GameState): GameState => {
    if (nextState === state || nextState.phase === "ended" || nextState.winner) return nextState;

    const victory = checkVictoryConditions(nextState, nextState.players);
    if (!victory) return nextState;

    return {
      ...nextState,
      phase: "ended",
      winner: victory.winnerId,
      victoryType: victory.victoryType,
    };
  };
  const applyImmediateVictoryResult = (result: ResolveResult): ResolveResult => ({
    ...result,
    state: applyImmediateVictory(result.state),
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
      return withActionResolutionResult(handleAttackUnit(state, action.payload));
    case 'END_TURN':
      return createResolveResult(handleEndTurn(state, action.payload));
    case 'RESEARCH_TECH':
      return createResolveResult(withLastAction(state, handleResearchTech(state, action.payload), action));
    case 'RESEARCH_TECHNOLOGY':
      return createResolveResult(withLastAction(state, handleResearchTechnology(state, action.payload), action));
    case 'START_CONSTRUCTION':
      return createResolveResult(withLastAction(state, handleStartConstruction(state, action.payload), action));
    case 'START_FAITH_PROJECT': {
      const result = startFaithProject(state, action.payload);
      return withActionResolutionResult(createResolveResult(result.state, { events: result.events }));
    }
    case 'CAPTURE_CITY':
      return withActionResolutionResult(applyImmediateVictoryResult(handleCaptureCity(state, action.payload)));
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
      return withActionResolutionResult(applyImmediateVictoryResult(handleConvertCity(state, action.payload)));
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
