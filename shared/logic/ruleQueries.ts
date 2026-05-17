import { TECHNOLOGIES } from "../data/technologies";
import { UNIT_DEFINITIONS } from "../data/units";
import { GAME_RULES } from "../data/gameRules";
import { IMPROVEMENT_DEFINITIONS, STRUCTURE_DEFINITIONS } from "../types/city";
import type { HexCoordinate } from "../types/coordinates";
import type { GameAction, GameState, PlayerState } from "../types/game";
import type { Unit } from "../types/unit";
import { checkCanonicalActionPreconditions, getActionPayload } from "./actionPreconditions";
import { getActionAvailabilityForUnit, type ActionAvailabilityResult } from "./actionAvailability";
import { getValidSpawnTiles } from "./actions/spawnUtils";
import { getCombatPreview, type CombatPreview } from "./combatPreview";
import { canAttemptUnitConversion, getUnitConversionFaithCost } from "./conversion";
import {
  getFaithProjectStartOptions,
  validateFaithProjectStart,
} from "./faithProject";
import { getFactionAbilityAvailability, type FactionAbilityAvailability } from "./factionAbilityAvailability";
import { resolveCombat } from "./combatResolver";
import { canPlayerResearchTechnology, getTechCostDetails, getTechnology } from "./technologyHelpers";
import {
  calculateReachableTiles,
  canSelectUnit,
  canUnitReachCoordinate,
  getMovementCostForCoordinate,
  getUnitActionsRemaining,
  getUnitAttackRangeFromDefinition,
  getValidAttackTargets,
  isPassableForUnit,
} from "./unitLogic";
import { canExecuteElementAction } from "./worldElementActions";
import {
  BUILDER_WORK_RADIUS,
  CITY_WORK_RADIUS,
  getImprovementConstructionOptions,
  getImprovementConstructionOptionsForTile,
  getStructureConstructionOptions,
  getWorkerImprovementOptions,
  validateConstructionRequest,
} from "./constructionValidation";

export type RuleReasonCode =
  | "legal"
  | "game_not_playing"
  | "missing_current_player"
  | "actor_context_mismatch"
  | "missing_actor_unit"
  | "payload_actor_mismatch"
  | "missing_actor"
  | "wrong_turn"
  | "city_not_owned"
  | "missing_unit"
  | "missing_target"
  | "invalid_move_target"
  | "invalid_attack_target"
  | "invalid_construction"
  | "unknown_technology"
  | "already_researched"
  | "missing_prerequisites"
  | "insufficient_resources"
  | "invalid_faith_project"
  | "invalid_world_element_action"
  | "invalid_conversion"
  | "invalid_ability"
  | "preconditions_only";

export interface RuleCost {
  stars?: number;
  faith?: number;
  pride?: number;
}

export interface RuleTarget {
  kind: "coordinate" | "unit" | "city" | "player";
  id?: string;
  coordinate?: HexCoordinate;
}

export interface RuleCheck {
  legal: boolean;
  reason: RuleReasonCode;
  message?: string;
  costs?: RuleCost;
  targets?: RuleTarget[];
  details?: Record<string, unknown>;
}

export interface LegalActionOption {
  id: string;
  label: string;
  kind: "unit" | "city" | "player";
  action: GameAction;
  check: RuleCheck & { legal: true };
  sourceId?: string;
  target?: RuleTarget;
  costs?: RuleCost;
  metadata?: Record<string, unknown>;
}

export type { FactionAbilityAvailability };
export { BUILDER_WORK_RADIUS, CITY_WORK_RADIUS };

export interface TechnologyRuleSummary {
  techId: string;
  status: "researched" | "available" | "locked" | "researching" | "unknown";
  baseCost: number;
  discount: number;
  finalCost: number;
  canAfford: boolean;
  prerequisitesMet: boolean;
  missingPrerequisites: string[];
  check: RuleCheck;
}

export interface CombatRulePreview {
  attacker?: Unit;
  defender?: Unit;
  check: RuleCheck;
  preview: CombatPreview | null;
  resolution: ReturnType<typeof resolveCombat> | null;
}

