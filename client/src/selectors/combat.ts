import { Unit } from '@shared/types/unit';
import { GameState, PlayerState } from '@shared/types/game';
import { getUnitDefinition } from '@shared/data/units';
import { hexDistance } from '@shared/utils/hex';
import { GAME_RULES } from '@shared/data/gameRules';

export interface CombatOdds {
  attackerWinChance: number;
  defenderWinChance: number;
  expectedAttackerDamage: number;
  expectedDefenderDamage: number;
  attackerSurvival: number;
  defenderSurvival: number;
  events: string[];
}

const getAbilitySet = (unit: Unit): Set<string> =>
  new Set((unit.abilities || []).map(ability => ability.toUpperCase()));

export function getCombatOdds(attacker: Unit, defender: Unit, gameState?: GameState): CombatOdds {
  const attackerDef = getUnitDefinition(attacker.type);
  const defenderDef = getUnitDefinition(defender.type);
  const events: string[] = [];
  
  let attackPower = attacker.attack;
  let defensePower = defender.defense;
  
  const attackerAbilities = getAbilitySet(attacker);
  const defenderAbilities = getAbilitySet(defender);
  
  if (attacker.status === 'rallied') {
    attackPower += 2;
    events.push('Rally bonus (+2 attack)');
  }
  
  if (attacker.status === 'siege_mode') {
    attackPower += 3;
    events.push('Siege stance (+3 attack)');
  }
  
  if (defender.status === 'formation') {
    defensePower += 2;
    events.push('Formation defense (+2 defense)');
  }
  
  if (defender.status === 'defending') {
    defensePower += 1;
    events.push('Defensive posture (+1 defense)');
  }
  
  if (attackerAbilities.has('AMBUSH') && attacker.status === 'stealthed') {
    attackPower += 3;
    events.push('Ambush bonus (+3 attack)');
  }
  
  if (defenderAbilities.has('PACIFIST_DEFENSE')) {
    defensePower += 2;
    events.push('Pacifist defense (+2 defense)');
  }
  
  if (gameState) {
    const attackerPlayer = gameState.players.find(p => p.id === attacker.playerId);
    const defenderPlayer = gameState.players.find(p => p.id === defender.playerId);
    
    if (attackerPlayer?.stats.faith && attackerPlayer.stats.faith >= 70) {
      attackPower += 2;
      events.push('High faith (+2 attack)');
    }
    
    if (attackerPlayer?.stats.pride && attackerPlayer.stats.pride >= 70) {
      attackPower += 1;
      events.push('Pride bonus (+1 attack)');
    }
    
    const defenderTile = gameState.map.tiles.find(t => 
      t.coordinate.q === defender.coordinate.q && t.coordinate.r === defender.coordinate.r
    );
    
    if (defenderTile) {
      const terrainBonus = GAME_RULES.terrain.defenseBonus[defenderTile.terrain] || 0;
      if (terrainBonus > 0) {
        defensePower += terrainBonus;
        events.push(`Terrain advantage (+${terrainBonus} defense)`);
      }
    }
  }
  
  const hpRatio = attacker.hp / attackerDef.baseStats.hp;
  const effectiveAttack = attackPower * hpRatio;
  
  const defenderHpRatio = defender.hp / defenderDef.baseStats.hp;
  const effectiveDefense = defensePower * defenderHpRatio;
  
  const expectedDamageToDefender = Math.max(1, Math.round(effectiveAttack - effectiveDefense * 0.5));
  
  const distance = hexDistance(attacker.coordinate, defender.coordinate);
  const defenderCanCounter = 
    defender.attack > 0 && 
    defender.attackRange >= distance &&
    !defenderAbilities.has('PACIFIST_DEFENSE') &&
    !defenderAbilities.has('NON_VIOLENCE');
  
  let expectedDamageToAttacker = 0;
  if (defenderCanCounter) {
    const counterAttack = defender.attack * defenderHpRatio;
    const counterDefense = attacker.defense * hpRatio;
    expectedDamageToAttacker = Math.max(1, Math.round(counterAttack - counterDefense * 0.5));
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
  
  if (attacker.playerId === target.playerId) {
    return { canAttack: false, reason: 'Cannot attack friendly units' };
  }
  
  if (attacker.hasAttacked) {
    return { canAttack: false, reason: 'Unit has already attacked this turn' };
  }
  
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  if (attacker.playerId !== currentPlayer.id) {
    return { canAttack: false, reason: 'Not your turn' };
  }
  
  const distance = hexDistance(attacker.coordinate, target.coordinate);
  if (distance > attacker.attackRange) {
    return { canAttack: false, reason: `Target out of range (${distance}/${attacker.attackRange})` };
  }
  
  if (attacker.type === 'catapult' && distance > 1 && attacker.status !== 'siege_mode') {
    return { canAttack: false, reason: 'Catapult must be in siege mode for ranged attacks' };
  }
  
  if (target.status === 'stealthed' && distance > 1) {
    return { canAttack: false, reason: 'Cannot target stealthed units at range' };
  }
  
  const attackerAbilities = getAbilitySet(attacker);
  if (attackerAbilities.has('PACIFIST_DEFENSE') || attackerAbilities.has('NON_VIOLENCE')) {
    return { canAttack: false, reason: 'This unit cannot attack' };
  }
  
  return { canAttack: true, reason: 'Attack available' };
}

export function getAttackableTargets(unit: Unit, gameState: GameState): Unit[] {
  if (!unit || !gameState) return [];
  
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  if (unit.playerId !== currentPlayer.id) return [];
  if (unit.hasAttacked) return [];
  
  const attackerAbilities = getAbilitySet(unit);
  if (attackerAbilities.has('PACIFIST_DEFENSE') || attackerAbilities.has('NON_VIOLENCE')) {
    return [];
  }
  
  return gameState.units.filter(target => {
    if (target.playerId === unit.playerId) return false;
    if (target.hp <= 0) return false;
    
    const distance = hexDistance(unit.coordinate, target.coordinate);
    if (distance > unit.attackRange) return false;
    
    if (unit.type === 'catapult' && distance > 1 && unit.status !== 'siege_mode') {
      return false;
    }
    
    if (target.status === 'stealthed' && distance > 1) return false;
    
    return true;
  });
}
