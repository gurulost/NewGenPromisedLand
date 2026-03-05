import { useCallback, useEffect, useMemo, useRef } from "react";

import {
  CHAT_EVENT_NAMES,
  type ChatMessageEventPayload,
  type ChatReadUpdateEventPayload,
  type ChatTypingEventPayload,
} from "@shared/types/chatEvents";

import type { ChatIdentity, ChatMessage, VoiceDraft } from "@/components/chat/types";
import { useChatUIState } from "@/hooks/useChatUIState";

interface ChatChannelEnvelope {
  kind: "message" | "typing-start" | "typing-stop" | "read-update";
  payload:
    | ChatMessageEventPayload
    | ChatTypingEventPayload
    | ChatReadUpdateEventPayload;
}

export interface UseChatChannelResult {
  sendTextMessage: (text: string, options?: { messageId?: string; createdAt?: number }) => Promise<void>;
  sendVoiceMessage: (draft: VoiceDraft, options?: { messageId?: string; createdAt?: number }) => Promise<void>;
  sendTypingStart: () => void;
  sendTypingStop: () => void;
  markRead: () => void;
}

const createMessageId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2)}`;
};

const toDataUrl = async (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Failed to encode audio"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to encode audio"));
    reader.readAsDataURL(blob);
  });

const dispatchWindowEvent = <T,>(eventName: string, payload: T): void => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<T>(eventName, { detail: payload }));
};

export function useChatChannel(identity: ChatIdentity | null): UseChatChannelResult {
  const {
    ensureLobby,
    receiveMessage,
    updateMessage,
    setTypingIndicator,
    clearTypingIndicator,
    pruneTypingIndicators,
    markLobbyRead,
  } = useChatUIState((state) => ({
    ensureLobby: state.ensureLobby,
    receiveMessage: state.receiveMessage,
    updateMessage: state.updateMessage,
    setTypingIndicator: state.setTypingIndicator,
    clearTypingIndicator: state.clearTypingIndicator,
    pruneTypingIndicators: state.pruneTypingIndicators,
    markLobbyRead: state.markLobbyRead,
  }));

  const typingRef = useRef(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const channelName = useMemo(() => {
    if (!identity) return null;
    return `ngpl-chat-${identity.lobbyCode}`;
  }, [identity]);

  useEffect(() => {
    if (!identity) return;
    ensureLobby(identity.lobbyCode);
  }, [ensureLobby, identity]);

  useEffect(() => {
    if (!identity || !channelName || typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel(channelName);
    channelRef.current = channel;

    channel.onmessage = (event: MessageEvent<ChatChannelEnvelope>) => {
      const message = event.data;
      if (!message || typeof message !== "object") return;

      switch (message.kind) {
        case "message": {
          const payload = message.payload as ChatMessageEventPayload;
          if (payload.lobbyCode !== identity.lobbyCode) return;
          const incomingMessage: ChatMessage = {
            ...payload,
            status: "sent",
          };
          receiveMessage(identity.lobbyCode, incomingMessage, {
            activeUserId: identity.userId,
          });
          dispatchWindowEvent(CHAT_EVENT_NAMES.messageNew, payload);
          break;
        }
        case "typing-start": {
          const payload = message.payload as ChatTypingEventPayload;
          if (payload.lobbyCode !== identity.lobbyCode || payload.userId === identity.userId) return;
          setTypingIndicator(identity.lobbyCode, { ...payload, isTyping: true });
          dispatchWindowEvent(CHAT_EVENT_NAMES.typingStart, payload);
          break;
        }
        case "typing-stop": {
          const payload = message.payload as ChatTypingEventPayload;
          if (payload.lobbyCode !== identity.lobbyCode || payload.userId === identity.userId) return;
          clearTypingIndicator(identity.lobbyCode, payload.userId);
          dispatchWindowEvent(CHAT_EVENT_NAMES.typingStop, payload);
          break;
        }
        case "read-update": {
          const payload = message.payload as ChatReadUpdateEventPayload;
          if (payload.lobbyCode !== identity.lobbyCode) return;
          dispatchWindowEvent(CHAT_EVENT_NAMES.readUpdate, payload);
          break;
        }
        default:
          break;
      }
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [channelName, clearTypingIndicator, identity, receiveMessage, setTypingIndicator]);

  useEffect(() => {
    if (!identity) return;
    const interval = window.setInterval(() => {
      pruneTypingIndicators(identity.lobbyCode, Date.now());
    }, 1500);
    return () => {
      window.clearInterval(interval);
    };
  }, [identity, pruneTypingIndicators]);

  const publish = useCallback((envelope: ChatChannelEnvelope) => {
    channelRef.current?.postMessage(envelope);
  }, []);

  const markRead = useCallback(() => {
    if (!identity) return;
    const payload: ChatReadUpdateEventPayload = {
      lobbyCode: identity.lobbyCode,
      userId: identity.userId,
      readAt: Date.now(),
    };
    markLobbyRead(identity.lobbyCode);
    publish({ kind: "read-update", payload });
    dispatchWindowEvent(CHAT_EVENT_NAMES.readUpdate, payload);
  }, [identity, markLobbyRead, publish]);

  const sendTypingStart = useCallback(() => {
    if (!identity || typingRef.current) return;
    typingRef.current = true;
    const payload: ChatTypingEventPayload = {
      lobbyCode: identity.lobbyCode,
      userId: identity.userId,
      userName: identity.userName,
      startedAt: Date.now(),
    };
    publish({ kind: "typing-start", payload });
    dispatchWindowEvent(CHAT_EVENT_NAMES.typingStart, payload);
  }, [identity, publish]);

  const sendTypingStop = useCallback(() => {
    if (!identity || !typingRef.current) return;
    typingRef.current = false;
    const payload: ChatTypingEventPayload = {
      lobbyCode: identity.lobbyCode,
      userId: identity.userId,
      userName: identity.userName,
      startedAt: Date.now(),
    };
    publish({ kind: "typing-stop", payload });
    dispatchWindowEvent(CHAT_EVENT_NAMES.typingStop, payload);
  }, [identity, publish]);

  const sendTextMessage = useCallback(async (text: string, options?: { messageId?: string; createdAt?: number }) => {
    if (!identity) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    const id = options?.messageId ?? createMessageId();
    const now = options?.createdAt ?? Date.now();
    const pendingMessage: ChatMessage = {
      id,
      lobbyCode: identity.lobbyCode,
      senderUserId: identity.userId,
      senderName: identity.userName,
      senderFactionId: identity.senderFactionId,
      type: "text",
      text: trimmed,
      createdAt: now,
      status: "pending",
    };

    receiveMessage(identity.lobbyCode, pendingMessage, {
      activeUserId: identity.userId,
      suppressPeek: true,
    });

    sendTypingStop();

    try {
      await new Promise((resolve) => setTimeout(resolve, 120));
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        throw new Error("offline");
      }

      updateMessage(identity.lobbyCode, id, "sent");

      const payload: ChatMessageEventPayload = {
        id: pendingMessage.id,
        lobbyCode: pendingMessage.lobbyCode,
        senderUserId: pendingMessage.senderUserId,
        senderName: pendingMessage.senderName,
        senderFactionId: pendingMessage.senderFactionId,
        type: pendingMessage.type,
        text: pendingMessage.text,
        createdAt: pendingMessage.createdAt,
      };
      publish({ kind: "message", payload });
      dispatchWindowEvent(CHAT_EVENT_NAMES.messageNew, payload);
    } catch {
      updateMessage(identity.lobbyCode, id, "failed");
    }
  }, [identity, publish, receiveMessage, sendTypingStop, updateMessage]);

  const sendVoiceMessage = useCallback(async (draft: VoiceDraft, options?: { messageId?: string; createdAt?: number }) => {
    if (!identity) return;

    const id = options?.messageId ?? createMessageId();
    const createdAt = options?.createdAt ?? Date.now();
    let encodedAudioUrl: string | undefined;

    const pendingMessage: ChatMessage = {
      id,
      lobbyCode: identity.lobbyCode,
      senderUserId: identity.userId,
      senderName: identity.userName,
      senderFactionId: identity.senderFactionId,
      type: "voice",
      audioDurationMs: draft.durationMs,
      waveformPeaks: draft.waveformPeaks,
      createdAt,
      status: "pending",
    };

    receiveMessage(identity.lobbyCode, pendingMessage, {
      activeUserId: identity.userId,
      suppressPeek: true,
    });

    try {
      encodedAudioUrl = await toDataUrl(draft.blob);
      await new Promise((resolve) => setTimeout(resolve, 120));
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        throw new Error("offline");
      }

      updateMessage(identity.lobbyCode, id, "sent", { audioUrl: encodedAudioUrl });

      const payload: ChatMessageEventPayload = {
        id: pendingMessage.id,
        lobbyCode: pendingMessage.lobbyCode,
        senderUserId: pendingMessage.senderUserId,
        senderName: pendingMessage.senderName,
        senderFactionId: pendingMessage.senderFactionId,
        type: pendingMessage.type,
        audioUrl: encodedAudioUrl,
        audioDurationMs: pendingMessage.audioDurationMs,
        waveformPeaks: pendingMessage.waveformPeaks,
        createdAt: pendingMessage.createdAt,
      };
      publish({ kind: "message", payload });
      dispatchWindowEvent(CHAT_EVENT_NAMES.messageNew, payload);
    } catch {
      updateMessage(identity.lobbyCode, id, "failed", encodedAudioUrl ? { audioUrl: encodedAudioUrl } : undefined);
    }
  }, [identity, publish, receiveMessage, updateMessage]);

  return {
    sendTextMessage,
    sendVoiceMessage,
    sendTypingStart,
    sendTypingStop,
    markRead,
  };
}