export interface UnitMovementPreview {
  unit?: Unit;
  check: RuleCheck;
  reachableTiles: HexCoordinate[];
  reachableMoveTiles: HexCoordinate[];
  reachableTilesCount: number;
  canMove: boolean;
  reason?: string;
}

export interface ConstructionModePreview {
  validTileKeys: string[];
  optionsByTileKey: Record<string, LegalActionOption[]>;
  selectedTileOptions: LegalActionOption[];
}

const legal = (overrides: Omit<RuleCheck, "legal" | "reason"> = {}): RuleCheck => ({
  legal: true,
  reason: "legal",
  ...overrides,
});

const blocked = (reason: RuleReasonCode, message?: string, details?: Record<string, unknown>): RuleCheck => ({
  legal: false,
  reason,
  message,
  details,
});

const coordinateKey = (coordinate: HexCoordinate) => `${coordinate.q},${coordinate.r}`;

const asHolyCityTuple = (cityIds: readonly string[]): [string, string, string] =>
  [cityIds[0], cityIds[1], cityIds[2]];

function getLegalFaithProjectHolyCityTuples(state: GameState, actorId: string): Array<[string, string, string]> {
  const rules = GAME_RULES.victory.faithVictory;
  if (rules.holyCitiesRequired !== 3) return [];

  const candidateIds = getFaithProjectStartOptions(state, actorId).map((city) => city.id);
  const tuples: Array<[string, string, string]> = [];
  const seen = new Set<string>();

  for (let first = 0; first < candidateIds.length - 2; first++) {
    for (let second = first + 1; second < candidateIds.length - 1; second++) {
      for (let third = second + 1; third < candidateIds.length; third++) {
        const holyCityIds = asHolyCityTuple([candidateIds[first], candidateIds[second], candidateIds[third]]);
        const key = holyCityIds.join(":");
        if (seen.has(key)) continue;
        seen.add(key);

        const validation = validateFaithProjectStart(state, actorId, holyCityIds);
        if (validation.ok && validation.holyCityIds) {
          tuples.push(validation.holyCityIds);
        }
      }
    }
  }

  return tuples;
}

const getCurrentPlayer = (state: GameState): PlayerState | undefined =>
  state.players[state.currentPlayerIndex];

const getActionPlayer = (state: GameState, action: GameAction): PlayerState | undefined => {
  const payload = getActionPayload(action);
  const playerId = typeof payload.playerId === "string" ? payload.playerId : undefined;
  return playerId ? state.players.find((player) => player.id === playerId) : undefined;
};

const asLegalCheck = (check: RuleCheck): (RuleCheck & { legal: true }) | null =>
  check.legal ? (check as RuleCheck & { legal: true }) : null;

function explainResearchAction(state: GameState, action: Extract<GameAction, { type: "RESEARCH_TECH" | "RESEARCH_TECHNOLOGY" }>): RuleCheck {
  const player = getActionPlayer(state, action);
  if (!player) return blocked("missing_actor", "Player not found");

  const techId = action.type === "RESEARCH_TECH" ? action.payload.techId : action.payload.technologyId;
  const technology = getTechnology(techId);
  if (!technology) return blocked("unknown_technology", "Unknown technology", { techId });

  const costs = { stars: getTechCostDetails(technology, player).finalCost };
  if (player.researchedTechs.includes(technology.id)) {
    return blocked("already_researched", "Technology already researched", { techId });
  }
  const missingPrerequisites = technology.prerequisites.filter((prereq) => !player.researchedTechs.includes(prereq));
  if (missingPrerequisites.length > 0) {
    return blocked("missing_prerequisites", "Missing technology prerequisites", { techId, missingPrerequisites });
  }
  if (!canPlayerResearchTechnology(player, technology)) {
    return blocked("insufficient_resources", "Not enough stars to research technology", { techId, costs });
  }
  return legal({ costs, details: { techId } });
}

