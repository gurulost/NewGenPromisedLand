import { create } from "zustand";
import { Unit } from "@shared/types/unit";
import { Tile } from "@shared/types/game";

interface GameStateStore {
  selectedUnit: Unit | null;
  hoveredTile: { x: number; z: number; tile: Tile } | null;
  reachableTiles: string[];
  
  // Construction mode
  constructionMode: {
    isActive: boolean;
    buildingType: string | null;
    buildingCategory: 'improvements' | 'structures' | 'units' | null;
    cityId: string | null;
    playerId: string | null;
  };
  
  setSelectedUnit: (unit: Unit | null) => void;
  setHoveredTile: (tile: { x: number; z: number; tile: Tile } | null) => void;
  setReachableTiles: (tiles: string[]) => void;
  
  // Construction actions
  startConstruction: (buildingType: string, category: 'improvements' | 'structures' | 'units', cityId: string, playerId: string) => void;
  cancelConstruction: () => void;
}

export const useGameState = create<GameStateStore>((set) => ({
  selectedUnit: null,
  hoveredTile: null,
  reachableTiles: [],
  
  constructionMode: {
    isActive: false,
    buildingType: null,
    buildingCategory: null,
    cityId: null,
    playerId: null,
  },
  
  setSelectedUnit: (unit) => set({ selectedUnit: unit }),
  setHoveredTile: (tile) => set({ hoveredTile: tile }),
  setReachableTiles: (tiles) => set({ reachableTiles: tiles }),
  
  startConstruction: (buildingType, category, cityId, playerId) => set({
    constructionMode: {
      isActive: true,
      buildingType,
      buildingCategory: category,
      cityId,
      playerId,
    },
    selectedUnit: null, // Clear unit selection when starting construction
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
}));
