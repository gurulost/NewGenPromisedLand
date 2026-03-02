import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const R2_ENV_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
] as const;

const ORIGINAL_ENV = { ...process.env };

const resetR2Env = () => {
  for (const key of R2_ENV_KEYS) {
    delete process.env[key];
  }
};

const loadR2Module = async () => {
  vi.resetModules();
  return import("../../server/r2");
};

describe("r2 voice URL helpers", () => {
  beforeEach(() => {
    resetR2Env();
  });

  afterEach(() => {
    resetR2Env();
    Object.assign(process.env, ORIGINAL_ENV);
  });

  it("requires public URL in R2 configuration", async () => {
    process.env.R2_ACCOUNT_ID = "acct";
    process.env.R2_ACCESS_KEY_ID = "key";
    process.env.R2_SECRET_ACCESS_KEY = "secret";
    process.env.R2_BUCKET_NAME = "bucket";
    delete process.env.R2_PUBLIC_URL;

    const mod = await loadR2Module();
    expect(mod.R2_CONFIGURED).toBe(false);
  });

  it("accepts only voice URLs under configured public prefix", async () => {
    process.env.R2_ACCOUNT_ID = "acct";
    process.env.R2_ACCESS_KEY_ID = "key";
    process.env.R2_SECRET_ACCESS_KEY = "secret";
    process.env.R2_BUCKET_NAME = "bucket";
    process.env.R2_PUBLIC_URL = "https://cdn.example.com/chat";

    const mod = await loadR2Module();
    expect(mod.R2_CONFIGURED).toBe(true);
    expect(mod.isVoiceStorageUrl("https://cdn.example.com/chat/voice/ROOM/message.webm")).toBe(true);
    expect(mod.isVoiceStorageUrl("https://cdn.example.com/chat/not-voice/message.webm")).toBe(false);
    expect(mod.isVoiceStorageUrl("https://tracker.example.net/voice/ROOM/message.webm")).toBe(false);
  });

  it("scopes voice URLs to a lobby prefix when requested", async () => {
    process.env.R2_ACCOUNT_ID = "acct";
    process.env.R2_ACCESS_KEY_ID = "key";
    process.env.R2_SECRET_ACCESS_KEY = "secret";
    process.env.R2_BUCKET_NAME = "bucket";
    process.env.R2_PUBLIC_URL = "https://cdn.example.com/chat";

    const mod = await loadR2Module();
    expect(mod.isVoiceStorageUrlForLobby("https://cdn.example.com/chat/voice/ROOMA/message.webm", "ROOMA")).toBe(true);
    expect(mod.isVoiceStorageUrlForLobby("https://cdn.example.com/chat/voice/ROOMB/message.webm", "ROOMA")).toBe(false);
  });
});
