import type { RuinsReward } from "../data/ruinsRewards";
import type { HexCoordinate } from "../types/coordinates";
import type { GameState } from "../types/game";

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

export const GAME_EVENT_TYPES = {
  villageEncounter: 'VILLAGE_ENCOUNTER',
  ruinsReward: 'RUINS_REWARD',
} as const;

export interface VillageEncounterEvent extends GameEvent {
  type: typeof GAME_EVENT_TYPES.villageEncounter;
  payload: {
    unitId: string;
    coordinate: HexCoordinate;
  };
}

export interface RuinsRewardEvent extends GameEvent {
  type: typeof GAME_EVENT_TYPES.ruinsReward;
  payload: {
    reward: RuinsReward;
    coordinate: HexCoordinate;
  };
}

export function createResolveResult(
  state: GameState,
  options: {
    events?: GameEvent[];
    messages?: GameMessage[];
  } = {}
): ResolveResult {
  return {
    state,
    events: options.events ?? [],
    messages: options.messages ?? [],
  };
}

export function createVillageEncounterEvent(payload: VillageEncounterEvent['payload']): VillageEncounterEvent {
  return {
    type: GAME_EVENT_TYPES.villageEncounter,
    payload,
  };
}

export function createRuinsRewardEvent(payload: RuinsRewardEvent['payload']): RuinsRewardEvent {
  return {
    type: GAME_EVENT_TYPES.ruinsReward,
    payload,
  };
}

export function isVillageEncounterEvent(event: GameEvent): event is VillageEncounterEvent {
  return event.type === GAME_EVENT_TYPES.villageEncounter;
}

export function isRuinsRewardEvent(event: GameEvent): event is RuinsRewardEvent {
  return event.type === GAME_EVENT_TYPES.ruinsReward;
}
