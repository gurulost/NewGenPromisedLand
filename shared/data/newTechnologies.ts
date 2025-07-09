/**
 * New Technologies for World Elements System
 * Supporting Book of Mormon themed resource management
 */

import { Technology } from './technologies';

export const NEW_TECHNOLOGIES: Record<string, Technology> = {
  woodcraft: {
    id: 'woodcraft',
    name: 'Woodcraft',
    description: 'Master the art of timber harvesting and processing, unlocking the potential of sacred groves',
    cost: 8,
    prerequisites: [],
    unlocks: {
      improvements: ['sawmill'],
      abilities: ['harvest_lumber']
    },
    category: 'economic'
  },

  husbandry: {
    id: 'husbandry',
    name: 'Husbandry',
    description: 'Learn to domesticate and care for wild animals, turning hunting into sustainable ranching',
    cost: 12,
    prerequisites: ['woodcraft'],
    unlocks: {
      improvements: ['corral'],
      abilities: ['animal_domestication']
    },
    category: 'economic'
  },

  agriculture: {
    id: 'agriculture',
    name: 'Agriculture',
    description: 'Cultivate the earth and plant seeds, as taught in Mosiah 9:9',
    cost: 10,
    prerequisites: [],
    unlocks: {
      improvements: ['field'],
      abilities: ['cultivation']
    },
    category: 'economic'
  },

  irrigation: {
    id: 'irrigation',
    name: 'Irrigation',
    description: 'Channel water to nourish crops, multiplying the harvest through careful stewardship',
    cost: 15,
    prerequisites: ['agriculture'],
    unlocks: {
      improvements: ['windmill'],
      abilities: ['advanced_farming']
    },
    category: 'economic'
  },

  seafaring: {
    id: 'seafaring',
    name: 'Seafaring',
    description: 'Navigate coastal waters and harvest the bounty of the sea',
    cost: 12,
    prerequisites: [],
    unlocks: {
      improvements: ['fishing_jetty'],
      units: ['boat'],
      abilities: ['coastal_fishing']
    },
    category: 'exploration'
  },

  trade: {
    id: 'trade',
    name: 'Trade',
    description: 'Establish maritime trade routes, connecting distant lands through commerce',
    cost: 18,
    prerequisites: ['seafaring'],
    unlocks: {
      improvements: ['harbor'],
      structures: ['marketplace'],
      abilities: ['trade_routes']
    },
    category: 'economic'
  },

  navigation: {
    id: 'navigation',
    name: 'Navigation',
    description: 'Master the deep waters and discover the great creatures of the sea',
    cost: 25,
    prerequisites: ['seafaring', 'trade'],
    unlocks: {
      improvements: ['sea_platform'],
      units: ['deep_water_vessel'],
      abilities: ['deep_sea_expedition']
    },
    category: 'exploration'
  }
};

// Merge with existing technologies
export function getAllTechnologies(): Record<string, Technology> {
  // Import existing technologies
  const { TECHNOLOGIES } = require('./technologies');
  
  return {
    ...TECHNOLOGIES,
    ...NEW_TECHNOLOGIES
  };
}