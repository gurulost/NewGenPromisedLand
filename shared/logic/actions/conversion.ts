import { GameState } from "../../types/game";
import { Unit } from "../../types/unit";
import { GAME_RULES } from "../../data/gameRules";
import { getUnitDefinition } from "../../data/units";
import { hexDistance } from "../../utils/hex";
import { attemptUnitConversion } from "../conversion";
import { getUnitActionsRemaining, spendUnitActions } from "../unitLogic";
import { clampStat, hasAbility } from "./helpers";

export function handleConvertCity(
  state: GameState,
  payload: { playerId: string; unitId?: string; cityId: string; conversionType: "faith" | "pride" | "peace" }
): GameState {
  const { playerId, unitId, cityId, conversionType } = payload;

  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  const city = state.cities?.find(c => c.id === cityId);
  if (!city) return state;

  const actingMissionary = (() => {
    const candidateById = unitId ? state.units.find(u => u.id === unitId) : undefined;
    const missionaryHasConvertAbility = (u: Unit): boolean => {
      const abilities = (u.abilities && u.abilities.length > 0) ? u.abilities : getUnitDefinition(u.type as any)?.abilities || [];
      return hasAbility(abilities, "CONVERT");
    };
    const isEligible = (u: Unit | undefined): u is Unit =>
      !!u &&
      u.playerId === playerId &&
      u.type === "missionary" &&
      missionaryHasConvertAbility(u) &&
      getUnitActionsRemaining(u) > 0 &&
      hexDistance(u.coordinate, city.coordinate) <= 1;

    if (isEligible(candidateById)) return candidateById;

    const candidates = state.units
      .filter(u => isEligible(u))
      .sort((a, b) => a.id.localeCompare(b.id));
    return candidates[0];
  })();

  if (!actingMissionary) return state;

  let resourceCost = 0;
  let statChanges = {};

  switch (conversionType) {
    case "faith":
      resourceCost = GAME_RULES.conversion.costs.cityFaith;
      if (player.stats.faith < resourceCost) return state;
      statChanges = { faith: Math.max(0, player.stats.faith - resourceCost) };
      break;
    case "pride":
      resourceCost = GAME_RULES.conversion.costs.cityPride;
      if (player.stats.pride < resourceCost) return state;
      statChanges = { pride: Math.max(0, player.stats.pride - resourceCost) };
      break;
    case "peace":
      resourceCost = GAME_RULES.conversion.costs.cityPeaceFaithCost;
      if (player.stats.faith < resourceCost) return state;
      statChanges = {
        faith: clampStat(player.stats.faith - resourceCost + GAME_RULES.conversion.costs.cityPeaceFaithRefund),
        internalDissent: Math.max(0, player.stats.internalDissent - GAME_RULES.conversion.costs.cityPeaceDissentReduction)
      };
      break;
  }

  const currentOwnerId = city.ownerId;

  const updatedPlayers = state.players.map(p => {
    if (p.id === playerId) {
      return {
        ...p,
        citiesOwned: p.citiesOwned.includes(cityId) ? p.citiesOwned : [...p.citiesOwned, cityId],
        stats: { ...p.stats, ...statChanges }
      };
    } else if (currentOwnerId && p.id === currentOwnerId) {
      return {
        ...p,
        citiesOwned: p.citiesOwned.filter(id => id !== cityId)
      };
    }
    return p;
  });
  const normalizedPlayers = updatedPlayers.map(p => ({
    ...p,
    isEliminated: p.citiesOwned.length === 0
  }));

  return {
    ...state,
    units: state.units.map(u =>
      u.id === actingMissionary.id ? spendUnitActions(u) : u
    ),
    players: normalizedPlayers,
    cities: (state.cities || []).map(c =>
      c.id === cityId ? { ...c, ownerId: playerId } : c
    ),
    map: {
      ...state.map,
      tiles: state.map.tiles.map(tile =>
        tile.coordinate.q === city.coordinate.q &&
          tile.coordinate.r === city.coordinate.r &&
          tile.hasCity
          ? {
            ...tile,
            cityOwner: playerId,
            exploredBy: tile.exploredBy.includes(playerId) ? tile.exploredBy : [...tile.exploredBy, playerId]
          }
          : tile
      )
    }
  };
}

export function handleConvertUnit(
  state: GameState,
  payload: { playerId: string; unitId: string; targetUnitId: string }
): GameState {
  const { playerId, unitId, targetUnitId } = payload;

  const caster = state.units.find(u => u.id === unitId);
  if (!caster || caster.playerId !== playerId) return state;

  const result = attemptUnitConversion(state, unitId, targetUnitId);
  if (!result.ok) return state;

  return result.state;
}
