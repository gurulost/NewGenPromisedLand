import type { TelemetryEvent } from '@shared/logic/telemetry';
import { subscribeTelemetry } from '@shared/logic/telemetry';
import type { GameState } from '@shared/types/game';
import { capture } from './posthog';

type AnalyticsValue = string | number | boolean | null | AnalyticsValue[] | { [key: string]: AnalyticsValue };

export type GameplayActionSource =
  | 'local_offline'
  | 'online_host'
  | 'online_guest'
  | 'online_remote'
  | 'system';

export type GameplayMode = 'standard' | 'tutorialEpisode';

type ActionLike = {
  type: string;
  payload?: Record<string, unknown>;
};

interface ActionContext {
  actionSource: GameplayActionSource;
  gameMode: GameplayMode;
  isOnline: boolean;
  correlation: ActionCorrelationIds;
}

interface ActionCorrelationIds {
  actionId: string;
  turnId: string;
  matchId: string;
  actionVersion?: number | null;
  queueVersion?: number | null;
}

interface GameStartPlayer {
  id: string;
  factionId: string;
  isAI: boolean;
  aiDifficulty?: string;
}

interface GameStartContext {
  gameState: GameState;
  gameMode: GameplayMode;
  mapSize: string;
  isOnline: boolean;
  seed?: number;
}

interface GameLoadContext {
  gameState: GameState;
  source: string;
  saveId?: string | number;
}

interface GameSaveContext {
  gameState: GameState;
  source: string;
  saveId?: string | number;
  saveName?: string;
}

interface GameEndContext {
  gameState: GameState;
  source: string;
}

interface MenuSelectionContext {
  selection: string;
  location: string;
}

declare global {
  interface Window {
    __ngplSharedTelemetryBridgeInitialized?: boolean;
  }
}

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const hashTelemetryString = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const getSaveNameTelemetry = (saveName: string | undefined) => {
  const normalized = typeof saveName === 'string' ? saveName.trim() : '';
  if (!normalized) {
    return {
      save_name: null,
      save_name_hash: null,
      save_name_length: 0,
    };
  }

  return {
    save_name: '[redacted]',
    save_name_hash: hashTelemetryString(normalized),
    save_name_length: normalized.length,
  };
};

const sanitizeValue = (value: unknown, depth = 0): AnalyticsValue => {
  if (value === null) return null;
  if (typeof value === 'string') return value.slice(0, 200);
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'boolean') return value;
  if (depth >= 2) return String(value).slice(0, 200);

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => sanitizeValue(entry, depth + 1));
  }

  if (isRecord(value)) {
    const entries = Object.entries(value).slice(0, 20);
    const mapped: Record<string, AnalyticsValue> = {};
    for (const [key, entry] of entries) {
      mapped[key] = sanitizeValue(entry, depth + 1);
    }
    return mapped;
  }

  return String(value).slice(0, 200);
};

const coordinateToString = (value: unknown): string | null => {
  if (!isRecord(value)) return null;
  const q = toNumber(value.q);
  const r = toNumber(value.r);
  const s = toNumber(value.s);
  if (q === null || r === null) return null;
  const resolvedS = s ?? -q - r;
  return `${q},${r},${resolvedS}`;
};

const coordinateDistance = (from: unknown, to: unknown): number | null => {
  if (!isRecord(from) || !isRecord(to)) return null;
  const fq = toNumber(from.q);
  const fr = toNumber(from.r);
  const fs = toNumber(from.s) ?? (fq !== null && fr !== null ? -fq - fr : null);
  const tq = toNumber(to.q);
  const tr = toNumber(to.r);
  const ts = toNumber(to.s) ?? (tq !== null && tr !== null ? -tq - tr : null);
  if (fq === null || fr === null || fs === null || tq === null || tr === null || ts === null) {
    return null;
  }
  return Math.max(Math.abs(fq - tq), Math.abs(fr - tr), Math.abs(fs - ts));
};

const getCurrentPlayerId = (state: GameState): string | null => {
  return state.players[state.currentPlayerIndex]?.id ?? null;
};

const getGameSnapshot = (state: GameState) => {
  const aiCount = state.players.filter((player) => Boolean(player.isAI)).length;
  const humanCount = state.players.length - aiCount;
  return {
    game_id: state.id,
    turn: state.turn,
    player_count: state.players.length,
    ai_count: aiCount,
    human_count: humanCount,
    map_width: state.map.width,
    map_height: state.map.height,
    unit_count: state.units.length,
    city_count: state.cities.length,
    improvement_count: state.improvements.length,
    structure_count: state.structures.length,
    current_player_id: getCurrentPlayerId(state),
  };
};

