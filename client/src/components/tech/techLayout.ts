import { TECHNOLOGIES } from '@shared/data/technologies';

export type TechTier = 1 | 2 | 3;

export interface TechLayoutEntry {
  column: number;
  row: number;
  tier: TechTier;
}

export interface TechCoordinates extends TechLayoutEntry {
  x: number;
  y: number;
}

export const TECH_LAYOUT_CONSTANTS = {
  originX: 80,
  originY: 60,
  columnSpacing: 260,
  rowSpacing: 140,
  nodeWidth: 220,
  nodeHeight: 140,
} as const;

const MANUAL_TECH_LAYOUT: Partial<Record<string, TechLayoutEntry>> = {
  organization: { column: 0, row: 0, tier: 1 },
  woodcraft: { column: 0, row: 1, tier: 1 },
  hunting: { column: 0, row: 2, tier: 1 },
  spirituality: { column: 0, row: 4, tier: 1 },
  mining: { column: 1, row: 0.3, tier: 2 },
  agriculture: { column: 1, row: 1.1, tier: 2 },
  seafaring: { column: 1, row: 2, tier: 2 },
  priesthood: { column: 1, row: 4, tier: 2 },
  forestry: { column: 2, row: 1.2, tier: 2 },
  husbandry: { column: 2, row: 1.8, tier: 2 },
  irrigation: { column: 2, row: 2.3, tier: 2 },
  bronze_working: { column: 2, row: 2.8, tier: 2 },
  sailing: { column: 2, row: 3.2, tier: 2 },
  trade: { column: 2, row: 3.8, tier: 2 },
  engineering: { column: 3, row: 2.6, tier: 3 },
  navigation: { column: 3, row: 3.3, tier: 3 },
  leadership: { column: 3, row: 1.6, tier: 3 },
  philosophy: { column: 3, row: 4.2, tier: 3 },
};

const DEPTH_CACHE = new Map<string, number>();

function computeTechDepth(techId: string, stack: Set<string> = new Set()): number {
  if (DEPTH_CACHE.has(techId)) {
    return DEPTH_CACHE.get(techId)!;
  }

  const tech = TECHNOLOGIES[techId];
  if (!tech || tech.prerequisites.length === 0 || stack.has(techId)) {
    DEPTH_CACHE.set(techId, 0);
    return 0;
  }

  stack.add(techId);
  const depth =
    1 +
    Math.max(
      ...tech.prerequisites.map(prereq => computeTechDepth(prereq, stack)),
    );
  stack.delete(techId);
  DEPTH_CACHE.set(techId, depth);
  return depth;
}

function clampTier(depth: number): TechTier {
  if (depth <= 0) return 1;
  if (depth === 1) return 2;
  return 3;
}

const CATEGORY_FALLBACK_COLUMNS: Record<string, number> = {
  economic: 0,
  exploration: 1,
  religious: 2,
  military: 2,
};

function deriveColumn(
  techId: string,
  tier: TechTier,
  override?: Partial<TechLayoutEntry>,
): number {
  if (typeof override?.column === 'number') {
    return override.column;
  }

  const tech = TECHNOLOGIES[techId];
  if (tech) {
    const categoryColumn = CATEGORY_FALLBACK_COLUMNS[tech.category];
    if (typeof categoryColumn === 'number') {
      return Math.min(categoryColumn + tier - 1, 3);
    }
  }

  return Math.min(tier - 1, 3);
}