export function getTechnologyRuleSummary(state: GameState, actorId: string, techId: string): TechnologyRuleSummary {
  const player = state.players.find((candidate) => candidate.id === actorId);
  const technology = getTechnology(techId);
  if (!player || !technology) {
    return {
      techId,
      status: "unknown",
      baseCost: 0,
      discount: 0,
      finalCost: 0,
      canAfford: false,
      prerequisitesMet: false,
      missingPrerequisites: [],
      check: blocked(technology ? "missing_actor" : "unknown_technology", technology ? "Player not found" : "Unknown technology", { techId }),
    };
  }

  const cost = getTechCostDetails(technology, player);
  const missingPrerequisites = technology.prerequisites.filter((prereq) => !player.researchedTechs.includes(prereq));
  const check = explainAction(state, { type: "RESEARCH_TECH", payload: { playerId: actorId, techId } }, { actorId });
  const status: TechnologyRuleSummary["status"] =
    player.researchedTechs.includes(techId)
      ? "researched"
      : player.currentResearch === techId
        ? "researching"
        : missingPrerequisites.length > 0
          ? "locked"
          : "available";

  return {
    techId,
    status,
    baseCost: cost.baseCost,
    discount: cost.discount,
    finalCost: cost.finalCost,
    canAfford: player.stars >= cost.finalCost,
    prerequisitesMet: missingPrerequisites.length === 0,
    missingPrerequisites,
    check,
  };
}

export function getCombatRulePreview(
  state: GameState,
  attackerId: string,
  targetId: string,
  actorId?: string,
): CombatRulePreview {
  const attacker = state.units.find((candidate) => candidate.id === attackerId);
  const defender = state.units.find((candidate) => candidate.id === targetId);
  const check = explainAction(state, { type: "ATTACK_UNIT", payload: { attackerId, targetId } }, actorId ? { actorId } : {});
  return {
    attacker,
    defender,
    check,
    preview: attacker && defender ? getCombatPreview(attacker, defender, state) : null,
    resolution: attacker && defender ? resolveCombat(attacker, defender, state) : null,
  };
}

export function getUnitMovementPreview(state: GameState, unitId: string, actorId?: string): UnitMovementPreview {
  const unit = state.units.find((candidate) => candidate.id === unitId);
  if (!unit) {
    const check = blocked("missing_unit", "Unit not found", { unitId });
    return { check, reachableTiles: [], reachableMoveTiles: [], reachableTilesCount: 0, canMove: false, reason: check.message };
  }

  const resolvedActorId = actorId ?? unit.playerId;
  const reachableTiles = calculateReachableTiles(unit, state);
  const reachableMoveTiles = reachableTiles.filter((coordinate) =>
    coordinate.q !== unit.coordinate.q || coordinate.r !== unit.coordinate.r
  );
  const firstMove = reachableMoveTiles[0];
  const check = firstMove
    ? explainAction(state, { type: "MOVE_UNIT", payload: { unitId: unit.id, targetCoordinate: firstMove } }, { actorId: resolvedActorId })
    : blocked(
      unit.remainingMovement <= 0 ? "invalid_move_target" : "invalid_move_target",
      unit.remainingMovement <= 0 ? "No movement remaining" : "No legal move targets",
      { unitId: unit.id },
    );

  return {
    unit,
    check,
    reachableTiles,
    reachableMoveTiles,
    reachableTilesCount: reachableMoveTiles.length,
    canMove: check.legal && reachableMoveTiles.length > 0,
    reason: check.legal ? undefined : check.message ?? check.reason,
  };
}

export function explainUnitSelection(state: GameState, unitId: string, actorId?: string): RuleCheck {
  const unit = state.units.find((candidate) => candidate.id === unitId);
  if (!unit) return blocked("missing_unit", "Unit not found", { unitId });
  if (actorId && unit.playerId !== actorId) {
    return blocked("actor_context_mismatch", "Unit does not belong to this actor", { actorId, unitPlayerId: unit.playerId });
  }
  if (!canSelectUnit(unit, state)) {
    return blocked("wrong_turn", "Only the current player's units can be selected", { unitId, playerId: unit.playerId });
  }
  return legal({ details: { unitId } });
}

