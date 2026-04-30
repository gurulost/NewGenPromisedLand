/**
 * Status Effects System - Centralized handling for unit status effects
 * This provides a single source of truth for status effect types and behaviors
 */

import { GameState } from "../types/game";
import { Unit } from "../types/unit";
import { hasUnitEffectFlag } from "./activeEffects";

// Status effect types
export type StatusEffectType =
    | 'TESTIMONY_PRESSURE'
    | 'CULTURAL_PRESSURE'
    | 'INTIMIDATED'
    | 'RALLIED'
    | 'DIVINE_PROTECTION';

export interface StatusEffect {
    type: StatusEffectType;
    turnsRemaining?: number;
    attackPenalty?: number;
    defensePenalty?: number;
    conversionChanceBonus?: number;
    attackBonus?: number;
    defenseBonus?: number;
    sourcePlayerId?: string;
}

// Negative statuses currently in the game ruleset. Keep centralized so
// immunity effects do not need to know every call site that can apply them.
export const NEGATIVE_STATUS_EFFECTS: StatusEffectType[] = ['INTIMIDATED', 'TESTIMONY_PRESSURE', 'CULTURAL_PRESSURE'];
export const MORALE_DEBUFFS: StatusEffectType[] = NEGATIVE_STATUS_EFFECTS;

/**
 * Check if a status effect is a morale debuff
 */
export function isMoraleDebuff(type: string): boolean {
    return MORALE_DEBUFFS.includes(type as StatusEffectType);
}

export function isNegativeStatus(type: string): boolean {
    return NEGATIVE_STATUS_EFFECTS.includes(type as StatusEffectType);
}

/**
 * Check if a status can be applied to a unit (respects immunity)
 * Units with YOUNG_VIGOR are immune to morale debuffs
 */
export function canApplyStatus(unit: Unit, statusType: string, state?: GameState): boolean {
    if (isNegativeStatus(statusType)) {
        if (state && hasUnitEffectFlag(state, unit, 'immuneToNegativeStatus')) {
            return false;
        }

        const abilities = new Set(
            (unit.abilities ?? []).map(a => String(a).toUpperCase())
        );
        if (abilities.has('YOUNG_VIGOR')) {
            return false; // Immune to morale debuffs
        }
    }
    return true;
}

/**
 * Get all status effects from a unit
 */
export function getStatusEffects(unit: Unit): StatusEffect[] {
    const effects = (unit as any).statusEffects;
    return Array.isArray(effects) ? effects : [];
}

/**
 * Check if unit has a specific status effect
 */
export function hasStatusEffect(unit: Unit, type: StatusEffectType): boolean {
    return getStatusEffects(unit).some(e => e?.type === type);
}

/**
 * Get the attack penalty from all status effects
 */
export function getStatusAttackPenalty(unit: Unit): number {
    return getStatusEffects(unit).reduce((total, effect) => {
        if (effect?.type === 'INTIMIDATED') {
            return total + 1; // -1 Attack from intimidation
        }
        if (effect?.type === 'TESTIMONY_PRESSURE' && typeof effect.attackPenalty === 'number') {
            return total + effect.attackPenalty;
        }
        return total;
    }, 0);
}

/**
 * Get the attack bonus from all status effects  
 */
export function getStatusAttackBonus(unit: Unit): number {
    return getStatusEffects(unit).reduce((total, effect) => {
        if (effect?.type === 'RALLIED') {
            return total + 2; // +2 Attack from rally
        }
        return total;
    }, 0);
}

export function getStatusDefensePenalty(unit: Unit): number {
    return getStatusEffects(unit).reduce((total, effect) => {
        if (effect?.type === 'CULTURAL_PRESSURE' && typeof effect.defensePenalty === 'number') {
            return total + effect.defensePenalty;
        }
        return total;
    }, 0);
}

export function getStatusConversionChanceBonus(unit: Unit, sourcePlayerId?: string): number {
    return getStatusEffects(unit).reduce((total, effect) => {
        if (effect?.type !== 'CULTURAL_PRESSURE') return total;
        if (sourcePlayerId && effect.sourcePlayerId && effect.sourcePlayerId !== sourcePlayerId) return total;
        if (typeof effect.conversionChanceBonus !== 'number') return total;
        return total + effect.conversionChanceBonus;
    }, 0);
}

/**
 * Apply a status effect to a unit (with immunity checks)
 * Returns the updated unit or null if status cannot be applied
 */
export function applyStatusEffect(unit: Unit, effect: StatusEffect, state?: GameState): Unit | null {
    if (!canApplyStatus(unit, effect.type, state)) {
        return null; // Unit is immune
    }

    const existingEffects = getStatusEffects(unit);
    // Replace existing effect of same type (refresh duration)
    const filteredEffects = existingEffects.filter(e => e?.type !== effect.type);

    return {
        ...unit,
        statusEffects: [...filteredEffects, effect]
    } as Unit;
}

/**
 * Remove a status effect from a unit
 */
export function removeStatusEffect(unit: Unit, type: StatusEffectType): Unit {
    const existingEffects = getStatusEffects(unit);
    return {
        ...unit,
        statusEffects: existingEffects.filter(e => e?.type !== type)
    } as Unit;
}

/**
 * Cleanse all morale debuffs from a unit (for YOUNG_VIGOR turn start)
 */
export function cleanseMoraleDebuffs(unit: Unit): Unit {
    const existingEffects = getStatusEffects(unit);
    return {
        ...unit,
        statusEffects: existingEffects.filter(e => !isMoraleDebuff(e?.type ?? ''))
    } as Unit;
}
