import { useCallback, useEffect, useRef } from "react";

import {
  CHAT_EVENT_NAMES,
  type ChatEventsResponse,
  type ChatMessageEventPayload,
  type ChatMessagesResponse,
  type ChatReadUpdateEventPayload,
  type ChatTransportEvent,
  type ChatTypingEventPayload,
} from "@shared/types/chatEvents";

import { VOICE_LIMITS } from "@shared/types/voiceLimits";

import type { ChatIdentity, ChatMessage, VoiceDraft } from "@/components/chat/types";
import { useChatUIState } from "@/hooks/useChatUIState";

const POLL_INTERVAL_MS = 1200;

export interface UseChatChannelResult {
  sendTextMessage: (text: string, options?: { messageId?: string; createdAt?: number }) => Promise<void>;
  sendVoiceMessage: (draft: VoiceDraft, options?: { messageId?: string; createdAt?: number }) => Promise<void>;
  retryVoiceMessage: (message: { id: string; audioUrl?: string; audioDurationMs?: number; waveformPeaks?: number[]; createdAt: number }) => Promise<void>;
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

interface PresignedUploadResponse {
  uploadUrl: string;
  objectKey: string;
  publicUrl: string;
  expiresInSeconds: number;
}

const isHttpsAudioUrl = (value: string | undefined): value is string =>
  typeof value === "string" && value.startsWith("https://");

const uploadVoiceBlob = async (
  blob: Blob,
  lobbyCode: string,
  messageId: string,
  durationMs: number
): Promise<string> => {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error("Voice note duration is unavailable. Please re-record.");
  }
  if (blob.size > VOICE_LIMITS.maxBytes) {
    throw new Error(`Voice note too large (max ${VOICE_LIMITS.maxBytes / 1024 / 1024} MB)`);
  }
  if (durationMs > VOICE_LIMITS.maxDurationMs) {
    throw new Error(`Voice note too long (max ${VOICE_LIMITS.maxDurationMs / 1000}s)`);
  }

  const presignRes = await fetch(
    `/api/lobbies/${encodeURIComponent(lobbyCode)}/chat/voice-upload`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messageId,
        mimeType: blob.type || "audio/webm",
        contentLength: blob.size,
        durationMs,
      }),
      credentials: "include",
    }
  );

  if (!presignRes.ok) {
    const body = await presignRes.json().catch(() => ({}));
    throw new Error(body?.error ?? `Failed to get upload URL (${presignRes.status})`);
  }

  const presignPayload = (await presignRes.json()) as Partial<PresignedUploadResponse>;
  const uploadUrl = typeof presignPayload.uploadUrl === "string" ? presignPayload.uploadUrl : "";
  const publicUrl = typeof presignPayload.publicUrl === "string" ? presignPayload.publicUrl : "";
  if (!uploadUrl || !publicUrl) {
    throw new Error("Invalid upload response from server");
  }

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": blob.type || "audio/webm" },
    body: blob,
  });

  if (!putRes.ok) {
    throw new Error(`Upload to storage failed (${putRes.status})`);
  }

  return publicUrl;
};

const dispatchWindowEvent = <T,>(eventName: string, payload: T): void => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<T>(eventName, { detail: payload }));
};

const asFiniteInt = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor(parsed));
};

const postJson = async <T,>(url: string, body: Record<string, unknown>): Promise<T | null> => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({})) as Record<string, unknown>;
    const serverMessage = typeof errorBody?.error === "string" ? errorBody.error : undefined;
    throw new Error(serverMessage ?? `Request failed (${response.status})`);
  }
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

