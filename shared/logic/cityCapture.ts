import type { City } from "../types/city";
import type { GameState, PlayerState } from "../types/game";
import type { Unit } from "../types/unit";
import { hexDistance } from "../utils/hex";

function isPlayerTurn(state: GameState, playerId: string): boolean {
  return state.players[state.currentPlayerIndex]?.id === playerId;
}

function isCityOwnedByPlayer(city: City, player: PlayerState): boolean {
  return city.ownerId === player.id || player.citiesOwned.includes(city.id);
}

export function canUnitCaptureCity(unit: Unit, city: City, player: PlayerState): boolean {
  if (unit.playerId !== player.id) return false;
  if (isCityOwnedByPlayer(city, player)) return false;

  return hexDistance(unit.coordinate, city.coordinate) <= 1;
}

export function getCapturableCitiesForUnit(
  unit: Unit,
  player: PlayerState,
  state: GameState
): City[] {
  if (!isPlayerTurn(state, player.id)) return [];

  return (state.cities || []).filter(city => canUnitCaptureCity(unit, city, player));
}

export function canPlayerCaptureCity(
  state: GameState,
  playerId: string,
  cityId: string
): boolean {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return false;

  const targetCity = (state.cities || []).find(city => city.id === cityId);
  if (!targetCity) return false;

  if (!isPlayerTurn(state, playerId)) return false;

  return state.units.some(unit => canUnitCaptureCity(unit, targetCity, player));
}