export function explainAction(state: GameState, action: GameAction, ctx: { actorId?: string } = {}): RuleCheck {
  const preconditions = checkCanonicalActionPreconditions(state, action, ctx);
  if (!preconditions.ok) {
    return blocked(preconditions.reason, undefined, preconditions.details);
  }

  switch (action.type) {
    case "MOVE_UNIT": {
      const unit = state.units.find((candidate) => candidate.id === action.payload.unitId);
      if (!unit) return blocked("missing_unit", "Unit not found");
      if (!canUnitReachCoordinate(unit, action.payload.targetCoordinate, state)) {
        return blocked("invalid_move_target", "Unit cannot reach target coordinate", {
          unitId: unit.id,
          targetCoordinate: action.payload.targetCoordinate,
        });
      }
      return legal({ targets: [{ kind: "coordinate", coordinate: action.payload.targetCoordinate }] });
    }
    case "ATTACK_UNIT": {
      const attacker = state.units.find((candidate) => candidate.id === action.payload.attackerId);
      const target = state.units.find((candidate) => candidate.id === action.payload.targetId);
      if (!attacker) return blocked("missing_unit", "Attacker not found");
      if (!target) return blocked("missing_target", "Target not found");
      const preview = resolveCombat(attacker, target, state);
      if (!preview.canAttack) {
        return blocked("invalid_attack_target", preview.reason || "Cannot attack target", {
          attackerId: attacker.id,
          targetId: target.id,
        });
      }
      return legal({ targets: [{ kind: "unit", id: target.id }] });
    }
    case "START_CONSTRUCTION": {
      const validation = validateConstructionRequest(state, action.payload);
      if (!validation) {
        return blocked("invalid_construction", "Construction request is not legal", action.payload);
      }
      return legal({
        costs: validation.cost,
        targets: validation.coordinate ? [{ kind: "coordinate", coordinate: validation.coordinate }] : undefined,
        details: {
          cityId: validation.city.id,
          category: action.payload.category,
          buildingType: action.payload.buildingType,
          builderUnitId: action.payload.builderUnitId,
        },
      });
    }
    case "RESEARCH_TECH":
    case "RESEARCH_TECHNOLOGY":
      return explainResearchAction(state, action);
    case "START_FAITH_PROJECT": {
      const validation = validateFaithProjectStart(state, action.payload.playerId, action.payload.holyCityIds);
      if (!validation.ok) {
        return blocked("invalid_faith_project", validation.reasons[0] || "Faith project cannot start", {
          reasons: validation.reasons,
        });
      }
      const rules = GAME_RULES.victory.faithVictory;
      return legal({
        costs: { stars: rules.startStarsCost, faith: rules.startFaithCost },
        targets: action.payload.holyCityIds.map((cityId) => ({ kind: "city", id: cityId })),
      });
    }
    case "WORLD_ELEMENT_HARVEST":
    case "WORLD_ELEMENT_BUILD": {
      const actionType = action.type === "WORLD_ELEMENT_HARVEST" ? "harvest" : "build";
      const check = canExecuteElementAction(
        state,
        action.payload.playerId,
        action.payload.elementId,
        actionType,
        action.payload.coordinate,
        action.payload.unitId,
      );
      if (!check.canExecute) {
        return blocked("invalid_world_element_action", check.reason || "World element action is not legal", action.payload);
      }
      return legal({
        targets: [{ kind: "coordinate", coordinate: action.payload.coordinate }],
        details: { elementId: action.payload.elementId, actionType },
      });
    }
    case "CONVERT_UNIT": {
      const caster = state.units.find((unit) => unit.id === action.payload.unitId);
      const target = state.units.find((unit) => unit.id === action.payload.targetUnitId);
      if (!caster) return blocked("missing_unit", "Converting unit not found");
      if (!target) return blocked("missing_target", "Conversion target not found");
      const conversion = canAttemptUnitConversion(state, caster, target);
      if (!conversion.ok) {
        return blocked("invalid_conversion", conversion.reason, { reason: conversion.reason });
      }
      const player = state.players.find((candidate) => candidate.id === caster.playerId);
      const faithCost = getUnitConversionFaithCost();
      if (!player || player.stats.faith < faithCost) {
        return blocked("insufficient_resources", "Not enough faith for conversion", { faithCost });
      }
      return legal({ costs: { faith: faithCost }, targets: [{ kind: "unit", id: target.id }] });
    }
    case "ACTIVATE_FACTION_ABILITY": {
      const availability = getFactionAbilityAvailability(state, action.payload.playerId, action.payload.abilityId);
      if (!availability.available) {
        return blocked("invalid_ability", availability.reason, { reason: availability.reason });
      }
      return legal({ details: { abilityId: action.payload.abilityId, targetId: action.payload.targetId } });
    }
    case "END_TURN":
      return legal();
    default:
      return legal({ details: { coverage: "preconditions_only" } });
  }
}