function buildTechLayout(): Record<string, TechLayoutEntry> {
  const layout: Record<string, TechLayoutEntry> = {};
  const techIds = Object.keys(TECHNOLOGIES);

  // Compute tiers/columns upfront
  const columnBuckets = new Map<number, Array<{ id: string; override?: TechLayoutEntry; tier: TechTier }>>();

  techIds.forEach(techId => {
    const override = MANUAL_TECH_LAYOUT[techId];
    const depth = computeTechDepth(techId);
    const tier = override?.tier ?? clampTier(depth);
    const column = deriveColumn(techId, tier, override);
    const bucket = columnBuckets.get(column) ?? [];
    bucket.push({ id: techId, override, tier });
    columnBuckets.set(column, bucket);
  });

  const sortedColumns = Array.from(columnBuckets.keys()).sort((a, b) => a - b);
  const COLUMN_SPACING = 1; // base distance between rows

  sortedColumns.forEach(column => {
    const entries = columnBuckets.get(column)!;
    if (column === 0) {
      let cursor = 0;
      entries
        .sort((a, b) => (a.override?.row ?? 0) - (b.override?.row ?? 0))
        .forEach(entry => {
          const row = typeof entry.override?.row === 'number' ? entry.override.row : cursor;
          layout[entry.id] = { column, row, tier: entry.tier };
          cursor = typeof entry.override?.row === 'number' ? Math.max(cursor, entry.override.row + COLUMN_SPACING) : cursor + COLUMN_SPACING;
        });
      return;
    }

    let fallbackCursor = 0;
    const fallbackOrder = entries.map(e => ({
      ...e,
      baseRow: (() => {
        if (typeof e.override?.row === 'number') {
          return e.override.row;
        }
        const prereqs = TECHNOLOGIES[e.id].prerequisites.filter(prereq => layout[prereq]);
        if (prereqs.length === 0) {
          const row = fallbackCursor;
          fallbackCursor += COLUMN_SPACING;
          return row;
        }
        const sum = prereqs.reduce((acc, prereq) => acc + layout[prereq].row, 0);
        return sum / prereqs.length;
      })(),
    }));

    fallbackOrder.sort((a, b) => a.baseRow - b.baseRow || a.id.localeCompare(b.id));

    let lastRow = Number.NEGATIVE_INFINITY;
    fallbackOrder.forEach(entry => {
      let targetRow =
        typeof entry.override?.row === 'number' ? entry.override.row : entry.baseRow;

      if (targetRow <= lastRow + (COLUMN_SPACING * 0.7)) {
        targetRow = lastRow + COLUMN_SPACING;
      }

      layout[entry.id] = { column, row: targetRow, tier: entry.tier };
      lastRow = targetRow;
    });
  });

  return layout;
}

export const TECH_LAYOUT: Record<string, TechLayoutEntry> = buildTechLayout();

const layoutEntries = Object.values(TECH_LAYOUT);

const maxColumn = layoutEntries.reduce((max, entry) => Math.max(max, entry.column), 0);
const maxRow = layoutEntries.reduce((max, entry) => Math.max(max, entry.row), 0);

export const TECH_CANVAS_SIZE = {
  width:
    TECH_LAYOUT_CONSTANTS.originX * 2 +
    TECH_LAYOUT_CONSTANTS.nodeWidth +
    TECH_LAYOUT_CONSTANTS.columnSpacing * maxColumn,
  height:
    TECH_LAYOUT_CONSTANTS.originY * 2 +
    TECH_LAYOUT_CONSTANTS.nodeHeight +
    TECH_LAYOUT_CONSTANTS.rowSpacing * maxRow,
};

export const TECH_TIER_LABELS: Record<TechTier, { short: string; long: string }> = {
  1: { short: 'Tier I', long: 'Tier I – Foundation' },
  2: { short: 'Tier II', long: 'Tier II – Expansion' },
  3: { short: 'Tier III', long: 'Tier III – Mastery' },
};

export const TECH_COLUMN_LABELS: Record<number, string> = {
  0: 'Foundation',
  1: 'Expansion',
  2: 'Specialization',
  3: 'Mastery',
};

export function getTechCoordinates(techId: string): TechCoordinates | null {
  const layout = TECH_LAYOUT[techId];
  if (!layout) {
    return null;
  }

  return {
    ...layout,
    x: TECH_LAYOUT_CONSTANTS.originX + layout.column * TECH_LAYOUT_CONSTANTS.columnSpacing,
    y: TECH_LAYOUT_CONSTANTS.originY + layout.row * TECH_LAYOUT_CONSTANTS.rowSpacing,
  };
}
