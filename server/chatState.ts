import type {
  ChatMessageEventPayload,
  ChatMessageRecord,
  ChatReadUpdateEventPayload,
  ChatTransportEvent,
  ChatTypingEventPayload,
} from "@shared/types/chatEvents";

export const CHAT_LIMITS = {
  maxMessages: 240,
  maxEvents: 1000,
  maxTextLength: 800,
  maxAudioDurationMs: 180000,
  maxAudioUrlChars: 2_500_000,
  maxWaveformPeaks: 128,
  typingTtlMs: 5000,
} as const;

export interface LobbyChatState {
  messageVersion: number;
  eventVersion: number;
  messages: ChatMessageRecord[];
  events: ChatTransportEvent[];
  readByUserId: Record<string, number>;
  typingByUserId: Record<string, ChatTypingEventPayload>;
}

export interface ValidatedIncomingMessage {
  id: string;
  type: "text" | "voice";
  text?: string;
  audioUrl?: string;
  audioDurationMs?: number;
  waveformPeaks?: number[];
  createdAt: number;
}

const toFiniteInt = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
};

const normalizeWaveformPeaks = (value: unknown): number[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const normalized = value
    .slice(0, CHAT_LIMITS.maxWaveformPeaks)
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry))
    .map((entry) => Math.min(1, Math.max(0, entry)));
  return normalized.length > 0 ? normalized : undefined;
};

const isAllowedAudioUrl = (value: string): boolean =>
  value.startsWith("data:audio/") ||
  value.startsWith("https://") ||
  value.startsWith("http://") ||
  value.startsWith("/");

const normalizeReadMap = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== "object") return {};
  const entries = Object.entries(value as Record<string, unknown>);
  return entries.reduce<Record<string, number>>((acc, [key, raw]) => {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      acc[key] = parsed;
    }
    return acc;
  }, {});
};

const normalizeTypingMap = (value: unknown): Record<string, ChatTypingEventPayload> => {
  if (!value || typeof value !== "object") return {};
  const entries = Object.entries(value as Record<string, unknown>);
  return entries.reduce<Record<string, ChatTypingEventPayload>>((acc, [key, raw]) => {
    if (!raw || typeof raw !== "object") return acc;
    const userId = Number((raw as Record<string, unknown>).userId);
    const userName = String((raw as Record<string, unknown>).userName ?? "").trim();
    const startedAt = Number((raw as Record<string, unknown>).startedAt);
    const lobbyCode = String((raw as Record<string, unknown>).lobbyCode ?? "").trim();
    if (!Number.isInteger(userId) || userId <= 0 || !userName || !Number.isFinite(startedAt) || !lobbyCode) {
      return acc;
    }
    acc[key] = {
      lobbyCode,
      userId,
      userName: userName.slice(0, 64),
      startedAt: Math.floor(startedAt),
    };
    return acc;
  }, {});
};

const normalizeMessageRecord = (value: unknown): ChatMessageRecord | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = String(raw.id ?? "").trim();
  const lobbyCode = String(raw.lobbyCode ?? "").trim();
  const senderUserId = Number(raw.senderUserId);
  const senderName = String(raw.senderName ?? "").trim();
  const type = raw.type === "voice" ? "voice" : raw.type === "text" ? "text" : null;
  const version = toFiniteInt(raw.version);
  const createdAt = toFiniteInt(raw.createdAt);
  if (!id || !lobbyCode || !Number.isInteger(senderUserId) || senderUserId <= 0 || !senderName || !type || version <= 0 || createdAt <= 0) {
    return null;
  }
  const base: ChatMessageRecord = {
    id: id.slice(0, 128),
    version,
    lobbyCode,
    senderUserId,
    senderName: senderName.slice(0, 64),
    senderFactionId: typeof raw.senderFactionId === "string" ? raw.senderFactionId.slice(0, 64) : undefined,
    type,
    createdAt,
  };
  if (type === "text") {
    const text = String(raw.text ?? "").trim();
    if (!text) return null;
    base.text = text.slice(0, CHAT_LIMITS.maxTextLength);
  } else {
    const audioUrl = String(raw.audioUrl ?? "");
    const audioDurationMs = toFiniteInt(raw.audioDurationMs);
    if (!audioUrl || audioDurationMs <= 0 || audioUrl.length > CHAT_LIMITS.maxAudioUrlChars) return null;
    base.audioUrl = audioUrl;
    base.audioDurationMs = Math.min(audioDurationMs, CHAT_LIMITS.maxAudioDurationMs);
    base.waveformPeaks = normalizeWaveformPeaks(raw.waveformPeaks);
  }
  return base;
};

const normalizeTransportEvent = (value: unknown): ChatTransportEvent | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const version = toFiniteInt(raw.version);
  const kind = raw.kind;
  if (!Number.isFinite(version) || version <= 0) return null;
  if (kind !== "message" && kind !== "typing-start" && kind !== "typing-stop" && kind !== "read-update") {
    return null;
  }
  if (!raw.payload || typeof raw.payload !== "object") return null;
  return {
    version,
    kind,
    payload: raw.payload as ChatTransportEvent["payload"],
  };
};

export const createEmptyChatState = (): LobbyChatState => ({
  messageVersion: 0,
  eventVersion: 0,
  messages: [],
  events: [],
  readByUserId: {},
  typingByUserId: {},
});

