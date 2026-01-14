import { GameState } from "../../types/game";
import { Unit } from "../../types/unit";
import { hexDistance } from "../../utils/hex";
import { getUnitDefinition } from "../../data/units";
import {
  getMovementCostToCoordinate,
  getUnitActionsRemaining,
  isPassableForUnit,
  spendUnitActions
} from "../unitLogic";
import { emitTelemetry } from "../telemetry";
import { resolveCombat } from "../combatResolver";
import { applyStatusEffect } from "../statusEffects";

function applyIntimidateToAdjacentEnemies(
  units: Unit[],
  actingUnit: Unit | undefined,
  state: GameState
): Unit[] {
  if (!actingUnit) return units;
  const actingDef = getUnitDefinition(actingUnit.type);
  const hasIntimidate = actingDef?.abilities?.some(a => String(a).toUpperCase() === 'INTIMIDATE');
  if (!hasIntimidate) return units;

  return units.map(u => {
    if (u.playerId === actingUnit.playerId) return u;
    if (hexDistance(u.coordinate, actingUnit.coordinate) > 1) return u;

    const targetDef = getUnitDefinition(u.type);
    const isCivilian = targetDef?.tags?.includes('civilian') ||
      targetDef?.tags?.includes('influence') ||
      targetDef?.tags?.includes('diplomat');
    if (isCivilian) return u;

    const withEffect = applyStatusEffect(u, { type: 'INTIMIDATED', turnsRemaining: 1 });
    return withEffect ?? u;
  });
}

