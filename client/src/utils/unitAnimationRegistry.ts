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

export type ClipEntry = string | { name: string; weight?: number; label?: string };

export interface NormalizedClipEntry {
  name: string;
  weight: number;
}

export const DEFAULT_MOVE_SPEED_TPS = 1;

export const UNIT_ANIMATION_REGISTRY: Partial<Record<UnitType, UnitAnimationSpec>> = {
  worker: {
    animatedModelPath: "/models/worker_animated.glb",
    clips: {
      move: [
        { name: "Walking", weight: 50 },
        { name: "Stumble_Walk", weight: 15 },
        { name: "Running", weight: 10 },
        { name: "Confident_Strut", weight: 25 },
      ],
      idle: [
        { name: "Idle_12", weight: 25 },
        { name: "Idle_15", weight: 25 },
        { name: "Idle_3", weight: 25 },
        { name: "Idle_7", weight: 25 },
      ],
      celebrate: [
        { name: "Hip_Hop_Dance", weight: 40 },
        { name: "FunnyDancing_01", weight: 30 },
        { name: "FunnyDancing_03", weight: 30 },
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
  scout: {
    animatedModelPath: "/models/scout_animated.glb",
    clips: {
      idle: [
        { name: "Idle_02", weight: 1 },
        { name: "Idle_11", weight: 1 },
        { name: "Idle_3", weight: 1 },
        { name: "Idle_7", weight: 1 },
        { name: "Idle_8", weight: 1 },
        { name: "Confused_Scratch", weight: 1 },
      ],
      move: [
        { name: "Walking", weight: 30 },
        { name: "Running", weight: 10 },
        { name: "Sneaky_Walk", weight: 18 },
        { name: "Cautious_Crouch_Walk_Forward", weight: 15 },
        { name: "Funky_Walk", weight: 7 },
        { name: "Female_Bow_Charge_Left_Hand", weight: 10 },
        { name: "Female_Throwing_Stance_Charge", weight: 10 },
      ],
      celebrate: [
        { name: "Backflip", weight: 20 },
        { name: "One_Arm_Handstand", weight: 35 },
        { name: "Breakdance_1990", weight: 15 },
        { name: "FunnyDancing_03", weight: 15 },
        { name: "Gangnam_Groove", weight: 15 },
      ],
    },
    moveSpeedTilesPerSec: DEFAULT_MOVE_SPEED_TPS,
    yawOffset: 0,
    clipDurationsMs: {
      Backflip: 633,
      Breakdance_1990: 8033,
      Cautious_Crouch_Walk_Forward: 10133,
      Confused_Scratch: 2333,
      Female_Bow_Charge_Left_Hand: 8767,
      Female_Throwing_Stance_Charge: 1133,
      Funky_Walk: 567,
      FunnyDancing_03: 1900,
      Gangnam_Groove: 9967,
      Idle_02: 8000,
      Idle_11: 500,
      Idle_3: 1900,
      Idle_7: 2867,
      Idle_8: 1033,
      One_Arm_Handstand: 2133,
      Running: 500,
      Sneaky_Walk: 11500,
      Walking: 3833,
    },
  },
  missionary: {
    animatedModelPath: "/models/missionary_animated.glb",
    clips: {
      idle: [
        { name: "Long_Breathe_and_Look_Around", weight: 25 },
        { name: "Talk_Passionately", weight: 20 },
        { name: "Talk_with_Left_Hand_Raised", weight: 30 },
        { name: "Talk_with_Right_Hand_Open", weight: 25 },
      ],
      move: [
        { name: "Walking", weight: 30 },
        { name: "walking_2", weight: 30 },
        { name: "Texting_Walk", weight: 5 },
        { name: "Running", weight: 15 },
        { name: "RunFast", weight: 10 },
      ],
      celebrate: [
        { name: "Excited_Walk_M", weight: 20 },
        { name: "Cheer_with_Both_Hands_1", weight: 20 },
        { name: "happy_jump_m", weight: 15 },
        { name: "Arm_Circle_Shuffle", weight: 10 },
        { name: "Big_Heart_Gesture", weight: 10 },
        { name: "Handstand_Flip", weight: 15 },
        { name: "Clapping_Run", weight: 5 },
      ],
      death: "dying_backwards",
    },
    moveSpeedTilesPerSec: DEFAULT_MOVE_SPEED_TPS,
    yawOffset: 0,
    clipDurationsMs: {
      Arm_Circle_Shuffle: 9833,
      Big_Heart_Gesture: 2233,
      Cheer_with_Both_Hands_1: 2000,
      Clapping_Run: 6167,
      Excited_Walk_M: 13667,
      Handstand_Flip: 467,
      Long_Breathe_and_Look_Around: 10267,
      Quick_Walk: 1033,
      RunFast: 1200,
      Running: 9667,
      Talk_Passionately: 3000,
      Talk_with_Left_Hand_Raised: 633,
      Talk_with_Right_Hand_Open: 4633,
      Texting_Walk: 3767,
      Walking: 2200,
      dying_backwards: 10700,
      happy_jump_m: 3300,
      walking_2: 11267,
    },
  },
};

export type UnitAnimationOverrides = Partial<Record<UnitType, Partial<UnitAnimationSpec>>>;

let registryOverrides: UnitAnimationOverrides = {};
let registryVersion = 0;
const registrySubscribers = new Set<() => void>();
let overridesLoaded = false;
let serverOverridesLoaded = false;
let serverOverridesInFlight: Promise<void> | null = null;
const SERVER_OVERRIDES_ENDPOINT = "/api/animation-overrides";

const notifyRegistryUpdate = () => {
  registryVersion += 1;
  registrySubscribers.forEach((listener) => listener());
};

const ensureOverridesLoaded = () => {
  if (overridesLoaded) return;
  if (typeof window === "undefined") return;
  overridesLoaded = true;
  const stored = window.localStorage.getItem("animationLabOverrides");
  if (stored) {
    try {
      registryOverrides = JSON.parse(stored) as UnitAnimationOverrides;
      notifyRegistryUpdate();
    } catch {
      // Ignore malformed overrides.
    }
  }
  loadServerOverrides();
};

const loadServerOverrides = () => {
  if (serverOverridesLoaded || serverOverridesInFlight) return;
  if (typeof window === "undefined" || typeof fetch !== "function") return;
  serverOverridesInFlight = fetch(SERVER_OVERRIDES_ENDPOINT, { method: "GET" })
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      if (!data || typeof data !== "object") return;
      const serverOverrides = data as UnitAnimationOverrides;
      const serverKeys = Object.keys(serverOverrides);
      const localKeys = Object.keys(registryOverrides);

      if (serverKeys.length === 0 && localKeys.length > 0) {
        // Bootstrap server with local overrides when server is empty.
        persistServerOverrides(registryOverrides);
        return;
      }

      registryOverrides = serverOverrides;
      notifyRegistryUpdate();
      try {
        window.localStorage.setItem("animationLabOverrides", JSON.stringify(registryOverrides));
      } catch {
        // Ignore storage failures.
      }
    })
    .catch(() => {})
    .finally(() => {
      serverOverridesLoaded = true;
      serverOverridesInFlight = null;
    });
};

const persistServerOverrides = (overrides: UnitAnimationOverrides) => {
  if (typeof window === "undefined" || typeof fetch !== "function") return;
  fetch(SERVER_OVERRIDES_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(overrides),
  }).catch(() => {});
};

