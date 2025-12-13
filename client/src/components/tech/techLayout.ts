
import { Technology } from "@shared/data/technologies";

export interface TechPosition {
  x: number;
  y: number;
}

// Manual layout for best visual aesthetics
// x = column (tier), y = vertical slot
export const TECH_LAYOUT: Record<string, TechPosition> = {
  // Tier 1 (Column 0)
  'organization': { x: 0, y: 0 },
  'forestry': { x: 0, y: 1 },
  'hunting': { x: 0, y: 2 },
  'spirituality': { x: 0, y: 3 },

  // Tier 2 (Column 1)
  'agriculture': { x: 1, y: 0 }, // Prereq: Organization
  'bronze_working': { x: 1, y: 1.5 }, // Prereq: Hunting + Organization
  'sailing': { x: 1, y: 3 }, // Prereq: Hunting
  'priesthood': { x: 1, y: 4 }, // Prereq: Spirituality

  // Tier 3 (Column 2)
  'engineering': { x: 2, y: 0.5 }, // Prereq: Bronze + Agriculture
  'leadership': { x: 2, y: 2 },   // Prereq: Bronze + Organization
  'philosophy': { x: 2, y: 4 },   // Prereq: Priesthood + Bronze
};

export const CELL_WIDTH = 280;
export const CELL_HEIGHT = 120;
export const COL_GAP = 100;
export const ROW_GAP = 40;

export const CANVAS_PADDING = 60;