export function normalizeLobbyChatState(raw: unknown): LobbyChatState {
  if (!raw || typeof raw !== "object") {
    return createEmptyChatState();
  }
  const source = raw as Record<string, unknown>;
  const messages = Array.isArray(source.messages)
    ? source.messages
        .map((entry) => normalizeMessageRecord(entry))
        .filter((entry): entry is ChatMessageRecord => entry !== null)
        .sort((a, b) => a.version - b.version)
        .slice(-CHAT_LIMITS.maxMessages)
    : [];
  const events = Array.isArray(source.events)
    ? source.events
        .map((entry) => normalizeTransportEvent(entry))
        .filter((entry): entry is ChatTransportEvent => entry !== null)
        .sort((a, b) => a.version - b.version)
        .slice(-CHAT_LIMITS.maxEvents)
    : [];

  const messageVersion = Math.max(
    toFiniteInt(source.messageVersion),
    messages[messages.length - 1]?.version ?? 0,
  );
  const eventVersion = Math.max(
    toFiniteInt(source.eventVersion),
    events[events.length - 1]?.version ?? 0,
  );

  return {
    messageVersion,
    eventVersion,
    messages,
    events,
    readByUserId: normalizeReadMap(source.readByUserId),
    typingByUserId: normalizeTypingMap(source.typingByUserId),
  };
}

export function validateIncomingChatMessage(input: unknown): { valid: true; message: ValidatedIncomingMessage } | { valid: false; error: string } {
  if (!input || typeof input !== "object") {
    return { valid: false, error: "Invalid message payload" };
  }
  const raw = input as Record<string, unknown>;
  const id = String(raw.id ?? "").trim();
  const type = raw.type === "voice" ? "voice" : raw.type === "text" ? "text" : null;
  if (!id || id.length > 128) {
    return { valid: false, error: "Message id is required" };
  }
  if (!type) {
    return { valid: false, error: "Invalid message type" };
  }
  const createdAt = toFiniteInt(raw.createdAt, Date.now());
  if (type === "text") {
    const text = String(raw.text ?? "").trim();
    if (!text) {
      return { valid: false, error: "Message text required" };
    }
    if (text.length > CHAT_LIMITS.maxTextLength) {
      return { valid: false, error: `Message text must be <= ${CHAT_LIMITS.maxTextLength} characters` };
    }
    return {
      valid: true,
      message: {
        id,
        type,
        text,
        createdAt,
      },
    };
  }

  const audioUrl = String(raw.audioUrl ?? "");
  if (!audioUrl || !isAllowedAudioUrl(audioUrl) || audioUrl.length > CHAT_LIMITS.maxAudioUrlChars) {
    return { valid: false, error: "Invalid voice audio payload" };
  }
  const audioDurationMs = toFiniteInt(raw.audioDurationMs);
  if (audioDurationMs <= 0 || audioDurationMs > CHAT_LIMITS.maxAudioDurationMs) {
    return { valid: false, error: `Voice note duration must be between 1 and ${CHAT_LIMITS.maxAudioDurationMs} ms` };
  }

  return {
    valid: true,
    message: {
      id,
      type,
      audioUrl,
      audioDurationMs,
      waveformPeaks: normalizeWaveformPeaks(raw.waveformPeaks),
      createdAt,
    },
  };
}

export function appendMessage(state: LobbyChatState, payload: ChatMessageEventPayload): LobbyChatState {
  const messageVersion = state.messageVersion + 1;
  const eventVersion = state.eventVersion + 1;
  const messageRecord: ChatMessageRecord = {
    ...payload,
    version: messageVersion,
  };
  const messages = [...state.messages, messageRecord].slice(-CHAT_LIMITS.maxMessages);
  const events = [
    ...state.events,
    {
      version: eventVersion,
      kind: "message",
      payload,
    } satisfies ChatTransportEvent,
  ].slice(-CHAT_LIMITS.maxEvents);
  return {
    ...state,
    messageVersion,
    eventVersion,
    messages,
    events,
  };
}

export function appendTypingEvent(
  state: LobbyChatState,
  payload: ChatTypingEventPayload,
  isTyping: boolean,
): LobbyChatState {
  const eventVersion = state.eventVersion + 1;
  const typingByUserId = { ...state.typingByUserId };
  const key = String(payload.userId);
  if (isTyping) {
    typingByUserId[key] = payload;
  } else {
    delete typingByUserId[key];
  }
  const events = [
    ...state.events,
    {
      version: eventVersion,
      kind: isTyping ? "typing-start" : "typing-stop",
      payload,
    } satisfies ChatTransportEvent,
  ].slice(-CHAT_LIMITS.maxEvents);
  return {
    ...state,
    eventVersion,
    typingByUserId,
    events,
  };
}

export function appendReadEvent(
  state: LobbyChatState,
  payload: ChatReadUpdateEventPayload,
): LobbyChatState {
  const eventVersion = state.eventVersion + 1;
  const readByUserId = {
    ...state.readByUserId,
    [String(payload.userId)]: payload.readAt,
  };
  const events = [
    ...state.events,
    {
      version: eventVersion,
      kind: "read-update",
      payload,
    } satisfies ChatTransportEvent,
  ].slice(-CHAT_LIMITS.maxEvents);
  return {
    ...state,
    eventVersion,
    readByUserId,
    events,
  };
}

export function pruneTyping(state: LobbyChatState, now = Date.now()): LobbyChatState {
  const typingByUserId = Object.entries(state.typingByUserId).reduce<Record<string, ChatTypingEventPayload>>(
    (acc, [key, payload]) => {
      if (now - payload.startedAt <= CHAT_LIMITS.typingTtlMs) {
        acc[key] = payload;
      }
      return acc;
    },
    {},
  );
  return {
    ...state,
    typingByUserId,
  };
}
