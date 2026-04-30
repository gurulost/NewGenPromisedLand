import { ActiveEffect, GameState, PlayerState } from "../../types/game";
import { ABILITIES } from "../../data/abilities";
import { getFactionAbilitySpec } from "../../data/factionAbilitySpecs";
import { TECHNOLOGIES } from "../../data/technologies";
import { GAME_RULES } from "../../data/gameRules";
import { getUnitDefinition } from "../../data/units";
import { hexDistance } from "../../utils/hex";
import { upsertActiveEffect } from "../activeEffects";
import { applyCulturalPressureToTargets, getCulturalPressureSelection } from "../culturalPressure";
import { getFactionAbilityAvailability } from "../factionAbilityAvailability";
import { nextInt } from "../rng";
import { applyTestimonyPressureToTargets, getTestimonyPressureSelection } from "../testimonyPressure";
import { emitTelemetry } from "../telemetry";
import { getUnitActionsRemaining, spendUnitActions } from "../unitLogic";
import { handleApplyStealth, handleHealUnit, handleReconnaissance } from "../unitActionHandlers";
import { handleConvertUnit } from "./conversion";
import { hasAbility, normalizeAbility } from "./helpers";

const MANUALLY_ACTIVATABLE_UNIT_ABILITIES = new Set([
  "HEAL",
  "CONVERT",
  "STEALTH",
  "RECONNAISSANCE",
  "RALLY",
  "RALLY_TROOPS",
  "BOMBARDMENT",
  "SIEGE",
  "FORMATION_FIGHTING",
  "BUILD",
  "HARVEST",
  "CLEAR_FOREST",
  "BUILD_ROAD",
  "COASTAL_EXPLORATION",
  "NAVAL_COMMAND",
]);

type AbilityActionPayload = {
  playerId: string;
  abilityId: string;
  target?: any;
  unitId?: string;
  targetCoordinate?: any;
  targetUnitId?: string;
};

function emitBlockedAbility(playerId: string, abilityId: string, reason: string): void {
  emitTelemetry({
    channel: "ability",
    status: "blocked",
    playerId,
    abilityId,
    reason,
  });
}

function validateManualAbilityUse(
  state: GameState,
  player: PlayerState,
  payload: AbilityActionPayload
): { ok: true } | { ok: false; reason: string } {
  const ability = ABILITIES[payload.abilityId];
  if (!ability) return { ok: false, reason: "unknown_ability" };

  if (ability.type === "faction") {
    const availability = getFactionAbilityAvailability(state, player.id, payload.abilityId);
    return availability.available ? { ok: true } : { ok: false, reason: availability.reason };
  }

  if (ability.type === "unit") {
    if (!payload.unitId) {
      return { ok: false, reason: "missing_unit" };
    }

    const actingUnit = state.units.find((unit) => unit.id === payload.unitId);
    if (!actingUnit || actingUnit.playerId !== player.id) {
      return { ok: false, reason: "invalid_unit" };
    }

    const unitDefinition = getUnitDefinition(actingUnit.type);
    const ownsAbility =
      hasAbility(unitDefinition.abilities, payload.abilityId) ||
      hasAbility(actingUnit.abilities, payload.abilityId);

    if (!ownsAbility) {
      return { ok: false, reason: "not_owned" };
    }

    if (!MANUALLY_ACTIVATABLE_UNIT_ABILITIES.has(normalizeAbility(payload.abilityId))) {
      return { ok: false, reason: "passive_only" };
    }

    return { ok: true };
  }

  return { ok: false, reason: "manual_activation_not_allowed" };
}

const TITLE_OF_LIBERTY_FAITH_COST = 50;

function createActiveEffectId(state: GameState, abilityId: string, playerId: string): string {
  return `${abilityId}:${playerId}:${state.turn}:${(state.activeEffects?.length ?? 0) + 1}`;
}

function addActiveEffect(state: GameState, effect: Omit<ActiveEffect, "id">): GameState {
  return upsertActiveEffect(state, {
    ...effect,
    id: createActiveEffectId(state, effect.source.abilityId, effect.source.playerId),
  });
}

function countFriendlyUnitsInRadius(state: GameState, playerId: string, unitId: string, radius: number): number {
  const center = state.units.find(unit => unit.id === unitId && unit.playerId === playerId);
  if (!center) return 0;

  return state.units.filter(unit =>
    unit.playerId === playerId &&
    hexDistance(unit.coordinate, center.coordinate) <= radius
  ).length;
}

