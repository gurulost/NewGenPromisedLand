import { GAME_RULES } from "../data/gameRules";
import type { GameState } from "../types/game";
import type { HexCoordinate } from "../types/coordinates";
import type { Unit } from "../types/unit";
import { coordToKey, hexDistance } from "../utils/hex";
import { applyStatusEffect, canApplyStatus } from "./statusEffects";

const CULTURAL_SOURCE_UNIT_TYPES = new Set(["scribe_teacher", "royal_envoy"]);

export interface CulturalPressureSelection {
  sourceCoordinates: HexCoordinate[];
  targetUnits: Unit[];
}

export interface CulturalPressureApplication {
  units: Unit[];
  appliedByOwner: Record<string, string[]>;
  appliedCount: number;
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

function getCulturalSourceCoordinates(state: GameState, playerId: string): HexCoordinate[] {
  const sourceKeys = new Set<string>();
  const sources: HexCoordinate[] = [];
  const addSource = (coordinate: HexCoordinate) => {
    const key = coordToKey(coordinate);
    if (sourceKeys.has(key)) return;
    sourceKeys.add(key);
    sources.push(coordinate);
  };

  (state.cities ?? [])
    .filter(city => city.ownerId === playerId)
    .forEach(city => addSource(city.coordinate));

  (state.units ?? [])
    .filter(unit => unit.playerId === playerId && CULTURAL_SOURCE_UNIT_TYPES.has(unit.type))
    .forEach(unit => addSource(unit.coordinate));

  return sources;
}

export function getCulturalPressureSelection(
  state: GameState,
  sourcePlayerId: string,
  range: number,
  options: { requireTargetVisibility?: boolean } = {}
): CulturalPressureSelection {
  const sourceCoordinates = getCulturalSourceCoordinates(state, sourcePlayerId);
  const targetIds = new Set<string>();

  sourceCoordinates.forEach(sourceCoordinate => {
    (state.units ?? [])
      .filter(unit => unit.playerId !== sourcePlayerId)
      .filter(unit =>
        !isExplicitAlly(state, sourcePlayerId, unit.playerId) &&
        (!options.requireTargetVisibility || canPlayerTargetUnit(state, sourcePlayerId, unit))
      )
      .filter(unit => canApplyStatus(unit, "CULTURAL_PRESSURE", state))
      .filter(unit => hexDistance(unit.coordinate, sourceCoordinate) <= range)
      .forEach(unit => targetIds.add(unit.id));
  });

  return {
    sourceCoordinates,
    targetUnits: (state.units ?? []).filter(unit => targetIds.has(unit.id)),
  };
}

export function applyCulturalPressureToTargets(
  state: GameState,
  sourcePlayerId: string,
  targetUnitIds: Iterable<string>,
  options: {
    defensePenalty?: number;
    conversionChanceBonus?: number;
    durationTurns?: number;
  } = {}
): CulturalPressureApplication {
  const targetIds = new Set(targetUnitIds);
  const defensePenalty = options.defensePenalty ?? GAME_RULES.abilities.factionActive.culturalReclamation.defensePenalty;
  const conversionChanceBonus = options.conversionChanceBonus ?? GAME_RULES.abilities.factionActive.culturalReclamation.conversionChanceBonus;
  const durationTurns = options.durationTurns ?? GAME_RULES.abilities.factionActive.culturalReclamation.durationTurns;
  const appliedByOwnerSets: Record<string, Set<string>> = {};
  let appliedCount = 0;

  const units = (state.units ?? []).map((unit: Unit) => {
    if (!targetIds.has(unit.id)) return unit;

    const withEffect = applyStatusEffect(unit, {
      type: "CULTURAL_PRESSURE",
      turnsRemaining: durationTurns,
      defensePenalty,
      conversionChanceBonus,
      sourcePlayerId,
    }, state);

    if (!withEffect) return unit;

    if (!appliedByOwnerSets[unit.playerId]) {
      appliedByOwnerSets[unit.playerId] = new Set();
    }
    appliedByOwnerSets[unit.playerId].add(unit.id);
    appliedCount += 1;

    return withEffect;
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
