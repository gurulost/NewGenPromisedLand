import type { GameState, PlayerState } from "@shared/types/game";
import { getTurnPlayer } from "@shared/logic/turnOrder";

export type TurnPresentationPhase = "idle" | "transitioning" | "handoff";

export interface TurnPresentationState {
  phase: TurnPresentationPhase;
  player: PlayerState | null;
}

export type TurnPresentationEvent =
  | { type: "reset" }
  | { type: "sync"; gameState: GameState | null; phase: TurnPresentationPhase }
  | { type: "transition"; player: PlayerState | null };

export const INITIAL_TURN_PRESENTATION_STATE: TurnPresentationState = {
  phase: "idle",
  player: null,
};

export function snapshotTurnPlayer(player: PlayerState | null | undefined): PlayerState | null {
  if (!player) return null;

  return {
    ...player,
    stats: { ...player.stats },
    modifiers: [...(player.modifiers ?? [])],
    researchedTechs: [...(player.researchedTechs ?? [])],
    citiesOwned: [...(player.citiesOwned ?? [])],
    constructionQueue: [...(player.constructionQueue ?? [])],
    visibilityMask: [...(player.visibilityMask ?? [])],
    exploredTiles: [...(player.exploredTiles ?? [])],
    abilityCooldowns: player.abilityCooldowns ? { ...player.abilityCooldowns } : {},
    atWarWith: [...(player.atWarWith ?? [])],
    alliedWith: [...(player.alliedWith ?? [])],
    tradeRoutes: [...(player.tradeRoutes ?? [])],
    diplomaticCooldowns: player.diplomaticCooldowns
      ? { ...player.diplomaticCooldowns }
      : { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
  };
}

export function resolveUiTurnPlayer(
  gameState: GameState | null | undefined,
  fallbackPlayer?: PlayerState | null,
): PlayerState | null {
  if (gameState) {
    const currentPlayer = getTurnPlayer(gameState.players, gameState.currentPlayerIndex);
    if (currentPlayer) {
      return currentPlayer;
    }
  }

  return fallbackPlayer ?? null;
}

export function reduceTurnPresentation(
  state: TurnPresentationState,
  event: TurnPresentationEvent,
): TurnPresentationState {
  switch (event.type) {
    case "reset":
      return INITIAL_TURN_PRESENTATION_STATE;
    case "sync":
      return {
        phase: event.phase,
        player: snapshotTurnPlayer(resolveUiTurnPlayer(event.gameState, state.player)),
      };
    case "transition":
      return {
        phase: "transitioning",
        player: snapshotTurnPlayer(event.player ?? state.player),
      };
    default:
      return state;
  }
}
