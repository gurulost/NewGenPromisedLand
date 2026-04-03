import type { GameState } from "@shared/types/game";
import type { TurnPresentationPhase } from "./turnPresentation";

export type GamePhase =
  | "menu"
  | "tutorialEpisodeIntro"
  | "playerSetup"
  | "handoff"
  | "playing"
  | "gameOver"
  | "lobbies"
  | "lobbyRoom";

export const getTurnPresentationPhaseForGamePhase = (
  gamePhase: GamePhase,
): TurnPresentationPhase | null => {
  if (gamePhase === "handoff") return "handoff";
  return gamePhase === "playing" || gamePhase === "gameOver" ? "idle" : null;
};

export const resolveGamePhaseForState = (
  currentPhase: GamePhase,
  gameState: GameState | null,
): GamePhase => (gameState?.phase === "ended" ? "gameOver" : currentPhase === "gameOver" ? "playing" : currentPhase);
