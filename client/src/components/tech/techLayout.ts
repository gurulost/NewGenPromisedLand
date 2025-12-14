
import { Technology } from "@shared/data/technologies";

export interface TechPosition {
  column: number;
  row: number;
}

// Manual layout for best visual aesthetics
// column = tier, row = vertical slot
export const TECH_LAYOUT: Record<string, TechPosition> = {
  // Tier 1 (Column 0)
  organization: { column: 0, row: 0 },
  forestry: { column: 0, row: 1 },
  hunting: { column: 0, row: 2 },
  spirituality: { column: 0, row: 3 },

  // Tier 2 (Column 1)
  agriculture: { column: 1, row: 0 }, // Prereq: Organization
  mining: { column: 1, row: 1 }, // Prereq: Organization
  woodcraft: { column: 1, row: 2 }, // Prereq: Forestry
  irrigation: { column: 1, row: 3 }, // Prereq: Agriculture
  construction: { column: 1, row: 4 }, // Prereq: Organization + Forestry
  bronze_working: { column: 1, row: 5 }, // Prereq: Hunting + Organization
  sailing: { column: 1, row: 6 }, // Prereq: Hunting
  priesthood: { column: 1, row: 7 }, // Prereq: Spirituality
  husbandry: { column: 1, row: 8 }, // Prereq: Hunting

  // Tier 3 (Column 2)
  engineering: { column: 2, row: 0.6 }, // Prereq: Bronze + Agriculture
  leadership: { column: 2, row: 2.1 },   // Prereq: Bronze + Organization
  seafaring: { column: 2, row: 3.6 },   // Prereq: Sailing
  philosophy: { column: 2, row: 5.1 },   // Prereq: Priesthood + Bronze

  // Tier 4 (Column 3)
  fishing: { column: 3, row: 1.2 }, // Prereq: Seafaring
  trade: { column: 3, row: 3.2 }, // Prereq: Organization + Seafaring

  // Tier 5 (Column 4)
  navigation: { column: 4, row: 2.2 }, // Prereq: Seafaring + Trade
};

export const CELL_WIDTH = 280;
export const CELL_HEIGHT = 120;
export const COL_GAP = 100;
export const ROW_GAP = 40;

export const CANVAS_PADDING = 60;
