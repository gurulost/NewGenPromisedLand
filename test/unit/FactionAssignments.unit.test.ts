import { describe, expect, it } from "vitest";

import {
  getDuplicateFactionIds,
  getTakenFactionIds,
  isFactionTakenByAnotherEntry,
} from "../../shared/utils/factionAssignments";

describe("factionAssignments", () => {
  it("tracks taken factions using canonical ids", () => {
    const takenFactionIds = getTakenFactionIds([
      { id: 1, factionId: "nephites" },
      { id: 2, factionId: "Anti Nephi Lehies" },
      { id: 3, factionId: null },
      { id: 4, factionId: "unknown" },
    ]);

    expect(Array.from(takenFactionIds)).toEqual(["NEPHITES", "ANTI_NEPHI_LEHIES"]);
  });

  it("flags duplicate factions after normalization", () => {
    const duplicateFactionIds = getDuplicateFactionIds([
      { id: 1, factionId: "nephites" },
      { id: 2, factionId: "NEPHITES" },
      { id: 3, factionId: "lamanites" },
    ]);

    expect(Array.from(duplicateFactionIds)).toEqual(["NEPHITES"]);
  });

  it("ignores the current seat when checking whether a faction is already taken", () => {
    const entries = [
      { id: 10, factionId: "NEPHITES" },
      { id: 11, factionId: "LAMANITES" },
    ];

    expect(isFactionTakenByAnotherEntry(entries, "nephites", 10)).toBe(false);
    expect(isFactionTakenByAnotherEntry(entries, "lamanites", 10)).toBe(true);
  });
});