const getActionCategory = (actionType: string): string => {
  if (['MOVE_UNIT', 'ATTACK_UNIT', 'HEAL_UNIT', 'USE_ABILITY'].includes(actionType)) return 'unit';
  if (['UPGRADE_UNIT'].includes(actionType)) return 'unit_production';
  if (['START_CONSTRUCTION'].includes(actionType)) return 'construction';
  if (['RESEARCH_TECH', 'RESEARCH_TECHNOLOGY'].includes(actionType)) return 'research';
  if (['CAPTURE_CITY', 'CONQUER_VILLAGE', 'CONVERT_VILLAGE'].includes(actionType)) return 'control';
  if (['DECLARE_WAR', 'FORM_ALLIANCE', 'BREAK_ALLIANCE', 'ESTABLISH_TRADE_ROUTE'].includes(actionType)) return 'diplomacy';
  if (actionType === 'END_TURN') return 'turn';
  return 'system';
};

const toActionName = (actionType: string): string => actionType.toLowerCase();

const getAddedUnits = (before: GameState, after: GameState) => {
  const beforeIds = new Set(before.units.map((unit) => unit.id));
  return after.units.filter((unit) => !beforeIds.has(unit.id));
};

const getRemovedUnits = (before: GameState, after: GameState) => {
  const afterIds = new Set(after.units.map((unit) => unit.id));
  return before.units.filter((unit) => !afterIds.has(unit.id));
};

const getCityOwnerChanges = (before: GameState, after: GameState) => {
  const beforeOwners = new Map(before.cities.map((city) => [city.id, city.ownerId]));
  return after.cities
    .map((city) => {
      const previousOwnerId = beforeOwners.get(city.id);
      if (!previousOwnerId || previousOwnerId === city.ownerId) return null;
      return {
        cityId: city.id,
        previousOwnerId,
        newOwnerId: city.ownerId,
      };
    })
    .filter((entry): entry is { cityId: string; previousOwnerId: string; newOwnerId: string } => Boolean(entry));
};

const getAddedStructures = (before: GameState, after: GameState) => {
  const beforeIds = new Set(before.structures.map((structure) => structure.id));
  return after.structures.filter((structure) => !beforeIds.has(structure.id));
};

const getAddedImprovements = (before: GameState, after: GameState) => {
  const beforeIds = new Set(before.improvements.map((improvement) => improvement.id));
  return after.improvements.filter((improvement) => !beforeIds.has(improvement.id));
};

const getNewResearchUnlocks = (before: GameState, after: GameState) => {
  const unlocked: Array<{ playerId: string; techId: string }> = [];
  for (const afterPlayer of after.players) {
    const beforePlayer = before.players.find((player) => player.id === afterPlayer.id);
    if (!beforePlayer) continue;
    const beforeSet = new Set(beforePlayer.researchedTechs || []);
    for (const techId of afterPlayer.researchedTechs || []) {
      if (!beforeSet.has(techId)) {
        unlocked.push({ playerId: afterPlayer.id, techId });
      }
    }
  }
  return unlocked;
};

const getVillageCaptureChanges = (before: GameState, after: GameState) => {
  type VillageCaptureChange = {
    coordinate: string;
    previousOwnerId: string | null;
    newOwnerId: string | null;
    captureType: string | null;
  };

  const beforeByCoord = new Map(
    before.map.tiles
      .filter((tile) => tile.feature === 'village')
      .map((tile) => [`${tile.coordinate.q},${tile.coordinate.r}`, tile])
  );

  const changes: VillageCaptureChange[] = [];

  for (const tile of after.map.tiles.filter((entry) => entry.feature === 'village')) {
    const key = `${tile.coordinate.q},${tile.coordinate.r}`;
    const previousTile = beforeByCoord.get(key);
    if (!previousTile) continue;
    if (previousTile.cityOwner === tile.cityOwner && previousTile.captureType === tile.captureType) continue;
    changes.push({
      coordinate: key,
      previousOwnerId: previousTile.cityOwner ?? null,
      newOwnerId: tile.cityOwner ?? null,
      captureType: tile.captureType ?? null,
    });
  }

  return changes;
};

const getActionActorId = (action: ActionLike): string | null => {
  const payload = action.payload;
  if (!payload) return null;
  if (typeof payload.playerId === 'string') return payload.playerId;
  return null;
};

const ACTION_PAYLOAD_STRING_KEYS = [
  'playerId',
  'unitId',
  'attackerId',
  'targetId',
  'cityId',
  'abilityId',
  'techId',
  'fromCityId',
  'toCityId',
  'targetPlayerId',
  'villageId',
  'improvementType',
  'structureType',
  'reason',
] as const;

