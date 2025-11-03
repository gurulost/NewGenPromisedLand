import { Faction, FactionId } from "../types/faction";

export const FACTIONS: Record<FactionId, Faction> = {
  NEPHITES: {
    id: 'NEPHITES',
    name: 'Nephites',
    description: 'A righteous people focused on faith, defense, and spiritual strength. They excel at building fortifications and inspiring their troops.',
    color: '#3b82f6',
    startingStats: {
      faith: 80,
      pride: 20,
      internalDissent: 10,
    },
    abilities: [
      {
        id: 'TITLE_OF_LIBERTY',
        name: 'Title of Liberty',
        description: 'Inspires all units within 3 tiles, increasing their attack and defense by 50% for 3 turns.',
        cost: 50,
        cooldown: 8,
        type: 'active',
        requirements: { faith: 70 },
      },
      {
        id: 'RIGHTEOUS_DEFENSE',
        name: 'Righteous Defense',
        description: 'Strengthen Nephite cities; nearby allies gain +2 defense and missionaries heal 3 HP.',
        cost: 20,
        cooldown: 5,
        type: 'active',
        requirements: { faith: 20 },
      }
    ],
    uniqueUnits: ['stripling_warrior', 'missionary'],
    playstyle: 'Defensive and spiritual growth focused',
    strengths: ['Strong defense', 'Unit inspiration', 'Faith-based abilities'],
    weaknesses: ['Slower expansion', 'Vulnerable to pride-based attacks'],
  },

  LAMANITES: {
    id: 'LAMANITES',
    name: 'Lamanites',
    description: 'A fierce warrior culture emphasizing strength, aggression, and martial prowess. They excel in early game combat.',
    color: '#ef4444',
    startingStats: {
      faith: 30,
      pride: 70,
      internalDissent: 40,
    },
    abilities: [
      {
        id: 'BLOOD_FEUD',
        name: 'Blood Feud',
        description: 'When a Lamanite unit is killed, nearby Lamanites gain permanent +1 attack.',
        cost: 0,
        cooldown: 0,
        type: 'triggered',
      },
      {
        id: 'WARRIOR_RAGE',
        name: 'Warrior Rage',
        description: 'Lamanite melee units gain +2 attack and +1 movement for two turns but dissent rises.',
        cost: 10,
        cooldown: 5,
        type: 'active',
        requirements: { pride: 20 },
      }
    ],
    uniqueUnits: ['warrior', 'scout'],
    playstyle: 'Aggressive early game warfare',
    strengths: ['Strong early combat', 'Fast movement', 'Intimidation'],
    weaknesses: ['High internal dissent', 'Weaker late game', 'Resource management'],
  },

  MULEKITES: {
    id: 'MULEKITES',
    name: 'Mulekites of Zarahemla',
    description: 'Ancient knowledge keepers focused on expansion, trade, and recovering lost wisdom.',
    color: '#10b981',
    startingStats: {
      faith: 50,
      pride: 40,
      internalDissent: 20,
    },
    abilities: [
      {
        id: 'ANCIENT_KNOWLEDGE',
        name: 'Ancient Knowledge',
        description: 'Reveal every ruin or shrine and gain a surge of research.',
        cost: 25,
        cooldown: 6,
        type: 'active',
        requirements: { faith: 25 },
      },
      {
        id: 'CULTURAL_RECLAMATION',
        name: 'Cultural Reclamation',
        description: 'Reclaim neutral settlements and erode enemy loyalty around your cities.',
        cost: 18,
        cooldown: 6,
        type: 'active',
        requirements: { faith: 18 },
      }
    ],
    uniqueUnits: ['royal_envoy', 'worker'],
    playstyle: 'Exploration and cultural expansion',
    strengths: ['Rapid expansion', 'Knowledge recovery', 'Diplomacy'],
    weaknesses: ['Weaker military', 'Vulnerable early game'],
  },

  ANTI_NEPHI_LEHIES: {
    id: 'ANTI_NEPHI_LEHIES',
    name: 'Anti-Nephi-Lehies',
    description: 'A peaceful covenant people who have sworn off warfare, focusing on conversion and cultural influence.',
    color: '#f59e0b',
    startingStats: {
      faith: 90,
      pride: 10,
      internalDissent: 5,
    },
    abilities: [
      {
        id: 'COVENANT_OF_PEACE',
        name: 'Covenant of Peace',
        description: 'When attacked, convert attacking units instead of fighting back.',
        cost: 0,
        cooldown: 0,
        type: 'passive',
      },
      {
        id: 'MISSIONARY_ZEAL',
        name: 'Missionary Zeal',
        description: 'Missionaries may convert nearby enemies and reduce dissent by spreading faith.',
        cost: 25,
        cooldown: 5,
        type: 'active',
        requirements: { faith: 25 },
      }
    ],
    uniqueUnits: ['missionary', 'guard'],
    playstyle: 'Peaceful conversion and defense',
    strengths: ['Unit conversion', 'High faith', 'Cultural victory'],
    weaknesses: ['Cannot initiate combat', 'Limited military options'],
  },

  ZORAMITES: {
    id: 'ZORAMITES',
    name: 'Zoramites',
    description: 'A prideful people focused on wealth, status, and civic power through the Rameumptom.',
    color: '#8b5cf6',
    startingStats: {
      faith: 20,
      pride: 80,
      internalDissent: 60,
    },
    abilities: [
      {
        id: 'RAMEUMPTOM',
        name: 'Rameumptom',
        description: 'Gain massive civic power boost but increase internal dissent. Effects last 5 turns.',
        cost: 50,
        cooldown: 12,
        type: 'active',
        requirements: { pride: 70 },
      },
      {
        id: 'WEALTH_ACCUMULATION',
        name: 'Wealth Accumulation',
        description: 'Toggle opulence: earn +1 star per city but lose faith and gain dissent each turn.',
        cost: 0,
        cooldown: 3,
        type: 'passive',
      }
    ],
    uniqueUnits: ['royal_envoy', 'commander'],
    playstyle: 'Economic dominance with high risk',
    strengths: ['Resource generation', 'Economic victory', 'Civic power'],
    weaknesses: ['High dissent', 'Faith penalties', 'Internal instability'],
  },

  JAREDITES: {
    id: 'JAREDITES',
    name: 'Jaredites',
    description: 'An ancient civilization prone to cycles of greatness and collapse, with powerful but unpredictable abilities.',
    color: '#6b7280',
    startingStats: {
      faith: 60,
      pride: 60,
      internalDissent: 30,
    },
    abilities: [
      {
        id: 'PROPHETIC_COLLAPSE',
        name: 'Prophetic Collapse',
        description: 'Sacrifice weaker forces to empower the righteous remnant.',
        cost: 0,
        cooldown: 12,
        type: 'active',
      },
      {
        id: 'ANCIENT_MIGHT',
        name: 'Ancient Might',
        description: 'Jaredite legions gain +2 attack and defense for three turns.',
        cost: 20,
        cooldown: 6,
        type: 'active',
        requirements: { pride: 15, faith: 15 },
      }
    ],
    uniqueUnits: ['commander', 'warrior'],
    playstyle: 'High risk, high reward cyclical power',
    strengths: ['Powerful late game', 'Unique mechanics', 'Strong units'],
    weaknesses: ['Unpredictable', 'Self-destructive tendencies', 'Complex management'],
  },
};

export const getFaction = (id: FactionId): Faction => {
  return FACTIONS[id];
};

export const getAllFactions = (): Faction[] => {
  return Object.values(FACTIONS);
};
