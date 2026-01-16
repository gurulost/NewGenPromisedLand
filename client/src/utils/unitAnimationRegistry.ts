import type { UnitType } from "@shared/types/unit";

export type UnitAnimationState =
  | "idle"
  | "move"
  | "attack"
  | "hit"
  | "death"
  | "ability"
  | "celebrate";

export interface UnitAnimationSpec {
  animatedModelPath?: string;
  clips: Partial<Record<UnitAnimationState, ClipEntry | ClipEntry[]>>;
  moveSpeedTilesPerSec?: number;
  yawOffset?: number;
  eventDurationsMs?: Partial<Record<UnitAnimationState, number>>;
  clipDurationsMs?: Record<string, number>;
}

export type ClipEntry = string | { name: string; weight?: number };

export interface NormalizedClipEntry {
  name: string;
  weight: number;
}

export const DEFAULT_MOVE_SPEED_TPS = 1;

export const UNIT_ANIMATION_REGISTRY: Partial<Record<UnitType, UnitAnimationSpec>> = {
  worker: {
    animatedModelPath: "/models/worker_animated.glb",
    clips: {
      idle: [
        { name: "Idle_12", weight: 1 },
        { name: "Idle_15", weight: 1 },
        { name: "Idle_3", weight: 1 },
        { name: "Idle_7", weight: 1 },
      ],
      move: [
        { name: "Walking", weight: 50 },
        { name: "Stumble_Walk", weight: 15 },
        { name: "Running", weight: 10 },
        { name: "Confident_Strut", weight: 25 },
      ],
      celebrate: [
        { name: "FunnyDancing_01", weight: 30 },
        { name: "FunnyDancing_03", weight: 30 },
        { name: "Hip_Hop_Dance", weight: 40 },
      ],
    },
    moveSpeedTilesPerSec: DEFAULT_MOVE_SPEED_TPS,
    yawOffset: 0,
    eventDurationsMs: {
      attack: 650,
      hit: 450,
      death: 1200,
    },
    clipDurationsMs: {
      Confident_Strut: 8767,
      FunnyDancing_01: 633,
      FunnyDancing_03: 1033,
      Hip_Hop_Dance: 1200,
      Idle_12: 6000,
      Idle_15: 7000,
      Idle_3: 9967,
      Idle_7: 2600,
      Running: 2667,
      Stumble_Walk: 7767,
      Walking: 8033,
      walking_2_inplace: 4100,
    },
  },
  warrior: {
    animatedModelPath: "/models/warrior_animated.glb",
    clips: {
      idle: [
        { name: "Idle", weight: 5 },
        { name: "Idle_8", weight: 20 },
        { name: "Idle_11", weight: 50 },
        { name: "Axe_Breathe_and_Look_Around", weight: 15 },
        { name: "Burpee_Exercise", weight: 10 },
      ],
      move: [
        { name: "Walking", weight: 35 },
        { name: "Casual_Walk", weight: 20 },
        { name: "Slow_Orc_Walk", weight: 10 },
        { name: "Running", weight: 15 },
        { name: "Proud_Strut", weight: 20 },
      ],
      attack: [
        { name: "Punch_Combo", weight: 1 },
        { name: "Kung_Fu_Punch", weight: 1 },
        { name: "Lunge_Spin_Kick", weight: 1 },
      ],
      celebrate: [
        { name: "FunnyDancing_02", weight: 15 },
        { name: "All_Night_Dance", weight: 10 },
        { name: "Hip_Hop_Dance_2", weight: 15 },
        { name: "Hip_Hop_Dance_3", weight: 25 },
        { name: "Shake_It_Off_Dance", weight: 15 },
        { name: "Agree_Gesture", weight: 15 },
      ],
      death: "Dead",
    },
    moveSpeedTilesPerSec: DEFAULT_MOVE_SPEED_TPS,
    yawOffset: 0,
      clipDurationsMs: {
      Agree_Gesture: 7500,
      All_Night_Dance: 7300,
      Axe_Breathe_and_Look_Around: 1633,
      Burpee_Exercise: 1033,
      Casual_Walk: 4733,
      Dead: 4500,
      FunnyDancing_02: 4200,
      Hip_Hop_Dance_2: 2967,
      Hip_Hop_Dance_3: 4000,
      Idle: 13000,
      Idle_11: 2467,
      Idle_8: 5500,
      Kung_Fu_Punch: 8167,
      Lunge_Spin_Kick: 6100,
      Proud_Strut: 1900,
      Punch_Combo: 8000,
      Running: 633,
      Shake_It_Off_Dance: 16267,
      Slow_Orc_Walk: 11300,
      Walking: 3167,
    },
},
};

export const getUnitAnimationSpec = (unitType: UnitType): UnitAnimationSpec | undefined =>
  UNIT_ANIMATION_REGISTRY[unitType];

export const getAnimatedModelPathForUnit = (unitType: UnitType): string | null =>
  getUnitAnimationSpec(unitType)?.animatedModelPath ?? null;

export const getUnitAnimationMoveSpeed = (unitType: UnitType): number | undefined =>
  getUnitAnimationSpec(unitType)?.moveSpeedTilesPerSec;

export const getUnitAnimationYawOffset = (unitType: UnitType): number | undefined =>
  getUnitAnimationSpec(unitType)?.yawOffset;

export const getUnitAnimationClipNames = (
  unitType: UnitType,
  state: UnitAnimationState
): string[] => {
  const clips = getUnitAnimationSpec(unitType)?.clips?.[state];
  if (!clips) return [];
  return Array.isArray(clips) ? clips.map((entry) => (typeof entry === "string" ? entry : entry.name)) : [typeof clips === "string" ? clips : clips.name];
};

export const getUnitAnimationEventDuration = (
  unitType: UnitType,
  state: UnitAnimationState
): number | undefined => getUnitAnimationSpec(unitType)?.eventDurationsMs?.[state];

export const hasUnitAnimationState = (unitType: UnitType, state: UnitAnimationState): boolean =>
  getUnitAnimationClipNames(unitType, state).length > 0;

export const getUnitAnimationClipPool = (
  unitType: UnitType,
  state: UnitAnimationState
): NormalizedClipEntry[] => {
  const clips = getUnitAnimationSpec(unitType)?.clips?.[state];
  if (!clips) return [];
  const entries = Array.isArray(clips) ? clips : [clips];
  return entries.map((entry) =>
    typeof entry === "string" ? { name: entry, weight: 1 } : { name: entry.name, weight: entry.weight ?? 1 }
  );
};

export const getUnitAnimationClipDurationMs = (
  unitType: UnitType,
  clipName: string
): number | undefined => getUnitAnimationSpec(unitType)?.clipDurationsMs?.[clipName];

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const pickWeightedClipName = (
  pool: NormalizedClipEntry[],
  key: string
): string | null => {
  if (!pool.length) return null;
  const totalWeight = pool.reduce((sum, entry) => sum + (entry.weight || 0), 0);
  if (totalWeight <= 0) return pool[0]?.name ?? null;
  const seed = hashString(key);
  let t = seed + 0x6D2B79F5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const rand = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  let target = rand * totalWeight;
  for (const entry of pool) {
    target -= entry.weight || 0;
    if (target <= 0) return entry.name;
  }
  return pool[pool.length - 1]?.name ?? null;
};
