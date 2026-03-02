import { beforeEach, describe, expect, it } from "vitest";

import type { ChatMessage } from "@/components/chat/types";
import { useChatUIState } from "@/hooks/useChatUIState";

const LOBBY_CODE = "ROOM123";

const createMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: "message-1",
  lobbyCode: LOBBY_CODE,
  senderUserId: 99,
  senderName: "Teammate",
  type: "text",
  text: "hello",
  createdAt: Date.now(),
  status: "sent",
  ...overrides,
});

describe("useChatUIState", () => {
  beforeEach(() => {
    useChatUIState.setState({ byLobby: {} });
    window.localStorage.clear();
  });

  it("keeps unread count until explicit read mark after opening", () => {
    const store = useChatUIState.getState();
    store.ensureLobby(LOBBY_CODE);

    store.receiveMessage(LOBBY_CODE, createMessage(), { activeUserId: 7 });
    expect(useChatUIState.getState().byLobby[LOBBY_CODE]?.unreadCount).toBe(1);

    store.setLobbyOpen(LOBBY_CODE, true);
    expect(useChatUIState.getState().byLobby[LOBBY_CODE]?.unreadCount).toBe(1);

    store.markLobbyRead(LOBBY_CODE);
    expect(useChatUIState.getState().byLobby[LOBBY_CODE]?.unreadCount).toBe(0);
  });

  it("does not increment unread for duplicate message ids", () => {
    const store = useChatUIState.getState();
    store.ensureLobby(LOBBY_CODE);

    const incoming = createMessage({ id: "dup-1", text: "first" });
    store.receiveMessage(LOBBY_CODE, incoming, { activeUserId: 7 });
    expect(useChatUIState.getState().byLobby[LOBBY_CODE]?.unreadCount).toBe(1);

    store.receiveMessage(LOBBY_CODE, { ...incoming, text: "updated text" }, { activeUserId: 7 });
    const lobbyState = useChatUIState.getState().byLobby[LOBBY_CODE];
    expect(lobbyState?.unreadCount).toBe(1);
    expect(lobbyState?.messages).toHaveLength(1);
    expect(lobbyState?.messages[0]?.text).toBe("updated text");
  });

  it("does not increment unread for own outbound messages", () => {
    const store = useChatUIState.getState();
    store.ensureLobby(LOBBY_CODE);

    store.receiveMessage(LOBBY_CODE, createMessage({ id: "mine", senderUserId: 7 }), { activeUserId: 7 });
    const lobbyState = useChatUIState.getState().byLobby[LOBBY_CODE];
    expect(lobbyState?.unreadCount).toBe(0);
    expect(lobbyState?.messages).toHaveLength(1);
  });
});