function selectBestFriendlySourceUnit(state: GameState, playerId: string, radius: number) {
  const friendlyUnits = state.units.filter(unit => unit.playerId === playerId);
  if (friendlyUnits.length === 0) return undefined;

  return [...friendlyUnits].sort((left, right) => {
    const coverageDelta =
      countFriendlyUnitsInRadius(state, playerId, right.id, radius) -
      countFriendlyUnitsInRadius(state, playerId, left.id, radius);
    if (coverageDelta !== 0) return coverageDelta;
    return left.id.localeCompare(right.id);
  })[0];
}

export function handleUseAbility(
  state: GameState,
  payload: AbilityActionPayload
): GameState {
  const player = state.players.find(p => p.id === payload.playerId);
  if (!player) return state;

  const validation = validateManualAbilityUse(state, player, payload);
  if (!validation.ok) {
    emitBlockedAbility(player.id, payload.abilityId, validation.reason);
    return state;
  }

  const ability = ABILITIES[payload.abilityId];
  if (!ability) return state;

  const cooldownRemaining = player.abilityCooldowns?.[payload.abilityId] ?? 0;
  if (cooldownRemaining > 0) {
    emitBlockedAbility(player.id, payload.abilityId, "cooldown");
    return state;
  }

  if (ability.type !== "faction" && ability.requirements) {
    if (ability.requirements.faith && player.stats.faith < ability.requirements.faith) return state;
    if (ability.requirements.pride && player.stats.pride < ability.requirements.pride) return state;
    if (ability.requirements.dissent && player.stats.internalDissent < ability.requirements.dissent) return state;
  }

  let next: GameState = state;
  switch (payload.abilityId) {
    case "TITLE_OF_LIBERTY":
      next = applyTitleOfLiberty(state, player, payload.targetUnitId);
      break;
    case "RAMEUMPTOM":
      next = applyRameumptom(state, player);
      break;
    case "WARRIOR_RAGE":
      next = applyWarriorRage(state, player);
      break;
    case "COVENANT_OF_PEACE":
      next = applyCovenantOfPeace(state, player);
      break;
    case "MISSIONARY_ZEAL":
      next = applyMissionaryZeal(state, player);
      break;
    case "CULTURAL_RECLAMATION":
      next = applyCulturalReclamation(state, player);
      break;
    case "ANCIENT_MIGHT":
      next = applyAncientMight(state, player);
      break;

    case "nephite_righteous_charge":
      return applyRighteousCharge(state, payload);
    case "nephite_faith_healing":
      return applyFaithHealing(state, payload);

    case "lamanite_guerrilla_tactics":
      return applyGuerrillaTactics(state, payload);
    case "lamanite_ancestral_rage":
      return applyAncestralRage(state, payload);

    case "zoramite_convert_enemy":
      return applyConvertEnemy(state, payload);
    case "zoramite_pride_boost":
      return applyPrideBoost(state, payload);

    case "jaredite_tower_vision":
      return applyTowerVision(state, payload);
    case "jaredite_ancient_knowledge":
      return applyAncientKnowledge(state, payload);

    case "anti_nephi_lehi_pacify":
      return applyPacify(state, payload);
    case "anti_nephi_lehi_conversion":
      return applyConversion(state, payload);

    case "mulekite_trade_network":
      return applyTradeNetwork(state, payload);
    case "mulekite_maritime_expansion":
      return applyMaritimeExpansion(state, payload);

    default:
      emitBlockedAbility(player.id, payload.abilityId, "not_implemented");
      return state;
  }

  if (next === state) return state;

  const cooldown = ability.cooldown;
  if (typeof cooldown === "number" && cooldown > 0) {
    next = {
      ...next,
      players: next.players.map(p =>
        p.id === player.id
          ? {
            ...p,
            abilityCooldowns: {
              ...(p.abilityCooldowns || {}),
              [payload.abilityId]: cooldown,
            }
          }
          : p
      )
    };
  }

  emitTelemetry({ channel: "ability", status: "success", playerId: player.id, abilityId: payload.abilityId });
  return next;
}

