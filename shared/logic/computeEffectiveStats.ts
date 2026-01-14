import { GameState } from "../types/game";
import { Unit } from "../types/unit";
import { getEffectiveAttackRange } from "./unitLogic";
import { ComputeStatsContext, onComputeStats } from "./effects";

export interface EffectiveStats {
  attack: number;
  defense: number;
  range: number;
  movement: number;
  flags: {
    ranged: boolean;
  };
  modifiers: string[];
  specialEffects: string[];
}

/**
 * Placeholder for canonical stat computation.
 *
 * Migration target: pull all combat modifiers into this function
 * so UI and combat use identical rules.
 */
export function computeEffectiveStats(
  unit: Unit,
  state: GameState,
  ctx: ComputeStatsContext
): EffectiveStats {
  const effectResult = onComputeStats(unit, state, ctx);
  const range = getEffectiveAttackRange(unit);
  return {
    attack: effectResult.attack,
    defense: effectResult.defense,
    range,
    movement: unit.movement,
    flags: {
      ranged: range > 1,
    },
    modifiers: effectResult.modifiers,
    specialEffects: effectResult.specialEffects,
  };
}
