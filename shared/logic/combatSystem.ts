import { GameState, PlayerState } from "../types/game";
import { Unit } from "../types/unit";
import { HexCoordinate } from "../types/coordinates";
import { hexDistance, hexNeighbors } from "../utils/hex";
import { GAME_RULES } from "../data/gameRules";

const getAbilitySet = (unit: Unit): Set<string> =>
  new Set((unit.abilities || []).map(ability => ability.toUpperCase()));

const getPlayerById = (state: GameState, playerId: string): PlayerState | undefined =>
  state.players.find(player => player.id === playerId);

export interface NegotiationResult {
  attackerPrideDelta: number;
  defenderDissentDelta: number;
  message: string;
}

export interface CombatResolution {
  success: boolean;
  damageToDefender: number;
  damageToAttacker: number;
  defenderSurvived: boolean;
  counterOccurred: boolean;
  events: string[];
  counterEvents: string[];
  negotiation?: NegotiationResult;
  reason?: string;
}

interface StrikeOptions {
  attackBonus?: number;
  defenseBonus?: number;
  isCounter?: boolean;
}

function calculateStrikeDamage(
  state: GameState,
  actingUnit: Unit,
  defendingUnit: Unit,
  actingAbilities: Set<string>,
  defendingAbilities: Set<string>,
  actingPlayer?: PlayerState,
  defendingPlayer?: PlayerState,
  options: StrikeOptions = {}
): { damage: number; events: string[] } {
  let attackPower = actingUnit.attack;
  let defensePower = defendingUnit.defense;
  const events: string[] = [];

  if (options.attackBonus) {
    attackPower += options.attackBonus;
    events.push(`Tactical boost (+${options.attackBonus} attack)`);
  }

  if (options.defenseBonus) {
    defensePower += options.defenseBonus;
    events.push(`Defensive preparation (+${options.defenseBonus} defense)`);
  }

  const strikeDistance = hexDistance(actingUnit.coordinate, defendingUnit.coordinate);
  const defendingTile = state.map.tiles.find(
    tile => tile.coordinate.q === defendingUnit.coordinate.q && tile.coordinate.r === defendingUnit.coordinate.r
  );
  const actingTile = state.map.tiles.find(
    tile => tile.coordinate.q === actingUnit.coordinate.q && tile.coordinate.r === actingUnit.coordinate.r
  );

  if (!options.isCounter) {
    if (actingUnit.status === 'rallied') {
      attackPower += 2;
      events.push('Rally bonus (+2 attack)');
    }

    if (actingUnit.status === 'siege_mode') {
      attackPower += 3;
      events.push('Siege stance (+3 attack)');
    }

    if (actingAbilities.has('AMBUSH') && (actingUnit.status === 'stealthed' || actingTile?.terrain === 'forest') && !actingUnit.hasAttacked) {
      attackPower += 3;
      events.push('Ambush bonus (+3 attack)');
    }
  }

  if (actingAbilities.has('RANGED_ATTACK') && strikeDistance > 1 && !actingUnit.hasAttacked) {
    attackPower += 2;
    events.push('Ranged focus (+2 attack)');
  }

  if (actingAbilities.has('GIANT_STRENGTH') && defendingTile?.hasCity) {
    attackPower += 4;
    events.push('Giant strength devastates fortifications (+4 attack)');
  }

  const intimidatingEnemies = state.units.filter(unit => {
    if (unit.playerId !== defendingUnit.playerId || unit.id === defendingUnit.id) return false;
    const abilities = getAbilitySet(unit);
    return abilities.has('INTIMIDATE') && hexDistance(unit.coordinate, actingUnit.coordinate) <= 1;
  }).length;

  if (intimidatingEnemies > 0) {
    attackPower = Math.max(1, attackPower - intimidatingEnemies);
    events.push(`Enemy intimidation aura (-${intimidatingEnemies} attack)`);
  }

  if (actingPlayer) {
    if (actingPlayer.stats.faith >= 70) {
      attackPower += 2;
      events.push('High faith inspiration (+2 attack)');
    }
    if (actingPlayer.stats.pride >= 70) {
      attackPower += 1;
      events.push('Prideful aggression (+1 attack)');
    }
  }

  if (defendingUnit.status === 'formation') {
    defensePower += 2;
    events.push('Formation defense (+2 defense)');
  }

  if (defendingUnit.status === 'defending') {
    defensePower += 1;
    events.push('Defensive posture (+1 defense)');
  }

  if (defendingAbilities.has('PACIFIST_DEFENSE')) {
    defensePower += 2;
    events.push('Pacifist stance hardens resolve (+2 defense)');
  }

  if (defendingTile) {
    const terrainBonus = GAME_RULES.terrain.defenseBonus[defendingTile.terrain] || 0;
    if (terrainBonus > 0) {
      defensePower += terrainBonus;
      events.push(`Terrain advantage (${defendingTile.terrain})`);
    }
  }

  if (actingAbilities.has('SIEGE_BREAKER') && defendingTile?.hasCity) {
    defensePower = Math.max(0, defensePower - 3);
    events.push('Siege breaker negates fortifications (-3 defense)');
  }

  const hasGuerrillaEffect = actingUnit.temporaryEffects?.some(
    effect => effect.source === 'lamanite_guerrilla_tactics'
  );
  if (hasGuerrillaEffect && actingTile && (actingTile.terrain === 'forest' || actingTile.terrain === 'swamp')) {
    attackPower += 1;
    events.push('Guerrilla positioning (+1 attack)');
  }

  const protectiveAura = state.units.some(unit => {
    if (unit.playerId !== defendingUnit.playerId || unit.id === defendingUnit.id) return false;
    const abilities = getAbilitySet(unit);
    return abilities.has('PROTECTIVE_AURA') && hexDistance(unit.coordinate, defendingUnit.coordinate) <= 1;
  });

  let damage = Math.max(1, attackPower - defensePower);

  if (protectiveAura) {
    damage = Math.max(1, Math.floor(damage * 0.75));
    events.push('Protective aura mitigates damage (-25%)');
  }

  if (defendingAbilities.has('PACIFIST_DEFENSE')) {
    damage = Math.max(1, damage - 2);
    events.push('Pacifist shields absorb shock (-2 damage)');
  }

  return { damage, events };
}

