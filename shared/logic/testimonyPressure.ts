import { GAME_RULES } from "../data/gameRules";
import { getUnitDefinition } from "../data/units";
import type { GameState } from "../types/game";
import type { Unit } from "../types/unit";
import { coordToKey, hexDistance } from "../utils/hex";
import { applyStatusEffect, canApplyStatus } from "./statusEffects";

export interface TestimonyPressureSelection {
  sourceUnits: Unit[];
  targetUnits: Unit[];
}

export interface TestimonyPressureApplication {
  units: Unit[];
  appliedByOwner: Record<string, string[]>;
  appliedCount: number;
}

export function isTestimonyPressureSourceUnit(unit: Unit, playerId: string): boolean {
  return unit.playerId === playerId && unit.type === "missionary";
}

export function isTestimonyPressureTargetUnit(unit: Unit, sourcePlayerId: string): boolean {
  if (unit.playerId === sourcePlayerId) return false;

  const def = getUnitDefinition(unit.type);
  const tags = def?.tags ?? [];
  return !tags.includes("civilian") && !tags.includes("influence") && !tags.includes("diplomat");
}

function isExplicitAlly(state: GameState, sourcePlayerId: string, targetPlayerId: string): boolean {
  const sourcePlayer = state.players.find(player => player.id === sourcePlayerId);
  const targetPlayer = state.players.find(player => player.id === targetPlayerId);

  return Boolean(
    sourcePlayer?.alliedWith?.includes(targetPlayerId) ||
    targetPlayer?.alliedWith?.includes(sourcePlayerId)
  );
}

function canPlayerTargetUnit(state: GameState, playerId: string, unit: Unit): boolean {
  if (isExplicitAlly(state, playerId, unit.playerId)) return false;

  const player = state.players.find(candidate => candidate.id === playerId);
  if (!player) return false;

  const coordinateKey = coordToKey(unit.coordinate);
  const visibilityMask = player.visibilityMask ?? [];
  if (visibilityMask.length > 0) {
    return visibilityMask.includes(coordinateKey);
  }

  if (player.exploredTiles?.includes(coordinateKey)) return true;

  const tile = state.map.tiles.find(candidate =>
    candidate.coordinate.q === unit.coordinate.q &&
    candidate.coordinate.r === unit.coordinate.r
  );

  return tile?.exploredBy?.includes(playerId) ?? false;
}

export function getTestimonyPressureSelection(
  state: GameState,
  sourcePlayerId: string,
  radius: number,
  options: { requireTargetVisibility?: boolean } = {}
): TestimonyPressureSelection {
  const units = state.units ?? [];
  const sourceUnits = units.filter(unit => isTestimonyPressureSourceUnit(unit, sourcePlayerId));
  const targetIds = new Set<string>();

  sourceUnits.forEach(sourceUnit => {
    units
      .filter(unit => isTestimonyPressureTargetUnit(unit, sourcePlayerId))
      .filter(unit =>
        !isExplicitAlly(state, sourcePlayerId, unit.playerId) &&
        (!options.requireTargetVisibility || canPlayerTargetUnit(state, sourcePlayerId, unit))
      )
      .filter(unit => canApplyStatus(unit, "TESTIMONY_PRESSURE", state))
      .filter(unit => hexDistance(unit.coordinate, sourceUnit.coordinate) <= radius)
      .forEach(unit => targetIds.add(unit.id));
  });

  return {
    sourceUnits,
    targetUnits: units.filter(unit => targetIds.has(unit.id)),
  };
}

export function applyTestimonyPressureToTargets(
  state: GameState,
  sourcePlayerId: string,
  targetUnitIds: Iterable<string>,
  options: {
    attackPenalty?: number;
    durationTurns?: number;
  } = {}
): TestimonyPressureApplication {
  const targetIds = new Set(targetUnitIds);
  const attackPenalty = options.attackPenalty ?? GAME_RULES.influence.testimonyPressure.attackPenalty;
  const durationTurns = options.durationTurns ?? GAME_RULES.influence.testimonyPressure.durationTurns;
  const appliedByOwnerSets: Record<string, Set<string>> = {};
  let appliedCount = 0;

  const units = (state.units ?? []).map((unit: Unit) => {
    if (!targetIds.has(unit.id)) return unit;

    const withEffect = applyStatusEffect(unit, {
      type: "TESTIMONY_PRESSURE",
      turnsRemaining: durationTurns,
      attackPenalty,
      sourcePlayerId,
    }, state);

    if (!withEffect) return unit;

    if (!appliedByOwnerSets[unit.playerId]) {
      appliedByOwnerSets[unit.playerId] = new Set();
    }
    appliedByOwnerSets[unit.playerId].add(unit.id);
    appliedCount += 1;

    return {
      ...withEffect,
      status: withEffect.status === "rallied" ? "active" : withEffect.status,
      rallyBuff: false,
      tacticalCommand: false,
    };
  });

  const appliedByOwner = Object.fromEntries(
    Object.entries(appliedByOwnerSets).map(([playerId, unitIds]) => [playerId, Array.from(unitIds)])
  );

  return {
    units,
    appliedByOwner,
    appliedCount,
  };
}
