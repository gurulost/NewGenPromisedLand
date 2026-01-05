import { z } from "zod";
import { HexCoordinateSchema } from "./coordinates";

export const UnitTypeSchema = z.enum([
  // Common units (available to all factions)
  'warrior',
  'scout',
  'slinger',
  'worker',
  'guard',
  'commander',
  'spearman',
  'boat',
  'catapult',

  // Faction-specific special units
  'stripling_warrior',      // Nephites
  'missionary',             // Nephites, Anti-Nephi-Lehies
  'priestcraft_preacher',   // Zoramites
  'converted_missionary',   // Lamanites (late/unlocked)
  'scribe_teacher',         // Mulekites
  'prophet',                // Jaredites
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
  ownerId: z.string().optional(),
  coordinate: HexCoordinateSchema,
  hp: z.number(),
  currentHp: z.number().optional(),
  maxHp: z.number(),
  attack: z.number(),
  defense: z.number(),
  movement: z.number(),
  remainingMovement: z.number(),
  maxActions: z.number().optional(),
  actionsRemaining: z.number().optional(),
  status: UnitStatusSchema,
  statusEffects: z.array(z.any()).optional(),
  // Enhanced unit abilities
  rallyBuff: z.boolean().optional(),
  tacticalCommand: z.boolean().optional(),
  abilities: z.array(z.string()).default([]),
  level: z.number().default(1),
  experience: z.number().default(0),
  visionRadius: z.number().default(2),
  attackRange: z.number().default(1),
  // Upgrade tracking for visual indicators
  upgrades: z.object({
    attack: z.number().default(0),
    defense: z.number().default(0),
    movement: z.number().default(0),
    vision: z.number().default(0),
  }).optional(),
  hasAttacked: z.boolean().default(false),
});

export type Unit = z.infer<typeof UnitSchema>;

const PerTurnDeltaSchema = z.object({
  stars: z.number().optional(),
  faith: z.number().optional(),
  pride: z.number().optional(),
  dissent: z.number().optional(),
});

const CooldownDeltaSchema = z.object({
  declareWar: z.number().optional(),
  formAlliance: z.number().optional(),
  breakAlliance: z.number().optional(),
  requestTrade: z.number().optional(),
});

export const UnitDefinitionSchema = z.object({
  type: UnitTypeSchema,
  name: z.string(),
  description: z.string(),
  tags: z.array(z.string()).default([]),
  baseStats: z.object({
    hp: z.number(),
    attack: z.number(),
    defense: z.number(),
    movement: z.number(),
    actions: z.number().default(1),
    visionRadius: z.number().default(2),
    attackRange: z.number().default(1),
  }),
  cost: z.number(),
  requirements: z.object({
    faith: z.number().optional(),
    pride: z.number().optional(),
    dissent: z.number().optional(),
  }).optional(),
  passiveEffects: z.object({
    perTurn: PerTurnDeltaSchema.optional(),
    perTurnWhen: z.array(z.object({
      stat: z.enum(['faith', 'pride', 'internalDissent']),
      gte: z.number().optional(),
      lte: z.number().optional(),
      perTurn: PerTurnDeltaSchema,
    })).optional(),
    diplomacyCooldownDelta: z.object({
      stacking: z.enum(['any', 'per_unit']).default('any'),
      perTurn: CooldownDeltaSchema,
    }).optional(),
  }).optional(),
  factionSpecific: z.array(z.string()).default([]),
  abilities: z.array(z.string()).default([]),
  requiredTechnology: z.string().optional(), // Technology required to unlock this unit
});

export type UnitDefinition = z.output<typeof UnitDefinitionSchema>;
export type UnitDefinitionInput = z.input<typeof UnitDefinitionSchema>;
