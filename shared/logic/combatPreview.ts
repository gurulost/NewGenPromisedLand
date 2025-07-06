import { Unit } from '../types/unit';
import { GameState } from '../types/game';
import { UNIT_DEFINITIONS } from '../data/units';
import { GAME_RULES } from '../data/gameRules';

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

  // Check if attack is valid
  if (attacker.ownerId === defender.ownerId) {
    return {
      attackerDamage: 0,
      defenderDamage: 0,
      attackerHealthAfter: attacker.currentHp,
      defenderHealthAfter: defender.currentHp,
      odds: 'Even',
      modifiers: { attacker: [], defender: [] },
      canAttack: false,
      reason: 'Cannot attack friendly units'
    };
  }

  if (attacker.hasAttacked) {
    return {
      attackerDamage: 0,
      defenderDamage: 0,
      attackerHealthAfter: attacker.currentHp,
      defenderHealthAfter: defender.currentHp,
      odds: 'Even',
      modifiers: { attacker: [], defender: [] },
      canAttack: false,
      reason: 'Unit has already attacked this turn'
    };
  }

  const attackerDef = UNIT_DEFINITIONS[attacker.type];
  const defenderDef = UNIT_DEFINITIONS[defender.type];
  
  if (!attackerDef || !defenderDef) return null;

  // Get player states for bonuses
  const attackerPlayer = gameState.players.find(p => p.id === attacker.ownerId);
  const defenderPlayer = gameState.players.find(p => p.id === defender.ownerId);

  // Calculate base stats
  let attackerAttack = attackerDef.baseStats.attack;
  let attackerDefense = attackerDef.baseStats.defense;
  let defenderAttack = defenderDef.baseStats.attack;
  let defenderDefense = defenderDef.baseStats.defense;

  const attackerModifiers: string[] = [];
  const defenderModifiers: string[] = [];

  // Apply status effects
  if (attacker.statusEffects) {
    if (attacker.statusEffects.formation_fighting) {
      attackerAttack += 2;
      attackerDefense += 2;
      attackerModifiers.push('+2 Attack/Defense (Formation)');
    }
    if (attacker.statusEffects.siege_mode) {
      attackerAttack += 5;
      attackerModifiers.push('+5 Attack (Siege Mode)');
    }
    if (attacker.statusEffects.rally_troops) {
      attackerAttack += 3;
      attackerModifiers.push('+3 Attack (Rally)');
    }
  }

  if (defender.statusEffects) {
    if (defender.statusEffects.formation_fighting) {
      defenderAttack += 2;
      defenderDefense += 2;
      defenderModifiers.push('+2 Attack/Defense (Formation)');
    }
    if (defender.statusEffects.siege_mode) {
      defenderAttack += 5;
      defenderModifiers.push('+5 Attack (Siege Mode)');
    }
    if (defender.statusEffects.rally_troops) {
      defenderAttack += 3;
      defenderModifiers.push('+3 Attack (Rally)');
    }
    if (defender.statusEffects.stealth) {
      defenderDefense += 3;
      defenderModifiers.push('+3 Defense (Stealth)');
    }
  }

  // Apply faith/pride bonuses
  if (attackerPlayer) {
    const faithBonus = Math.floor(attackerPlayer.stats.faith / 20);
    const prideBonus = Math.floor(attackerPlayer.stats.pride / 25);
    if (faithBonus > 0) {
      attackerAttack += faithBonus;
      attackerModifiers.push(`+${faithBonus} Attack (Faith)`);
    }
    if (prideBonus > 0) {
      attackerDefense += prideBonus;
      attackerModifiers.push(`+${prideBonus} Defense (Pride)`);
    }
  }

  if (defenderPlayer) {
    const faithBonus = Math.floor(defenderPlayer.stats.faith / 20);
    const prideBonus = Math.floor(defenderPlayer.stats.pride / 25);
    if (faithBonus > 0) {
      defenderAttack += faithBonus;
      defenderModifiers.push(`+${faithBonus} Attack (Faith)`);
    }
    if (prideBonus > 0) {
      defenderDefense += prideBonus;
      defenderModifiers.push(`+${prideBonus} Defense (Pride)`);
    }
  }

  // Calculate damage
  const attackerDamage = Math.max(1, attackerAttack - defenderDefense);
  const defenderDamage = Math.max(1, defenderAttack - attackerDefense);

  // Calculate health after combat
  const attackerHealthAfter = Math.max(0, attacker.currentHp - defenderDamage);
  const defenderHealthAfter = Math.max(0, defender.currentHp - attackerDamage);

  // Determine odds based on damage ratio and health
  let odds: CombatPreview['odds'] = 'Even';
  const damageRatio = attackerDamage / defenderDamage;
  const healthRatio = attacker.currentHp / defender.currentHp;
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
    modifiers: {
      attacker: attackerModifiers,
      defender: defenderModifiers
    },
    canAttack: true
  };
}