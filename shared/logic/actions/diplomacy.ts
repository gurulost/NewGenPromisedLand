import { GameState } from "../../types/game";
import {
  areCitiesConnectedByRoad,
  calculateTradeRouteEstablishCostStars,
  calculateTradeRouteStarsPerTurn
} from "../tradeRoutes";

export function handleEstablishTradeRoute(
  state: GameState,
  payload: { playerId: string; fromCityId: string; toCityId: string }
): GameState {
  const { playerId, fromCityId, toCityId } = payload;

  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  if (!player.researchedTechs?.includes('trade')) return state;

  const cooldowns = player.diplomaticCooldowns || { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 };
  if ((cooldowns.requestTrade || 0) > 0) return state;

  const fromCity = state.cities?.find(city => city.id === fromCityId);
  const toCity = state.cities?.find(city => city.id === toCityId);

  if (!fromCity || !toCity) return state;
  if (!player.citiesOwned.includes(fromCityId)) return state;
  if (!player.citiesOwned.includes(toCityId)) return state;
  if (fromCityId === toCityId) return state;

  const existingRoutes = player.tradeRoutes || [];
  const isDuplicatePair = existingRoutes.some(r =>
    (r.fromCityId === fromCityId && r.toCityId === toCityId) ||
    (r.fromCityId === toCityId && r.toCityId === fromCityId)
  );
  if (isDuplicatePair) return state;

  const maxRoutes = Math.max(1, player.citiesOwned.length);
  if (existingRoutes.length >= maxRoutes) return state;

  if (existingRoutes.some(r => r.fromCityId === fromCityId)) return state;

  if (!areCitiesConnectedByRoad(state, playerId, fromCityId, toCityId)) return state;

  const starsPerTurn = calculateTradeRouteStarsPerTurn(state, playerId, fromCityId, toCityId);
  const costStars = calculateTradeRouteEstablishCostStars(starsPerTurn);
  if (player.stars < costStars) return state;

  return {
    ...state,
    players: state.players.map(p =>
      p.id === playerId
        ? {
          ...p,
          stars: p.stars - costStars,
          tradeRoutes: [...(p.tradeRoutes || []), { fromCityId, toCityId, starsPerTurn }],
          diplomaticCooldowns: { ...(p.diplomaticCooldowns || cooldowns), requestTrade: 3 },
        }
        : p
    )
  };
}

export function handleDeclareWar(
  state: GameState,
  payload: { playerId: string; targetPlayerId: string }
): GameState {
  const { playerId, targetPlayerId } = payload;

  const player = state.players.find(p => p.id === playerId);
  const targetPlayer = state.players.find(p => p.id === targetPlayerId);

  if (!player || !targetPlayer) return state;
  if (playerId === targetPlayerId) return state;

  if (player.atWarWith?.includes(targetPlayerId)) return state;

  return {
    ...state,
    players: state.players.map(p => {
      if (p.id === playerId) {
        const newAtWarWith = [...(p.atWarWith || []), targetPlayerId];
        const newAlliedWith = (p.alliedWith || []).filter(id => id !== targetPlayerId);
        return {
          ...p,
          atWarWith: newAtWarWith,
          alliedWith: newAlliedWith,
          stats: {
            ...p.stats,
            pride: Math.min(100, p.stats.pride + 15),
            internalDissent: Math.min(100, p.stats.internalDissent + 5)
          },
          diplomaticCooldowns: {
            ...(p.diplomaticCooldowns || { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 }),
            declareWar: 5
          }
        };
      }
      if (p.id === targetPlayerId) {
        const newAtWarWith = [...(p.atWarWith || []), playerId];
        const newAlliedWith = (p.alliedWith || []).filter(id => id !== playerId);
        return {
          ...p,
          atWarWith: newAtWarWith,
          alliedWith: newAlliedWith,
        };
      }
      return p;
    })
  };
}

export function handleFormAlliance(
  state: GameState,
  payload: { playerId: string; targetPlayerId: string }
): GameState {
  const { playerId, targetPlayerId: allyPlayerId } = payload;

  const player = state.players.find(p => p.id === playerId);
  const ally = state.players.find(p => p.id === allyPlayerId);

  if (!player || !ally) return state;
  if (playerId === allyPlayerId) return state;

  if (player.atWarWith?.includes(allyPlayerId)) return state;

  if (player.alliedWith?.includes(allyPlayerId)) return state;

  return {
    ...state,
    players: state.players.map(p => {
      if (p.id === playerId) {
        return {
          ...p,
          alliedWith: [...(p.alliedWith || []), allyPlayerId],
          stats: {
            ...p.stats,
            faith: Math.min(100, p.stats.faith + 10),
            internalDissent: Math.max(0, p.stats.internalDissent - 10)
          },
          diplomaticCooldowns: {
            ...(p.diplomaticCooldowns || { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 }),
            formAlliance: 3
          }
        };
      }
      if (p.id === allyPlayerId) {
        return {
          ...p,
          alliedWith: [...(p.alliedWith || []), playerId],
          stats: {
            ...p.stats,
            faith: Math.min(100, p.stats.faith + 10),
            internalDissent: Math.max(0, p.stats.internalDissent - 10)
          }
        };
      }
      return p;
    })
  };
}
