import type { PlayerState } from "../../types/game";
import { clamp01 } from "../../utils/math";

export function clampStat(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export const normalizeAbility = (abilityId: string) => abilityId.toUpperCase();

export const hasAbility = (abilities: string[] | undefined, abilityId: string) =>
  (abilities || []).some(ability => normalizeAbility(String(ability)) === normalizeAbility(abilityId));

type MoraleDelta = { faith?: number; pride?: number; dissent?: number };

export function applyMoralDelta(stats: PlayerState["stats"], delta: MoraleDelta): PlayerState["stats"] {
  return {
    faith: clampStat(stats.faith + (delta.faith || 0)),
    pride: clampStat(stats.pride + (delta.pride || 0)),
    internalDissent: clampStat(stats.internalDissent + (delta.dissent || 0)),
  };
}

export function pickWeightedIndex(weights: number[], roll01: number): number {
  const total = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
  if (total <= 0) return 0;
  let selector = clamp01(roll01) * total;
  for (let i = 0; i < weights.length; i++) {
    selector -= Math.max(0, weights[i]);
    if (selector <= 0) return i;
  }
  return weights.length - 1;
}
