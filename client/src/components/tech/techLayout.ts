
import { Technology } from "@shared/data/technologies";

export interface TechPosition {
  column: number;
  row: number;
}

// Tech tree layout organized by category lanes:
// Rows 0-3: Economic (★)
// Rows 4-5: Military (⚔)
// Row 6: Religious (☀)
// Rows 7-8: Exploration (🐍)

export const TECH_LAYOUT: Record<string, TechPosition> = {
  // ═══════════════════════════════════════════════════════════════
  // ECONOMIC LANE (Rows 0-3)
  // ═══════════════════════════════════════════════════════════════

  // Column 0 (Starting)
  organization: { column: 0, row: 0 },
  forestry: { column: 0, row: 1 },

  // Column 1
  agriculture: { column: 1, row: 0 },     // ← Organization
  woodcraft: { column: 1, row: 1 },       // ← Forestry
  mining: { column: 1, row: 2 },          // ← Organization
  irrigation: { column: 1, row: 3 },      // ← Agriculture
  husbandry: { column: 1, row: 2.5 },     // ← Hunting (cross-category, Economic tech)

  // Column 2
  construction: { column: 2, row: 1 },    // ← Organization + Forestry

  // Column 3
  trade: { column: 3, row: 0 },           // ← Organization + Seafaring (cross-category!)
  fishing: { column: 3, row: 1 },         // ← Seafaring (cross-category!)

  // ═══════════════════════════════════════════════════════════════
  // MILITARY LANE (Rows 4-5)
  // ═══════════════════════════════════════════════════════════════

  // Column 0 (Starting)
  hunting: { column: 0, row: 4 },

  // Column 1
  bronze_working: { column: 1, row: 4 },  // ← Hunting + Organization (cross-category!)

  // Column 2
  leadership: { column: 2, row: 4 },      // ← Bronze + Organization (cross-category!)
  engineering: { column: 2, row: 5 },     // ← Bronze + Agriculture (Military tech!)

  // ═══════════════════════════════════════════════════════════════
  // RELIGIOUS LANE (Row 6)
  // ═══════════════════════════════════════════════════════════════

  // Column 0 (Starting)
  spirituality: { column: 0, row: 6 },

  // Column 1
  priesthood: { column: 1, row: 6 },      // ← Spirituality

  // Column 2
  philosophy: { column: 2, row: 6 },      // ← Priesthood + Bronze (cross-category!)

  // ═══════════════════════════════════════════════════════════════
  // EXPLORATION LANE (Rows 7-8)
  // ═══════════════════════════════════════════════════════════════

  // Column 1 (no starting exploration tech - branches from hunting)
  sailing: { column: 1, row: 7 },         // ← Hunting (cross-category!)

  // Column 2
  seafaring: { column: 2, row: 7 },       // ← Sailing

  // Column 3
  navigation: { column: 3, row: 7 },      // ← Seafaring + Trade (cross-category!)
};

export const CELL_WIDTH = 280;
export const CELL_HEIGHT = 120;
export const COL_GAP = 100;
export const ROW_GAP = 40;

export const CANVAS_PADDING = 60;

// Lane Y positions for background rendering
export const CATEGORY_LANES = {
  economic: { startRow: 0, endRow: 3, color: 'rgba(251, 191, 36, 0.05)' },   // amber
  military: { startRow: 4, endRow: 5, color: 'rgba(239, 68, 68, 0.05)' },    // red
  religious: { startRow: 6, endRow: 6, color: 'rgba(59, 130, 246, 0.05)' },  // blue
  exploration: { startRow: 7, endRow: 7, color: 'rgba(20, 184, 166, 0.05)' }, // teal
};
