import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BellOff, MessagesSquare, Users, X, ArrowDown } from "lucide-react";

import { ChatFeed } from "@/components/chat/ChatFeed";
import { TextComposer } from "@/components/chat/TextComposer";
import { VoiceRecorderComposer } from "@/components/chat/VoiceRecorderComposer";
import type { ChatIdentity, ChatLobbyState, ChatMessage, VoiceDraft } from "@/components/chat/types";
import { useChatChannel, type UseChatChannelResult } from "@/hooks/useChatChannel";
import { useChatUIState } from "@/hooks/useChatUIState";
import { cn } from "@/lib/utils";

type ChatPanelVariant = "dropdown" | "mobile" | "docked";

interface ChatPanelProps {
  identity: ChatIdentity;
  isOpen: boolean;
  onClose?: () => void;
  participantCount?: number;
  roomTitle?: string;
  variant?: ChatPanelVariant;
  className?: string;
  channel?: UseChatChannelResult;
}

const FALLBACK_STATE: ChatLobbyState = {
  messages: [],
  unreadCount: 0,
  isOpen: false,
  peek: null,
  typingByUserId: {},
  draftText: "",
  voiceDraft: null,
  isRecording: false,
  lastReadAt: 0,
};

export function ChatPanel({
  identity,
  isOpen,
  onClose,
  participantCount,
  roomTitle = "Party Chat",
  variant = "dropdown",
  className,
  channel,
}: ChatPanelProps) {
  const [showVoiceComposer, setShowVoiceComposer] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const feedRef = useRef<HTMLDivElement | null>(null);
  const previousMessageCountRef = useRef(0);

  const {
    setLobbyOpen,
    setDraftText,
    setVoiceDraft,
    setRecordingState,
    consumePeek,
  } = useChatUIState((state) => ({
    setLobbyOpen: state.setLobbyOpen,
    setDraftText: state.setDraftText,
    setVoiceDraft: state.setVoiceDraft,
    setRecordingState: state.setRecordingState,
    consumePeek: state.consumePeek,
  }));

  const lobbyState = useChatUIState(
    useCallback(
      (state) => state.byLobby[identity.lobbyCode] ?? FALLBACK_STATE,
      [identity.lobbyCode],
    ),
  );

  const internalChannel = useChatChannel(channel ? null : identity);
  const { sendTextMessage, sendVoiceMessage, retryVoiceMessage, sendTypingStart, sendTypingStop, markRead } = channel ?? internalChannel;
  const readTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setLobbyOpen(identity.lobbyCode, isOpen);
    if (isOpen) {
      consumePeek(identity.lobbyCode);
    } else {
      sendTypingStop();
      setShowVoiceComposer(false);
    }
  }, [consumePeek, identity.lobbyCode, isOpen, sendTypingStop, setLobbyOpen]);

  const queueMarkRead = useCallback(() => {
    if (!isOpen || typeof document === "undefined") return;
    if (document.visibilityState !== "visible") return;

    if (readTimerRef.current) {
      window.clearTimeout(readTimerRef.current);
    }
    readTimerRef.current = window.setTimeout(() => {
      markRead();
      readTimerRef.current = null;
    }, 500);
  }, [isOpen, markRead]);

  useEffect(() => {
    queueMarkRead();
  }, [lobbyState.messages.length, queueMarkRead]);

  useEffect(() => {
    if (!isOpen || typeof document === "undefined") return;

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        queueMarkRead();
      }
    };
    const handleFocus = () => {
      queueMarkRead();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, [isOpen, queueMarkRead]);

  useEffect(() => () => {
    if (readTimerRef.current) {
      window.clearTimeout(readTimerRef.current);
      readTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isOpen || !readTimerRef.current) return;
    window.clearTimeout(readTimerRef.current);
    readTimerRef.current = null;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const nextCount = lobbyState.messages.length;
    const previousCount = previousMessageCountRef.current;
    previousMessageCountRef.current = nextCount;

    if (nextCount <= previousCount) return;

    if (isAtBottom) {
      requestAnimationFrame(() => {
        const feed = feedRef.current;
        if (!feed) return;
        feed.scrollTop = feed.scrollHeight;
      });
      setShowJumpToLatest(false);
      return;
    }

    setShowJumpToLatest(true);
  }, [isAtBottom, isOpen, lobbyState.messages.length]);

  const typingUsers = useMemo(
    () => Object.values(lobbyState.typingByUserId).map((entry) => entry.userName),
    [lobbyState.typingByUserId],
  );

  const handleSendText = useCallback(async () => {
    const value = lobbyState.draftText;
    if (!value.trim()) return;
    await sendTextMessage(value);
    setDraftText(identity.lobbyCode, "");
  }, [identity.lobbyCode, lobbyState.draftText, sendTextMessage, setDraftText]);

  const handleRetryMessage = useCallback(async (message: ChatMessage) => {
    if (message.type === "text" && message.text) {
      await sendTextMessage(message.text, {
        messageId: message.id,
        createdAt: message.createdAt,
      });
      return;
    }

    if (message.type === "voice") {
      await retryVoiceMessage({
        id: message.id,
        audioUrl: message.audioUrl,
        audioDurationMs: message.audioDurationMs,
        waveformPeaks: message.waveformPeaks,
        createdAt: message.createdAt,
        localBlob: message.localBlob,
      });
    }
  }, [sendTextMessage, retryVoiceMessage]);

  if (!isOpen) return null;

  return (
    <section
      className={cn(
        "pointer-events-auto flex flex-col overflow-hidden rounded-[14px] border border-amber-500/30 bg-slate-900/95 text-slate-100 shadow-2xl shadow-black/35 backdrop-blur-md",
        variant === "dropdown" && "w-[352px] max-w-[calc(100vw-2rem)] max-h-[58vh]",
        variant === "mobile" && "h-full w-full max-h-full rounded-none border-0",
        variant === "docked" && "h-[70vh] min-h-[440px] w-full",
        className,
      )}
      aria-label="Chat panel"
    >
      <header className="shrink-0 flex items-center justify-between border-b border-slate-700/60 bg-slate-950/70 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <MessagesSquare className="h-4 w-4 text-amber-300" aria-hidden="true" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-amber-100">{roomTitle}</div>
            <div className="flex items-center gap-2 text-[11px] text-slate-300/80">
              <Users className="h-3 w-3" aria-hidden="true" />
              <span>{participantCount ?? "?"} online</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-slate-600/60 bg-slate-800/65 text-slate-200 transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            aria-label="Mute chat sounds"
          >
            <BellOff className="h-4 w-4" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-slate-600/60 bg-slate-800/65 text-slate-200 transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              aria-label="Close chat panel"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      <div
        ref={feedRef}
        className="relative min-h-0 flex-1 overflow-y-auto"
        onScroll={(event) => {
          const target = event.currentTarget;
          const atBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 24;
          setIsAtBottom(atBottom);
          if (atBottom) {
            setShowJumpToLatest(false);
          }
        }}
      >
        <ChatFeed
          messages={lobbyState.messages}
          currentUserId={identity.userId}
          onRetryMessage={handleRetryMessage}
        />

        {showJumpToLatest && (
          <button
            type="button"
            onClick={() => {
              const target = feedRef.current;
              if (!target) return;
              target.scrollTop = target.scrollHeight;
              setShowJumpToLatest(false);
            }}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 inline-flex min-h-[44px] items-center gap-1 rounded-full border border-amber-500/40 bg-slate-900/90 px-3 py-1 text-xs text-amber-100 shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          >
            <ArrowDown className="h-3 w-3" />
            Jump to latest
          </button>
        )}
      </div>

      {typingUsers.length > 0 && (
        <div className="border-t border-slate-700/40 bg-slate-950/70 px-3 py-1 text-xs text-slate-300/85">
          {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing…
        </div>
      )}

      {showVoiceComposer && (
        <VoiceRecorderComposer
          isVisible={showVoiceComposer}
          isRecording={lobbyState.isRecording}
          voiceDraft={lobbyState.voiceDraft}
          onRecordingStateChange={(nextValue) => setRecordingState(identity.lobbyCode, nextValue)}
          onVoiceDraftChange={(draft) => setVoiceDraft(identity.lobbyCode, draft)}
          onSendVoiceDraft={sendVoiceMessage}
          onClose={() => setShowVoiceComposer(false)}
        />
      )}

      <TextComposer
        value={lobbyState.draftText}
        recordingActive={lobbyState.isRecording}
        onChange={(nextValue) => setDraftText(identity.lobbyCode, nextValue)}
        onSend={() => {
          void handleSendText();
        }}
        onOpenVoiceRecorder={() => setShowVoiceComposer((previous) => !previous)}
        onTypingStart={sendTypingStart}
        onTypingStop={sendTypingStop}
      />
    </section>
  );
}