function applyTitleOfLiberty(state: GameState, player: PlayerState, targetUnitId?: string): GameState {
  if (player.stats.faith < 70) return state;

  const radius = 3;
  const sourceUnit = targetUnitId
    ? state.units.find(unit => unit.id === targetUnitId && unit.playerId === player.id)
    : selectBestFriendlySourceUnit(state, player.id, radius);
  if (!sourceUnit) return state;

  const buffedState = addActiveEffect(state, {
    name: ABILITIES.TITLE_OF_LIBERTY.name,
    source: {
      playerId: player.id,
      abilityId: "TITLE_OF_LIBERTY",
      unitId: sourceUnit.id,
    },
    target: {
      kind: "units_in_radius",
      playerId: player.id,
      radius,
    },
    durationTurns: ABILITIES.TITLE_OF_LIBERTY.duration ?? 3,
    turnsRemaining: ABILITIES.TITLE_OF_LIBERTY.duration ?? 3,
    tickOn: "source_turn_end",
    stackRule: "refresh",
    unitStatModifiers: [
      { stat: "attack", mode: "percent", value: 0.3 },
      { stat: "defense", mode: "percent", value: 0.3 },
    ],
    yieldModifiers: [],
    flags: {
      immuneToNegativeStatus: true,
    },
  });

  return {
    ...buffedState,
    players: state.players.map(p =>
      p.id === player.id
        ? { ...p, stats: { ...p.stats, faith: Math.max(0, p.stats.faith - TITLE_OF_LIBERTY_FAITH_COST) } }
        : p
    )
  };
}

function applyRameumptom(state: GameState, player: PlayerState): GameState {
  if (player.stats.pride < 70) return state;

  const buffedState = addActiveEffect(state, {
    name: ABILITIES.RAMEUMPTOM.name,
    source: {
      playerId: player.id,
      abilityId: "RAMEUMPTOM",
    },
    target: {
      kind: "player",
      playerId: player.id,
    },
    durationTurns: ABILITIES.RAMEUMPTOM.duration ?? 5,
    turnsRemaining: ABILITIES.RAMEUMPTOM.duration ?? 5,
    tickOn: "source_turn_end",
    stackRule: "refresh",
    unitStatModifiers: [],
    yieldModifiers: [
      { resource: "stars", multiplier: 1, flat: 0 },
      { resource: "faith", multiplier: 1, flat: 0 },
    ],
    flags: {},
  });

  return {
    ...buffedState,
    players: buffedState.players.map(p =>
      p.id === player.id
        ? {
          ...p,
          stats: {
            ...p.stats,
            internalDissent: Math.min(100, p.stats.internalDissent + 20)
          }
        }
        : p
    )
  };
}

function applyWarriorRage(state: GameState, player: PlayerState): GameState {
  if (player.stats.pride < 60) return state;

  return addActiveEffect(state, {
    name: ABILITIES.WARRIOR_RAGE.name,
    source: {
      playerId: player.id,
      abilityId: "WARRIOR_RAGE",
    },
    target: {
      kind: "all_units",
      playerId: player.id,
    },
    durationTurns: ABILITIES.WARRIOR_RAGE.duration ?? 4,
    turnsRemaining: ABILITIES.WARRIOR_RAGE.duration ?? 4,
    tickOn: "source_turn_end",
    stackRule: "refresh",
    unitStatModifiers: [
      { stat: "attack", mode: "flat", value: 3 },
      { stat: "defense", mode: "flat", value: -1 },
    ],
    yieldModifiers: [],
    flags: {},
  });
}

function applyCovenantOfPeace(state: GameState, player: PlayerState): GameState {
  const costFaith = GAME_RULES.abilities.resourceCosts.covenantOfPeace;
  const requiredAdvantage = GAME_RULES.conversion.covenantOfPeace.requiredFaithAdvantage;
  const range = GAME_RULES.conversion.covenantOfPeace.range;
  if (player.stats.faith < costFaith) return state;

  const isExplicitAlly = (targetPlayerId: string): boolean => {
    const targetPlayer = state.players.find(candidate => candidate.id === targetPlayerId);
    return Boolean(
      player.alliedWith?.includes(targetPlayerId) ||
      targetPlayer?.alliedWith?.includes(player.id)
    );
  };

  const enemyCandidates = state.units
    .filter(u => u.playerId !== player.id)
    .filter(u => u.playerId !== undefined)
    .filter(u => !isExplicitAlly(u.playerId))
    .filter(u => {
      const enemyPlayer = state.players.find(p => p.id === u.playerId);
      const enemyFaith = enemyPlayer?.stats.faith ?? 0;
      return player.stats.faith - enemyFaith >= requiredAdvantage;
    })
    .filter(u => state.units.some(ally => ally.playerId === player.id && hexDistance(ally.coordinate, u.coordinate) <= range))
    .sort((a, b) => a.hp - b.hp);

  if (enemyCandidates.length === 0) return state;

  const chosen = enemyCandidates[0];

  return {
    ...state,
    units: state.units.map(u => u.id === chosen.id ? { ...u, playerId: player.id } : u),
    players: state.players.map(p =>
      p.id === player.id
        ? { ...p, stats: { ...p.stats, faith: Math.max(0, p.stats.faith - costFaith) } }
        : p
    )
  };
}

