import { create } from "zustand";

import type {
  ChatLobbyState,
  ChatMessage,
  ChatMessageStatus,
  ChatPeek,
  TypingIndicator,
  VoiceDraft,
} from "@/components/chat/types";

const MAX_MESSAGES_PER_LOBBY = 200;

const getStorageKey = (lobbyCode: string) => `chat_messages_${lobbyCode}`;

const readStoredMessages = (lobbyCode: string): ChatMessage[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(getStorageKey(lobbyCode));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => !!entry && typeof entry.id === "string")
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-MAX_MESSAGES_PER_LOBBY);
  } catch {
    return [];
  }
};

const writeStoredMessages = (lobbyCode: string, messages: ChatMessage[]): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getStorageKey(lobbyCode), JSON.stringify(messages.slice(-MAX_MESSAGES_PER_LOBBY)));
  } catch {
    // Ignore quota/storage failures.
  }
};

const createLobbyState = (): ChatLobbyState => ({
  messages: [],
  unreadCount: 0,
  isOpen: false,
  peek: null,
  typingByUserId: {},
  draftText: "",
  voiceDraft: null,
  isRecording: false,
  lastReadAt: 0,
});

const withLobbyState = (
  state: ChatStore,
  lobbyCode: string,
  updater: (lobbyState: ChatLobbyState) => ChatLobbyState,
): Record<string, ChatLobbyState> => {
  const existing = state.byLobby[lobbyCode] ?? createLobbyState();
  return {
    ...state.byLobby,
    [lobbyCode]: updater(existing),
  };
};

const upsertMessages = (messages: ChatMessage[], nextMessage: ChatMessage): ChatMessage[] => {
  const existingIndex = messages.findIndex((entry) => entry.id === nextMessage.id);
  if (existingIndex === -1) {
    return [...messages, nextMessage]
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-MAX_MESSAGES_PER_LOBBY);
  }
  const updated = [...messages];
  updated[existingIndex] = {
    ...updated[existingIndex],
    ...nextMessage,
  };
  return updated.sort((a, b) => a.createdAt - b.createdAt).slice(-MAX_MESSAGES_PER_LOBBY);
};

