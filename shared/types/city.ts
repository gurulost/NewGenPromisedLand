import { z } from "zod";
import { HexCoordinateSchema } from "./coordinates";

export const ImprovementTypeSchema = z.enum([
  'farm',
  'mine', 
  'forest_camp',
  'plantation',
  'irrigation',
  'workshop',
  'port',
  'aqueduct',
  'road'
]);

export type ImprovementType = z.infer<typeof ImprovementTypeSchema>;

export const StructureTypeSchema = z.enum([
  'temple',
  'granary',
  'lighthouse',
  'cathedral',
  'academy',
  'library',
  'fortress'
]);

export type StructureType = z.infer<typeof StructureTypeSchema>;

export const ImprovementSchema = z.object({
  id: z.string(),
  type: ImprovementTypeSchema,
  coordinate: HexCoordinateSchema,
  ownerId: z.string(),
  starProduction: z.number().default(0),
  cityId: z.string(), // Which city this improvement belongs to
  constructionTurns: z.number().default(0), // If > 0, still under construction
});

export type Improvement = z.infer<typeof ImprovementSchema>;

export const StructureSchema = z.object({
  id: z.string(),
  type: StructureTypeSchema,
  cityId: z.string(),
  ownerId: z.string(),
  constructionTurns: z.number().default(0), // If > 0, still under construction
  effects: z.object({
    starProduction: z.number().default(0),
    unitProduction: z.number().default(0),
    defenseBonus: z.number().default(0),
    populationGrowth: z.number().default(0)
  }).default({}),
});

export type Structure = z.infer<typeof StructureSchema>;

export const CitySchema = z.object({
  id: z.string(),
  name: z.string(),
  coordinate: HexCoordinateSchema,
  ownerId: z.string().optional(), // undefined = neutral city
  population: z.number().default(1),
  maxPopulation: z.number().default(4), // Population needed to level up
  level: z.number().default(1), // City level affects max population and bonuses
  starProduction: z.number().default(2), // Base star production (increases with level)
  improvements: z.array(z.string()).default([]), // Improvement IDs
  structures: z.array(z.string()).default([]), // Structure IDs
  currentProduction: z.object({
    type: z.enum(['unit', 'structure']),
    targetId: z.string(),
    progress: z.number(),
    totalCost: z.number()
  }).optional(), // What the city is currently producing
  harvestedResources: z.array(z.string()).default([]), // Resource tile IDs already harvested
});

export type City = z.infer<typeof CitySchema>;

// Improvement definitions
export interface ImprovementDefinition {
  id: ImprovementType;
  name: string;
  description: string;
  cost: number;
  starProduction: number;
  validTerrain: string[];
  requiredTech: string;
  constructionTime: number; // Turns to build
}

export const IMPROVEMENT_DEFINITIONS: Record<ImprovementType, ImprovementDefinition> = {
  farm: {
    id: 'farm',
    name: 'Farm',
    description: 'Increases food production on fertile land',
    cost: 5,
    starProduction: 2,
    validTerrain: ['plains', 'desert'],
    requiredTech: 'organization',
    constructionTime: 1
  },
  
  mine: {
    id: 'mine',
    name: 'Mine',
    description: 'Extracts valuable resources from mountains',
    cost: 8,
    starProduction: 3,
    validTerrain: ['mountain'],
    requiredTech: 'organization',
    constructionTime: 1
  },
  
  lumber_hut: {
    id: 'lumber_hut',
    name: 'Lumber Hut',
    description: 'Harvests timber and provides population growth',
    cost: 3,
    starProduction: 0,
    validTerrain: ['forest'],
    requiredTech: 'forestry',
    constructionTime: 1,
    effects: {
      populationGrowth: 1 // +1 population per turn
    }
  },
  
  sawmill: {
    id: 'sawmill',
    name: 'Sawmill',
    description: 'Processes lumber - adds +1 population for each adjacent Lumber Hut',
    cost: 5,
    starProduction: 0,
    validTerrain: ['plains'],
    requiredTech: 'forestry',
    constructionTime: 1,
    effects: {
      populationGrowth: 0 // Dynamic bonus calculated based on adjacent Lumber Huts
    }
  },
  
  plantation: {
    id: 'plantation',
    name: 'Plantation',
    description: 'Advanced agricultural facility',
    cost: 12,
    starProduction: 4,
    validTerrain: ['plains', 'forest'],
    requiredTech: 'agriculture',
    constructionTime: 1
  },
  
  irrigation: {
    id: 'irrigation',
    name: 'Irrigation',
    description: 'Advanced water management for agriculture',
    cost: 10,
    starProduction: 3,
    validTerrain: ['plains', 'desert'],
    requiredTech: 'agriculture',
    constructionTime: 1
  },
  
  workshop: {
    id: 'workshop',
    name: 'Workshop',
    description: 'Metalworking and crafting facility',
    cost: 15,
    starProduction: 3,
    validTerrain: ['mountain', 'plains'],
    requiredTech: 'bronze_working',
    constructionTime: 1
  },
  
  port: {
    id: 'port',
    name: 'Port',
    description: 'Enables sea travel and trade',
    cost: 8,
    starProduction: 2,
    validTerrain: ['water'],
    requiredTech: 'sailing',
    constructionTime: 1
  },
  
  aqueduct: {
    id: 'aqueduct',
    name: 'Aqueduct',
    description: 'Advanced water infrastructure',
    cost: 20,
    starProduction: 2,
    validTerrain: ['plains', 'mountain'],
    requiredTech: 'engineering',
    constructionTime: 1
  },
  
  road: {
    id: 'road',
    name: 'Road',
    description: 'Infrastructure that reduces movement cost for units',
    cost: 3,
    starProduction: 0,
    validTerrain: ['plains', 'forest', 'desert'],
    requiredTech: 'organization',
    constructionTime: 1
  }
};