function applyMissionaryZeal(state: GameState, player: PlayerState): GameState {
  const spec = getFactionAbilitySpec("MISSIONARY_ZEAL");
  const costFaith = spec?.cost.faith ?? 40;
  const radius = spec?.target.range ?? 4;
  if (player.stats.faith < costFaith) return state;

  const selection = getTestimonyPressureSelection(state, player.id, radius, {
    requireTargetVisibility: true,
  });
  if (selection.sourceUnits.length === 0 || selection.targetUnits.length === 0) {
    return state;
  }

  const pressureResult = applyTestimonyPressureToTargets(
    state,
    player.id,
    selection.targetUnits.map(unit => unit.id),
    {
      attackPenalty: GAME_RULES.influence.testimonyPressure.attackPenalty,
      durationTurns: GAME_RULES.influence.testimonyPressure.durationTurns,
    }
  );

  if (pressureResult.appliedCount === 0) return state;

  const lastAction: GameState["lastAction"] = {
    type: "TESTIMONY_PRESSURE",
    payload: {
      sourcePlayerId: player.id,
      attackPenalty: GAME_RULES.influence.testimonyPressure.attackPenalty,
      durationTurns: GAME_RULES.influence.testimonyPressure.durationTurns,
      affected: Object.entries(pressureResult.appliedByOwner).map(([playerId, unitIds]) => ({
        playerId,
        unitIds,
      })),
    },
  };

  return {
    ...state,
    units: pressureResult.units,
    players: state.players.map(p =>
      p.id === player.id
        ? { ...p, stats: { ...p.stats, faith: Math.max(0, p.stats.faith - costFaith) } }
        : p
    ),
    lastAction,
  };
}

function applyCulturalReclamation(state: GameState, player: PlayerState): GameState {
  const spec = getFactionAbilitySpec("CULTURAL_RECLAMATION");
  const rules = GAME_RULES.abilities.factionActive.culturalReclamation;
  const costFaith = spec?.cost.faith ?? rules.faithCost;
  const range = spec?.target.range ?? rules.range;
  if (player.stats.faith < costFaith) return state;

  const selection = getCulturalPressureSelection(state, player.id, range, {
    requireTargetVisibility: true,
  });
  if (selection.sourceCoordinates.length === 0 || selection.targetUnits.length === 0) {
    return state;
  }

  const pressureResult = applyCulturalPressureToTargets(
    state,
    player.id,
    selection.targetUnits.map(unit => unit.id),
    {
      defensePenalty: rules.defensePenalty,
      conversionChanceBonus: rules.conversionChanceBonus,
      durationTurns: rules.durationTurns,
    }
  );

  if (pressureResult.appliedCount === 0) return state;

  const lastAction: GameState["lastAction"] = {
    type: "CULTURAL_PRESSURE",
    payload: {
      sourcePlayerId: player.id,
      defensePenalty: rules.defensePenalty,
      conversionChanceBonus: rules.conversionChanceBonus,
      durationTurns: rules.durationTurns,
      affected: Object.entries(pressureResult.appliedByOwner).map(([playerId, unitIds]) => ({
        playerId,
        unitIds,
      })),
    },
  };

  return {
    ...state,
    units: pressureResult.units,
    players: state.players.map(p =>
      p.id === player.id
        ? { ...p, stats: { ...p.stats, faith: Math.max(0, p.stats.faith - costFaith) } }
        : p
    ),
    lastAction,
  };
}

