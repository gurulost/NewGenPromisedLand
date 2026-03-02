import { describe, expect, it } from "vitest";

import {
  appendMessage,
  appendReadEvent,
  appendTypingEvent,
  CHAT_LIMITS,
  createEmptyChatState,
  normalizeLobbyChatState,
  pruneTyping,
  validateIncomingChatMessage,
} from "../../server/chatState";
import { VOICE_LIMITS } from "../../shared/types/voiceLimits";

describe("chatState helpers", () => {
  it("validates text messages", () => {
    const result = validateIncomingChatMessage({
      id: "m1",
      type: "text",
      text: "hello",
      createdAt: Date.now(),
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.message.type).toBe("text");
      expect(result.message.text).toBe("hello");
    }
  });

  it("rejects invalid voice payloads", () => {
    const result = validateIncomingChatMessage({
      id: "m2",
      type: "voice",
      audioUrl: "not-audio",
      audioDurationMs: 1000,
    });
    expect(result.valid).toBe(false);
  });

  it("appends message/read/typing events with monotonic versions", () => {
    const initial = createEmptyChatState();
    const withMessage = appendMessage(initial, {
      id: "m1",
      lobbyCode: "ROOMA",
      senderUserId: 7,
      senderName: "Tester",
      type: "text",
      text: "hey",
      createdAt: 123,
    });
    expect(withMessage.messageVersion).toBe(1);
    expect(withMessage.eventVersion).toBe(1);
    expect(withMessage.events[0]?.kind).toBe("message");

    const withTyping = appendTypingEvent(withMessage, {
      lobbyCode: "ROOMA",
      userId: 7,
      userName: "Tester",
      startedAt: 200,
    }, true);
    expect(withTyping.eventVersion).toBe(2);
    expect(withTyping.typingByUserId["7"]?.userName).toBe("Tester");

    const withRead = appendReadEvent(withTyping, {
      lobbyCode: "ROOMA",
      userId: 7,
      readAt: 300,
    });
    expect(withRead.eventVersion).toBe(3);
    expect(withRead.readByUserId["7"]).toBe(300);
  });

  it("prunes stale typing entries", () => {
    const state = appendTypingEvent(createEmptyChatState(), {
      lobbyCode: "ROOMA",
      userId: 11,
      userName: "Old",
      startedAt: 1,
    }, true);
    const pruned = pruneTyping(state, CHAT_LIMITS.typingTtlMs + 100);
    expect(pruned.typingByUserId["11"]).toBeUndefined();
  });

  it("normalizes malformed chat state safely", () => {
    const normalized = normalizeLobbyChatState({
      messageVersion: "x",
      eventVersion: null,
      messages: [{ id: 1 }],
      events: [{ version: "bad" }],
      typingByUserId: { hello: { userId: "oops" } },
    });
    expect(normalized.messageVersion).toBe(0);
    expect(normalized.eventVersion).toBe(0);
    expect(normalized.messages).toHaveLength(0);
    expect(normalized.events).toHaveLength(0);
    expect(Object.keys(normalized.typingByUserId)).toHaveLength(0);
  });

  it("uses shared voice duration limits", () => {
    expect(CHAT_LIMITS.maxAudioDurationMs).toBe(VOICE_LIMITS.maxDurationMs);
  });
});
