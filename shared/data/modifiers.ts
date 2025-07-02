import type { Unit } from '../types/unit';
import type { PlayerState } from '../types/game';

export interface GameModifier {
  id: string;
  name: string;
  description: string;
  trigger: 'on_attack' | 'on_defend' | 'on_death' | 'on_turn_start' | 'on_turn_end' | 'passive';
  condition?: {
    stat?: keyof PlayerState['stats'];
    operator: '>' | '<' | '=' | '>=' | '<=';
    value: number;
  };
  effect: {
    stat: 'attack' | 'defense' | 'hp' | 'movement' | 'vision_radius' | 'attack_range' | 'faith' | 'pride' | 'internalDissent';
    value: number;
    duration?: number; // -1 for permanent
    target: 'self' | 'nearby' | 'all_friendly' | 'all_enemy';
    radius?: number; // for 'nearby' target
  }[];
  factionId?: string;
}

// Data-driven faction modifiers
export const FACTION_MODIFIERS: GameModifier[] = [
  // Nephites - Faith-based combat bonus
  {
    id: 'nephite_faith_attack',
    name: 'Righteous Fury',
    description: 'Gain +1 attack when Faith is above 70',
    trigger: 'on_attack',
    condition: { stat: 'faith', operator: '>', value: 70 },
    effect: [{ stat: 'attack', value: 1, target: 'self' }],
    factionId: 'NEPHITES'
  },

  // Lamanites - Pride-based damage bonus
  {
    id: 'lamanite_pride_damage',
    name: 'Fierce Pride',
    description: 'Deal +2 damage when Pride is above 60',
    trigger: 'on_attack',
    condition: { stat: 'pride', operator: '>', value: 60 },
    effect: [{ stat: 'attack', value: 2, target: 'self' }],
    factionId: 'LAMANITES'
  },

  // Lamanites - Blood Feud (vengeance for fallen allies)
  {
    id: 'lamanite_blood_feud',
    name: 'Blood Feud',
    description: 'When a Lamanite dies, nearby allies gain permanent +2 attack',
    trigger: 'on_death',
    effect: [{ stat: 'attack', value: 2, target: 'nearby', radius: 1, duration: -1 }],
    factionId: 'LAMANITES'
  },

  // Anti-Nephi-Lehies - Pacifist defense bonus
  {
    id: 'anl_pacifist_defense',
    name: 'Peaceful Resistance',
    description: 'Passive +1 defense due to pacifist conviction',
    trigger: 'passive',
    effect: [{ stat: 'defense', value: 1, target: 'self' }],
    factionId: 'ANTI_NEPHI_LEHIES'
  },

  // Zoramites - Rameumptom resource boost
  {
    id: 'zoramite_pride_boost',
    name: 'Tower of Pride',
    description: 'Massive Pride boost but increased Internal Dissent',
    trigger: 'on_turn_start',
    effect: [
      { stat: 'pride' as any, value: 5, target: 'self' },
      { stat: 'internalDissent' as any, value: 2, target: 'self' }
    ],
    factionId: 'ZORAMITES'
  }
];

// Unit type modifiers
export const UNIT_MODIFIERS: GameModifier[] = [
  // Scout units have extended vision
  {
    id: 'scout_vision',
    name: 'Extended Sight',
    description: 'Scouts can see 3 tiles instead of 2',
    trigger: 'passive',
    effect: [{ stat: 'vision_radius', value: 3, target: 'self' }]
  },

  // Commander units provide leadership
  {
    id: 'commander_leadership',
    name: 'Battle Leadership',
    description: 'Nearby friendly units gain +1 attack',
    trigger: 'passive',
    effect: [{ stat: 'attack', value: 1, target: 'nearby', radius: 2 }]
  }
];

/**
 * Get all active modifiers for a player
 */
export function getActiveModifiers(player: PlayerState, trigger: GameModifier['trigger']): GameModifier[] {
  return FACTION_MODIFIERS.filter(modifier => {
    // Match faction
    if (modifier.factionId && modifier.factionId !== player.factionId) {
      return false;
    }

    // Match trigger
    if (modifier.trigger !== trigger) {
      return false;
    }

    // Check condition if present
    if (modifier.condition) {
      const statValue = player.stats[modifier.condition.stat!];
      const { operator, value } = modifier.condition;
      
      switch (operator) {
        case '>': return statValue > value;
        case '<': return statValue < value;
        case '=': return statValue === value;
        case '>=': return statValue >= value;
        case '<=': return statValue <= value;
        default: return false;
      }
    }

    return true;
  });
}

/**
 * Get unit-specific modifiers
 */
export function getUnitModifiers(unit: Unit, trigger: GameModifier['trigger']): GameModifier[] {
  return UNIT_MODIFIERS.filter(modifier => {
    return modifier.trigger === trigger;
  });
}