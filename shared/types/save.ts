import { z } from "zod";

import { GameStateSchema } from "./game";

export const SAVE_SCHEMA_VERSION = 1;

export const SaveMetadataSchema = z.object({
  currentPlayer: z.string().trim().min(1).max(80),
  turn: z.number().int().min(1).max(100_000),
  playerCount: z.number().int().min(1).max(16),
  mapSize: z.string().trim().min(1).max(64),
  factions: z.array(z.string().trim().min(1).max(64)).max(16),
});

export const SaveWriteRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  gameState: GameStateSchema,
  metadata: SaveMetadataSchema,
  schemaVersion: z
    .number()
    .int()
    .min(1)
    .max(SAVE_SCHEMA_VERSION)
    .optional()
    .default(SAVE_SCHEMA_VERSION),
});

export type SaveMetadata = z.infer<typeof SaveMetadataSchema>;
export type SaveWriteRequest = z.infer<typeof SaveWriteRequestSchema>;
