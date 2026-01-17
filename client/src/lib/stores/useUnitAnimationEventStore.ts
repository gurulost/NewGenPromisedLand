import { create } from "zustand";
import type { UnitAnimationState } from "../../utils/unitAnimationRegistry";
import { DEFAULT_ANIMATION_EVENT_CONFIG } from "../../utils/unitAnimationEvents";
import {
  getUnitAnimationClipDurationMs,
  getUnitAnimationClipPool,
  getUnitAnimationEventDuration,
  pickWeightedClipName,
} from "../../utils/unitAnimationRegistry";
import type { UnitType } from "@shared/types/unit";

interface UnitAnimationEvent {
  unitId: string;
  state: UnitAnimationState;
  clipName?: string;
  priority: number;
  expiresAt: number;
  token: string;
}

interface UnitAnimationEventStore {
  active: Record<string, UnitAnimationEvent>;
  emitEvent: (params: {
    unitId: string;
    unitType?: UnitType;
    state: UnitAnimationState;
    durationMs?: number;
    priority?: number;
  }) => void;
  clearUnit: (unitId: string) => void;
  clearAll: () => void;
  cleanupStale: () => void;
}

const timeouts = new Map<string, ReturnType<typeof setTimeout>>();

const makeToken = () => `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;

const clearTimeoutForUnit = (unitId: string) => {
  const timeoutId = timeouts.get(unitId);
  if (timeoutId !== undefined) {
    clearTimeout(timeoutId);
    timeouts.delete(unitId);
  }
};

export const useUnitAnimationEventStore = create<UnitAnimationEventStore>((set, get) => ({
  active: {},
  emitEvent: ({ unitId, unitType, state, durationMs, priority }) => {
    const now = Date.now();
    const config = DEFAULT_ANIMATION_EVENT_CONFIG[state];
    const resolvedPriority = priority ?? config?.priority ?? 0;
    const registryDuration = unitType ? getUnitAnimationEventDuration(unitType, state) : undefined;
    const existing = get().active[unitId];

    if (existing && existing.expiresAt > now && resolvedPriority < existing.priority) {
      return;
    }

    const token = makeToken();
    const isLoopingState = state === "idle" || state === "move";
    let clipName: string | undefined;
    if (!unitType && !isLoopingState) {
      return;
    }
    if (unitType && !isLoopingState) {
      const pool = getUnitAnimationClipPool(unitType, state);
      const picked = pickWeightedClipName(pool, token);
      clipName = picked ?? undefined;
      if (!clipName) {
        return;
      }
    }

    const clipDuration = unitType && clipName
      ? getUnitAnimationClipDurationMs(unitType, clipName)
      : undefined;
    const resolvedDuration =
      durationMs ?? clipDuration ?? registryDuration ?? config?.durationMs ?? 600;
    const expiresAt = now + Math.max(resolvedDuration, 1);
    clearTimeoutForUnit(unitId);

    set((store) => ({
      active: {
        ...store.active,
        [unitId]: {
          unitId,
          state,
          clipName,
          priority: resolvedPriority,
          expiresAt,
          token,
        },
      },
    }));

    const timeoutId = setTimeout(() => {
      const current = get().active[unitId];
      if (!current || current.token !== token) return;
      set((store) => {
        const { [unitId]: _removed, ...rest } = store.active;
        return { active: rest };
      });
      clearTimeoutForUnit(unitId);
    }, Math.max(resolvedDuration, 1));

    timeouts.set(unitId, timeoutId);
  },
  clearUnit: (unitId) => {
    clearTimeoutForUnit(unitId);
    set((store) => {
      if (!store.active[unitId]) return store;
      const { [unitId]: _removed, ...rest } = store.active;
      return { active: rest };
    });
  },
  clearAll: () => {
    timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    timeouts.clear();
    set({ active: {} });
  },
  cleanupStale: () => {
    const now = Date.now();
    set((store) => {
      const updated: Record<string, UnitAnimationEvent> = {};
      Object.entries(store.active).forEach(([unitId, event]) => {
        if (event.expiresAt > now) {
          updated[unitId] = event;
        } else {
          clearTimeoutForUnit(unitId);
        }
      });
      return { active: updated };
    });
  },
}));
