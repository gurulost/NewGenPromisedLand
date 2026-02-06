import { describe, expect, it } from "vitest";

import { FactionPersonalityEngine } from "../../shared/ai/aiFactionPersonality";
import type { PlayerState } from "../../shared/types/game";

const makePlayer = (id: string, factionId: string): PlayerState => ({
  id,
  name: id,
  factionId,
  isAI: true,
  aiDifficulty: "normal",
  stars: 10,
  stats: { faith: 50, pride: 30, internalDissent: 10 },
  modifiers: [],
  researchedTechs: [],
  researchProgress: 0,
  researchInspiration: 0,
  abilityCooldowns: {},
  citiesOwned: [],
  constructionQueue: [],
  visibilityMask: [],
  exploredTiles: [],
  isEliminated: false,
  turnOrder: 0,
  atWarWith: [],
  alliedWith: [],
  tradeRoutes: [],
  diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
});

describe("Faction personality mapping", () => {
  it("maps uppercase Hagoth faction IDs to the Hagoth personality template", () => {
    const engine = new FactionPersonalityEngine(makePlayer("p1", "HAGOTHS_MARINERS"), 1337);
    const personality = engine.getPersonality();

    expect(personality.preferredVictory).toBe("economic");
    expect(personality.unitPreferences).toContain("voyager");
    expect(personality.unitPreferences).toContain("shipwright");
  });

  it("maps uppercase Amulonite faction IDs to the Amulonite personality template", () => {
    const engine = new FactionPersonalityEngine(makePlayer("p2", "AMULONITES"), 1337);
    const personality = engine.getPersonality();

    expect(personality.preferredVictory).toBe("conquest");
    expect(personality.unitPreferences).toContain("amulonite_enforcer");
    expect(personality.unitPreferences).toContain("taskmaster");
  });

  it("normalizes underscore faction IDs like ANTI_NEPHI_LEHIES", () => {
    const engine = new FactionPersonalityEngine(makePlayer("p3", "ANTI_NEPHI_LEHIES"), 1337);
    const personality = engine.getPersonality();

    expect(personality.unitPreferences).toContain("worker");
  });

  it("accepts legacy punctuation/casing faction IDs", () => {
    const engine = new FactionPersonalityEngine(makePlayer("p4", "Hagoth's Mariners"), 1337);
    const personality = engine.getPersonality();

    expect(personality.preferredVictory).toBe("economic");
    expect(personality.unitPreferences).toContain("voyager");
  });
});