export function getUnitRuleSummary(
  state: GameState,
  unitId: string,
  actorId?: string,
): ActionAvailabilityResult | null {
  const unit = state.units.find((candidate) => candidate.id === unitId);
  if (!unit) return null;
  const player = state.players.find((candidate) => candidate.id === (actorId ?? unit.playerId));
  if (!player) return null;
  return getActionAvailabilityForUnit(unit, player, state);
}

export function explainFactionAbilityAction(
  state: GameState,
  actorId: string,
  abilityId: string,
): { availability: FactionAbilityAvailability; check: RuleCheck } {
  return {
    availability: getFactionAbilityAvailability(state, actorId, abilityId),
    check: explainAction(state, {
      type: "ACTIVATE_FACTION_ABILITY",
      payload: { playerId: actorId, abilityId },
    }, { actorId }),
  };
}

function addLegalOption(options: LegalActionOption[], option: Omit<LegalActionOption, "check">, state: GameState, actorId: string): void {
  const check = asLegalCheck(explainAction(state, option.action, { actorId }));
  if (!check) return;
  options.push({
    ...option,
    check,
    costs: option.costs ?? check.costs,
  });
}

function getCurrentTileResourceIds(state: GameState, unit: Unit): string[] {
  const tile = state.map.tiles.find(
    (candidate) => candidate.coordinate.q === unit.coordinate.q && candidate.coordinate.r === unit.coordinate.r,
  );
  return [...(tile?.resources || [])];
}

