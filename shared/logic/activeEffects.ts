import { ActiveEffect, GameState } from "../types/game";
import { Unit } from "../types/unit";
import { hexDistance } from "../utils/hex";

type YieldModifierSummary = {
  multiplier: number;
  flat: number;
};

const getStoredEffects = (state: GameState): ActiveEffect[] =>
  Array.isArray(state.activeEffects) ? state.activeEffects : [];

export function getActiveEffects(state: GameState): ActiveEffect[] {
  return getStoredEffects(state).filter(effect => effect.turnsRemaining > 0);
}

function resolveEffectOriginCoordinate(effect: ActiveEffect, state: GameState) {
  if (effect.source.unitId) {
    const sourceUnit = state.units.find(unit => unit.id === effect.source.unitId);
    if (sourceUnit) {
      return sourceUnit.coordinate;
    }
  }

  return effect.source.coordinate;
}

function isSameStackGroup(existing: ActiveEffect, incoming: ActiveEffect): boolean {
  return (
    existing.source.abilityId === incoming.source.abilityId &&
    existing.source.playerId === incoming.source.playerId &&
    existing.source.unitId === incoming.source.unitId &&
    existing.target.kind === incoming.target.kind &&
    existing.target.playerId === incoming.target.playerId
  );
}

export function upsertActiveEffect(state: GameState, effect: ActiveEffect): GameState {
  const activeEffects = getStoredEffects(state);

  if (effect.stackRule === "stack") {
    return {
      ...state,
      activeEffects: [...activeEffects, effect],
    };
  }

  return {
    ...state,
    activeEffects: [
      ...activeEffects.filter(existing => !isSameStackGroup(existing, effect)),
      effect,
    ],
  };
}

export function tickActiveEffectsForPlayer(state: GameState, playerId: string): GameState {
  const nextEffects = getStoredEffects(state).flatMap(effect => {
    const shouldTick =
      (effect.tickOn === "source_turn_end" && effect.source.playerId === playerId) ||
      (effect.tickOn === "target_turn_end" && effect.target.playerId === playerId);

    if (!shouldTick) {
      return [effect];
    }

    const turnsRemaining = effect.turnsRemaining - 1;
    if (turnsRemaining <= 0) {
      return [];
    }

    return [{ ...effect, turnsRemaining }];
  });

  return {
    ...state,
    activeEffects: nextEffects,
  };
}

export function effectAppliesToUnit(effect: ActiveEffect, state: GameState, unit: Unit): boolean {
  if (effect.turnsRemaining <= 0) return false;
  if (effect.target.playerId !== unit.playerId) return false;

  switch (effect.target.kind) {
    case "all_units":
      return true;
    case "specific_units":
      return (effect.target.unitIds || []).includes(unit.id);
    case "units_in_radius": {
      if (!effect.target.radius) return false;
      const origin = resolveEffectOriginCoordinate(effect, state);
      if (!origin) return false;
      return hexDistance(origin, unit.coordinate) <= effect.target.radius;
    }
    case "player":
    default:
      return false;
  }
}

export function getUnitActiveEffects(state: GameState, unit: Unit): ActiveEffect[] {
  return getActiveEffects(state).filter(effect => effectAppliesToUnit(effect, state, unit));
}

export function getPlayerActiveEffects(state: GameState, playerId: string): ActiveEffect[] {
  return getActiveEffects(state).filter(
    effect => effect.target.playerId === playerId && effect.target.kind === "player"
  );
}

export function hasUnitEffectFlag(
  state: GameState,
  unit: Unit,
  flag: keyof NonNullable<ActiveEffect["flags"]>
): boolean {
  return getUnitActiveEffects(state, unit).some(effect => Boolean(effect.flags?.[flag]));
}

export function getPlayerYieldModifiers(
  state: GameState,
  playerId: string,
  resource: "stars" | "faith"
): YieldModifierSummary {
  return getPlayerActiveEffects(state, playerId).reduce<YieldModifierSummary>(
    (summary, effect) => {
      effect.yieldModifiers.forEach(modifier => {
        if (modifier.resource !== resource) return;
        summary.multiplier += modifier.multiplier ?? 0;
        summary.flat += modifier.flat ?? 0;
      });
      return summary;
    },
    { multiplier: 0, flat: 0 }
  );
}

export function applyYieldModifiers(value: number, modifiers: YieldModifierSummary): number {
  return Math.max(0, Math.round(value * (1 + modifiers.multiplier) + modifiers.flat));
}
