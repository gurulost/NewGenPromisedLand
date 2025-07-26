import { Unit } from '../../../shared/types/unit';

export interface CombatOdds {
  attackerWinChance: number;
  defenderWinChance: number;
  expectedAttackerDamage: number;
  expectedDefenderDamage: number;
  attackerSurvival: number;
  defenderSurvival: number;
}

export function getCombatOdds(attacker: Unit, defender: Unit): CombatOdds {
  // Simplified combat calculation - in real game would use complex formulas
  const attackerPower = attacker.combat.attack * (attacker.health / attacker.maxHealth);
  const defenderPower = defender.combat.defense * (defender.health / defender.maxHealth);
  
  const totalPower = attackerPower + defenderPower;
  const attackerWinChance = totalPower > 0 ? (attackerPower / totalPower) * 100 : 50;
  
  return {
    attackerWinChance,
    defenderWinChance: 100 - attackerWinChance,
    expectedAttackerDamage: Math.max(0, attacker.combat.attack - defender.combat.defense),
    expectedDefenderDamage: Math.max(0, defender.combat.attack - attacker.combat.defense),
    attackerSurvival: attackerWinChance,
    defenderSurvival: 100 - attackerWinChance
  };
}