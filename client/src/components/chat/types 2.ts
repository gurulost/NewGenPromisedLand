import type {
  ChatMessageEventPayload,
  ChatReadUpdateEventPayload,
  ChatTypingEventPayload,
  ChatMessageType,
} from "@shared/types/chatEvents";

export type { ChatMessageType };

export type ChatMessageStatus = "pending" | "sent" | "failed";

export interface ChatMessage extends ChatMessageEventPayload {
  status: ChatMessageStatus;
}

export interface VoiceDraft {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  waveformPeaks: number[];
}

export interface ChatPeek {
  id: string;
  senderName: string;
  type: ChatMessageType;
  previewText: string;
  createdAt: number;
}

export interface TypingIndicator extends ChatTypingEventPayload {
  isTyping: boolean;
}

export interface ChatReadReceipt extends ChatReadUpdateEventPayload {}

export interface ChatIdentity {
  lobbyCode: string;
  userId: number;
  userName: string;
  senderFactionId?: string;
}

export interface ChatLobbyState {
  messages: ChatMessage[];
  unreadCount: number;
  isOpen: boolean;
  peek: ChatPeek | null;
  typingByUserId: Record<string, TypingIndicator>;
  draftText: string;
  voiceDraft: VoiceDraft | null;
  isRecording: boolean;
  lastReadAt: number;
}
