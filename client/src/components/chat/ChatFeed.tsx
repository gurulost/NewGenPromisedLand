import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Play, Pause, RotateCcw } from "lucide-react";

import { VoiceMessageWaveform } from "@/components/chat/VoiceMessageWaveform";
import type { ChatMessage } from "@/components/chat/types";
import { cn } from "@/lib/utils";

interface ChatFeedProps {
  messages: ChatMessage[];
  currentUserId: number;
  onRetryMessage: (message: ChatMessage) => void;
}

const GLOBAL_ACTIVE_VOICE_EVENT = "ngpl:chat:voice-active";

const formatTime = (epochMs: number): string => {
  try {
    return new Date(epochMs).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

const formatDuration = (durationMs?: number): string => {
  if (!durationMs || durationMs <= 0) return "0:00";
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${mins}:${String(seconds).padStart(2, "0")}`;
};

const formatElapsed = (durationMs: number | undefined, progress: number): string => {
  if (!durationMs || durationMs <= 0) return "0:00";
  const elapsedMs = Math.max(0, Math.round(durationMs * Math.min(1, Math.max(0, progress))));
  return formatDuration(elapsedMs);
};

const getSenderInitials = (name: string): string => {
  const clean = name.trim();
  if (!clean) return "?";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
};

const canRetryVoiceMessage = (message: ChatMessage): boolean =>
  message.type === "voice" &&
  ((typeof message.audioUrl === "string" && message.audioUrl.startsWith("https://")) || message.localBlob instanceof Blob) &&
  Number.isFinite(message.audioDurationMs) &&
  (message.audioDurationMs ?? 0) > 0;

export function ChatFeed({ messages, currentUserId, onRetryMessage }: ChatFeedProps) {
  const [activeVoiceId, setActiveVoiceId] = useState<string | null>(null);
  const [progressById, setProgressById] = useState<Record<string, number>>({});
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const activeVoiceRef = useRef<string | null>(null);

  useEffect(() => {
    activeVoiceRef.current = activeVoiceId;
  }, [activeVoiceId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleGlobalVoicePlay = (event: Event) => {
      const nextId = (event as CustomEvent<{ id?: string }>).detail?.id;
      const currentId = activeVoiceRef.current;
      if (!nextId || !currentId || currentId === nextId) return;

      const currentAudio = audioRefs.current[currentId];
      if (!currentAudio) return;
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setProgressById((prev) => ({ ...prev, [currentId]: 0 }));
      setActiveVoiceId(null);
    };

    window.addEventListener(GLOBAL_ACTIVE_VOICE_EVENT, handleGlobalVoicePlay as EventListener);
    return () => {
      window.removeEventListener(GLOBAL_ACTIVE_VOICE_EVENT, handleGlobalVoicePlay as EventListener);
    };
  }, []);

  useEffect(() => {
    const audioRegistry = audioRefs.current;
    return () => {
      Object.values(audioRegistry).forEach((audio) => {
        if (!audio) return;
        audio.pause();
        audio.currentTime = 0;
      });
    };
  }, []);

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => a.createdAt - b.createdAt),
    [messages],
  );

  const toggleVoice = useCallback((message: ChatMessage) => {
    const audio = audioRefs.current[message.id];
    if (!audio) return;

    if (activeVoiceId && activeVoiceId !== message.id) {
      const current = audioRefs.current[activeVoiceId];
      if (current) {
        current.pause();
        current.currentTime = 0;
      }
      setProgressById((prev) => ({ ...prev, [activeVoiceId]: 0 }));
    }

    if (audio.paused) {
      if (audio.duration > 0 && audio.currentTime >= audio.duration - 0.05) {
        audio.currentTime = 0;
        setProgressById((prev) => ({ ...prev, [message.id]: 0 }));
      }
      void audio.play().then(() => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(GLOBAL_ACTIVE_VOICE_EVENT, { detail: { id: message.id } }));
        }
        setActiveVoiceId(message.id);
      }).catch(() => {
        setActiveVoiceId(null);
      });
    } else {
      audio.pause();
      setActiveVoiceId(null);
    }
  }, [activeVoiceId]);

  return (
    <div className="space-y-2 px-2 py-2">
      {sortedMessages.map((message) => {
        const isOwn = message.senderUserId === currentUserId;
        const isVoice = message.type === "voice";
        const progress = progressById[message.id] ?? 0;
        const initials = getSenderInitials(message.senderName);
        const canRetry = message.status === "failed" && (!isVoice || canRetryVoiceMessage(message));
        const requiresRerecord = message.status === "failed" && isVoice && !canRetryVoiceMessage(message);

        return (
          <div
            key={message.id}
            className={cn("flex", isOwn ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[88%] rounded-xl border px-3 py-2 text-sm shadow-sm",
                isOwn
                  ? "border-amber-500/40 bg-amber-900/20 text-amber-50"
                  : "border-slate-600/50 bg-slate-800/80 text-slate-100",
                message.status === "failed" && "border-red-500/60 bg-red-900/20",
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold tracking-wide text-amber-200/80">
                  {message.senderName}
                </span>
                <span className="text-[10px] text-slate-300/80">{formatTime(message.createdAt)}</span>
              </div>

              {!isVoice && (
                <p className="whitespace-pre-wrap break-words text-sm leading-snug">{message.text}</p>
              )}

              {isVoice && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-500/45 bg-slate-900/80 text-[10px] font-semibold uppercase tracking-wide text-amber-100"
                      aria-hidden="true"
                    >
                      {initials}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleVoice(message)}
                      disabled={!message.audioUrl || message.status === "pending"}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-amber-400/40 bg-slate-900/60 text-amber-100 transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-45"
                      aria-label={`${activeVoiceId === message.id ? "Pause" : "Play"} voice message from ${message.senderName}`}
                    >
                      {activeVoiceId === message.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <VoiceMessageWaveform peaks={message.waveformPeaks ?? []} progress={progress} />
                    </div>
                    <span className="text-xs text-slate-200/75">
                      {formatElapsed(message.audioDurationMs, progress)} / {formatDuration(message.audioDurationMs)}
                    </span>
                  </div>

                  <audio
                    ref={(node) => {
                      audioRefs.current[message.id] = node;
                    }}
                    src={message.audioUrl || undefined}
                    preload="metadata"
                    onTimeUpdate={(event) => {
                      const audio = event.currentTarget;
                      const ratio = audio.duration > 0 ? audio.currentTime / audio.duration : 0;
                      setProgressById((prev) => ({
                        ...prev,
                        [message.id]: ratio,
                      }));
                    }}
                    onEnded={() => {
                      setActiveVoiceId((prev) => (prev === message.id ? null : prev));
                      setProgressById((prev) => ({ ...prev, [message.id]: 1 }));
                    }}
                    onPause={() => {
                      setActiveVoiceId((prev) => (prev === message.id ? null : prev));
                    }}
                  />
                </div>
              )}

              <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
                {message.status === "pending" && (
                  <span className="text-slate-300/70">Sending…</span>
                )}
                {message.status === "failed" && (
                  <span className="inline-flex items-center gap-1 text-red-200">
                    <AlertTriangle className="h-3 w-3" />
                    {requiresRerecord
                      ? "Upload failed — re-record to send"
                      : "Failed to send"}
                  </span>
                )}
                {message.status === "sent" && <span className="text-slate-300/60">Sent</span>}

                {canRetry && (
                  <button
                    type="button"
                    onClick={() => onRetryMessage(message)}
                    className="inline-flex min-h-[44px] items-center gap-1 rounded px-2 py-0.5 text-red-100 transition-colors hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                  >
                    <RotateCcw className="h-3 w-3" /> Retry
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {sortedMessages.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-600/60 bg-slate-900/40 px-3 py-6 text-center text-xs text-slate-300/70">
          No messages yet. Say hello to your party.
        </div>
      )}
    </div>
  );
}
