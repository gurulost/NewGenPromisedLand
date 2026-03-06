import { describe, expect, it } from "vitest";

import {
  buildAnimationLabAccessStatus,
  getAnimationLabAccessConfig,
  getAnimationLabAccessExpiryMs,
  isAnimationLabAccessConfigured,
  isAnimationLabSessionUnlocked,
  unlockAnimationLabSession,
  verifyAnimationLabAnswer,
} from "../../server/animationLabAccess";

describe("animationLabAccess helpers", () => {
  it("builds a production config with the default question and normalized answer", () => {
    const config = getAnimationLabAccessConfig({
      NODE_ENV: "production",
      ANIMATION_LAB_ACCESS_ANSWER: "  Muffin  ",
    });

    expect(config.isProduction).toBe(true);
    expect(config.question).toBe("Who was the queen of all cats, born in a garage?");
    expect(config.answer).toBe("muffin");
    expect(config.ttlMs).toBe(12 * 60 * 60 * 1000);
  });

  it("treats development as always allowed", () => {
    const config = getAnimationLabAccessConfig({ NODE_ENV: "development" });

    expect(isAnimationLabAccessConfigured(config)).toBe(true);
    expect(isAnimationLabSessionUnlocked({}, config, Date.now())).toBe(true);
  });

  it("verifies the answer case-insensitively and ignores extra whitespace", () => {
    const config = getAnimationLabAccessConfig({
      NODE_ENV: "production",
      ANIMATION_LAB_ACCESS_ANSWER: "Muffin",
    });

    expect(verifyAnimationLabAnswer("  muffin  ", config)).toBe(true);
    expect(verifyAnimationLabAnswer("MuFfIn", config)).toBe(true);
    expect(verifyAnimationLabAnswer("garage", config)).toBe(false);
  });

  it("expires production access after the configured ttl", () => {
    const config = getAnimationLabAccessConfig({
      NODE_ENV: "production",
      ANIMATION_LAB_ACCESS_ANSWER: "Muffin",
      ANIMATION_LAB_ACCESS_TTL_HOURS: "1",
    });
    const session: { animationLabUnlockedAt?: number } = {};
    const unlockedAt = Date.parse("2026-03-06T10:00:00.000Z");

    unlockAnimationLabSession(session as any, unlockedAt);

    expect(getAnimationLabAccessExpiryMs(session as any, config)).toBe(unlockedAt + 60 * 60 * 1000);
    expect(isAnimationLabSessionUnlocked(session as any, config, unlockedAt + 59 * 60 * 1000)).toBe(true);
    expect(isAnimationLabSessionUnlocked(session as any, config, unlockedAt + 60 * 60 * 1000)).toBe(false);
  });

  it("builds a locked status when production access is not configured", () => {
    const config = getAnimationLabAccessConfig({ NODE_ENV: "production" });
    const status = buildAnimationLabAccessStatus({}, config, Date.now());

    expect(status.allowed).toBe(false);
    expect(status.configured).toBe(false);
    expect(status.requiresUnlock).toBe(true);
    expect(status.expiresAt).toBeNull();
  });
});
