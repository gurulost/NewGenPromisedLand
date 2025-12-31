import { Unit } from '../types/unit';
import { GameState } from '../types/game';
import { getUnitDefinition } from '../data/units';
import { resolveCombat } from './combatResolver';

export interface CombatPreview {
  attackerDamage: number;
  defenderDamage: number;
  attackerHealthAfter: number;
  defenderHealthAfter: number;
  odds: 'Overwhelming' | 'Favorable' | 'Even' | 'Unfavorable' | 'Desperate';
  modifiers: {
    attacker: string[];
    defender: string[];
  };
  canAttack: boolean;
  reason?: string;
}

export function getCombatPreview(
  attacker: Unit,
  defender: Unit,
  gameState: GameState
): CombatPreview | null {
  if (!attacker || !defender) return null;

  const attackerDef = getUnitDefinition(attacker.type);
  const defenderDef = getUnitDefinition(defender.type);
  const attackerHp = attacker.hp ?? attackerDef.baseStats.hp;
  const defenderHp = defender.hp ?? defenderDef.baseStats.hp;

  const resolution = resolveCombat(attacker, defender, gameState);
  if (!resolution.canAttack) {
    return {
      attackerDamage: 0,
      defenderDamage: 0,
      attackerHealthAfter: attackerHp,
      defenderHealthAfter: defenderHp,
      odds: 'Even',
      modifiers: { attacker: [], defender: [] },
      canAttack: false,
      reason: resolution.reason || 'Cannot attack target'
    };
  }

  const attackerDamage = resolution.attackerDamage;
  const defenderDamage = resolution.defenderDamage;
  const attackerHealthAfter = resolution.attackerHp;
  const defenderHealthAfter = resolution.defenderHp;

  // Determine odds based on damage ratio and health
  let odds: CombatPreview['odds'] = 'Even';
  const damageRatio = attackerDamage / Math.max(1, defenderDamage);
  const healthRatio = attackerHp / defenderHp;
  const combinedRatio = damageRatio * healthRatio;

  if (combinedRatio > 3) odds = 'Overwhelming';
  else if (combinedRatio > 1.5) odds = 'Favorable';
  else if (combinedRatio > 0.7) odds = 'Even';
  else if (combinedRatio > 0.3) odds = 'Unfavorable';
  else odds = 'Desperate';

  return {
    attackerDamage,
    defenderDamage,
    attackerHealthAfter,
    defenderHealthAfter,
    odds,
    modifiers: resolution.modifiers,
    canAttack: true
  };
}
