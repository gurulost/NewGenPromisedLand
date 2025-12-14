import { create } from "zustand";
import { Unit } from "@shared/types/unit";
import { Tile } from "@shared/types/game";

interface GameStateStore {
  selectedUnit: Unit | null;
  hoveredTile: { x: number; z: number; tile: Tile } | null;
  reachableTiles: string[];
  reachableCoordinates: Array<{ q: number; r: number; s: number }>;
  
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

  setSelectedUnit: (unit: Unit | null) => void;
  setHoveredTile: (tile: { x: number; z: number; tile: Tile } | null) => void;
  setReachableTiles: (tiles: string[]) => void;
  setReachableCoordinates: (coordinates: Array<{ q: number; r: number; s: number }>) => void;
  
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
}

export const useGameState = create<GameStateStore>((set) => ({
  selectedUnit: null,
  hoveredTile: null,
  reachableTiles: [],
  reachableCoordinates: [],
  
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
}));
