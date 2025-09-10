import { Unit } from '@shared/types/unit';
import { getUnitDefinition } from '@shared/data/units';

export interface CombatOdds {
  attackerWinChance: number;
  defenderWinChance: number;
  expectedAttackerDamage: number;
  expectedDefenderDamage: number;
  attackerSurvival: number;
  defenderSurvival: number;
}

export function getCombatOdds(attacker: Unit, defender: Unit): CombatOdds {
  // Get unit definitions to access combat stats
  const attackerDef = getUnitDefinition(attacker.type);
  const defenderDef = getUnitDefinition(defender.type);
  
  // Simplified combat calculation - in real game would use complex formulas
  const attackerPower = attackerDef.baseStats.attack * (attacker.hp / attackerDef.baseStats.hp);
  const defenderPower = defenderDef.baseStats.defense * (defender.hp / defenderDef.baseStats.hp);
  
  const totalPower = attackerPower + defenderPower;
  const attackerWinChance = totalPower > 0 ? (attackerPower / totalPower) * 100 : 50;
  
  return {
    attackerWinChance,
    defenderWinChance: 100 - attackerWinChance,
    expectedAttackerDamage: Math.max(0, attackerDef.baseStats.attack - defenderDef.baseStats.defense),
    expectedDefenderDamage: Math.max(0, defenderDef.baseStats.attack - attackerDef.baseStats.defense),
    attackerSurvival: attackerWinChance,
    defenderSurvival: 100 - attackerWinChance
  };
}