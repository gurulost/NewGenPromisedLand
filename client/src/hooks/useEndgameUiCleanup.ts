import { useEffect } from "react";
import type { GameState } from "@shared/types/game";

interface EndgameUiCleanupOptions {
  phase?: GameState["phase"];
  setShowTechPanel: (open: boolean) => void;
  setShowCityPanel: (open: boolean) => void;
  setShowConstructionHall: (open: boolean) => void;
  setShowQuickUnitActions: (open: boolean) => void;
  setShowSaveLoadMenu: (open: boolean) => void;
  setShowTelemetry: (open: boolean) => void;
  setShowCitySelector: (open: boolean) => void;
  setSelectedCityId: (cityId: string | null) => void;
  setSelectedWorldElement: (value: { elementId: string; coordinate: { q: number; r: number; s: number }; unitId?: string } | null) => void;
  setSelectedVillage: (value: { unitId: string; coordinate: { q: number; r: number; s: number } } | null) => void;
  setShowDiplomacy: (open: boolean) => void;
  setRuinsReward: (reward: unknown) => void;
  setShowLegendaryShimmer: (open: boolean) => void;
  setShowGameLog: (open: boolean) => void;
  setShowSettings: (open: boolean) => void;
  setShowMobileChat: (open: boolean) => void;
  setActiveTechReveal: (techId: string | null) => void;
  setTechRevealQueue: (techIds: string[]) => void;
  setSelectedUnit: (unit: null) => void;
  setMovementMode: (enabled: boolean) => void;
  setAttackMode: (enabled: boolean) => void;
  setReachableCoordinates: (coordinates: Array<{ q: number; r: number; s: number }>) => void;
  setAttackableTargets: (targets: Array<{ q: number; r: number; s: number }>) => void;
  cancelConstruction: () => void;
  cancelSpawnSelection: () => void;
  cancelRoadBuild: () => void;
  closeTileContextMenu: () => void;
}

export function useEndgameUiCleanup({
  phase,
  setShowTechPanel,
  setShowCityPanel,
  setShowConstructionHall,
  setShowQuickUnitActions,
  setShowSaveLoadMenu,
  setShowTelemetry,
  setShowCitySelector,
  setSelectedCityId,
  setSelectedWorldElement,
  setSelectedVillage,
  setShowDiplomacy,
  setRuinsReward,
  setShowLegendaryShimmer,
  setShowGameLog,
  setShowSettings,
  setShowMobileChat,
  setActiveTechReveal,
  setTechRevealQueue,
  setSelectedUnit,
  setMovementMode,
  setAttackMode,
  setReachableCoordinates,
  setAttackableTargets,
  cancelConstruction,
  cancelSpawnSelection,
  cancelRoadBuild,
  closeTileContextMenu,
}: EndgameUiCleanupOptions) {
  useEffect(() => {
    if (phase !== "ended") return;
    setShowTechPanel(false);
    setShowCityPanel(false);
    setShowConstructionHall(false);
    setShowQuickUnitActions(false);
    setShowSaveLoadMenu(false);
    setShowTelemetry(false);
    setShowCitySelector(false);
    setSelectedCityId(null);
    setSelectedWorldElement(null);
    setSelectedVillage(null);
    setShowDiplomacy(false);
    setRuinsReward(null);
    setShowLegendaryShimmer(false);
    setShowGameLog(false);
    setShowSettings(false);
    setShowMobileChat(false);
    setActiveTechReveal(null);
    setTechRevealQueue([]);
    setSelectedUnit(null);
    setMovementMode(false);
    setAttackMode(false);
    setReachableCoordinates([]);
    setAttackableTargets([]);
    cancelConstruction();
    cancelSpawnSelection();
    cancelRoadBuild();
    closeTileContextMenu();
  }, [
    cancelConstruction,
    cancelRoadBuild,
    cancelSpawnSelection,
    closeTileContextMenu,
    phase,
    setActiveTechReveal,
    setAttackMode,
    setAttackableTargets,
    setMovementMode,
    setReachableCoordinates,
    setRuinsReward,
    setSelectedCityId,
    setSelectedUnit,
    setSelectedVillage,
    setSelectedWorldElement,
    setShowCityPanel,
    setShowCitySelector,
    setShowConstructionHall,
    setShowDiplomacy,
    setShowGameLog,
    setShowLegendaryShimmer,
    setShowMobileChat,
    setShowQuickUnitActions,
    setShowSaveLoadMenu,
    setShowSettings,
    setShowTechPanel,
    setShowTelemetry,
    setTechRevealQueue,
  ]);
}
