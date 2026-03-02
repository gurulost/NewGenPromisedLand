import { GameState, PlayerState } from "../../types/game";
import { ABILITIES } from "../../data/abilities";
import { TECHNOLOGIES } from "../../data/technologies";
import { GAME_RULES } from "../../data/gameRules";
import { getUnitDefinition } from "../../data/units";
import { hexDistance } from "../../utils/hex";
import { nextInt } from "../rng";
import { emitTelemetry } from "../telemetry";
import { getUnitActionsRemaining, spendUnitActions } from "../unitLogic";
import { handleApplyStealth, handleHealUnit, handleReconnaissance } from "../unitActionHandlers";
import { handleConvertUnit } from "./conversion";
import { hasAbility } from "./helpers";

export function handleUseAbility(
  state: GameState,
  payload: { playerId: string; abilityId: string; target?: any; unitId?: string; targetCoordinate?: any; targetUnitId?: string }
): GameState {
  const player = state.players.find(p => p.id === payload.playerId);
  if (!player) return state;

  const ability = ABILITIES[payload.abilityId];
  if (!ability) return state;

  const cooldownRemaining = player.abilityCooldowns?.[payload.abilityId] ?? 0;
  if (cooldownRemaining > 0) {
    emitTelemetry({
      channel: "ability",
      status: "blocked",
      playerId: player.id,
      abilityId: payload.abilityId,
      reason: "cooldown"
    });
    return state;
  }

  if (ability.requirements) {
    if (ability.requirements.faith && player.stats.faith < ability.requirements.faith) return state;
    if (ability.requirements.pride && player.stats.pride < ability.requirements.pride) return state;
    if (ability.requirements.dissent && player.stats.internalDissent < ability.requirements.dissent) return state;
  }

  let next: GameState = state;
  switch (payload.abilityId) {
    case "TITLE_OF_LIBERTY":
      next = applyTitleOfLiberty(state, player);
      break;
    case "RAMEUMPTOM":
      next = applyRameumptom(state, player);
      break;
    case "COVENANT_OF_PEACE":
      next = applyCovenantOfPeace(state, player);
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
      console.warn(`Ability ${payload.abilityId} not implemented yet`);
      next = state;
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

function applyTitleOfLiberty(state: GameState, player: PlayerState): GameState {
  if (player.stats.faith < 70) return state;

  return {
    ...state,
    units: state.units.map(u => {
      if (u.playerId !== player.id) return u;
      return {
        ...u,
        attack: u.attack + 2,
        defense: u.defense + 2,
      };
    }),
    players: state.players.map(p =>
      p.id === player.id
        ? { ...p, stats: { ...p.stats, faith: p.stats.faith - 50 } }
        : p
    )
  };
}

function applyRameumptom(state: GameState, player: PlayerState): GameState {
  if (player.stats.pride < 70) return state;

  return {
    ...state,
    players: state.players.map(p =>
      p.id === player.id
        ? {
          ...p,
          stats: {
            ...p.stats,
            pride: Math.min(100, p.stats.pride + 30),
            internalDissent: Math.min(100, p.stats.internalDissent + 20)
          }
        }
        : p
    )
  };
}

function applyCovenantOfPeace(state: GameState, player: PlayerState): GameState {
  const costFaith = GAME_RULES.abilities.resourceCosts.covenantOfPeace;
  const requiredAdvantage = GAME_RULES.conversion.covenantOfPeace.requiredFaithAdvantage;
  const range = GAME_RULES.conversion.covenantOfPeace.range;
  if (player.stats.faith < costFaith) return state;

  const enemyCandidates = state.units
    .filter(u => u.playerId !== player.id)
    .filter(u => u.playerId !== undefined)
    .filter(u => state.units.some(ally => ally.playerId === player.id && hexDistance(ally.coordinate, u.coordinate) <= range))
    .sort((a, b) => a.hp - b.hp);

  if (enemyCandidates.length === 0) return state;

  const chosen = enemyCandidates[0];
  const enemyPlayer = state.players.find(p => p.id === chosen.playerId);
  const enemyFaith = enemyPlayer?.stats.faith ?? 0;
  const advantage = player.stats.faith - enemyFaith;
  if (advantage < requiredAdvantage) return state;

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
  const updatedUnits = state.units.map(u => {
    if (u.playerId !== player.id) return u;
    const tile = state.map.tiles.find(t => t.coordinate.q === u.coordinate.q && t.coordinate.r === u.coordinate.r);
    if (tile?.terrain !== "forest") return u;
    return { ...u, defense: u.defense + bonus };
  });

  if (updatedUnits === state.units) return state;
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
      console.log(`Unit action ${actionType} not implemented yet`);
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