// Structure definitions
export interface StructureDefinition {
  id: StructureType;
  name: string;
  description: string;
  cost: number;
  requiredTech: string;
  constructionTime: number;
  effects: {
    starProduction: number;
    unitProduction: number;
    defenseBonus: number;
    populationGrowth: number;
  };
}

export const STRUCTURE_DEFINITIONS: Record<StructureType, StructureDefinition> = {
  temple: {
    id: 'temple',
    name: 'Temple',
    description: 'Center of worship and spiritual guidance',
    cost: 8,
    requiredTech: 'spirituality',
    constructionTime: 1,
    effects: {
      starProduction: 1,
      unitProduction: 0,
      defenseBonus: 0,
      populationGrowth: 1
    }
  },
  
  granary: {
    id: 'granary',
    name: 'Granary',
    description: 'Stores food and supports population growth',
    cost: 10,
    requiredTech: 'agriculture',
    constructionTime: 1,
    effects: {
      starProduction: 0,
      unitProduction: 0,
      defenseBonus: 0,
      populationGrowth: 2
    }
  },
  
  lighthouse: {
    id: 'lighthouse',
    name: 'Lighthouse',
    description: 'Guides ships and enhances naval capabilities',
    cost: 12,
    requiredTech: 'sailing',
    constructionTime: 1,
    effects: {
      starProduction: 2,
      unitProduction: 1,
      defenseBonus: 0,
      populationGrowth: 0
    }
  },
  
  cathedral: {
    id: 'cathedral',
    name: 'Cathedral',
    description: 'Grand religious center with wide influence',
    cost: 25,
    requiredTech: 'priesthood',
    constructionTime: 1,
    effects: {
      starProduction: 3,
      unitProduction: 0,
      defenseBonus: 1,
      populationGrowth: 2
    }
  },
  
  academy: {
    id: 'academy',
    name: 'Academy',
    description: 'Center of learning and knowledge',
    cost: 30,
    requiredTech: 'philosophy',
    constructionTime: 1,
    effects: {
      starProduction: 4,
      unitProduction: 0,
      defenseBonus: 0,
      populationGrowth: 1
    }
  },
  
  library: {
    id: 'library',
    name: 'Library',
    description: 'Repository of knowledge and wisdom',
    cost: 20,
    requiredTech: 'philosophy',
    constructionTime: 1,
    effects: {
      starProduction: 2,
      unitProduction: 0,
      defenseBonus: 0,
      populationGrowth: 1
    }
  },
  
  fortress: {
    id: 'fortress',
    name: 'Fortress',
    description: 'Strong defensive fortification',
    cost: 35,
    requiredTech: 'engineering',
    constructionTime: 1,
    effects: {
      starProduction: 0,
      unitProduction: 1,
      defenseBonus: 3,
      populationGrowth: 0
    }
  }
};