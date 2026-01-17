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
  expiresAtMs: number;
}

interface UnitMotionStore {
  motions: Record<string, UnitMotion>;
  holdMotion: (unitId: string, coordinate: HexCoordinate) => void;
  startMotion: (unitId: string, path: HexCoordinate[], speedTilesPerSec?: number) => void;
  stopMotion: (unitId: string) => void;
  cleanupStale: () => void;
  clearAll: () => void;
}

const nowMs = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());
const createMotionId = () => `motion_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const timeouts = new Map<string, ReturnType<typeof setTimeout>>();

const clearTimeoutForUnit = (unitId: string) => {
  const timeoutId = timeouts.get(unitId);
  if (timeoutId !== undefined) {
    clearTimeout(timeoutId);
    timeouts.delete(unitId);
  }
};

export const useUnitMotionStore = create<UnitMotionStore>((set, get) => {
  const scheduleClear = (unitId: string, motionId: string, delayMs: number) => {
    clearTimeoutForUnit(unitId);
    const timeoutId = setTimeout(() => {
      const current = get().motions[unitId];
      if (!current || current.id !== motionId) return;
      set((state) => {
        const { [unitId]: _removed, ...rest } = state.motions;
        return { motions: rest };
      });
      clearTimeoutForUnit(unitId);
    }, Math.max(delayMs, 0));
    timeouts.set(unitId, timeoutId);
  };

  return ({
  motions: {},
  holdMotion: (unitId, coordinate) => {
    const pixel = hexToPixel(coordinate, HEX_SIZE);
    const startTimeMs = nowMs();
    const expiresAtMs = startTimeMs + 2500;
    const motionId = createMotionId();
    set((state) => ({
      motions: {
        ...state.motions,
        [unitId]: {
          mode: "pending",
          id: motionId,
          path: [coordinate],
          points: [{ x: pixel.x, z: pixel.y }],
          startTimeMs,
          speedTilesPerSec: 0,
          expiresAtMs,
        },
      },
    }));
    scheduleClear(unitId, motionId, 2500);
  },
  startMotion: (unitId, path, speedTilesPerSec = DEFAULT_SPEED_TILES_PER_SEC) => {
    if (!path || path.length < 2) return;
    const points = path.map((coord) => {
      const pixel = hexToPixel(coord, HEX_SIZE);
      return { x: pixel.x, z: pixel.y };
    });
    const startTimeMs = nowMs();
    const durationMs = ((path.length - 1) / Math.max(speedTilesPerSec, 0.001)) * 1000;
    const expiresAtMs = startTimeMs + durationMs + 500;
    const motionId = createMotionId();
    set((state) => ({
      motions: {
        ...state.motions,
        [unitId]: {
          mode: "active",
          id: motionId,
          path,
          points,
          startTimeMs,
          speedTilesPerSec,
          expiresAtMs,
        },
      },
    }));
    scheduleClear(unitId, motionId, durationMs + 500);
  },
  stopMotion: (unitId) => {
    clearTimeoutForUnit(unitId);
    set((state) => {
      if (!state.motions[unitId]) return state;
      const { [unitId]: _removed, ...rest } = state.motions;
      return { motions: rest };
    });
  },
  cleanupStale: () => {
    const now = nowMs();
    set((state) => {
      const updated: Record<string, UnitMotion> = {};
      Object.entries(state.motions).forEach(([unitId, motion]) => {
        if (motion.expiresAtMs > now) {
          updated[unitId] = motion;
        } else {
          clearTimeoutForUnit(unitId);
        }
      });
      return { motions: updated };
    });
  },
  clearAll: () => {
    timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    timeouts.clear();
    set({ motions: {} });
  },
  });
});
