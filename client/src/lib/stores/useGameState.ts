import { create } from "zustand";
import { Unit } from "@shared/types/unit";
import { Tile } from "@shared/types/game";

interface GameStateStore {
  selectedUnit: Unit | null;
  hoveredTile: { x: number; z: number; tile: Tile } | null;
  
  setSelectedUnit: (unit: Unit | null) => void;
  setHoveredTile: (tile: { x: number; z: number; tile: Tile } | null) => void;
}

export const useGameState = create<GameStateStore>((set) => ({
  selectedUnit: null,
  hoveredTile: null,
  
  setSelectedUnit: (unit) => set({ selectedUnit: unit }),
  setHoveredTile: (tile) => set({ hoveredTile: tile }),
}));
