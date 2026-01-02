import { create } from "zustand";
import { Unit } from "@shared/types/unit";
import { Tile } from "@shared/types/game";

export interface TileContextMenuOption {
  id: string;
  label: string;
  icon?: string;
  subLabel?: string;
  action: () => void;
}

export interface TileContextMenuState {
  isOpen: boolean;
  screenPosition: { x: number; y: number };
  tileCoordinate: { q: number; r: number } | null;
  options: TileContextMenuOption[];
}

interface GameStateStore {
  selectedUnit: Unit | null;
  hoveredTile: { x: number; z: number; tile: Tile } | null;
  reachableTiles: string[];
  reachableCoordinates: Array<{ q: number; r: number; s: number }>;

  // Ability targeting mode
  abilityTargetMode: {
    isActive: boolean;
    abilityId: string | null;
    title: string | null;
    instructions: string | null;
    eligibleUnitIds: string[];
    selectedUnitId: string | null;
    onSelectUnit?: (unitId: string) => void;
  };
  
  // Construction mode
  constructionMode: {
    isActive: boolean;
    buildingType: string | null;
    buildingCategory: 'improvements' | 'structures' | 'units' | null;
    cityId: string | null;
    playerId: string | null;
  };
  
  // Movement and attack modes
  isMovementMode: boolean;
  isAttackMode: boolean;
  attackableTargets: Array<{ q: number; r: number; s: number }>;

  // Road building mode (worker)
  isRoadBuildMode: boolean;
  roadBuildUnitId: string | null;

  // Tile context menu (for tiles with multiple interactable items)
  tileContextMenu: TileContextMenuState;

  // Debug toggles
  showSpawnDebug: boolean;

  setSelectedUnit: (unit: Unit | null) => void;
  setHoveredTile: (tile: { x: number; z: number; tile: Tile } | null) => void;
  setReachableTiles: (tiles: string[]) => void;
  setReachableCoordinates: (coordinates: Array<{ q: number; r: number; s: number }>) => void;

  // Ability targeting actions
  startAbilityTargeting: (params: {
    abilityId: string;
    title: string;
    instructions: string;
    eligibleUnitIds: string[];
    onSelectUnit?: (unitId: string) => void;
  }) => void;
  setAbilityTargetSelection: (unitId: string | null) => void;
  cancelAbilityTargeting: () => void;
  
  // Construction actions
  startConstruction: (buildingType: string, category: 'improvements' | 'structures' | 'units', cityId: string, playerId: string) => void;
  cancelConstruction: () => void;
  
  // Movement and attack mode actions
  setMovementMode: (enabled: boolean) => void;
  setAttackMode: (enabled: boolean) => void;
  setAttackableTargets: (targets: Array<{ q: number; r: number; s: number }>) => void;

  // Road building actions
  startRoadBuild: (unitId: string) => void;
  cancelRoadBuild: () => void;

  // Tile context menu actions
  openTileContextMenu: (screenPosition: { x: number; y: number }, tileCoordinate: { q: number; r: number }, options: TileContextMenuOption[]) => void;
  closeTileContextMenu: () => void;

  // Debug actions
  setShowSpawnDebug: (show: boolean) => void;
  toggleSpawnDebug: () => void;
}

export const useGameState = create<GameStateStore>((set) => ({
  selectedUnit: null,
  hoveredTile: null,
  reachableTiles: [],
  reachableCoordinates: [],

  abilityTargetMode: {
    isActive: false,
    abilityId: null,
    title: null,
    instructions: null,
    eligibleUnitIds: [],
    selectedUnitId: null,
    onSelectUnit: undefined,
  },
  
  constructionMode: {
    isActive: false,
    buildingType: null,
    buildingCategory: null,
    cityId: null,
    playerId: null,
  },
  
  isMovementMode: false,
  isAttackMode: false,
  attackableTargets: [],

  isRoadBuildMode: false,
  roadBuildUnitId: null,

  tileContextMenu: {
    isOpen: false,
    screenPosition: { x: 0, y: 0 },
    tileCoordinate: null,
    options: [],
  },

  showSpawnDebug: false,

  setSelectedUnit: (unit) =>
    set({
      selectedUnit: unit,
      isMovementMode: false,
      isAttackMode: false,
      isRoadBuildMode: false,
      roadBuildUnitId: null,
      attackableTargets: [],
    }),
  setHoveredTile: (tile) => set({ hoveredTile: tile }),
  setReachableTiles: (tiles) => set({ reachableTiles: tiles }),
  setReachableCoordinates: (coordinates) => set({ reachableCoordinates: coordinates }),

  startAbilityTargeting: ({ abilityId, title, instructions, eligibleUnitIds, onSelectUnit }) => set({
    abilityTargetMode: {
      isActive: true,
      abilityId,
      title,
      instructions,
      eligibleUnitIds,
      selectedUnitId: null,
      onSelectUnit,
    },
    isMovementMode: false,
    isAttackMode: false,
  }),
  setAbilityTargetSelection: (unitId) => set((state) => ({
    abilityTargetMode: {
      ...state.abilityTargetMode,
      selectedUnitId: unitId,
    },
  })),
  cancelAbilityTargeting: () => set({
    abilityTargetMode: {
      isActive: false,
      abilityId: null,
      title: null,
      instructions: null,
      eligibleUnitIds: [],
      selectedUnitId: null,
      onSelectUnit: undefined,
    },
  }),
  
  startConstruction: (buildingType, category, cityId, playerId) => set({
    constructionMode: {
      isActive: true,
      buildingType,
      buildingCategory: category,
      cityId,
      playerId,
    },
    selectedUnit: null, // Clear unit selection when starting construction
    isMovementMode: false,
    isAttackMode: false,
    isRoadBuildMode: false,
    roadBuildUnitId: null,
  }),
  
  cancelConstruction: () => set({
    constructionMode: {
      isActive: false,
      buildingType: null,
      buildingCategory: null,
      cityId: null,
      playerId: null,
    },
  }),
  
  setMovementMode: (enabled) => set({ isMovementMode: enabled, isAttackMode: enabled ? false : false, isRoadBuildMode: false, roadBuildUnitId: null, attackableTargets: [] }),
  setAttackMode: (enabled) => set({ isAttackMode: enabled, isMovementMode: enabled ? false : false, isRoadBuildMode: false, roadBuildUnitId: null }),
  setAttackableTargets: (targets) => set({ attackableTargets: targets }),

  startRoadBuild: (unitId) => set({ isRoadBuildMode: true, roadBuildUnitId: unitId, isMovementMode: false, isAttackMode: false, attackableTargets: [] }),
  cancelRoadBuild: () => set({ isRoadBuildMode: false, roadBuildUnitId: null }),

  openTileContextMenu: (screenPosition, tileCoordinate, options) => set({
    tileContextMenu: {
      isOpen: true,
      screenPosition,
      tileCoordinate,
      options,
    },
  }),
  closeTileContextMenu: () => set({
    tileContextMenu: {
      isOpen: false,
      screenPosition: { x: 0, y: 0 },
      tileCoordinate: null,
      options: [],
    },
  }),

  setShowSpawnDebug: (show) => set({ showSpawnDebug: show }),
  toggleSpawnDebug: () => set((state) => ({ showSpawnDebug: !state.showSpawnDebug })),
}));
