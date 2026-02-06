import { describe, expect, it } from "vitest";
import { coerceFactionId } from "./factionId";

describe("coerceFactionId", () => {
  it("returns canonical uppercase ids for valid inputs", () => {
    expect(coerceFactionId("NEPHITES")).toBe("NEPHITES");
    expect(coerceFactionId("lamanites")).toBe("LAMANITES");
    expect(coerceFactionId("Anti_Nephi_Lehies")).toBe("ANTI_NEPHI_LEHIES");
    expect(coerceFactionId("hagoths_mariners")).toBe("HAGOTHS_MARINERS");
    expect(coerceFactionId("AMULONITES")).toBe("AMULONITES");
  });

  it("returns null for unknown faction ids", () => {
    expect(coerceFactionId("UNKNOWN_FACTION")).toBeNull();
  });

  it("returns null for non-string values", () => {
    expect(coerceFactionId(null)).toBeNull();
    expect(coerceFactionId(undefined)).toBeNull();
    expect(coerceFactionId(42)).toBeNull();
  });
});
