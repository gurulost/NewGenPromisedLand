import { getUnitDefinition } from "../data/units";
import type { City } from "../types/city";
import type { GameState, PlayerState } from "../types/game";
import type { Unit } from "../types/unit";
import { hexDistance } from "../utils/hex";
import { getUnitActionsRemaining } from "./unitLogic";

export type CityCaptureBlockReason =
  | "missing_player"
  | "missing_unit"
  | "missing_city"
  | "not_players_turn"
  | "unit_not_owned"
  | "city_already_owned"
  | "unit_has_no_actions"
  | "unit_not_military"
  | "not_adjacent"
  | "not_at_war"
  | "city_garrisoned";

export interface CityCaptureEvaluation {
  canCapture: boolean;
  reason?: CityCaptureBlockReason;
  player?: PlayerState;
  unit?: Unit;
  city?: City;
}

const NON_MILITARY_TAGS = new Set(["civilian", "influence", "diplomat"]);

function isPlayerTurn(state: GameState, playerId: string): boolean {
  return state.players[state.currentPlayerIndex]?.id === playerId;
}

function isCityOwnedByPlayer(city: City, player: PlayerState): boolean {
  return city.ownerId === player.id || player.citiesOwned.includes(city.id);
}

function isMilitaryUnit(unit: Unit): boolean {
  const unitDef = getUnitDefinition(unit.type);
  const tags = unitDef?.tags ?? [];
  return !tags.some(tag => NON_MILITARY_TAGS.has(tag));
}

function hasDefendingGarrison(state: GameState, city: City, playerId: string): boolean {
  return state.units.some(unit =>
    unit.playerId !== playerId &&
    unit.coordinate.q === city.coordinate.q &&
    unit.coordinate.r === city.coordinate.r &&
    unit.coordinate.s === city.coordinate.s &&
    isMilitaryUnit(unit)
  );
}

export function evaluateCityCapture(
  state: GameState,
  payload: { playerId: string; unitId: string; cityId: string }
): CityCaptureEvaluation {
  const { playerId, unitId, cityId } = payload;

  const player = state.players.find(p => p.id === playerId);
  if (!player) return { canCapture: false, reason: "missing_player" };

  const unit = state.units.find(candidate => candidate.id === unitId);
  if (!unit) return { canCapture: false, reason: "missing_unit", player };

  const city = (state.cities || []).find(candidate => candidate.id === cityId);
  if (!city) return { canCapture: false, reason: "missing_city", player, unit };

  if (!isPlayerTurn(state, playerId)) {
    return { canCapture: false, reason: "not_players_turn", player, unit, city };
  }

  if (unit.playerId !== player.id) {
    return { canCapture: false, reason: "unit_not_owned", player, unit, city };
  }

  if (isCityOwnedByPlayer(city, player)) {
    return { canCapture: false, reason: "city_already_owned", player, unit, city };
  }

  if (getUnitActionsRemaining(unit) <= 0) {
    return { canCapture: false, reason: "unit_has_no_actions", player, unit, city };
  }

  if (!isMilitaryUnit(unit)) {
    return { canCapture: false, reason: "unit_not_military", player, unit, city };
  }

  if (hexDistance(unit.coordinate, city.coordinate) > 1) {
    return { canCapture: false, reason: "not_adjacent", player, unit, city };
  }

  if (city.ownerId && city.ownerId !== playerId && !player.atWarWith?.includes(city.ownerId)) {
    return { canCapture: false, reason: "not_at_war", player, unit, city };
  }

  // Current state model has no separate city-garrison entity, so "garrison defeated"
  // is modeled as "no defending military unit remains on the city tile."
  if (hasDefendingGarrison(state, city, playerId)) {
    return { canCapture: false, reason: "city_garrisoned", player, unit, city };
  }

  return { canCapture: true, player, unit, city };
}

export function canUnitCaptureCity(
  state: GameState,
  payload: { playerId: string; unitId: string; cityId: string }
): boolean {
  return evaluateCityCapture(state, payload).canCapture;
}

export function getCapturableCitiesForUnit(
  unit: Unit,
  player: PlayerState,
  state: GameState
): City[] {
  return (state.cities || []).filter(city =>
    canUnitCaptureCity(state, { playerId: player.id, unitId: unit.id, cityId: city.id })
  );
}
