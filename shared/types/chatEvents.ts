export const CHAT_EVENT_NAMES = {
  messageNew: "chat:message:new",
  typingStart: "chat:typing:start",
  typingStop: "chat:typing:stop",
  readUpdate: "chat:read:update",
} as const;

export type ChatEventName = typeof CHAT_EVENT_NAMES[keyof typeof CHAT_EVENT_NAMES];

export type ChatMessageType = "text" | "voice";

export interface ChatMessageEventPayload {
  id: string;
  lobbyCode: string;
  senderUserId: number;
  senderName: string;
  senderFactionId?: string;
  type: ChatMessageType;
  text?: string;
  audioUrl?: string;
  audioDurationMs?: number;
  waveformPeaks?: number[];
  createdAt: number;
}

export interface ChatTypingEventPayload {
  lobbyCode: string;
  userId: number;
  userName: string;
  startedAt: number;
}

export interface ChatReadUpdateEventPayload {
  lobbyCode: string;
  userId: number;
  readAt: number;
}

export type ChatTransportEventKind = "message" | "typing-start" | "typing-stop" | "read-update";

export interface ChatMessageRecord extends ChatMessageEventPayload {
  version: number;
}

export type ChatTransportEventPayload =
  | ChatMessageEventPayload
  | ChatTypingEventPayload
  | ChatReadUpdateEventPayload;

export interface ChatTransportEvent {
  version: number;
  kind: ChatTransportEventKind;
  payload: ChatTransportEventPayload;
}

export interface ChatMessagesResponse {
  messageVersion: number;
  eventVersion: number;
  messages: ChatMessageRecord[];
}

export interface ChatEventsResponse {
  eventVersion: number;
  events: ChatTransportEvent[];
  eventsTruncated?: boolean;
}
