import type { UnitAnimationState } from "./unitAnimationRegistry";

export interface UnitAnimationEventConfig {
  durationMs: number;
  priority: number;
}

export const DEFAULT_ANIMATION_EVENT_CONFIG: Record<UnitAnimationState, UnitAnimationEventConfig> = {
  idle: { durationMs: 0, priority: 0 },
  move: { durationMs: 0, priority: 0 },
  attack: { durationMs: 650, priority: 3 },
  hit: { durationMs: 450, priority: 2 },
  death: { durationMs: 1200, priority: 4 },
  ability: { durationMs: 800, priority: 3 },
  celebrate: { durationMs: 1200, priority: 3 },
};