function applyAncientMight(state: GameState, player: PlayerState): GameState {
  const rules = GAME_RULES.abilities.factionActive.ancientMight;
  if (player.stats.pride < rules.activationPride) return state;
  if (!state.units.some(unit => unit.playerId === player.id)) return state;

  const buffedState = addActiveEffect(state, {
    name: ABILITIES.ANCIENT_MIGHT.name,
    source: {
      playerId: player.id,
      abilityId: "ANCIENT_MIGHT",
    },
    target: {
      kind: "all_units",
      playerId: player.id,
    },
    durationTurns: rules.durationTurns,
    turnsRemaining: rules.durationTurns,
    tickOn: "source_turn_end",
    stackRule: "refresh",
    unitStatModifiers: [
      { stat: "attack", mode: "flat", value: rules.attackBonus },
      { stat: "defense", mode: "flat", value: rules.defenseBonus },
    ],
    yieldModifiers: [],
    flags: {},
    metadata: {
      sourceTurnStatDeltas: {
        pride: rules.pridePerSourceTurn,
      },
    },
  });

  return {
    ...buffedState,
    players: buffedState.players.map(p =>
      p.id === player.id
        ? { ...p, stats: { ...p.stats, pride: Math.min(100, p.stats.pride + rules.immediatePride) } }
        : p
    ),
  };
}

function applyRighteousCharge(state: GameState, payload: any): GameState {
  const unit = state.units.find(u => u.id === payload.unitId);
  if (!unit || !payload.targetUnitId) return state;
  if (getUnitActionsRemaining(unit) <= 0) return state;

  const target = state.units.find(u => u.id === payload.targetUnitId);
  if (!target || target.playerId === unit.playerId) return state;

  const distance = hexDistance(unit.coordinate, target.coordinate);
  if (distance <= 2) {
    return {
      ...state,
      units: state.units.map(u =>
        u.id === unit.id
          ? { ...spendUnitActions(u), attack: u.attack + GAME_RULES.abilities.attackBonuses.righteousCharge }
          : u
      )
    };
  }
  return state;
}

function applyFaithHealing(state: GameState, payload: any): GameState {
  const unit = state.units.find(u => u.id === payload.unitId);
  if (!unit) return state;

  const player = state.players.find(p => p.id === unit.playerId);
  if (!player || player.stats.faith < GAME_RULES.abilities.resourceCosts.faithHealing) return state;

  const healRadius = GAME_RULES.abilities.healRadius;
  const nearbyAllies = state.units.filter(u => {
    if (u.playerId !== unit.playerId) return false;
    const distance = hexDistance(unit.coordinate, u.coordinate);
    return distance <= healRadius;
  });

  const healAmount = GAME_RULES.units.healingAmount;
  return {
    ...state,
    units: state.units.map(u => {
      if (nearbyAllies.some(ally => ally.id === u.id)) {
        const unitDef = getUnitDefinition(u.type);
        return { ...u, hp: Math.min(unitDef.baseStats.hp, u.hp + healAmount) };
      }
      return u;
    }),
    players: state.players.map(p =>
      p.id === player.id
        ? { ...p, stats: { ...p.stats, faith: Math.max(0, p.stats.faith - GAME_RULES.abilities.resourceCosts.faithHealing) } }
        : p
    )
  };
}

function applyGuerrillaTactics(state: GameState, payload: any): GameState {
  const player = state.players.find(p => p.id === payload.playerId);
  if (!player) return state;

  const bonus = GAME_RULES.abilities.attackBonuses.guerrillaBonus;
  let changed = false;
  const updatedUnits = state.units.map(u => {
    if (u.playerId !== player.id) return u;
    const tile = state.map.tiles.find(t => t.coordinate.q === u.coordinate.q && t.coordinate.r === u.coordinate.r);
    if (tile?.terrain !== "forest") return u;
    const unitDef = getUnitDefinition(u.type);
    const nextDefense = Math.max(u.defense, unitDef.baseStats.defense + bonus);
    if (nextDefense === u.defense) return u;
    changed = true;
    return { ...u, defense: nextDefense };
  });

  if (!changed) return state;
  return { ...state, units: updatedUnits };
}

function applyAncestralRage(state: GameState, payload: any): GameState {
  const player = state.players.find(p => p.id === payload.playerId);
  if (!player || player.stats.pride < 15) return state;

  return {
    ...state,
    units: state.units.map(u =>
      u.playerId === player.id
        ? { ...u, attack: u.attack + GAME_RULES.abilities.attackBonuses.ancestralRage }
        : u
    ),
    players: state.players.map(p =>
      p.id === player.id
        ? { ...p, stats: { ...p.stats, pride: Math.max(0, p.stats.pride - 15) } }
        : p
    )
  };
}

