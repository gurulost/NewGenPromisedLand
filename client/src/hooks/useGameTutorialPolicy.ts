import { useEffect, useMemo } from "react";
import { useTutorialStore } from "../lib/stores/useTutorial";
import type { PlayerState } from "@shared/types/game";

type GameMode = "standard" | "tutorialEpisode";

interface GameTutorialPolicyOptions {
  gameMode: GameMode;
  gameId: string | null;
  hasGameState: boolean;
  isOnlineMatch: boolean;
  isPublicAuthoritativeOnlineMatch: boolean;
  currentPlayer: Pick<PlayerState, "id" | "name" | "isAI"> | null;
  isLocalHumanTurn: boolean;
  showTechPanel: boolean;
  showCityPanel: boolean;
  hasSelectedWorldElement: boolean;
  hasSelectedVillage: boolean;
  selectedUnitPlayerId: string | null;
  isAttackMode: boolean;
}

export function useGameTutorialPolicy({
  gameMode,
  gameId,
  hasGameState,
  isOnlineMatch,
  isPublicAuthoritativeOnlineMatch,
  currentPlayer,
  isLocalHumanTurn,
  showTechPanel,
  showCityPanel,
  hasSelectedWorldElement,
  hasSelectedVillage,
  selectedUnitPlayerId,
  isAttackMode,
}: GameTutorialPolicyOptions) {
  const openTutorialIfNeeded = useTutorialStore((state) => state.openIfNeeded);
  const setTutorialContext = useTutorialStore((state) => state.setActiveProfile);
  const setTutorialBlockingSuppression = useTutorialStore((state) => state.setBlockingSuppression);
  const activeTutorialCardId = useTutorialStore((state) => state.activeCardId);
  const isTutorialLibraryOpen = useTutorialStore((state) => state.isLibraryOpen);
  const suppressBlockingTutorials = isPublicAuthoritativeOnlineMatch && hasGameState;
  const canOpenTutorialPrompts = gameMode !== "tutorialEpisode" && !suppressBlockingTutorials;

  const tutorialProfileKey = useMemo(() => {
    if (isOnlineMatch || !currentPlayer) return null;
    const nameKey = currentPlayer.name?.trim() || currentPlayer.id;
    return `local:${nameKey}`;
  }, [currentPlayer, isOnlineMatch]);

  useEffect(() => {
    setTutorialContext(tutorialProfileKey, gameId, isLocalHumanTurn);
  }, [tutorialProfileKey, gameId, isLocalHumanTurn, setTutorialContext]);

  useEffect(() => {
    setTutorialBlockingSuppression(suppressBlockingTutorials ? "public-multiplayer" : null);
    return () => setTutorialBlockingSuppression(null);
  }, [setTutorialBlockingSuppression, suppressBlockingTutorials]);

  useEffect(() => {
    if (!canOpenTutorialPrompts || !hasGameState || !currentPlayer || !isLocalHumanTurn) return;
    openTutorialIfNeeded("overview");
  }, [canOpenTutorialPrompts, currentPlayer, hasGameState, isLocalHumanTurn, openTutorialIfNeeded]);

  useEffect(() => {
    if (canOpenTutorialPrompts && showTechPanel) openTutorialIfNeeded("tech");
  }, [canOpenTutorialPrompts, showTechPanel, openTutorialIfNeeded]);

  useEffect(() => {
    if (canOpenTutorialPrompts && showCityPanel) openTutorialIfNeeded("city");
  }, [canOpenTutorialPrompts, showCityPanel, openTutorialIfNeeded]);

  useEffect(() => {
    if (canOpenTutorialPrompts && hasSelectedWorldElement) openTutorialIfNeeded("world-elements");
  }, [canOpenTutorialPrompts, hasSelectedWorldElement, openTutorialIfNeeded]);

  useEffect(() => {
    if (canOpenTutorialPrompts && hasSelectedVillage) openTutorialIfNeeded("village");
  }, [canOpenTutorialPrompts, hasSelectedVillage, openTutorialIfNeeded]);

  useEffect(() => {
    if (canOpenTutorialPrompts && selectedUnitPlayerId && selectedUnitPlayerId === currentPlayer?.id) {
      openTutorialIfNeeded("movement");
    }
  }, [canOpenTutorialPrompts, currentPlayer?.id, openTutorialIfNeeded, selectedUnitPlayerId]);

  useEffect(() => {
    if (canOpenTutorialPrompts && isAttackMode) openTutorialIfNeeded("combat");
  }, [canOpenTutorialPrompts, isAttackMode, openTutorialIfNeeded]);

  return { activeTutorialCardId, isTutorialLibraryOpen };
}