export function handleMoveUnit(
  state: GameState,
  payload: { unitId: string; targetCoordinate: any }
): GameState {
  const unit = state.units.find((u: Unit) => u.id === payload.unitId);
  if (!unit) {
    return state;
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (unit.playerId !== currentPlayer.id) {
    return state;
  }

  // Check if movement is valid (weighted by terrain/path cost)
  const moveCost = getMovementCostToCoordinate(unit, payload.targetCoordinate, state);
  if (moveCost === null || moveCost > unit.remainingMovement) {
    return state;
  }

  // Check if target tile is passable (includes naval special-cases and enemy-blocking)
  if (!isPassableForUnit(payload.targetCoordinate, state, unit)) {
    return state;
  }

  const getTileAt = (coordinate: any) =>
    state.map.tiles.find(t => t.coordinate.q === coordinate.q && t.coordinate.r === coordinate.r);

  // Update unit position and movement (+ clear conditional buffs that depend on terrain)
  const updatedUnits = state.units.map((u: Unit) => {
    if (u.id !== payload.unitId) return u;

    const nextCoordinate = payload.targetCoordinate;
    const updatedUnit: Unit = {
      ...u,
      coordinate: nextCoordinate,
      remainingMovement: Math.max(0, u.remainingMovement - moveCost)
    };

    if (updatedUnit.status === 'siege_mode') {
      updatedUnit.status = 'active';
    }
    // Formation breaks on move per spec
    if (updatedUnit.status === 'formation') {
      updatedUnit.status = 'active';
    }
    // Stealth doesn't break on move (only on attack/capture per spec)

    // Guerrilla/forest bonuses are terrain-dependent; reset to base stats when leaving forest.
    const unitDef = getUnitDefinition(updatedUnit.type);
    const unitAbilities = new Set((unitDef.abilities || []).map(a => String(a).toUpperCase()));
    const hasForestKit = unitAbilities.has('FOREST_STEALTH') || unitAbilities.has('AMBUSH');
    if (hasForestKit) {
      const destTile = getTileAt(nextCoordinate);
      const isForest = destTile?.terrain === 'forest';
      if (!isForest && updatedUnit.defense !== unitDef.baseStats.defense) {
        updatedUnit.defense = unitDef.baseStats.defense;
      }
    }

    return updatedUnit;
  });

  // Use unit's actual vision radius from definition
  const unitDef = getUnitDefinition(unit.type);
  const visionRadius = unit.visionRadius ?? unitDef.baseStats.visionRadius;
  const visibleTiles: string[] = [];

  // Get all tiles within vision radius
  for (let q = payload.targetCoordinate.q - visionRadius; q <= payload.targetCoordinate.q + visionRadius; q++) {
    for (let r = payload.targetCoordinate.r - visionRadius; r <= payload.targetCoordinate.r + visionRadius; r++) {
      const s = -q - r;
      const distance = Math.max(Math.abs(q - payload.targetCoordinate.q),
        Math.abs(r - payload.targetCoordinate.r),
        Math.abs(s - payload.targetCoordinate.s));

      if (distance <= visionRadius) {
        visibleTiles.push(`${q},${r}`);
      }
    }
  }

  const updatedPlayers = state.players.map(player =>
    player.id === currentPlayer.id
      ? {
        ...player,
        visibilityMask: Array.from(new Set([...player.visibilityMask, ...visibleTiles])),
        exploredTiles: Array.from(new Set([...player.exploredTiles, ...visibleTiles]))
      }
      : player
  );

  // Update explored tiles - explore all visible tiles
  const updatedTiles = state.map.tiles.map(tile => {
    const tileKey = `${tile.coordinate.q},${tile.coordinate.r}`;
    if (visibleTiles.includes(tileKey)) {
      return {
        ...tile,
        exploredBy: Array.from(new Set([...tile.exploredBy, currentPlayer.id]))
      };
    }
    return tile;
  });

  // Check if unit landed on an unclaimed village
  const destTile = updatedTiles.find(t =>
    t.coordinate.q === payload.targetCoordinate.q &&
    t.coordinate.r === payload.targetCoordinate.r
  );

  // If unit is on a village that's NOT owned (neutral), trigger village encounter
  // Don't trigger for villages owned by other players - those would need conquest
  if (destTile?.feature === 'village' && !destTile.cityOwner) {
    // Dispatch village encounter event to UI
    if (typeof window !== 'undefined') {
      const villageEvent = new CustomEvent('villageEncounter', {
        detail: {
          unitId: payload.unitId,
          coordinate: payload.targetCoordinate
        }
      });
      window.dispatchEvent(villageEvent);
    }
  }

  const movedUnit = updatedUnits.find((u: Unit) => u.id === payload.unitId);
  const finalUnits = applyIntimidateToAdjacentEnemies(updatedUnits, movedUnit, state);

  return {
    ...state,
    units: finalUnits,
    players: updatedPlayers,
    map: {
      ...state.map,
      tiles: updatedTiles
    }
  };
}

export function handleAttackUnit(
  state: GameState,
  payload: { attackerId: string; targetId: string }
): GameState {
  const attacker = state.units.find((u: Unit) => u.id === payload.attackerId);
  const target = state.units.find((u: Unit) => u.id === payload.targetId);

  if (!attacker || !target) return state;

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (attacker.playerId !== currentPlayer.id) return state;

  // Prevent friendly fire - cannot attack units from the same player
  if (attacker.playerId === target.playerId) return state;

  // Check if unit has remaining actions this turn
  if (getUnitActionsRemaining(attacker) <= 0) return state;

  const distance = hexDistance(attacker.coordinate, target.coordinate);

  const normalizeAbility = (abilityId: string) => abilityId.toUpperCase();
  const unitHasAbility = (unit: Unit, abilityId: string) =>
    (unit.abilities || []).some(a => normalizeAbility(String(a)) === normalizeAbility(abilityId));

  const attackerHasBombardment =
    unitHasAbility(attacker, 'SIEGE') ||
    unitHasAbility(attacker, 'BOMBARDMENT') ||
    unitHasAbility(attacker, 'bombardment');

  const combatResult = resolveCombat(attacker, target, state);
  if (!combatResult.canAttack) {
    if (combatResult.reasonCode === 'catapult_not_deployed') {
      emitTelemetry({
        channel: 'combat',
        status: 'blocked',
        attackerId: attacker.id,
        defenderId: target.id,
        reason: 'catapult_not_deployed'
      });
    } else if (combatResult.reasonCode === 'catapult_moved_this_turn') {
      emitTelemetry({
        channel: 'combat',
        status: 'blocked',
        attackerId: attacker.id,
        defenderId: target.id,
        reason: 'catapult_moved_this_turn'
      });
    } else if (combatResult.reasonCode === 'diplomacy_avoided') {
      emitTelemetry({
        channel: 'combat',
        status: 'info',
        attackerId: attacker.id,
        defenderId: target.id,
        reason: 'diplomacy_avoided'
      });

      const updatedPlayers = state.players.map(p => {
        if (p.id !== attacker.playerId) return p;
        return {
          ...p,
          stats: {
            ...p.stats,
            pride: Math.max(0, p.stats.pride - 3),
          }
        };
      });

      return {
        ...state,
        players: updatedPlayers,
        units: state.units.map(u => u.id === attacker.id ? spendUnitActions(u) : u)
      };
    }

    return state;
  }

  const newHp = combatResult.defenderHp;
  const newAttackerHp = combatResult.attackerHp;

  emitTelemetry({
    channel: 'combat',
    status: 'success',
    attackerId: attacker.id,
    defenderId: target.id,
    damage: combatResult.attackerDamage,
    metadata: { defenderDamage: combatResult.defenderDamage }
  });

  let updatedUnits = state.units.map((u: Unit) => {
    if (u.id === payload.targetId) {
      return { ...u, hp: newHp };
    }
    if (u.id === payload.attackerId) {
      // Remove stealth/formation when attacking per spec
      let newStatus = u.status;
      if (newStatus === 'stealthed' || newStatus === 'siege_mode' || newStatus === 'formation' || newStatus === 'rallied') {
        newStatus = 'active';
      }
      const existingEffects = Array.isArray((u as any).statusEffects)
        ? (u as any).statusEffects
        : [];
      const filteredEffects = existingEffects.filter((e: any) => e?.type !== 'RALLIED');
      return {
        ...spendUnitActions(u),
        hp: newAttackerHp,
        status: newStatus,
        statusEffects: filteredEffects,
        remainingMovement: u.remainingMovement
      };
    }
    return u;
  });

  // Splash damage during bombardment (adjacent to target).
  if (attackerHasBombardment && attacker.status === 'siege_mode' && distance > 1) {
    const splashDamage = Math.max(1, Math.floor(combatResult.attackerDamage / 2));
    updatedUnits = updatedUnits.map(u => {
      if (u.playerId !== target.playerId) return u;
      if (u.id === target.id) return u;
      if (hexDistance(u.coordinate, target.coordinate) !== 1) return u;
      return { ...u, hp: Math.max(0, u.hp - splashDamage) };
    });
  }

  const intimidateSource = updatedUnits.find(u => u.id === attacker.id);
  updatedUnits = applyIntimidateToAdjacentEnemies(updatedUnits, intimidateSource, state);

  const killedUnits = updatedUnits.filter(u => u.hp <= 0);
  if (killedUnits.length > 0) {
    const killedIds = new Set(killedUnits.map(u => u.id));
    let survivingUnits = updatedUnits.filter(u => !killedIds.has(u.id));

    killedUnits.forEach(deadUnit => {
      const owner = state.players.find(p => p.id === deadUnit.playerId);
      if (owner?.factionId === 'LAMANITES') {
        survivingUnits = survivingUnits.map(u => {
          if (u.playerId !== deadUnit.playerId) return u;
          if (hexDistance(u.coordinate, deadUnit.coordinate) > 1) return u;
          return { ...u, attack: u.attack + 2 };
        });
      }

      if (unitHasAbility(deadUnit, 'PROTECTIVE_STANCE')) {
        survivingUnits = survivingUnits.map(u => {
          if (u.playerId !== deadUnit.playerId) return u;
          if (hexDistance(u.coordinate, deadUnit.coordinate) > 1) return u;
          const baseDefense = getUnitDefinition(u.type)?.baseStats?.defense;
          if (typeof baseDefense !== 'number') return u;
          return u.defense !== baseDefense ? { ...u, defense: baseDefense } : u;
        });
      }
    });

    updatedUnits = survivingUnits;
  }

  return {
    ...state,
    units: updatedUnits
  };
}
