import { Unit } from '@shared/types/unit';
import { GameState, PlayerState } from '@shared/types/game';
import { getUnitDefinition } from '@shared/data/units';
import { hexDistance } from '@shared/utils/hex';
import { resolveCombat } from '@shared/logic/combatResolver';
import { isUnitVisibleToPlayer } from '@shared/logic/unitLogic';

export interface CombatOdds {
  attackerWinChance: number;
  defenderWinChance: number;
  expectedAttackerDamage: number;
  expectedDefenderDamage: number;
  attackerSurvival: number;
  defenderSurvival: number;
  events: string[];
}

export function getCombatOdds(attacker: Unit, defender: Unit, gameState?: GameState): CombatOdds {
  const attackerDef = getUnitDefinition(attacker.type);
  const defenderDef = getUnitDefinition(defender.type);
  const events: string[] = [];

  const hpRatio = attacker.hp / attackerDef.baseStats.hp;
  const defenderHpRatio = defender.hp / defenderDef.baseStats.hp;

  const resolution = gameState ? resolveCombat(attacker, defender, gameState) : null;
  const expectedDamageToDefender =
    resolution?.attackerDamage ??
    Math.max(1, Math.round(attacker.attack * hpRatio - defender.defense * defenderHpRatio * 0.5));

  const expectedDamageToAttacker =
    resolution?.defenderDamage ??
    (() => {
      const distance = hexDistance(attacker.coordinate, defender.coordinate);
      const defenderCanCounter = defender.attack > 0 && defender.attackRange >= distance;
      if (!defenderCanCounter) return 0;
      const counterAttack = defender.attack * defenderHpRatio;
      const counterDefense = attacker.defense * hpRatio;
      return Math.max(1, Math.round(counterAttack - counterDefense * 0.5));
    })();

  if (resolution?.modifiers?.attacker?.length) {
    events.push(...resolution.modifiers.attacker);
  }
  if (resolution?.modifiers?.defender?.length) {
    events.push(...resolution.modifiers.defender);
  }

  const attackerRemainingHp = Math.max(0, attacker.hp - expectedDamageToAttacker);
  const defenderRemainingHp = Math.max(0, defender.hp - expectedDamageToDefender);

  const attackerSurvival = (attackerRemainingHp / attacker.hp) * 100;
  const defenderSurvival = (defenderRemainingHp / defender.hp) * 100;

  const attackerWinChance = defenderRemainingHp <= 0 ? 100 :
    Math.min(95, Math.max(5, 50 + (expectedDamageToDefender - expectedDamageToAttacker) * 5));

  return {
    attackerWinChance,
    defenderWinChance: 100 - attackerWinChance,
    expectedAttackerDamage: expectedDamageToDefender,
    expectedDefenderDamage: expectedDamageToAttacker,
    attackerSurvival,
    defenderSurvival,
    events
  };
}

export function canAttackTarget(attacker: Unit, target: Unit, gameState: GameState): { canAttack: boolean; reason: string } {
  if (!attacker || !target) {
    return { canAttack: false, reason: 'Invalid units' };
  }

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  if (attacker.playerId !== currentPlayer.id) {
    return { canAttack: false, reason: 'Not your turn' };
  }

  const resolution = resolveCombat(attacker, target, gameState);
  return {
    canAttack: resolution.canAttack,
    reason: resolution.canAttack ? 'Attack available' : (resolution.reason || 'Cannot attack target'),
  };
}

export function getAttackableTargets(unit: Unit, gameState: GameState): Unit[] {
  if (!unit || !gameState) return [];

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  if (unit.playerId !== currentPlayer.id) return [];
  if (unit.hasAttacked) return [];

  return gameState.units.filter(target => {
    if (target.playerId === unit.playerId) return false;
    if (target.hp <= 0) return false;
    if (!isUnitVisibleToPlayer(target, unit.playerId, gameState)) return false;
    return resolveCombat(unit, target, gameState).canAttack;
  });
}