export const setUnitAnimationOverrides = (overrides: UnitAnimationOverrides) => {
  registryOverrides = overrides;
  notifyRegistryUpdate();
  persistServerOverrides(overrides);
};

export const updateUnitAnimationOverride = (unitType: UnitType, spec: Partial<UnitAnimationSpec> | null) => {
  if (spec) {
    registryOverrides = { ...registryOverrides, [unitType]: spec };
  } else {
    const { [unitType]: _removed, ...rest } = registryOverrides;
    registryOverrides = rest;
  }
  notifyRegistryUpdate();
  persistServerOverrides(registryOverrides);
};

export const clearUnitAnimationOverrides = () => {
  registryOverrides = {};
  notifyRegistryUpdate();
  persistServerOverrides(registryOverrides);
};

export const getUnitAnimationOverrides = () => {
  ensureOverridesLoaded();
  return registryOverrides;
};

export const hasUnitAnimationOverride = (unitType: UnitType): boolean => {
  ensureOverridesLoaded();
  return !!registryOverrides[unitType];
};

export const subscribeUnitAnimationRegistry = (listener: () => void): (() => void) => {
  registrySubscribers.add(listener);
  return () => registrySubscribers.delete(listener);
};

export const getUnitAnimationRegistryVersion = () => registryVersion;

export const getUnitAnimationSpec = (unitType: UnitType): UnitAnimationSpec | undefined => {
  ensureOverridesLoaded();
  const base = UNIT_ANIMATION_REGISTRY[unitType];
  const override = registryOverrides[unitType];
  if (!override) return base;
  if (!base) return override as UnitAnimationSpec;
  return {
    ...base,
    ...override,
    clips: override.clips ? { ...base.clips, ...override.clips } : base.clips,
    eventDurationsMs: override.eventDurationsMs
      ? { ...base.eventDurationsMs, ...override.eventDurationsMs }
      : base.eventDurationsMs,
    clipDurationsMs: override.clipDurationsMs
      ? { ...base.clipDurationsMs, ...override.clipDurationsMs }
      : base.clipDurationsMs,
  };
};

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
