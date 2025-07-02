import { create } from "zustand";
import { Unit } from "@shared/types/unit";
import { Tile } from "@shared/types/game";

interface GameStateStore {
  selectedUnit: Unit | null;
  hoveredTile: { x: number; z: number; tile: Tile } | null;
  reachableTiles: string[];
  
  setSelectedUnit: (unit: Unit | null) => void;
  setHoveredTile: (tile: { x: number; z: number; tile: Tile } | null) => void;
  setReachableTiles: (tiles: string[]) => void;
}

export const useGameState = create<GameStateStore>((set) => ({
  selectedUnit: null,
  hoveredTile: null,
  reachableTiles: [],
  
  setSelectedUnit: (unit) => set({ selectedUnit: unit }),
  setHoveredTile: (tile) => set({ hoveredTile: tile }),
  setReachableTiles: (tiles) => set({ reachableTiles: tiles }),
}));
