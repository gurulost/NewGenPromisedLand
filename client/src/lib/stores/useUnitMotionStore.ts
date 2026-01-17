import { create } from "zustand";
import type { HexCoordinate } from "@shared/types/coordinates";
import { hexToPixel } from "@shared/utils/hex";

const DEFAULT_SPEED_TILES_PER_SEC = 1;
const HEX_SIZE = 1;

export interface UnitMotion {
  mode: "pending" | "active";
  id: string;
  path: HexCoordinate[];
  points: Array<{ x: number; z: number }>;
  startTimeMs: number;
  speedTilesPerSec: number;
}

interface UnitMotionStore {
  motions: Record<string, UnitMotion>;
  holdMotion: (unitId: string, coordinate: HexCoordinate) => void;
  startMotion: (unitId: string, path: HexCoordinate[], speedTilesPerSec?: number) => void;
  stopMotion: (unitId: string) => void;
  clearAll: () => void;
}

const nowMs = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());
const createMotionId = () => `motion_${Date.now()}_${Math.random().toString(36).slice(2)}`;

export const useUnitMotionStore = create<UnitMotionStore>((set) => ({
  motions: {},
  holdMotion: (unitId, coordinate) => {
    const pixel = hexToPixel(coordinate, HEX_SIZE);
    set((state) => ({
      motions: {
        ...state.motions,
        [unitId]: {
          mode: "pending",
          id: createMotionId(),
          path: [coordinate],
          points: [{ x: pixel.x, z: pixel.y }],
          startTimeMs: nowMs(),
          speedTilesPerSec: 0,
        },
      },
    }));
  },
  startMotion: (unitId, path, speedTilesPerSec = DEFAULT_SPEED_TILES_PER_SEC) => {
    if (!path || path.length < 2) return;
    const points = path.map((coord) => {
      const pixel = hexToPixel(coord, HEX_SIZE);
      return { x: pixel.x, z: pixel.y };
    });
    set((state) => ({
      motions: {
        ...state.motions,
        [unitId]: {
          mode: "active",
          id: createMotionId(),
          path,
          points,
          startTimeMs: nowMs(),
          speedTilesPerSec,
        },
      },
    }));
  },
  stopMotion: (unitId) =>
    set((state) => {
      if (!state.motions[unitId]) return state;
      const { [unitId]: _removed, ...rest } = state.motions;
      return { motions: rest };
    }),
  clearAll: () => set({ motions: {} }),
}));