const ACTION_PAYLOAD_NUMBER_KEYS = [
  'amount',
  'cost',
  'turn',
  'version',
] as const;

const ACTION_PAYLOAD_BOOLEAN_KEYS = [
  'force',
  'autoResolve',
] as const;

const ACTION_PAYLOAD_COORD_KEYS = [
  'coordinate',
  'targetCoordinate',
  'resourceCoordinate',
  'cityCoordinate',
] as const;

const getActionPayloadSummary = (payload: unknown): Record<string, AnalyticsValue> => {
  if (!isRecord(payload)) return {};

  const summary: Record<string, AnalyticsValue> = {};

  for (const key of ACTION_PAYLOAD_STRING_KEYS) {
    const value = payload[key];
    if (typeof value === 'string') {
      summary[key] = value.slice(0, 120);
    }
  }

  for (const key of ACTION_PAYLOAD_NUMBER_KEYS) {
    const value = payload[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      summary[key] = value;
    }
  }

  for (const key of ACTION_PAYLOAD_BOOLEAN_KEYS) {
    const value = payload[key];
    if (typeof value === 'boolean') {
      summary[key] = value;
    }
  }

  for (const key of ACTION_PAYLOAD_COORD_KEYS) {
    const value = payload[key];
    const coordinate = coordinateToString(value);
    if (coordinate) {
      summary[key] = coordinate;
    }
  }

  return summary;
};

const getCombatEventProperties = (
  action: ActionLike,
  before: GameState,
  after: GameState,
  context: ActionContext,
) => {
  if (action.type !== 'ATTACK_UNIT') return null;
  const attackerId = typeof action.payload?.attackerId === 'string' ? action.payload.attackerId : null;
  const defenderId = typeof action.payload?.targetId === 'string' ? action.payload.targetId : null;
  if (!attackerId || !defenderId) return null;

  const attackerBefore = before.units.find((unit) => unit.id === attackerId);
  const defenderBefore = before.units.find((unit) => unit.id === defenderId);
  if (!attackerBefore || !defenderBefore) return null;

  const attackerAfter = after.units.find((unit) => unit.id === attackerId);
  const defenderAfter = after.units.find((unit) => unit.id === defenderId);

  const attackerHpAfter = attackerAfter?.hp ?? 0;
  const defenderHpAfter = defenderAfter?.hp ?? 0;
  const attackerDamage = Math.max(0, attackerBefore.hp - attackerHpAfter);
  const defenderDamage = Math.max(0, defenderBefore.hp - defenderHpAfter);
  const terrainType = before.map.tiles.find(
    (tile) =>
      tile.coordinate.q === defenderBefore.coordinate.q &&
      tile.coordinate.r === defenderBefore.coordinate.r
  )?.terrain;

  return {
    attacker_id: attackerId,
    defender_id: defenderId,
    attacker_type: attackerBefore.type,
    defender_type: defenderBefore.type,
    attacker_damage: attackerDamage,
    defender_damage: defenderDamage,
    attacker_survived: Boolean(attackerAfter),
    defender_survived: Boolean(defenderAfter),
    attack_distance: coordinateDistance(attackerBefore.coordinate, defenderBefore.coordinate),
    terrain_type: terrainType ?? 'unknown',
    action_source: context.actionSource,
    game_mode: context.gameMode,
    is_online: context.isOnline,
    action_id: context.correlation.actionId,
    turn_id: context.correlation.turnId,
    match_id: context.correlation.matchId,
    action_version: context.correlation.actionVersion ?? null,
    queue_version: context.correlation.queueVersion ?? null,
    turn: before.turn,
    game_id: before.id,
  };
};

