import { Unit } from '@shared/types/unit';
import { GameState } from '@shared/types/game';
import { getUnitDefinition } from '@shared/data/units';
import { hexDistance } from '@shared/utils/hex';
import { getCombatRulePreview, getLegalUnitActions } from '@shared/logic/ruleQueries';

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

  const resolution = gameState
    ? getCombatRulePreview(gameState, attacker.id, defender.id, attacker.playerId).preview
    : null;
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

  const resolution = getCombatRulePreview(gameState, attacker.id, target.id, attacker.playerId).check;
  return {
    canAttack: resolution.legal,
    reason: resolution.legal ? 'Attack available' : (resolution.message || resolution.reason || 'Cannot attack target'),
  };
}

export function getAttackableTargets(unit: Unit, gameState: GameState): Unit[] {
  if (!unit || !gameState) return [];

  const targetIds = new Set<string>();
  for (const option of getLegalUnitActions(gameState, unit.id, unit.playerId)) {
    if (option.action.type === 'ATTACK_UNIT') {
      targetIds.add(option.action.payload.targetId);
    }
  }
  return gameState.units.filter(target => targetIds.has(target.id));
}