export function getLegalUnitActions(state: GameState, unitId: string, actorId?: string): LegalActionOption[] {
  const unit = state.units.find((candidate) => candidate.id === unitId);
  if (!unit) return [];
  const resolvedActorId = actorId ?? unit.playerId;
  const options: LegalActionOption[] = [];

  for (const coordinate of calculateReachableTiles(unit, state)) {
    if (coordinate.q === unit.coordinate.q && coordinate.r === unit.coordinate.r) continue;
    addLegalOption(options, {
      id: `move:${coordinateKey(coordinate)}`,
      label: "Move",
      kind: "unit",
      sourceId: unit.id,
      target: { kind: "coordinate", coordinate },
      action: { type: "MOVE_UNIT", payload: { unitId: unit.id, targetCoordinate: coordinate } },
    }, state, resolvedActorId);
  }

  for (const target of getValidAttackTargets(unit, state)) {
    addLegalOption(options, {
      id: `attack:${target.id}`,
      label: "Attack",
      kind: "unit",
      sourceId: unit.id,
      target: { kind: "unit", id: target.id },
      action: { type: "ATTACK_UNIT", payload: { attackerId: unit.id, targetId: target.id } },
    }, state, resolvedActorId);
  }

  for (const resourceId of getCurrentTileResourceIds(state, unit)) {
    addLegalOption(options, {
      id: `world-harvest:${resourceId}`,
      label: "Harvest",
      kind: "unit",
      sourceId: unit.id,
      target: { kind: "coordinate", coordinate: unit.coordinate },
      action: {
        type: "WORLD_ELEMENT_HARVEST",
        payload: { playerId: resolvedActorId, unitId: unit.id, elementId: resourceId, coordinate: unit.coordinate },
      },
    }, state, resolvedActorId);
    addLegalOption(options, {
      id: `world-build:${resourceId}`,
      label: "Develop",
      kind: "unit",
      sourceId: unit.id,
      target: { kind: "coordinate", coordinate: unit.coordinate },
      action: {
        type: "WORLD_ELEMENT_BUILD",
        payload: { playerId: resolvedActorId, unitId: unit.id, elementId: resourceId, coordinate: unit.coordinate },
      },
    }, state, resolvedActorId);
  }

  if (unit.type === "missionary" && getUnitActionsRemaining(unit) > 0) {
    for (const target of state.units.filter((candidate) => candidate.playerId !== resolvedActorId)) {
      addLegalOption(options, {
        id: `convert-unit:${target.id}`,
        label: "Convert",
        kind: "unit",
        sourceId: unit.id,
        target: { kind: "unit", id: target.id },
        action: {
          type: "CONVERT_UNIT",
          payload: { playerId: resolvedActorId, unitId: unit.id, targetUnitId: target.id },
        },
      }, state, resolvedActorId);
    }
  }

  for (const improvement of getImprovementConstructionOptions(state, resolvedActorId, {})) {
    if (improvement.builderUnitId !== unit.id) continue;
    addLegalOption(options, {
      id: `worker-build:${improvement.buildingType}:${coordinateKey(improvement.coordinate)}`,
      label: `Build ${improvement.name}`,
      kind: "unit",
      sourceId: unit.id,
      target: { kind: "coordinate", coordinate: improvement.coordinate },
      costs: { stars: improvement.costStars },
      action: {
        type: "START_CONSTRUCTION",
        payload: {
          playerId: resolvedActorId,
          buildingType: improvement.buildingType,
          category: "improvements",
          coordinate: improvement.coordinate,
          cityId: improvement.cityId,
          builderUnitId: improvement.builderUnitId,
        },
      },
    }, state, resolvedActorId);
  }

  return options;
}

export function getLegalCityActions(state: GameState, cityId: string, actorId: string): LegalActionOption[] {
  const city = state.cities.find((candidate) => candidate.id === cityId);
  if (!city || city.ownerId !== actorId) return [];
  const options: LegalActionOption[] = [];

  for (const unitDef of Object.values(UNIT_DEFINITIONS)) {
    for (const coordinate of getValidSpawnTiles(state, city.coordinate, unitDef.type, actorId)) {
      addLegalOption(options, {
        id: `recruit:${unitDef.type}:${coordinateKey(coordinate)}`,
        label: `Recruit ${unitDef.name}`,
        kind: "city",
        sourceId: city.id,
        target: { kind: "coordinate", coordinate },
        costs: { stars: unitDef.cost },
        action: {
          type: "START_CONSTRUCTION",
          payload: {
            playerId: actorId,
            buildingType: unitDef.type,
            category: "units",
            coordinate,
            cityId: city.id,
          },
        },
      }, state, actorId);
    }
  }

  for (const structure of getStructureConstructionOptions(state, actorId, { cityId: city.id })) {
    addLegalOption(options, {
      id: `structure:${structure.buildingType}:${coordinateKey(structure.coordinate)}`,
      label: `Build ${structure.name}`,
      kind: "city",
      sourceId: city.id,
      target: { kind: "coordinate", coordinate: structure.coordinate },
      costs: { stars: structure.costStars },
      action: {
        type: "START_CONSTRUCTION",
        payload: {
          playerId: actorId,
          buildingType: structure.buildingType,
          category: "structures",
          coordinate: structure.coordinate,
          cityId: city.id,
        },
      },
    }, state, actorId);
  }

  for (const improvement of getImprovementConstructionOptions(state, actorId, { cityId: city.id })) {
    addLegalOption(options, {
      id: `improvement:${improvement.buildingType}:${coordinateKey(improvement.coordinate)}:${improvement.builderUnitId}`,
      label: `Build ${improvement.name}`,
      kind: "city",
      sourceId: city.id,
      target: { kind: "coordinate", coordinate: improvement.coordinate },
      costs: { stars: improvement.costStars },
      action: {
        type: "START_CONSTRUCTION",
        payload: {
          playerId: actorId,
          buildingType: improvement.buildingType,
          category: "improvements",
          coordinate: improvement.coordinate,
          cityId: city.id,
          builderUnitId: improvement.builderUnitId,
        },
      },
    }, state, actorId);
  }

  return options;
}

