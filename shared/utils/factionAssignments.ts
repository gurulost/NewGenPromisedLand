import { coerceFactionId, type FactionId } from "../types/factionId";

export interface FactionAssignmentEntry {
  id: string | number;
  factionId: unknown;
}

export interface CanonicalFactionAssignment {
  id: string | number;
  factionId: FactionId;
}

export function getCanonicalFactionAssignments(
  entries: FactionAssignmentEntry[],
): CanonicalFactionAssignment[] {
  return entries.flatMap((entry) => {
    const factionId = coerceFactionId(entry.factionId);
    return factionId ? [{ id: entry.id, factionId }] : [];
  });
}

export function getTakenFactionIds(entries: FactionAssignmentEntry[]): Set<FactionId> {
  return new Set(getCanonicalFactionAssignments(entries).map((entry) => entry.factionId));
}

export function getDuplicateFactionIds(entries: FactionAssignmentEntry[]): Set<FactionId> {
  const counts = new Map<FactionId, number>();

  getCanonicalFactionAssignments(entries).forEach((entry) => {
    counts.set(entry.factionId, (counts.get(entry.factionId) ?? 0) + 1);
  });

  return new Set(
    Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([factionId]) => factionId),
  );
}

export function isFactionTakenByAnotherEntry(
  entries: FactionAssignmentEntry[],
  factionId: unknown,
  currentId?: string | number,
): boolean {
  const canonicalFactionId = coerceFactionId(factionId);
  if (!canonicalFactionId) {
    return false;
  }

  return getCanonicalFactionAssignments(entries).some(
    (entry) => entry.factionId === canonicalFactionId && entry.id !== currentId,
  );
}