function applyConvertEnemy(state: GameState, payload: any): GameState {
  const unit = state.units.find(u => u.id === payload.unitId);
  if (!unit || !payload.targetUnitId) return state;

  const target = state.units.find(u => u.id === payload.targetUnitId);
  if (!target || target.playerId === unit.playerId) return state;

  const player = state.players.find(p => p.id === unit.playerId);
  if (!player || player.stats.pride < 20) return state;

  const distance = hexDistance(unit.coordinate, target.coordinate);
  if (distance <= GAME_RULES.abilities.conversionRadius) {
    return {
      ...state,
      units: state.units.map(u =>
        u.id === payload.targetUnitId
          ? { ...u, playerId: unit.playerId }
          : u
      ),
      players: state.players.map(p =>
        p.id === player.id
          ? { ...p, stats: { ...p.stats, pride: Math.max(0, p.stats.pride - 20) } }
          : p
      )
    };
  }
  return state;
}

function applyPrideBoost(state: GameState, payload: any): GameState {
  const player = state.players.find(p => p.id === payload.playerId);
  if (!player) return state;

  const playerCities = state.cities?.filter(city =>
    player.citiesOwned.includes(city.id)
  ) || [];

  const prideGain = playerCities.length * 3;
  return {
    ...state,
    players: state.players.map(p =>
      p.id === player.id
        ? { ...p, stats: { ...p.stats, pride: Math.min(100, p.stats.pride + prideGain) } }
        : p
    )
  };
}

function applyTowerVision(state: GameState, payload: any): GameState {
  if (!payload.targetCoordinate) return state;

  const player = state.players.find(p => p.id === payload.playerId);
  if (!player || player.stats.faith < 15) return state;

  const revealRadius = GAME_RULES.abilities.visionRevealRadius;
  const tilesToReveal: string[] = [];

  for (let q = payload.targetCoordinate.q - revealRadius; q <= payload.targetCoordinate.q + revealRadius; q++) {
    for (let r = payload.targetCoordinate.r - revealRadius; r <= payload.targetCoordinate.r + revealRadius; r++) {
      const s = -q - r;
      const distance = Math.max(
        Math.abs(q - payload.targetCoordinate.q),
        Math.abs(r - payload.targetCoordinate.r),
        Math.abs(s - payload.targetCoordinate.s)
      );

      if (distance <= revealRadius) {
        tilesToReveal.push(`${q},${r}`);
      }
    }
  }

  return {
    ...state,
    map: {
      ...state.map,
      tiles: state.map.tiles.map(tile => {
        const tileKey = `${tile.coordinate.q},${tile.coordinate.r}`;
        if (tilesToReveal.includes(tileKey) && !tile.exploredBy.includes(player.id)) {
          return {
            ...tile,
            exploredBy: [...tile.exploredBy, player.id]
          };
        }
        return tile;
      })
    },
    players: state.players.map(p =>
      p.id === player.id
        ? {
          ...p,
          exploredTiles: Array.from(new Set([...p.exploredTiles, ...tilesToReveal])),
          stats: { ...p.stats, faith: Math.max(0, p.stats.faith - 15) }
        }
        : p
    )
  };
}

function applyAncientKnowledge(state: GameState, payload: any): GameState {
  const player = state.players.find(p => p.id === payload.playerId);
  if (!player) return state;

  const availableTechs = Object.keys(TECHNOLOGIES).filter(techId =>
    !player.researchedTechs.includes(techId)
  );

  if (availableTechs.length > 0) {
    let rngSeed = state.rngSeed ?? 0;
    const techRoll = nextInt(rngSeed, availableTechs.length);
    rngSeed = techRoll.seed;
    const randomTech = availableTechs[techRoll.value];
    return {
      ...state,
      players: state.players.map(p =>
        p.id === player.id
          ? {
            ...p,
            researchedTechs: [...p.researchedTechs, randomTech],
            stats: { ...p.stats, faith: Math.max(0, p.stats.faith - 25) }
          }
          : p
      ),
      rngSeed,
    };
  }
  return state;
}

function applyPacify(state: GameState, payload: any): GameState {
  const unit = state.units.find(u => u.id === payload.unitId);
  if (!unit) return state;

  const pacifyRadius = GAME_RULES.abilities.pacifyRadius;
  const nearbyEnemies = state.units.filter(u => {
    if (u.playerId === unit.playerId) return false;
    const distance = hexDistance(unit.coordinate, u.coordinate);
    return distance <= pacifyRadius;
  });

  return {
    ...state,
    units: state.units.map(u => {
      if (nearbyEnemies.some(enemy => enemy.id === u.id)) {
        return { ...u, attack: Math.max(1, u.attack - 3) };
      }
      return u;
    })
  };
}