export function getLegalConstructionActionsForTile(
  state: GameState,
  actorId: string,
  coordinate: HexCoordinate,
  filters: {
    buildingType?: string | null;
    category?: "improvements" | "structures" | "units" | null;
    cityId?: string | null;
    builderUnitId?: string | null;
    allowAnyImprovement?: boolean | null;
  } = {},
): LegalActionOption[] {
  const options: LegalActionOption[] = [];

  if (filters.category === "improvements") {
    for (const improvement of getImprovementConstructionOptionsForTile(state, actorId, coordinate, {
      buildingType: filters.buildingType,
      cityId: filters.cityId,
      builderUnitId: filters.builderUnitId,
      allowAnyImprovement: !!filters.allowAnyImprovement,
    })) {
      addLegalOption(options, {
        id: `tile-improvement:${improvement.buildingType}:${coordinateKey(coordinate)}:${improvement.builderUnitId}`,
        label: `Build ${improvement.name}`,
        kind: "city",
        sourceId: improvement.cityId,
        target: { kind: "coordinate", coordinate: improvement.coordinate },
        costs: { stars: improvement.costStars },
        action: {
          type: "START_CONSTRUCTION",
          payload: {
            playerId: actorId,
            buildingType: improvement.buildingType,
            category: "improvements",
            coordinate: improvement.coordinate,
            cityId: improvement.cityId,
            builderUnitId: improvement.builderUnitId,
          },
        },
      }, state, actorId);
    }
    return options;
  }

  if (!filters.buildingType || !filters.category || !filters.cityId) return [];
  addLegalOption(options, {
    id: `tile-construction:${filters.category}:${filters.buildingType}:${coordinateKey(coordinate)}`,
    label: `Build ${filters.buildingType}`,
    kind: "city",
    sourceId: filters.cityId,
    target: { kind: "coordinate", coordinate },
    action: {
      type: "START_CONSTRUCTION",
      payload: {
        playerId: actorId,
        buildingType: filters.buildingType,
        category: filters.category,
        coordinate,
        cityId: filters.cityId,
      },
    },
  }, state, actorId);

  return options;
}

export function getConstructionMenuOptions(state: GameState, actorId: string, cityId: string): LegalActionOption[] {
  return getLegalCityActions(state, cityId, actorId).filter(
    (option) => option.action.type === "START_CONSTRUCTION",
  );
}

export function getConstructionModePreview(
  state: GameState,
  actorId: string,
  filters: {
    buildingType?: string | null;
    category?: "improvements" | "structures" | "units" | null;
    cityId?: string | null;
    builderUnitId?: string | null;
    allowAnyImprovement?: boolean | null;
    selectedCoordinate?: HexCoordinate | null;
  } = {},
): ConstructionModePreview {
  const optionsByTileKey: Record<string, LegalActionOption[]> = {};
  const validTileKeys: string[] = [];

  for (const tile of state.map.tiles) {
    const options = getLegalConstructionActionsForTile(state, actorId, tile.coordinate, filters);
    if (options.length === 0) continue;
    const key = coordinateKey(tile.coordinate);
    optionsByTileKey[key] = options;
    validTileKeys.push(key);
  }

  const selectedTileOptions = filters.selectedCoordinate
    ? optionsByTileKey[coordinateKey(filters.selectedCoordinate)] ?? []
    : [];

  return { validTileKeys, optionsByTileKey, selectedTileOptions };
}