const getJson = async <T,>(url: string): Promise<T | null> => {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

export function useChatChannel(identity: ChatIdentity | null): UseChatChannelResult {
  const {
    ensureLobby,
    getLobbyState,
    receiveMessage,
    updateMessage,
    replaceMessages,
    setTypingIndicator,
    clearTypingIndicator,
    pruneTypingIndicators,
    markLobbyRead,
  } = useChatUIState((state) => ({
    ensureLobby: state.ensureLobby,
    getLobbyState: state.getLobbyState,
    receiveMessage: state.receiveMessage,
    updateMessage: state.updateMessage,
    replaceMessages: state.replaceMessages,
    setTypingIndicator: state.setTypingIndicator,
    clearTypingIndicator: state.clearTypingIndicator,
    pruneTypingIndicators: state.pruneTypingIndicators,
    markLobbyRead: state.markLobbyRead,
  }));

  const typingRef = useRef(false);
  const lastEventVersionRef = useRef(0);
  const pollingInFlightRef = useRef(false);

  useEffect(() => {
    if (!identity) return;
    ensureLobby(identity.lobbyCode);
  }, [ensureLobby, identity]);

  const applyMessagePayload = useCallback((payload: ChatMessageEventPayload) => {
    if (!identity || payload.lobbyCode !== identity.lobbyCode) return;
    const incomingMessage: ChatMessage = {
      ...payload,
      status: "sent",
    };
    receiveMessage(identity.lobbyCode, incomingMessage, {
      activeUserId: identity.userId,
    });
    dispatchWindowEvent(CHAT_EVENT_NAMES.messageNew, payload);
  }, [identity, receiveMessage]);

  const applyTransportEvent = useCallback((event: ChatTransportEvent) => {
    if (!identity) return;
    if (!event || typeof event !== "object") return;

    switch (event.kind) {
      case "message": {
        applyMessagePayload(event.payload as ChatMessageEventPayload);
        break;
      }
      case "typing-start": {
        const payload = event.payload as ChatTypingEventPayload;
        if (payload.lobbyCode !== identity.lobbyCode || payload.userId === identity.userId) return;
        setTypingIndicator(identity.lobbyCode, { ...payload, isTyping: true });
        dispatchWindowEvent(CHAT_EVENT_NAMES.typingStart, payload);
        break;
      }
      case "typing-stop": {
        const payload = event.payload as ChatTypingEventPayload;
        if (payload.lobbyCode !== identity.lobbyCode || payload.userId === identity.userId) return;
        clearTypingIndicator(identity.lobbyCode, payload.userId);
        dispatchWindowEvent(CHAT_EVENT_NAMES.typingStop, payload);
        break;
      }
      case "read-update": {
        const payload = event.payload as ChatReadUpdateEventPayload;
        if (payload.lobbyCode !== identity.lobbyCode) return;
        dispatchWindowEvent(CHAT_EVENT_NAMES.readUpdate, payload);
        break;
      }
      default:
        break;
    }
  }, [applyMessagePayload, clearTypingIndicator, identity, setTypingIndicator]);

  const refreshMessageSnapshot = useCallback(async () => {
    if (!identity) return;
    const endpoint = `/api/lobbies/${encodeURIComponent(identity.lobbyCode)}/chat/messages`;
    const data = await getJson<ChatMessagesResponse>(endpoint);
    if (!data || !Array.isArray(data.messages)) return;

    const remoteMessages: ChatMessage[] = data.messages.map((entry) => ({
      ...entry,
      status: "sent",
    }));
    const localMessages = getLobbyState(identity.lobbyCode).messages;
    const localUnsent = localMessages.filter((entry) => entry.status !== "sent");
    const remoteIds = new Set(remoteMessages.map((entry) => entry.id));
    const merged = [
      ...remoteMessages,
      ...localUnsent.filter((entry) => !remoteIds.has(entry.id)),
    ];
    replaceMessages(identity.lobbyCode, merged);

    const eventVersion = asFiniteInt(data.eventVersion);
    if (eventVersion !== null) {
      lastEventVersionRef.current = Math.max(lastEventVersionRef.current, eventVersion);
    }
  }, [getLobbyState, identity, replaceMessages]);

  const pollEvents = useCallback(async () => {
    if (!identity || pollingInFlightRef.current) return;
    pollingInFlightRef.current = true;
    try {
      const since = lastEventVersionRef.current;
      const endpoint = `/api/lobbies/${encodeURIComponent(identity.lobbyCode)}/chat/events?since=${since}`;
      const data = await getJson<ChatEventsResponse>(endpoint);
      if (!data) return;

      if (data.eventsTruncated) {
        await refreshMessageSnapshot();
      }

      const events = Array.isArray(data.events) ? data.events : [];
      for (const event of events) {
        applyTransportEvent(event);
        const version = asFiniteInt(event.version);
        if (version !== null) {
          lastEventVersionRef.current = Math.max(lastEventVersionRef.current, version);
        }
      }

      const eventVersion = asFiniteInt(data.eventVersion);
      if (eventVersion !== null) {
        lastEventVersionRef.current = Math.max(lastEventVersionRef.current, eventVersion);
      }
    } catch {
      // Ignore polling errors. UI keeps optimistic local state and retries next interval.
    } finally {
      pollingInFlightRef.current = false;
    }
  }, [applyTransportEvent, identity, refreshMessageSnapshot]);

  useEffect(() => {
    if (!identity) return;
    let cancelled = false;

    lastEventVersionRef.current = 0;
    typingRef.current = false;

    const bootstrap = async () => {
      try {
        await refreshMessageSnapshot();
        if (!cancelled) {
          await pollEvents();
        }
      } catch {
        // Ignore bootstrap failures; interval polling will retry.
      }
    };
    void bootstrap();

    const interval = window.setInterval(() => {
      void pollEvents();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      pollingInFlightRef.current = false;
    };
  }, [identity, pollEvents, refreshMessageSnapshot]);

  useEffect(() => {
    if (!identity) return;
    const interval = window.setInterval(() => {
      pruneTypingIndicators(identity.lobbyCode, Date.now());
    }, 1500);
    return () => {
      window.clearInterval(interval);
    };
  }, [identity, pruneTypingIndicators]);

  const markRead = useCallback(() => {
    if (!identity) return;
    const payload: ChatReadUpdateEventPayload = {
      lobbyCode: identity.lobbyCode,
      userId: identity.userId,
      readAt: Date.now(),
    };
    markLobbyRead(identity.lobbyCode);
    dispatchWindowEvent(CHAT_EVENT_NAMES.readUpdate, payload);
    void postJson<{ eventVersion?: number }>(`/api/lobbies/${encodeURIComponent(identity.lobbyCode)}/chat/read`, {
      readAt: payload.readAt,
    })
      .then((data) => {
        const nextVersion = asFiniteInt(data?.eventVersion);
        if (nextVersion !== null) {
          lastEventVersionRef.current = Math.max(lastEventVersionRef.current, nextVersion);
        }
      })
      .catch(() => {
        // Keep local read state; server sync will retry on next mark-read.
      });
  }, [identity, markLobbyRead]);

  const sendTypingStart = useCallback(() => {
    if (!identity || typingRef.current) return;
    typingRef.current = true;

    const payload: ChatTypingEventPayload = {
      lobbyCode: identity.lobbyCode,
      userId: identity.userId,
      userName: identity.userName,
      startedAt: Date.now(),
    };
    dispatchWindowEvent(CHAT_EVENT_NAMES.typingStart, payload);

    void postJson<{ eventVersion?: number }>(`/api/lobbies/${encodeURIComponent(identity.lobbyCode)}/chat/typing`, {
      isTyping: true,
    })
      .then((data) => {
        const nextVersion = asFiniteInt(data?.eventVersion);
        if (nextVersion !== null) {
          lastEventVersionRef.current = Math.max(lastEventVersionRef.current, nextVersion);
        }
      })
      .catch(() => {
        // Typing indicator can fail silently; it will recover on next keystroke.
      });
  }, [identity]);

  const sendTypingStop = useCallback(() => {
    if (!identity || !typingRef.current) return;
    typingRef.current = false;

    const payload: ChatTypingEventPayload = {
      lobbyCode: identity.lobbyCode,
      userId: identity.userId,
      userName: identity.userName,
      startedAt: Date.now(),
    };
    dispatchWindowEvent(CHAT_EVENT_NAMES.typingStop, payload);

    void postJson<{ eventVersion?: number }>(`/api/lobbies/${encodeURIComponent(identity.lobbyCode)}/chat/typing`, {
      isTyping: false,
    })
      .then((data) => {
        const nextVersion = asFiniteInt(data?.eventVersion);
        if (nextVersion !== null) {
          lastEventVersionRef.current = Math.max(lastEventVersionRef.current, nextVersion);
        }
      })
      .catch(() => {
        // Typing stop can fail silently; stale indicators are pruned client-side.
      });
  }, [identity]);

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
      const result = await postJson<{
        eventVersion?: number;
        messageVersion?: number;
        message?: ChatMessageEventPayload & { version?: number };
      }>(`/api/lobbies/${encodeURIComponent(identity.lobbyCode)}/chat/messages`, {
        id,
        type: "text",
        text: trimmed,
        createdAt: now,
      });

      const responseMessage = result?.message;
      updateMessage(identity.lobbyCode, id, "sent", responseMessage
        ? {
            senderName: responseMessage.senderName,
            senderFactionId: responseMessage.senderFactionId,
            createdAt: responseMessage.createdAt,
            text: responseMessage.text,
          }
        : undefined);

      const eventVersion = asFiniteInt(result?.eventVersion);
      if (eventVersion !== null) {
        lastEventVersionRef.current = Math.max(lastEventVersionRef.current, eventVersion);
      }
    } catch {
      updateMessage(identity.lobbyCode, id, "failed");
    }
  }, [identity, receiveMessage, sendTypingStop, updateMessage]);

  const sendVoiceMessage = useCallback(async (draft: VoiceDraft, options?: { messageId?: string; createdAt?: number }) => {
    if (!identity) return;

    const id = options?.messageId ?? createMessageId();
    const createdAt = options?.createdAt ?? Date.now();

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

    let uploadedUrl: string | undefined;

    try {
      uploadedUrl = await uploadVoiceBlob(
        draft.blob,
        identity.lobbyCode,
        id,
        draft.durationMs
      );

      const result = await postJson<{
        eventVersion?: number;
        messageVersion?: number;
        message?: ChatMessageEventPayload & { version?: number };
      }>(`/api/lobbies/${encodeURIComponent(identity.lobbyCode)}/chat/messages`, {
        id,
        type: "voice",
        audioUrl: uploadedUrl,
        audioDurationMs: draft.durationMs,
        waveformPeaks: draft.waveformPeaks,
        createdAt,
      });

      const responseMessage = result?.message;
      updateMessage(identity.lobbyCode, id, "sent", {
        audioUrl: responseMessage?.audioUrl ?? uploadedUrl,
        audioDurationMs: responseMessage?.audioDurationMs ?? draft.durationMs,
        waveformPeaks: responseMessage?.waveformPeaks ?? draft.waveformPeaks,
        senderName: responseMessage?.senderName ?? identity.userName,
        senderFactionId: responseMessage?.senderFactionId ?? identity.senderFactionId,
      });

      const eventVersion = asFiniteInt(result?.eventVersion);
      if (eventVersion !== null) {
        lastEventVersionRef.current = Math.max(lastEventVersionRef.current, eventVersion);
      }
    } catch (err) {
      updateMessage(identity.lobbyCode, id, "failed", uploadedUrl ? { audioUrl: uploadedUrl } : undefined);
      console.warn("[chat] Voice send failed:", err instanceof Error ? err.message : String(err));
    }
  }, [identity, receiveMessage, updateMessage]);

  // Retry a previously failed voice message. If the audio was already uploaded
  // to object storage (https:// URL), skip the upload step and re-POST only the
  // message metadata. If there is no audioUrl (upload never completed), the
  // message cannot be retried without the original blob — the user must re-record.
  const retryVoiceMessage = useCallback(async (message: {
    id: string;
    audioUrl?: string;
    audioDurationMs?: number;
    waveformPeaks?: number[];
    createdAt: number;
  }) => {
    if (!identity) return;
    const { id, audioUrl, audioDurationMs, waveformPeaks, createdAt } = message;

    if (!isHttpsAudioUrl(audioUrl) || !Number.isFinite(audioDurationMs) || (audioDurationMs ?? 0) <= 0) {
      // Missing/invalid uploaded URL or duration means this failed note cannot be
      // retried safely without a new recording.
      return;
    }

    updateMessage(identity.lobbyCode, id, "pending");

    try {
      const result = await postJson<{
        eventVersion?: number;
        message?: ChatMessageEventPayload & { version?: number };
      }>(`/api/lobbies/${encodeURIComponent(identity.lobbyCode)}/chat/messages`, {
        id,
        type: "voice",
        audioUrl,
        audioDurationMs,
        waveformPeaks,
        createdAt,
      });

      const responseMessage = result?.message;
      updateMessage(identity.lobbyCode, id, "sent", {
        audioUrl: responseMessage?.audioUrl ?? audioUrl,
        audioDurationMs: responseMessage?.audioDurationMs ?? audioDurationMs,
        waveformPeaks: responseMessage?.waveformPeaks ?? waveformPeaks,
        senderName: responseMessage?.senderName ?? identity.userName,
        senderFactionId: responseMessage?.senderFactionId ?? identity.senderFactionId,
      });

      const eventVersion = asFiniteInt(result?.eventVersion);
      if (eventVersion !== null) {
        lastEventVersionRef.current = Math.max(lastEventVersionRef.current, eventVersion);
      }
    } catch (err) {
      updateMessage(identity.lobbyCode, id, "failed");
      console.warn("[chat] Voice retry failed:", err instanceof Error ? err.message : String(err));
    }
  }, [identity, updateMessage]);

  return {
    sendTextMessage,
    sendVoiceMessage,
    retryVoiceMessage,
    sendTypingStart,
    sendTypingStop,
    markRead,
  };
}
