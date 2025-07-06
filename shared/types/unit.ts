import { z } from "zod";
import { HexCoordinateSchema } from "./coordinates";

export const UnitTypeSchema = z.enum([
  // Common units (available to all factions)
  'warrior',
  'scout',
  'worker',
  'guard',
  'commander',
  'spearman',
  'boat',
  'catapult',
  
  // Faction-specific special units
  'stripling_warrior',      // Nephites
  'missionary',             // Nephites, Anti-Nephi-Lehies
  'royal_envoy',           // Mulekites, Zoramites
  'wilderness_hunter',     // Lamanites
  'ancient_giant',         // Jaredites
  'peacekeeping_guard'     // Anti-Nephi-Lehies
]);

export type UnitType = z.infer<typeof UnitTypeSchema>;

export const UnitStatusSchema = z.enum([
  'active',
  'exhausted',
  'defending',
  'fortified',
  'stealthed',      // Scout stealth mode
  'rallied',        // Boosted by commander
  'formation',      // Spearman formation fighting
  'siege_mode',     // Catapult siege mode
]);

export type UnitStatus = z.infer<typeof UnitStatusSchema>;

export const UnitSchema = z.object({
  id: z.string(),
  type: UnitTypeSchema,
  playerId: z.string(),
  coordinate: HexCoordinateSchema,
  hp: z.number(),
  maxHp: z.number(),
  attack: z.number(),
  defense: z.number(),
  movement: z.number(),
  remainingMovement: z.number(),
  status: UnitStatusSchema,
  abilities: z.array(z.string()).default([]),
  level: z.number().default(1),
  experience: z.number().default(0),
  visionRadius: z.number().default(2),
  attackRange: z.number().default(1),
  hasAttacked: z.boolean().default(false),
});

export type Unit = z.infer<typeof UnitSchema>;

export const UnitDefinitionSchema = z.object({
  type: UnitTypeSchema,
  name: z.string(),
  description: z.string(),
  baseStats: z.object({
    hp: z.number(),
    attack: z.number(),
    defense: z.number(),
    movement: z.number(),
    visionRadius: z.number().default(2),
    attackRange: z.number().default(1),
  }),
  cost: z.number(),
  requirements: z.object({
    faith: z.number().optional(),
    pride: z.number().optional(),
    dissent: z.number().optional(),
  }).optional(),
  factionSpecific: z.array(z.string()).default([]),
  abilities: z.array(z.string()).default([]),
  requiredTechnology: z.string().optional(), // Technology required to unlock this unit
});

export type UnitDefinition = z.infer<typeof UnitDefinitionSchema>;