export function getWorldElementRuleOptions(
  state: GameState,
  actorId: string,
  coordinate: HexCoordinate,
  unitId?: string | null,
): LegalActionOption[] {
  const units = state.units.filter((unit) =>
    unit.playerId === actorId &&
    (!unitId || unit.id === unitId) &&
    unit.coordinate.q === coordinate.q &&
    unit.coordinate.r === coordinate.r
  );
  return units.flatMap((unit) =>
    getLegalUnitActions(state, unit.id, actorId).filter((option) =>
      (option.action.type === "WORLD_ELEMENT_HARVEST" || option.action.type === "WORLD_ELEMENT_BUILD") &&
      option.action.payload.coordinate.q === coordinate.q &&
      option.action.payload.coordinate.r === coordinate.r
    )
  );
}

export function getLegalPlayerActions(state: GameState, actorId: string): LegalActionOption[] {
  const player = state.players.find((candidate) => candidate.id === actorId);
  if (!player) return [];
  const options: LegalActionOption[] = [];

  addLegalOption(options, {
    id: "end-turn",
    label: "End Turn",
    kind: "player",
    sourceId: actorId,
    action: { type: "END_TURN", payload: { playerId: actorId } },
  }, state, actorId);

  for (const technology of Object.values(TECHNOLOGIES)) {
    const costs = { stars: getTechCostDetails(technology, player).finalCost };
    addLegalOption(options, {
      id: `research:${technology.id}`,
      label: `Research ${technology.name}`,
      kind: "player",
      sourceId: actorId,
      costs,
      action: { type: "RESEARCH_TECH", payload: { playerId: actorId, techId: technology.id } },
    }, state, actorId);
  }

  for (const holyCityIds of getLegalFaithProjectHolyCityTuples(state, actorId)) {
    addLegalOption(options, {
      id: `faith-project:${holyCityIds.join(":")}`,
      label: "Start Faith Project",
      kind: "player",
      sourceId: actorId,
      target: { kind: "city", id: holyCityIds.join(",") },
      action: { type: "START_FAITH_PROJECT", payload: { playerId: actorId, holyCityIds } },
    }, state, actorId);
  }

  return options;
}

export function getLegalActionsForActor(state: GameState, actorId: string): LegalActionOption[] {
  const player = state.players.find((candidate) => candidate.id === actorId);
  if (!player) return [];
  return [
    ...getLegalPlayerActions(state, actorId),
    ...state.units.filter((unit) => unit.playerId === actorId).flatMap((unit) => getLegalUnitActions(state, unit.id, actorId)),
    ...state.cities.filter((city) => city.ownerId === actorId).flatMap((city) => getLegalCityActions(state, city.id, actorId)),
  ];
}

export function getAICandidateActions(state: GameState, actorId: string): LegalActionOption[] {
  return getLegalActionsForActor(state, actorId).map((option) => ({
    ...option,
    metadata: {
      ...option.metadata,
      aiKind: option.action.type,
      actorId,
    },
  }));
}

export function getWorkerImprovementRuleOptions(
  state: GameState,
  actorId: string,
  workerUnitId: string,
  buildingType?: string | null,
  cityId?: string | null,
): LegalActionOption[] {
  return getWorkerImprovementOptions(state, actorId, workerUnitId, buildingType, cityId).flatMap((option) =>
    getLegalConstructionActionsForTile(state, actorId, option.coordinate, {
      buildingType: option.buildingType,
      category: "improvements",
      cityId: option.cityId,
      builderUnitId: option.builderUnitId,
      allowAnyImprovement: true,
    })
  );
}

export const getRuleUnitActionsRemaining = getUnitActionsRemaining;
export const getRuleUnitAttackRangeFromDefinition = getUnitAttackRangeFromDefinition;
export const isRulePassableForUnit = isPassableForUnit;
export const getRuleMovementCostForCoordinate = getMovementCostForCoordinate;

export function getRuleCatalogSummary() {
  return {
    structures: Object.keys(STRUCTURE_DEFINITIONS),
    improvements: Object.keys(IMPROVEMENT_DEFINITIONS),
    units: Object.keys(UNIT_DEFINITIONS),
    technologies: Object.keys(TECHNOLOGIES),
  };
}
