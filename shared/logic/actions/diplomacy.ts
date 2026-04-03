import { GameState, PlayerState } from "../../types/game";
import {
  areCitiesConnectedByRoad,
  calculateTradeRouteEstablishCostStars,
  calculateTradeRouteStarsPerTurn
} from "../tradeRoutes";

type DiplomaticCooldowns = PlayerState["diplomaticCooldowns"];
type DiplomaticRelationship = "neutral" | "allied" | "atWar";
type DiplomacyTransition = "declareWar" | "formAlliance" | "breakAlliance";

const EMPTY_DIPLOMATIC_COOLDOWNS: DiplomaticCooldowns = {
  declareWar: 0,
  formAlliance: 0,
  breakAlliance: 0,
  requestTrade: 0,
};

const DIPLOMATIC_COOLDOWN_TURNS: Record<keyof DiplomaticCooldowns, number> = {
  declareWar: 5,
  formAlliance: 3,
  breakAlliance: 3,
  requestTrade: 3,
};

function getDiplomaticCooldowns(player: Pick<PlayerState, "diplomaticCooldowns">): DiplomaticCooldowns {
  return { ...EMPTY_DIPLOMATIC_COOLDOWNS, ...(player.diplomaticCooldowns || {}) };
}

function getDiplomaticRelationship(
  player: PlayerState,
  targetPlayer: PlayerState
): DiplomaticRelationship {
  const atWar =
    player.atWarWith?.includes(targetPlayer.id) ||
    targetPlayer.atWarWith?.includes(player.id);
  if (atWar) return "atWar";

  const allied =
    player.alliedWith?.includes(targetPlayer.id) ||
    targetPlayer.alliedWith?.includes(player.id);
  if (allied) return "allied";

  return "neutral";
}

function addRelation(ids: string[] | undefined, targetId: string): string[] {
  return ids?.includes(targetId) ? ids : [...(ids || []), targetId];
}

function removeRelation(ids: string[] | undefined, targetId: string): string[] {
  return (ids || []).filter(id => id !== targetId);
}

function validateDiplomacyTransition(
  state: GameState,
  transition: DiplomacyTransition,
  playerId: string,
  targetPlayerId: string
): {
  player: PlayerState;
  targetPlayer: PlayerState;
  cooldowns: DiplomaticCooldowns;
  relationship: DiplomaticRelationship;
} | null {
  const player = state.players.find(p => p.id === playerId);
  const targetPlayer = state.players.find(p => p.id === targetPlayerId);

  if (!player || !targetPlayer) return null;
  if (playerId === targetPlayerId) return null;
  if (player.isEliminated || targetPlayer.isEliminated) return null;

  const cooldowns = getDiplomaticCooldowns(player);
  const relationship = getDiplomaticRelationship(player, targetPlayer);

  const rules: Record<
    DiplomacyTransition,
    { cooldownKey: keyof DiplomaticCooldowns; isLegal: (relationship: DiplomaticRelationship) => boolean }
  > = {
    declareWar: {
      cooldownKey: "declareWar",
      isLegal: currentRelationship => currentRelationship !== "atWar",
    },
    formAlliance: {
      cooldownKey: "formAlliance",
      isLegal: currentRelationship => currentRelationship === "neutral",
    },
    breakAlliance: {
      cooldownKey: "breakAlliance",
      isLegal: currentRelationship => currentRelationship === "allied",
    },
  };

  const rule = rules[transition];
  if (cooldowns[rule.cooldownKey] > 0) return null;
  if (!rule.isLegal(relationship)) return null;

  return { player, targetPlayer, cooldowns, relationship };
}

export function handleEstablishTradeRoute(
  state: GameState,
  payload: { playerId: string; fromCityId: string; toCityId: string }
): GameState {
  const { playerId, fromCityId, toCityId } = payload;

  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  if (!player.researchedTechs?.includes('trade')) return state;

  const cooldowns = getDiplomaticCooldowns(player);
  if (cooldowns.requestTrade > 0) return state;

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
          diplomaticCooldowns: {
            ...getDiplomaticCooldowns(p),
            requestTrade: DIPLOMATIC_COOLDOWN_TURNS.requestTrade,
          },
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

  if (!validateDiplomacyTransition(state, "declareWar", playerId, targetPlayerId)) return state;

  return {
    ...state,
    players: state.players.map(p => {
      if (p.id === playerId) {
        const newAtWarWith = addRelation(p.atWarWith, targetPlayerId);
        const newAlliedWith = removeRelation(p.alliedWith, targetPlayerId);
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
            ...getDiplomaticCooldowns(p),
            declareWar: DIPLOMATIC_COOLDOWN_TURNS.declareWar,
          }
        };
      }
      if (p.id === targetPlayerId) {
        const newAtWarWith = addRelation(p.atWarWith, playerId);
        const newAlliedWith = removeRelation(p.alliedWith, playerId);
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

  if (!validateDiplomacyTransition(state, "formAlliance", playerId, allyPlayerId)) return state;

  return {
    ...state,
    players: state.players.map(p => {
      if (p.id === playerId) {
        return {
          ...p,
          alliedWith: addRelation(p.alliedWith, allyPlayerId),
          stats: {
            ...p.stats,
            faith: Math.min(100, p.stats.faith + 10),
            internalDissent: Math.max(0, p.stats.internalDissent - 10)
          },
          diplomaticCooldowns: {
            ...getDiplomaticCooldowns(p),
            formAlliance: DIPLOMATIC_COOLDOWN_TURNS.formAlliance,
          }
        };
      }
      if (p.id === allyPlayerId) {
        return {
          ...p,
          alliedWith: addRelation(p.alliedWith, playerId),
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

export function handleBreakAlliance(
  state: GameState,
  payload: { playerId: string; targetPlayerId: string }
): GameState {
  const { playerId, targetPlayerId } = payload;

  if (!validateDiplomacyTransition(state, "breakAlliance", playerId, targetPlayerId)) return state;

  return {
    ...state,
    players: state.players.map(p => {
      if (p.id === playerId) {
        return {
          ...p,
          alliedWith: removeRelation(p.alliedWith, targetPlayerId),
          diplomaticCooldowns: {
            ...getDiplomaticCooldowns(p),
            breakAlliance: DIPLOMATIC_COOLDOWN_TURNS.breakAlliance,
          },
        };
      }

      if (p.id === targetPlayerId) {
        return {
          ...p,
          alliedWith: removeRelation(p.alliedWith, playerId),
        };
      }

      return p;
    }),
  };
}
