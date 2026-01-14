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
  handleBuildImprovement,
  handleBuildStructure,
  handleBuildUnit,
  handleRecruitUnit,
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
} from "./actions/diplomacy";
import { handleConvertCity, handleConvertUnit } from "./actions/conversion";
import {
  handleUseAbility,
  handleActivateFactionAbility,
} from "./actions/abilities";

export type ResolveSource = 'client' | 'server' | 'ai' | 'test';

export interface ResolveContext {
  source?: ResolveSource;
  actorId?: string;
  now?: number;
}

export interface GameEvent {
  type: string;
  payload?: unknown;
}

export interface GameMessage {
  kind: 'info' | 'warning' | 'error';
  text: string;
}

export interface ResolveResult {
  state: GameState;
  events: GameEvent[];
  messages: GameMessage[];
}

const withLastAction = (prev: GameState, next: GameState, action: GameAction): GameState => {
  if (next === prev) return prev;
  if (action.type === 'END_TURN') return next;
  return {
    ...next,
    lastAction: { type: action.type as any, payload: (action as any).payload },
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
  let nextState: GameState;
  switch (action.type) {
    case 'HEAL_UNIT':
      nextState = withLastAction(state, handleHealUnit(state, action.payload), action);
      break;
    case 'APPLY_STEALTH':
      nextState = withLastAction(state, handleApplyStealth(state, action.payload), action);
      break;
    case 'RECONNAISSANCE':
      nextState = withLastAction(state, handleReconnaissance(state, action.payload), action);
      break;
    case 'FORMATION_FIGHTING':
      nextState = withLastAction(state, handleFormationFighting(state, action.payload), action);
      break;
    case 'SIEGE_MODE':
      nextState = withLastAction(state, handleSiegeMode(state, action.payload), action);
      break;
    case 'RALLY_TROOPS':
      nextState = withLastAction(state, handleRallyTroops(state, action.payload), action);
      break;
    case 'CLEAR_FOREST':
      nextState = withLastAction(state, handleClearForest(state, action.payload), action);
      break;
    case 'BUILD_ROAD':
      nextState = withLastAction(state, handleBuildRoad(state, action.payload), action);
      break;
    case 'COASTAL_EXPLORE':
      nextState = withLastAction(state, handleCoastalExplore(state, action.payload), action);
      break;
    case 'ACTIVATE_FACTION_ABILITY':
      nextState = withLastAction(state, handleActivateFactionAbility(state, action.payload), action);
      break;
    case 'HARVEST_RESOURCE':
      nextState = withLastAction(state, handleHarvestResource(state, action.payload), action);
      break;
    case 'MOVE_UNIT':
      nextState = withLastAction(state, handleMoveUnit(state, action.payload), action);
      break;
    case 'ATTACK_UNIT':
      nextState = withLastAction(state, handleAttackUnit(state, action.payload), action);
      break;
    case 'END_TURN':
      nextState = handleEndTurn(state, action.payload);
      break;
    case 'RESEARCH_TECH':
      nextState = withLastAction(state, handleResearchTech(state, action.payload), action);
      break;
    case 'RESEARCH_TECHNOLOGY':
      nextState = withLastAction(state, handleResearchTechnology(state, action.payload), action);
      break;
    case 'START_CONSTRUCTION':
      nextState = withLastAction(state, handleStartConstruction(state, action.payload), action);
      break;
    case 'BUILD_IMPROVEMENT':
      nextState = withLastAction(state, handleBuildImprovement(state, action.payload), action);
      break;
    case 'BUILD_STRUCTURE':
      nextState = withLastAction(state, handleBuildStructure(state, action.payload), action);
      break;
    case 'BUILD_UNIT':
      nextState = withLastAction(state, handleBuildUnit(state, action.payload), action);
      break;
    case 'RECRUIT_UNIT':
      nextState = withLastAction(state, handleRecruitUnit(state, action.payload), action);
      break;
    case 'CAPTURE_CITY':
      nextState = withLastAction(state, handleCaptureCity(state, action.payload), action);
      break;
    case 'CONQUER_VILLAGE':
      nextState = withLastAction(state, handleConquerVillage(state, action.payload), action);
      break;
    case 'CONVERT_VILLAGE':
      nextState = withLastAction(state, handleConvertVillage(state, action.payload), action);
      break;
    case 'EXPLORE_RUINS':
      nextState = withLastAction(state, handleExploreRuins(state, action.payload), action);
      break;
    case 'WORLD_ELEMENT_HARVEST':
      nextState = withLastAction(state, handleWorldElementHarvest(state, action.payload), action);
      break;
    case 'WORLD_ELEMENT_BUILD':
      nextState = withLastAction(state, handleWorldElementBuild(state, action.payload), action);
      break;
    case 'USE_ABILITY':
      nextState = withLastAction(state, handleUseAbility(state, action.payload), action);
      break;
    case 'ESTABLISH_TRADE_ROUTE':
      nextState = withLastAction(state, handleEstablishTradeRoute(state, action.payload), action);
      break;
    case 'DECLARE_WAR':
      nextState = withLastAction(state, handleDeclareWar(state, action.payload), action);
      break;
    case 'FORM_ALLIANCE':
      nextState = withLastAction(state, handleFormAlliance(state, action.payload), action);
      break;
    case 'CONVERT_CITY':
      nextState = withLastAction(state, handleConvertCity(state, action.payload), action);
      break;
    case 'CONVERT_UNIT':
      nextState = withLastAction(state, handleConvertUnit(state, action.payload), action);
      break;
    case 'RENAME_CITY':
      nextState = withLastAction(state, handleRenameCity(state, action.payload), action);
      break;
    case 'UPGRADE_UNIT':
      nextState = withLastAction(state, handleUpgradeUnit(state, action.payload), action);
      break;
    default:
      {
        const _exhaustive: never = action;
        nextState = state;
      }
      break;
  }
  return {
    state: nextState,
    events: [],
    messages: [],
  };
}

export function resolveActionState(
  state: GameState,
  action: GameAction,
  ctx: ResolveContext = {}
): GameState {
  return resolveAction(state, action, ctx).state;
}
