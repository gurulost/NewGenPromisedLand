import { z } from "zod";

export const FactionIdSchema = z.enum([
  "NEPHITES",
  "LAMANITES",
  "MULEKITES",
  "ANTI_NEPHI_LEHIES",
  "ZORAMITES",
  "JAREDITES",
  "HAGOTHS_MARINERS",
  "AMULONITES",
]);

export type FactionId = z.infer<typeof FactionIdSchema>;

/**
 * Coerces untrusted faction strings (e.g. loaded saves) into canonical ids.
 * Returns null when the value is not a recognized faction id.
 */
export const coerceFactionId = (value: unknown): FactionId | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^A-Z_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  const parsed = FactionIdSchema.safeParse(normalized);
  return parsed.success ? parsed.data : null;
};
