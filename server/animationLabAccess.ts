import { createHash, timingSafeEqual } from "crypto";

import type { SessionData } from "express-session";

const DEFAULT_ANIMATION_LAB_QUESTION = "Who was the queen of all cats, born in a garage?";
const DEFAULT_ANIMATION_LAB_TTL_MS = 12 * 60 * 60 * 1000;

export interface AnimationLabAccessConfig {
  isProduction: boolean;
  question: string;
  answer: string | null;
  ttlMs: number;
}

export interface AnimationLabAccessStatus {
  allowed: boolean;
  unlocked: boolean;
  requiresUnlock: boolean;
  configured: boolean;
  question: string;
  expiresAt: string | null;
}

const normalizeAnswer = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

const toHashBuffer = (value: string): Buffer =>
  createHash("sha256").update(value).digest();

export function getAnimationLabAccessConfig(env: NodeJS.ProcessEnv = process.env): AnimationLabAccessConfig {
  const ttlHours = Number.parseInt(env.ANIMATION_LAB_ACCESS_TTL_HOURS ?? "12", 10);
  const ttlMs = Number.isFinite(ttlHours) && ttlHours > 0
    ? ttlHours * 60 * 60 * 1000
    : DEFAULT_ANIMATION_LAB_TTL_MS;
  const rawAnswer = env.ANIMATION_LAB_ACCESS_ANSWER?.trim();

  return {
    isProduction: env.NODE_ENV === "production",
    question: env.ANIMATION_LAB_ACCESS_QUESTION?.trim() || DEFAULT_ANIMATION_LAB_QUESTION,
    answer: rawAnswer ? normalizeAnswer(rawAnswer) : null,
    ttlMs,
  };
}

export function isAnimationLabAccessConfigured(config: AnimationLabAccessConfig): boolean {
  return !config.isProduction || Boolean(config.answer);
}

export function getAnimationLabAccessExpiryMs(
  session: Pick<SessionData, "animationLabUnlockedAt"> | null | undefined,
  config: AnimationLabAccessConfig,
): number | null {
  if (!config.isProduction) return null;
  const unlockedAt = session?.animationLabUnlockedAt;
  if (!Number.isFinite(unlockedAt) || typeof unlockedAt !== "number") return null;
  return unlockedAt + config.ttlMs;
}

export function isAnimationLabSessionUnlocked(
  session: Pick<SessionData, "animationLabUnlockedAt"> | null | undefined,
  config: AnimationLabAccessConfig,
  now = Date.now(),
): boolean {
  if (!config.isProduction) return true;
  if (!isAnimationLabAccessConfigured(config)) return false;
  const expiresAt = getAnimationLabAccessExpiryMs(session, config);
  return typeof expiresAt === "number" && expiresAt > now;
}

export function buildAnimationLabAccessStatus(
  session: Pick<SessionData, "animationLabUnlockedAt"> | null | undefined,
  config: AnimationLabAccessConfig,
  now = Date.now(),
): AnimationLabAccessStatus {
  const configured = isAnimationLabAccessConfigured(config);
  const unlocked = isAnimationLabSessionUnlocked(session, config, now);
  const expiresAt = getAnimationLabAccessExpiryMs(session, config);

  return {
    allowed: unlocked,
    unlocked,
    requiresUnlock: config.isProduction,
    configured,
    question: config.question,
    expiresAt: typeof expiresAt === "number" && expiresAt > now
      ? new Date(expiresAt).toISOString()
      : null,
  };
}

export function verifyAnimationLabAnswer(answer: string, config: AnimationLabAccessConfig): boolean {
  if (!isAnimationLabAccessConfigured(config)) return false;
  if (!config.answer) return !config.isProduction;

  const normalizedInput = normalizeAnswer(answer);
  if (!normalizedInput) return false;

  const expectedHash = toHashBuffer(config.answer);
  const inputHash = toHashBuffer(normalizedInput);
  return timingSafeEqual(expectedHash, inputHash);
}

export function unlockAnimationLabSession(
  session: SessionData,
  now = Date.now(),
): void {
  session.animationLabUnlockedAt = now;
}

export function clearAnimationLabSession(session: SessionData): void {
  delete session.animationLabUnlockedAt;
}
