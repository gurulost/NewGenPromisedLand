import { describe, expect, it } from "vitest";

import { getRandomCityName, resetCityNames } from "../../shared/data/cityNames";
import { getRandomRuinsReward } from "../../shared/data/ruinsRewards";

describe("deterministic shared gameplay randomness", () => {
  it("requires ruins rewards to receive caller-provided seeded randomness", () => {
    expect(() => (getRandomRuinsReward as unknown as () => unknown)()).toThrow(/deterministic random value/);
    expect(() => getRandomRuinsReward(Number.NaN)).toThrow(/deterministic random value/);
    expect(getRandomRuinsReward(0.01).id).toBe("small_treasure");
  });

  it("uses deterministic city-name selection for the same game id", () => {
    resetCityNames("deterministic-city");

    const firstRun = [
      getRandomCityName("NEPHITES", "deterministic-city"),
      getRandomCityName("NEPHITES", "deterministic-city"),
      getRandomCityName("LAMANITES", "deterministic-city"),
    ];

    resetCityNames("deterministic-city");
    const secondRun = [
      getRandomCityName("NEPHITES", "deterministic-city"),
      getRandomCityName("NEPHITES", "deterministic-city"),
      getRandomCityName("LAMANITES", "deterministic-city"),
    ];

    expect(firstRun).toEqual(secondRun);
    expect(new Set(firstRun).size).toBe(firstRun.length);
  });
});