const captureActionDerivedEvents = (
  action: ActionLike,
  before: GameState,
  after: GameState,
  context: ActionContext,
) => {
  const common = {
    action_source: context.actionSource,
    game_mode: context.gameMode,
    is_online: context.isOnline,
    action_id: context.correlation.actionId,
    turn_id: context.correlation.turnId,
    match_id: context.correlation.matchId,
    action_version: context.correlation.actionVersion ?? null,
    queue_version: context.correlation.queueVersion ?? null,
    turn_before: before.turn,
    turn_after: after.turn,
    game_id: after.id,
  };

  const addedUnits = getAddedUnits(before, after);
  for (const unit of addedUnits) {
    capture('unit_created', {
      ...common,
      unit_id: unit.id,
      unit_type: unit.type,
      owner_player_id: unit.playerId,
      coordinate: coordinateToString(unit.coordinate),
      trigger_action: action.type,
    });
  }

  const addedStructures = getAddedStructures(before, after);
  for (const structure of addedStructures) {
    capture('building_constructed', {
      ...common,
      building_category: 'structure',
      building_id: structure.id,
      building_type: structure.type,
      owner_player_id: structure.ownerId,
      city_id: structure.cityId,
      coordinate: coordinateToString(structure.coordinate),
      trigger_action: action.type,
    });
  }

  const addedImprovements = getAddedImprovements(before, after);
  for (const improvement of addedImprovements) {
    capture('building_constructed', {
      ...common,
      building_category: 'improvement',
      building_id: improvement.id,
      building_type: improvement.type,
      owner_player_id: improvement.ownerId,
      city_id: improvement.cityId,
      coordinate: coordinateToString(improvement.coordinate),
      trigger_action: action.type,
    });
  }

  const cityOwnerChanges = getCityOwnerChanges(before, after);
  for (const cityChange of cityOwnerChanges) {
    capture('city_captured', {
      ...common,
      city_id: cityChange.cityId,
      previous_owner_id: cityChange.previousOwnerId,
      new_owner_id: cityChange.newOwnerId,
      trigger_action: action.type,
    });
  }

  const villageChanges = getVillageCaptureChanges(before, after);
  for (const villageChange of villageChanges) {
    capture('village_captured', {
      ...common,
      coordinate: villageChange.coordinate,
      previous_owner_id: villageChange.previousOwnerId,
      new_owner_id: villageChange.newOwnerId,
      capture_type: villageChange.captureType,
      trigger_action: action.type,
    });
  }

  const unlockedTechs = getNewResearchUnlocks(before, after);
  for (const unlock of unlockedTechs) {
    capture('tech_researched', {
      ...common,
      player_id: unlock.playerId,
      tech_id: unlock.techId,
      trigger_action: action.type,
    });
  }

  if (action.type === 'END_TURN') {
    const endingPlayerId = typeof action.payload?.playerId === 'string' ? action.payload.playerId : null;
    const nextPlayerId = getCurrentPlayerId(after);
    const endingPlayerBefore = endingPlayerId
      ? before.players.find((player) => player.id === endingPlayerId)
      : null;
    const endingPlayerAfter = endingPlayerId
      ? after.players.find((player) => player.id === endingPlayerId)
      : null;
    capture('turn_ended', {
      ...common,
      ending_player_id: endingPlayerId,
      next_player_id: nextPlayerId,
      turn_advanced: after.turn > before.turn,
      ending_player_stars_before: endingPlayerBefore?.stars ?? null,
      ending_player_stars_after: endingPlayerAfter?.stars ?? null,
      ending_player_faith_after: endingPlayerAfter?.stats.faith ?? null,
      ending_player_pride_after: endingPlayerAfter?.stats.pride ?? null,
      ending_player_dissent_after: endingPlayerAfter?.stats.internalDissent ?? null,
    });
  }

  const removedUnits = getRemovedUnits(before, after);
  if (removedUnits.length > 0) {
    capture('units_removed', {
      ...common,
      removed_unit_count: removedUnits.length,
      removed_unit_types: removedUnits.map((unit) => unit.type),
      removed_owner_ids: removedUnits.map((unit) => unit.playerId),
      trigger_action: action.type,
    });
  }

  const combatProperties = getCombatEventProperties(action, before, after, context);
  if (combatProperties) {
    capture('combat_event', combatProperties);
  }
};

export function trackPlayerSetupChoices(players: GameStartPlayer[], mapSize: string): void {
  const playerCount = players.length;
  const aiCount = players.filter((player) => player.isAI).length;
  capture('player_choice', {
    choice_type: 'map_size',
    choice_value: mapSize,
    player_count: playerCount,
    ai_count: aiCount,
  });

  for (const player of players) {
    capture('player_choice', {
      choice_type: 'faction',
      choice_value: player.factionId,
      player_id: player.id,
      is_ai: player.isAI,
      ai_difficulty: player.aiDifficulty ?? null,
      player_count: playerCount,
      ai_count: aiCount,
    });

    if (player.isAI && player.aiDifficulty) {
      capture('player_choice', {
        choice_type: 'difficulty',
        choice_value: player.aiDifficulty,
        player_id: player.id,
        is_ai: true,
      });
    }
  }
}

