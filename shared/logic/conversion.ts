/**
 * Faith / Conversion invariants (SSOT contract)
 *
 * This module is the single source of truth for unit conversion rules.
 *
 * Invariants:
 * - Costs: read from `GAME_RULES.conversion.costs` via exported helpers (no inline constants elsewhere).
 * - RNG: never uses `Math.random()`; uses only `state.rngSeed` and advances exactly once per valid attempt.
 * - Eligibility: validated in one place (`canAttemptUnitConversion`), not split between UI and reducer.
 * - Side-effects: a valid attempt always spends the cost and consumes the acting unit’s turn consistently.
 * - Determinism: seed advances only after eligibility + affordability checks pass (prevents “burning RNG”).
 */

import type { GameState, PlayerState } from '../types/game';
import type { Unit } from '../types/unit';
import { GAME_RULES } from '../data/gameRules';
import { hexDistance } from '../utils/hex';

export type ConversionFailureReason =
  | 'not_found'
  | 'not_owner_turn'
  | 'invalid_caster'
  | 'invalid_target'
  | 'same_player'
  | 'out_of_range'
  | 'exhausted'
  | 'insufficient_faith';

export function getUnitConversionFaithCost(): number {
  return GAME_RULES.conversion.costs.unit;
}

export function canAttemptUnitConversion(
  state: GameState,
  caster: Unit,
  target: Unit,
  options?: { ignoreTurn?: boolean }
): { ok: true } | { ok: false; reason: ConversionFailureReason } {
  if (!caster || !target) return { ok: false, reason: 'not_found' };
  if (!options?.ignoreTurn) {
    const currentPlayerId = state.players[state.currentPlayerIndex]?.id;
    if (!currentPlayerId || caster.playerId !== currentPlayerId) return { ok: false, reason: 'not_owner_turn' };
  }
  if (caster.playerId === target.playerId) return { ok: false, reason: 'same_player' };
  if (caster.hasAttacked || caster.remainingMovement <= 0) return { ok: false, reason: 'exhausted' };

  // Canonical rule: unit conversions are performed by missionaries.
  if (caster.type !== 'missionary') return { ok: false, reason: 'invalid_caster' };
  if (!caster.abilities?.includes('convert')) return { ok: false, reason: 'invalid_caster' };
  if (!target.playerId) return { ok: false, reason: 'invalid_target' };

  const distance = hexDistance(caster.coordinate, target.coordinate);
  if (distance > GAME_RULES.abilities.conversionRadius) return { ok: false, reason: 'out_of_range' };

  return { ok: true };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function nextRngSeed(seed: number): number {
  return (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
}

export function computeUnitConversionChance(
  casterPlayer: PlayerState,
  targetPlayer: PlayerState | undefined,
  targetUnit: Unit
): number {
  const targetFaith = targetPlayer?.stats.faith ?? 0;
  const targetPride = targetPlayer?.stats.pride ?? 0;
  const targetDissent = targetPlayer?.stats.internalDissent ?? 0;

  const base = GAME_RULES.abilities.conversionResistance.baseDifficulty / 100; // 0..1
  const diff = casterPlayer.stats.faith - targetFaith;
  const diffBonus = (diff * GAME_RULES.abilities.conversionResistance.faithDifferentialWeight) / 100;

  const woundFactor = 0.8 + 0.2 * (1 - targetUnit.hp / Math.max(1, targetUnit.maxHp)); // 0.8..1.0
  const prideFactor = 1 + (targetPride / 100) * 0.25;
  const dissentFactor = 1 + (targetDissent / 100) * 0.15;

  const minChance = GAME_RULES.abilities.conversionResistance.minSuccessChance / 100;
  const maxChance = GAME_RULES.abilities.conversionResistance.maxSuccessChance / 100;

  return clamp01(Math.max(minChance, Math.min(maxChance, (base + diffBonus) * woundFactor * prideFactor * dissentFactor)));
}

export function attemptUnitConversion(
  state: GameState,
  casterUnitId: string,
  targetUnitId: string
): { ok: true; success: boolean; chance: number; state: GameState } | { ok: false; reason: ConversionFailureReason } {
  const caster = state.units.find(u => u.id === casterUnitId);
  const target = state.units.find(u => u.id === targetUnitId);
  if (!caster || !target) return { ok: false, reason: 'not_found' };

  const casterPlayer = state.players.find(p => p.id === caster.playerId);
  if (!casterPlayer) return { ok: false, reason: 'invalid_caster' };

  const eligibility = canAttemptUnitConversion(state, caster, target);
  if (!eligibility.ok) return eligibility;

  const costFaith = getUnitConversionFaithCost();
  if (casterPlayer.stats.faith < costFaith) return { ok: false, reason: 'insufficient_faith' };

  const targetPlayer = state.players.find(p => p.id === target.playerId);
  const chance = computeUnitConversionChance(casterPlayer, targetPlayer, target);

  // RNG advances only on valid attempt (after eligibility + cost checks).
  const currentSeed = state.rngSeed ?? 0;
  const advancedSeed = nextRngSeed(currentSeed);
  const roll = (advancedSeed >>> 0) / 4294967296;
  const success = roll < chance;

  const updatedPlayers = state.players.map(p =>
    p.id === casterPlayer.id
      ? { ...p, stats: { ...p.stats, faith: Math.max(0, p.stats.faith - costFaith) } }
      : p
  );

  const updatedUnits = state.units.map(u => {
    if (u.id === caster.id) return { ...u, hasAttacked: true, remainingMovement: 0 };
    if (u.id === target.id && success) {
      return {
        ...u,
        playerId: caster.playerId,
        hp: Math.min(u.maxHp, u.hp + GAME_RULES.units.healingAmount),
      };
    }
    return u;
  });

  return {
    ok: true,
    success,
    chance,
    state: {
      ...state,
      players: updatedPlayers,
      units: updatedUnits,
      rngSeed: advancedSeed,
    }
  };
}
