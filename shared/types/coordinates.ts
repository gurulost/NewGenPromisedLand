import { z } from "zod";

// Hexagonal coordinate system types
export const HexCoordinateSchema = z.object({
  q: z.number(),
  r: z.number(),
  s: z.number(),
});

export type HexCoordinate = z.infer<typeof HexCoordinateSchema>;