export function resolveMeleeCombat(
  state: GameState,
  attacker: Unit,
  defender: Unit,
  bonuses: { attackBonus?: number; defenseBonus?: number; counterAttackBonus?: number; counterDefenseBonus?: number } = {}
): CombatResolution {
  const attackerAbilities = getAbilitySet(attacker);
  const defenderAbilities = getAbilitySet(defender);

  const attackerPlayer = getPlayerById(state, attacker.playerId);
  const defenderPlayer = getPlayerById(state, defender.playerId);
  const distance = hexDistance(attacker.coordinate, defender.coordinate);

  // Diplomacy negotiation – attempt to defuse combat before it begins
  if (defenderAbilities.has('DIPLOMACY') && attackerPlayer && defenderPlayer) {
    const resistanceThreshold = defenderPlayer.stats.faith + Math.max(0, 10 - defenderPlayer.stats.internalDissent);
    const aggressorPressure = attackerPlayer.stats.pride + Math.floor(attacker.attack / 2);

    if (resistanceThreshold >= aggressorPressure) {
      return {
        success: false,
        damageToDefender: 0,
        events: ['Diplomatic negotiation succeeded'],
        negotiation: {
          attackerPrideDelta: -2,
          defenderDissentDelta: -2,
          message: 'Diplomacy avoided bloodshed',
        },
        reason: 'diplomacy',
      };
    }
  }

  const primary = calculateStrikeDamage(
    state,
    attacker,
    defender,
    attackerAbilities,
    defenderAbilities,
    attackerPlayer,
    defenderPlayer,
    { attackBonus: bonuses.attackBonus ?? 0, defenseBonus: bonuses.defenseBonus ?? 0 }
  );

  const defenderRemainingHp = defender.hp - primary.damage;
  const defenderSurvived = defenderRemainingHp > 0;

  let counterDamage = 0;
  let counterEvents: string[] = [];

  const defenderCanCounter =
    defenderSurvived &&
    defender.attack > 0 &&
    defender.attackRange >= distance &&
    !defenderAbilities.has('PACIFIST_DEFENSE') &&
    !defenderAbilities.has('NON_VIOLENCE');

  if (defenderCanCounter) {
    const counter = calculateStrikeDamage(
      state,
      defender,
      attacker,
      defenderAbilities,
      attackerAbilities,
      defenderPlayer,
      attackerPlayer,
      {
        attackBonus: bonuses.counterAttackBonus ?? 0,
        defenseBonus: bonuses.counterDefenseBonus ?? 0,
        isCounter: true,
      }
    );
    counterDamage = counter.damage;
    counterEvents = counter.events;
  }

  return {
    success: true,
    damageToDefender: primary.damage,
    damageToAttacker: counterDamage,
    defenderSurvived,
    counterOccurred: counterDamage > 0,
    events: primary.events,
    counterEvents,
  };
}

