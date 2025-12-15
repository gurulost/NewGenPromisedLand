import { Unit } from '../types/unit';
import { GameState } from '../types/game';
import { getUnitDefinition } from '../data/units';
import { getActiveModifiers } from '../data/modifiers';
import { GAME_RULES } from '../data/gameRules';
import { hexDistance } from '../utils/hex';

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

  if (attacker.playerId === defender.playerId) {
    return {
      attackerDamage: 0,
      defenderDamage: 0,
      attackerHealthAfter: attackerHp,
      defenderHealthAfter: defenderHp,
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
      attackerHealthAfter: attackerHp,
      defenderHealthAfter: defenderHp,
      odds: 'Even',
      modifiers: { attacker: [], defender: [] },
      canAttack: false,
      reason: 'Unit has already attacked this turn'
    };
  }

  const distance = hexDistance(attacker.coordinate, defender.coordinate);
  if (distance > attacker.attackRange) {
    return {
      attackerDamage: 0,
      defenderDamage: 0,
      attackerHealthAfter: attackerHp,
      defenderHealthAfter: defenderHp,
      odds: 'Even',
      modifiers: { attacker: [], defender: [] },
      canAttack: false,
      reason: 'Target out of range'
    };
  }

  // Cannot target stealthed units unless adjacent
  if (defender.status === 'stealthed' && distance > 1) {
    return {
      attackerDamage: 0,
      defenderDamage: 0,
      attackerHealthAfter: attackerHp,
      defenderHealthAfter: defenderHp,
      odds: 'Even',
      modifiers: { attacker: [], defender: [] },
      canAttack: false,
      reason: 'Target is hidden (stealth)'
    };
  }

  const normalizeAbility = (abilityId: string) => abilityId.toUpperCase();
  const unitHasAbility = (unit: Unit, abilityId: string) =>
    (unit.abilities || []).some(a => normalizeAbility(String(a)) === normalizeAbility(abilityId));

  const attackerHasBombardment =
    unitHasAbility(attacker, 'SIEGE') ||
    unitHasAbility(attacker, 'BOMBARDMENT') ||
    unitHasAbility(attacker, 'bombardment');
  if (attackerHasBombardment && distance > 1 && attacker.status !== 'siege_mode') {
    return {
      attackerDamage: 0,
      defenderDamage: 0,
      attackerHealthAfter: attackerHp,
      defenderHealthAfter: defenderHp,
      odds: 'Even',
      modifiers: { attacker: [], defender: [] },
      canAttack: false,
      reason: 'Artillery must deploy (Siege Mode) to fire at range'
    };
  }
  if (attackerHasBombardment && distance > 1 && attacker.remainingMovement !== attacker.movement) {
    return {
      attackerDamage: 0,
      defenderDamage: 0,
      attackerHealthAfter: attackerHp,
      defenderHealthAfter: defenderHp,
      odds: 'Even',
      modifiers: { attacker: [], defender: [] },
      canAttack: false,
      reason: 'Artillery must be stationary to fire at range'
    };
  }

  const attackerPlayer = gameState.players.find(p => p.id === attacker.playerId);
  const defenderPlayer = gameState.players.find(p => p.id === defender.playerId);

  // Diplomacy: avoid combat when defender is an envoy-type with strong faith backing.
  if (unitHasAbility(defender, 'DIPLOMACY') && (defenderPlayer?.stats.faith ?? 0) >= 80) {
    return {
      attackerDamage: 0,
      defenderDamage: 0,
      attackerHealthAfter: attackerHp,
      defenderHealthAfter: defenderHp,
      odds: 'Even',
      modifiers: { attacker: [], defender: [] },
      canAttack: false,
      reason: 'Diplomacy prevents combat (high enemy faith)'
    };
  }

  // Calculate base stats using the unit's current values (matches reducer).
  let attackerAttack = attacker.attack;
  let defenderDefense = defender.defense;

  const attackerModifiers: string[] = [];
  const defenderModifiers: string[] = [];

  // Status effects (matches reducer: rallied/siege_mode/formation)
  if (attacker.status === 'rallied') {
    attackerAttack += 2;
    attackerModifiers.push('+2 Attack (Rallied)');
  }
  if (attacker.status === 'siege_mode') {
    attackerAttack += 3;
    attackerModifiers.push('+3 Attack (Siege Mode)');
  }
  if (defender.status === 'formation') {
    defenderDefense += 2;
    defenderModifiers.push('+2 Defense (Formation)');
  }

  // Player modifiers (matches reducer: data-driven modifiers only)
  if (attackerPlayer) {
    const attackModifiers = getActiveModifiers(attackerPlayer, 'on_attack');
    for (const modifier of attackModifiers) {
      for (const effect of modifier.effect) {
        if (effect.stat === 'attack' && effect.target === 'self') {
          attackerAttack += effect.value;
          attackerModifiers.push(`${effect.value >= 0 ? '+' : ''}${effect.value} Attack (${modifier.name})`);
        }
      }
    }
  }
  if (defenderPlayer) {
    const defenseModifiers = getActiveModifiers(defenderPlayer, 'on_defend');
    for (const modifier of defenseModifiers) {
      for (const effect of modifier.effect) {
        if (effect.stat === 'defense' && effect.target === 'self') {
          defenderDefense += effect.value;
          defenderModifiers.push(`${effect.value >= 0 ? '+' : ''}${effect.value} Defense (${modifier.name})`);
        }
      }
    }
  }

  // Faith synergy combat bonuses (tiered; matches reducer)
  const faithCfg = GAME_RULES.faithBonuses;
  if ((attackerPlayer?.stats.faith ?? 0) >= faithCfg.highThreshold) {
    attackerAttack += faithCfg.highAttackBonus;
    attackerModifiers.push(`+${faithCfg.highAttackBonus} Attack (High Faith)`);
  }
  const defenderFaith = defenderPlayer?.stats.faith ?? 0;
  if (defenderFaith >= faithCfg.highThreshold) {
    defenderDefense += faithCfg.highDefenseBonus;
    defenderModifiers.push(`+${faithCfg.highDefenseBonus} Defense (High Faith)`);
  } else if (defenderFaith >= faithCfg.lowThreshold) {
    defenderDefense += faithCfg.lowDefenseBonus;
    defenderModifiers.push(`+${faithCfg.lowDefenseBonus} Defense (Faith)`);
  }

  // Calculate damage
  let attackerDamage = Math.max(1, attackerAttack - defenderDefense);

  // Protective aura: allied guardian adjacent to defender reduces incoming damage.
  const hasProtectiveAura = gameState.units.some(u =>
    u.playerId === defender.playerId &&
    u.id !== defender.id &&
    unitHasAbility(u, 'PROTECTIVE_AURA') &&
    hexDistance(u.coordinate, defender.coordinate) <= 1
  );
  if (hasProtectiveAura) {
    attackerDamage = Math.max(1, attackerDamage - 1);
    defenderModifiers.push('-1 Damage Taken (Protective Aura)');
  }

  // Calculate health after combat
  const defenderHealthAfter = Math.max(0, defenderHp - attackerDamage);
  const defenderCanCounter = defenderHealthAfter > 0 && distance <= defender.attackRange && defender.attack > 0;
  const defenderDamage = defenderCanCounter ? Math.max(1, defender.attack - attacker.defense) : 0;
  const attackerHealthAfter = Math.max(0, attackerHp - defenderDamage);

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
    modifiers: {
      attacker: attackerModifiers,
      defender: defenderModifiers
    },
    canAttack: true
  };
}