export function trackGameStarted(context: GameStartContext): void {
  const snapshot = getGameSnapshot(context.gameState);
  capture('game_started', {
    ...snapshot,
    game_mode: context.gameMode,
    map_size: context.mapSize,
    is_online: context.isOnline,
    seed: context.seed ?? null,
    factions: context.gameState.players.map((player) => player.factionId),
    human_factions: context.gameState.players
      .filter((player) => !player.isAI)
      .map((player) => player.factionId),
    ai_difficulties: context.gameState.players
      .filter((player) => player.isAI)
      .map((player) => player.aiDifficulty ?? 'normal'),
  });
}

export function trackGameLoaded(context: GameLoadContext): void {
  capture('game_loaded', {
    ...getGameSnapshot(context.gameState),
    load_source: context.source,
    save_id: context.saveId ?? null,
  });
}

export function trackGameSaved(context: GameSaveContext): void {
  capture('game_saved', {
    ...getGameSnapshot(context.gameState),
    save_source: context.source,
    save_id: context.saveId ?? null,
    ...getSaveNameTelemetry(context.saveName),
  });
}

export function trackGameEnded(context: GameEndContext): void {
  capture('game_ended', {
    ...getGameSnapshot(context.gameState),
    winner: context.gameState.winner ?? null,
    victory_type: context.gameState.victoryType ?? null,
    total_turns: context.gameState.turn,
    end_source: context.source,
  });
}

export function trackGamePhaseChanged(previousPhase: string, nextPhase: string): void {
  capture('game_phase_changed', {
    previous_phase: previousPhase,
    next_phase: nextPhase,
  });
}

export function trackMenuSelection(context: MenuSelectionContext): void {
  capture('menu_selection', {
    selection: context.selection,
    location: context.location,
  });
}

export function trackGameplayActionApplied(
  action: ActionLike,
  before: GameState,
  after: GameState,
  context: ActionContext,
): void {
  const payloadSummary = getActionPayloadSummary(action.payload ?? {});
  capture('gameplay_action', {
    action_type: toActionName(action.type),
    action_name: action.type,
    action_category: getActionCategory(action.type),
    action_source: context.actionSource,
    game_mode: context.gameMode,
    is_online: context.isOnline,
    actor_id: getActionActorId(action),
    applied: true,
    action_id: context.correlation.actionId,
    turn_id: context.correlation.turnId,
    match_id: context.correlation.matchId,
    action_version: context.correlation.actionVersion ?? null,
    queue_version: context.correlation.queueVersion ?? null,
    turn_before: before.turn,
    turn_after: after.turn,
    ...getGameSnapshot(after),
    action_payload_summary: payloadSummary,
    action_payload_keys: Object.keys(payloadSummary),
  });

  captureActionDerivedEvents(action, before, after, context);
}

export function trackGameplayActionBlocked(
  action: ActionLike,
  reason: string,
  context: ActionContext,
  gameState: GameState | null,
): void {
  const snapshot = gameState ? getGameSnapshot(gameState) : {};
  const payloadSummary = getActionPayloadSummary(action.payload ?? {});
  capture('gameplay_action_blocked', {
    action_type: toActionName(action.type),
    action_name: action.type,
    action_category: getActionCategory(action.type),
    action_source: context.actionSource,
    game_mode: context.gameMode,
    is_online: context.isOnline,
    actor_id: getActionActorId(action),
    blocked_reason: reason,
    applied: false,
    action_id: context.correlation.actionId,
    turn_id: context.correlation.turnId,
    match_id: context.correlation.matchId,
    action_version: context.correlation.actionVersion ?? null,
    queue_version: context.correlation.queueVersion ?? null,
    ...snapshot,
    action_payload_summary: payloadSummary,
    action_payload_keys: Object.keys(payloadSummary),
  });
}

const captureSharedTelemetryEvent = (event: TelemetryEvent): void => {
  const base = {
    channel: event.channel,
    status: event.status,
    player_id: event.playerId ?? null,
    ability_id: event.abilityId ?? null,
    attacker_id: event.attackerId ?? null,
    defender_id: event.defenderId ?? null,
    technology_id: event.technologyId ?? null,
    reason: event.reason ?? null,
    damage: event.damage ?? null,
    metadata: sanitizeValue(event.metadata ?? {}),
    occurred_at: event.timestamp,
  };

  capture('logic_telemetry_event', base);
  capture(`logic_${event.channel}_event`, base);
};

export function initSharedTelemetryBridge(): void {
  if (typeof window === 'undefined') return;
  if (window.__ngplSharedTelemetryBridgeInitialized) return;
  window.__ngplSharedTelemetryBridgeInitialized = true;

  subscribeTelemetry((event) => {
    captureSharedTelemetryEvent(event);
  });
}