function applyConversion(state: GameState, payload: any): GameState {
  const player = state.players.find(p => p.id === payload.playerId);
  if (!player) return state;

  return {
    ...state,
    players: state.players.map(p =>
      p.id === player.id
        ? {
          ...p,
          stats: {
            ...p.stats,
            faith: Math.min(100, p.stats.faith + 10),
            internalDissent: Math.max(0, p.stats.internalDissent - 15)
          }
        }
        : p
    )
  };
}

function applyTradeNetwork(state: GameState, payload: any): GameState {
  const unit = state.units.find(u => u.id === payload.unitId);
  if (!unit) return state;

  const tradeRadius = GAME_RULES.abilities.tradeRadius;
  const nearbyCities = state.cities?.filter(city => {
    const distance = hexDistance(unit.coordinate, city.coordinate);
    return distance <= tradeRadius;
  }) || [];

  const starGain = nearbyCities.length * 3;
  const player = state.players.find(p => p.id === unit.playerId);
  if (!player) return state;

  return {
    ...state,
    players: state.players.map(p =>
      p.id === player.id
        ? { ...p, stars: p.stars + starGain }
        : p
    )
  };
}

function applyMaritimeExpansion(state: GameState, payload: any): GameState {
  const player = state.players.find(p => p.id === payload.playerId);
  if (!player) return state;

  const waterTileKeys = state.map.tiles
    .filter(tile => tile.terrain === "water")
    .map(tile => `${tile.coordinate.q},${tile.coordinate.r}`);

  return {
    ...state,
    map: {
      ...state.map,
      tiles: state.map.tiles.map(tile => {
        if ((tile.terrain === "water") &&
          !tile.exploredBy.includes(player.id)) {
          return {
            ...tile,
            exploredBy: [...tile.exploredBy, player.id]
          };
        }
        return tile;
      })
    },
    players: state.players.map(p =>
      p.id === player.id
        ? { ...p, exploredTiles: Array.from(new Set([...p.exploredTiles, ...waterTileKeys])) }
        : p
    ),
    units: state.units.map(u =>
      u.playerId === player.id && u.type === "scout"
        ? { ...u, movement: u.movement + 1, remainingMovement: u.remainingMovement + 1 }
        : u
    )
  };
}

export function handleUnitAction(
  state: GameState,
  payload: { unitId: string; actionType: string; playerId: string; target?: any }
): GameState {
  const { unitId, actionType, playerId, target } = payload;

  const unit = state.units.find(u => u.id === unitId);
  if (!unit || unit.playerId !== playerId) return state;

  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  switch (actionType) {
    case "convert": {
      if (!hasAbility(unit.abilities, "CONVERT") || getUnitActionsRemaining(unit) <= 0) return state;
      if (player.stats.faith < GAME_RULES.conversion.costs.unit) return state;

      const requestedTargetUnitId =
        typeof target === "string"
          ? target
          : typeof target === "object" && typeof target?.unitId === "string"
            ? target.unitId
            : undefined;

      const candidates = state.units
        .filter(u => u.playerId !== playerId)
        .filter(u => hexDistance(u.coordinate, unit.coordinate) <= GAME_RULES.abilities.conversionRadius)
        .filter(u => (requestedTargetUnitId ? u.id === requestedTargetUnitId : true));

      if (candidates.length === 0) return state;

      const targetUnit = candidates.sort((a, b) => a.hp - b.hp)[0];

      return handleConvertUnit(state, { playerId, unitId, targetUnitId: targetUnit.id });
    }

    case "stealth":
      return handleApplyStealth(state, { unitId, playerId });

    case "heal":
      return handleHealUnit(state, { unitId, playerId });

    case "reconnaissance":
      return handleReconnaissance(state, { unitId, playerId });

    default:
      break;
  }

  return state;
}

export function handleActivateFactionAbility(
  state: GameState,
  payload: { playerId: string; abilityId: string; targetId?: string }
): GameState {
  // Keep activation and use semantics in one place so effects/cooldowns stay consistent.
  return handleUseAbility(state, {
    playerId: payload.playerId,
    abilityId: payload.abilityId,
    targetUnitId: payload.targetId
  });
}
