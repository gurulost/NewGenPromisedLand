import { z } from "zod";

export const FactionIdSchema = z.enum([
  'NEPHITES',
  'LAMANITES', 
  'MULEKITES',
  'ANTI_NEPHI_LEHIES',
  'ZORAMITES',
  'JAREDITES'
]);

export type FactionId = z.infer<typeof FactionIdSchema>;

export const FactionAbilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  cost: z.number(),
  cooldown: z.number(),
  type: z.enum(['active', 'passive', 'triggered']),
  requirements: z.object({
    faith: z.number().optional(),
    pride: z.number().optional(),
    dissent: z.number().optional(),
  }).optional(),
});

export type FactionAbility = z.infer<typeof FactionAbilitySchema>;

export const FactionSchema = z.object({
  id: FactionIdSchema,
  name: z.string(),
  description: z.string(),
  color: z.string(),
  startingStats: z.object({
    faith: z.number(),
    pride: z.number(),
    internalDissent: z.number(),
  }),
  abilities: z.array(FactionAbilitySchema),
  uniqueUnits: z.array(z.string()),
  playstyle: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
});

export type Faction = z.infer<typeof FactionSchema>;