const formatVoicePeekDuration = (durationMs?: number): string => {
  const totalSeconds = Math.max(1, Math.round((durationMs ?? 0) / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${mins}:${String(seconds).padStart(2, "0")}`;
};

interface ReceiveMessageOptions {
  activeUserId?: number;
  suppressPeek?: boolean;
}

interface ChatStore {
  byLobby: Record<string, ChatLobbyState>;

  ensureLobby: (lobbyCode: string) => void;
  getLobbyState: (lobbyCode: string) => ChatLobbyState;
  setLobbyOpen: (lobbyCode: string, isOpen: boolean) => void;
  consumePeek: (lobbyCode: string) => void;
  setDraftText: (lobbyCode: string, text: string) => void;
  setVoiceDraft: (lobbyCode: string, draft: VoiceDraft | null) => void;
  setRecordingState: (lobbyCode: string, isRecording: boolean) => void;
  markLobbyRead: (lobbyCode: string) => void;
  setTypingIndicator: (lobbyCode: string, indicator: TypingIndicator) => void;
  clearTypingIndicator: (lobbyCode: string, userId: number) => void;
  pruneTypingIndicators: (lobbyCode: string, now: number) => void;
  receiveMessage: (lobbyCode: string, message: ChatMessage, options?: ReceiveMessageOptions) => void;
  updateMessage: (lobbyCode: string, messageId: string, status: ChatMessageStatus, patch?: Partial<ChatMessage>) => void;
  replaceMessages: (lobbyCode: string, messages: ChatMessage[]) => void;
  hydrateMessages: (lobbyCode: string) => void;
}

export const useChatUIState = create<ChatStore>((set, get) => ({
  byLobby: {},

  ensureLobby: (lobbyCode) => {
    if (get().byLobby[lobbyCode]) return;
    const hydrated = readStoredMessages(lobbyCode);
    set((state) => ({
      byLobby: {
        ...state.byLobby,
        [lobbyCode]: {
          ...createLobbyState(),
          messages: hydrated,
        },
      },
    }));
  },

  getLobbyState: (lobbyCode) => get().byLobby[lobbyCode] ?? createLobbyState(),

  setLobbyOpen: (lobbyCode, isOpen) => {
    set((state) => ({
      byLobby: withLobbyState(state, lobbyCode, (lobbyState) => ({
        ...lobbyState,
        isOpen,
        peek: isOpen ? null : lobbyState.peek,
      })),
    }));
  },

  consumePeek: (lobbyCode) => {
    set((state) => ({
      byLobby: withLobbyState(state, lobbyCode, (lobbyState) => ({
        ...lobbyState,
        peek: null,
      })),
    }));
  },

  setDraftText: (lobbyCode, text) => {
    set((state) => ({
      byLobby: withLobbyState(state, lobbyCode, (lobbyState) => ({
        ...lobbyState,
        draftText: text,
      })),
    }));
  },

  setVoiceDraft: (lobbyCode, draft) => {
    set((state) => ({
      byLobby: withLobbyState(state, lobbyCode, (lobbyState) => ({
        ...lobbyState,
        voiceDraft: draft,
      })),
    }));
  },

  setRecordingState: (lobbyCode, isRecording) => {
    set((state) => ({
      byLobby: withLobbyState(state, lobbyCode, (lobbyState) => ({
        ...lobbyState,
        isRecording,
      })),
    }));
  },

  markLobbyRead: (lobbyCode) => {
    set((state) => ({
      byLobby: withLobbyState(state, lobbyCode, (lobbyState) => ({
        ...lobbyState,
        unreadCount: 0,
        peek: null,
        lastReadAt: Date.now(),
      })),
    }));
  },

  setTypingIndicator: (lobbyCode, indicator) => {
    const key = String(indicator.userId);
    set((state) => ({
      byLobby: withLobbyState(state, lobbyCode, (lobbyState) => ({
        ...lobbyState,
        typingByUserId: {
          ...lobbyState.typingByUserId,
          [key]: indicator,
        },
      })),
    }));
  },

  clearTypingIndicator: (lobbyCode, userId) => {
    const key = String(userId);
    set((state) => ({
      byLobby: withLobbyState(state, lobbyCode, (lobbyState) => {
        if (!lobbyState.typingByUserId[key]) return lobbyState;
        const typingByUserId = { ...lobbyState.typingByUserId };
        delete typingByUserId[key];
        return {
          ...lobbyState,
          typingByUserId,
        };
      }),
    }));
  },

  pruneTypingIndicators: (lobbyCode, now) => {
    set((state) => ({
      byLobby: withLobbyState(state, lobbyCode, (lobbyState) => {
        const nextTyping = Object.entries(lobbyState.typingByUserId).reduce<Record<string, TypingIndicator>>(
          (acc, [key, value]) => {
            if (now - value.startedAt <= 4000) {
              acc[key] = value;
            }
            return acc;
          },
          {},
        );
        return {
          ...lobbyState,
          typingByUserId: nextTyping,
        };
      }),
    }));
  },

  receiveMessage: (lobbyCode, message, options) => {
    const { activeUserId, suppressPeek } = options ?? {};
    set((state) => {
      const prevLobby = state.byLobby[lobbyCode] ?? createLobbyState();
      const hadMessage = prevLobby.messages.some((entry) => entry.id === message.id);
      const nextMessages = upsertMessages(prevLobby.messages, message);
      const isOwnMessage = typeof activeUserId === "number" && message.senderUserId === activeUserId;
      const isChatFocused =
        typeof document === "undefined"
          ? true
          : document.visibilityState === "visible" && document.hasFocus();
      const shouldTreatOpenAsRead = prevLobby.isOpen && isChatFocused;
      const shouldIncrementUnread = !hadMessage && !isOwnMessage && !shouldTreatOpenAsRead;
      const nextUnreadCount = shouldIncrementUnread ? prevLobby.unreadCount + 1 : prevLobby.unreadCount;

      const previewText = message.type === "voice"
        ? `Voice note • ${formatVoicePeekDuration(message.audioDurationMs)}`
        : (message.text ?? "").slice(0, 88);

      const peek: ChatPeek | null = shouldIncrementUnread && !suppressPeek
        ? {
            id: message.id,
            senderName: message.senderName,
            type: message.type,
            previewText,
            createdAt: Date.now(),
          }
        : prevLobby.peek;

      writeStoredMessages(lobbyCode, nextMessages);

      return {
        byLobby: {
          ...state.byLobby,
          [lobbyCode]: {
            ...prevLobby,
            messages: nextMessages,
            unreadCount: nextUnreadCount,
            peek,
          },
        },
      };
    });
  },

  updateMessage: (lobbyCode, messageId, status, patch) => {
    set((state) => {
      const prevLobby = state.byLobby[lobbyCode] ?? createLobbyState();
      const nextMessages = prevLobby.messages.map((message) =>
        message.id === messageId
          ? {
              ...message,
              ...patch,
              status,
            }
          : message,
      );
      writeStoredMessages(lobbyCode, nextMessages);
      return {
        byLobby: {
          ...state.byLobby,
          [lobbyCode]: {
            ...prevLobby,
            messages: nextMessages,
          },
        },
      };
    });
  },

  replaceMessages: (lobbyCode, messages) => {
    const sortedMessages = [...messages]
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-MAX_MESSAGES_PER_LOBBY);
    set((state) => ({
      byLobby: withLobbyState(state, lobbyCode, (lobbyState) => ({
        ...lobbyState,
        messages: sortedMessages,
      })),
    }));
    writeStoredMessages(lobbyCode, sortedMessages);
  },

  hydrateMessages: (lobbyCode) => {
    const stored = readStoredMessages(lobbyCode);
    set((state) => ({
      byLobby: withLobbyState(state, lobbyCode, (lobbyState) => ({
        ...lobbyState,
        messages: stored,
      })),
    }));
  },
}));
