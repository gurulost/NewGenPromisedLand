import type { GameState, PlayerState } from '../types/game';
import type { UnitDefinition, UnitType } from '../types/unit';
import { getUnitDefinition } from '../data/units';

export type PerTurnDelta = { stars?: number; faith?: number; pride?: number; dissent?: number };
export type CooldownDelta = Partial<PlayerState['diplomaticCooldowns']>;

export type UnitPassiveBreakdown = Array<{
  unitType: UnitType;
  count: number;
  perTurn: PerTurnDelta;
  diplomacyCooldownDelta?: CooldownDelta;
}>;

function addDelta(total: PerTurnDelta, delta: PerTurnDelta, scale: number): PerTurnDelta {
  return {
    stars: (total.stars || 0) + (delta.stars || 0) * scale,
    faith: (total.faith || 0) + (delta.faith || 0) * scale,
    pride: (total.pride || 0) + (delta.pride || 0) * scale,
    dissent: (total.dissent || 0) + (delta.dissent || 0) * scale,
  };
}

function evaluateConditionalPerTurn(def: UnitDefinition, stats: PlayerState['stats']): PerTurnDelta {
  const conditions = def.passiveEffects?.perTurnWhen || [];
  return conditions.reduce<PerTurnDelta>((acc, cond) => {
    const value = stats[cond.stat as keyof PlayerState['stats']] as number;
    if (typeof value !== 'number') return acc;
    if (typeof cond.gte === 'number' && value < cond.gte) return acc;
    if (typeof cond.lte === 'number' && value > cond.lte) return acc;
    return addDelta(acc, cond.perTurn, 1);
  }, {});
}

function getPerTurnForUnit(def: UnitDefinition, stats: PlayerState['stats']): PerTurnDelta {
  const base = def.passiveEffects?.perTurn || {};
  const conditional = evaluateConditionalPerTurn(def, stats);
  return addDelta(base, conditional, 1);
}

function addCooldownDelta(base: CooldownDelta, delta: CooldownDelta, scale: number): CooldownDelta {
  const keys: Array<keyof PlayerState['diplomaticCooldowns']> = ['declareWar', 'formAlliance', 'breakAlliance', 'requestTrade'];
  const next: CooldownDelta = { ...base };
  for (const key of keys) {
    const value = (delta[key] ?? 0) * scale;
    if (!value) continue;
    next[key] = (next[key] ?? 0) + value;
  }
  return next;
}

function getCooldownDeltaForUnit(def: UnitDefinition): { delta: CooldownDelta; stacking: 'any' | 'per_unit' } | null {
  const entry = def.passiveEffects?.diplomacyCooldownDelta;
  if (!entry) return null;
  return { delta: entry.perTurn, stacking: entry.stacking };
}

export function computeUnitPassiveEffectsForPlayer(
  state: GameState,
  playerId: string,
  statsForConditions: PlayerState['stats']
): { perTurn: PerTurnDelta; cooldownDelta: CooldownDelta; breakdown: UnitPassiveBreakdown } {
  const myUnits = (state.units ?? []).filter(u => u.playerId === playerId);
  const counts = new Map<UnitType, number>();
  for (const u of myUnits) {
    counts.set(u.type, (counts.get(u.type) || 0) + 1);
  }

  let totals: PerTurnDelta = {};
  let cooldownTotals: CooldownDelta = {};
  const breakdown: UnitPassiveBreakdown = [];

  counts.forEach((count, unitType) => {
    const def = getUnitDefinition(unitType);
    if (!def.passiveEffects) return;

    const perTurn = getPerTurnForUnit(def, statsForConditions);
    totals = addDelta(totals, perTurn, count);

    const cd = getCooldownDeltaForUnit(def);
    if (cd) {
      const scale = cd.stacking === 'per_unit' ? count : 1;
      cooldownTotals = addCooldownDelta(cooldownTotals, cd.delta, scale);
    }

    breakdown.push({
      unitType,
      count,
      perTurn,
      diplomacyCooldownDelta: cd ? cd.delta : undefined,
    });
  });

  return { perTurn: totals, cooldownDelta: cooldownTotals, breakdown };
}