export interface RangedAttackImpact {
  unit: Unit;
  damage: number;
  isCenter: boolean;
  events: string[];
}

export interface RangedAttackResolution {
  success: boolean;
  message: string;
  impacts: RangedAttackImpact[];
  tiles: HexCoordinate[];
  centerTile: HexCoordinate;
  events: string[];
}

export function calculateRangedAttack(
  state: GameState,
  attacker: Unit,
  targetCoordinate: HexCoordinate
): RangedAttackResolution {
  if (attacker.attackRange <= 1) {
    return { success: false, message: 'Unit has no ranged attack', impacts: [], tiles: [], centerTile: targetCoordinate, events: [] };
  }

  const distance = hexDistance(attacker.coordinate, targetCoordinate);
  if (distance > attacker.attackRange) {
    return { success: false, message: 'Target out of range', impacts: [], tiles: [], centerTile: targetCoordinate, events: [] };
  }

  const tiles = [targetCoordinate, ...hexNeighbors(targetCoordinate)];
  const actingAbilities = getAbilitySet(attacker);
  const actingPlayer = getPlayerById(state, attacker.playerId);

  const impacts: RangedAttackImpact[] = [];

  state.units.forEach(candidate => {
    if (candidate.id === attacker.id) return;
    if (candidate.hp <= 0) return;

    const isOnTile = tiles.some(tile =>
      tile.q === candidate.coordinate.q &&
      tile.r === candidate.coordinate.r &&
      tile.s === candidate.coordinate.s
    );

    if (!isOnTile) return;

    const isCenter =
      candidate.coordinate.q === targetCoordinate.q &&
      candidate.coordinate.r === targetCoordinate.r &&
      candidate.coordinate.s === targetCoordinate.s;

    const defendingAbilities = getAbilitySet(candidate);
    const defendingPlayer = getPlayerById(state, candidate.playerId);

    const strike = calculateStrikeDamage(
      state,
      attacker,
      candidate,
      actingAbilities,
      defendingAbilities,
      actingPlayer,
      defendingPlayer,
      {}
    );

    if (strike.damage <= 0) return;

    const scaledDamage = isCenter
      ? strike.damage
      : Math.max(1, Math.floor(strike.damage * 0.6));

    impacts.push({
      unit: candidate,
      damage: scaledDamage,
      isCenter,
      events: strike.events,
    });
  });

  if (impacts.length === 0) {
    return {
      success: false,
      message: 'No targets in blast radius',
      impacts: [],
      tiles,
      centerTile: targetCoordinate,
      events: [],
    };
  }

  return {
    success: true,
    message: `Bombardment hit ${impacts.length} unit${impacts.length === 1 ? '' : 's'}`,
    impacts,
    tiles,
    centerTile: targetCoordinate,
    events: impacts.flatMap(impact => impact.events),
  };
}
