import { useCallback, useEffect, useRef, useState } from "react";
import { Circle, Square, Trash2, RotateCcw, Send } from "lucide-react";

import { VoiceMessageWaveform } from "@/components/chat/VoiceMessageWaveform";
import type { VoiceDraft } from "@/components/chat/types";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface VoiceRecorderComposerProps {
  isVisible: boolean;
  isRecording: boolean;
  voiceDraft: VoiceDraft | null;
  onRecordingStateChange: (isRecording: boolean) => void;
  onVoiceDraftChange: (draft: VoiceDraft | null) => void;
  onSendVoiceDraft: (draft: VoiceDraft) => Promise<void>;
  onClose: () => void;
}

const SUPPORTED_MIME_TYPES = [
  "audio/mp4;codecs=mp4a.40.2",
  "audio/webm;codecs=opus",
  "audio/ogg;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "",
];

const formatDuration = (durationMs: number): string => {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${mins}:${String(seconds).padStart(2, "0")}`;
};

const pickMimeType = (): string => {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }
  return SUPPORTED_MIME_TYPES.find((candidate) => candidate === "" || MediaRecorder.isTypeSupported(candidate)) ?? "";
};

const getAudioContext = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
};

const extractPeaks = (channelData: Float32Array, targetSamples = 72): number[] => {
  const peaks: number[] = [];
  const blockSize = Math.max(1, Math.floor(channelData.length / targetSamples));

  for (let index = 0; index < targetSamples; index += 1) {
    const start = index * blockSize;
    const end = Math.min(channelData.length, start + blockSize);
    let max = 0;
    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      const absolute = Math.abs(channelData[sampleIndex] ?? 0);
      if (absolute > max) {
        max = absolute;
      }
    }
    peaks.push(Math.min(1, Math.max(0.05, max)));
  }

  return peaks;
};

const createFallbackPeaks = (targetSamples = 72): number[] =>
  Array.from({ length: targetSamples }, (_, index) => (index % 6 === 0 ? 0.24 : 0.12));

async function createVoiceDraft(blob: Blob, fallbackDurationMs: number): Promise<VoiceDraft> {
  const safeDurationMs = Math.max(1, Math.round(fallbackDurationMs));
  const fallbackDraft: VoiceDraft = {
    blob,
    mimeType: blob.type,
    durationMs: safeDurationMs,
    waveformPeaks: createFallbackPeaks(),
  };

  const context = getAudioContext();
  if (!context) {
    return fallbackDraft;
  }

  try {
    const buffer = await blob.arrayBuffer();
    const audioBuffer = await context.decodeAudioData(buffer);
    const firstChannel = audioBuffer.getChannelData(0);
    const decodedDurationMs = Math.max(1, Math.round(audioBuffer.duration * 1000));
    const peaks = firstChannel.length > 0
      ? extractPeaks(firstChannel)
      : createFallbackPeaks();
    return {
      blob,
      mimeType: blob.type,
      durationMs: Number.isFinite(decodedDurationMs) ? decodedDurationMs : safeDurationMs,
      waveformPeaks: peaks,
    };
  } catch {
    return fallbackDraft;
  } finally {
    void context.close();
  }
}

export function VoiceRecorderComposer({
  isVisible,
  isRecording,
  voiceDraft,
  onRecordingStateChange,
  onVoiceDraftChange,
  onSendVoiceDraft,
  onClose,
}: VoiceRecorderComposerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const reducedMotion = useReducedMotion();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const discardOnStopRef = useRef(false);

  const cleanupMedia = useCallback(() => {
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    recordingStartedAtRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        discardOnStopRef.current = true;
        recorder.stop();
      }
      // Always release the mic stream on unmount. If recorder.onstop also
      // calls cleanupMedia later, the second call is a harmless no-op
      // (tracks are already stopped and refs are null).
      cleanupMedia();
      onRecordingStateChange(false);
    };
  }, [cleanupMedia, onRecordingStateChange]);

  const startRecording = useCallback(async () => {
    if (isRecording) return;
    setError(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Voice recording is not supported on this device.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      discardOnStopRef.current = false;
      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recordingStartedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const fallbackDurationMs = recordingStartedAtRef.current
          ? Math.max(1, Date.now() - recordingStartedAtRef.current)
          : 1;
        const discardOnStop = discardOnStopRef.current;
        discardOnStopRef.current = false;
        chunksRef.current = [];
        recordingStartedAtRef.current = null;
        onRecordingStateChange(false);
        cleanupMedia();

        if (discardOnStop) {
          onVoiceDraftChange(null);
          return;
        }

        if (blob.size === 0) {
          setError("No audio captured. Please try again.");
          return;
        }

        try {
          const draft = await createVoiceDraft(blob, fallbackDurationMs);
          onVoiceDraftChange(draft);
        } catch {
          setError("Could not prepare voice note.");
        }
      };

      recorder.start();
      onRecordingStateChange(true);
    } catch {
      recordingStartedAtRef.current = null;
      cleanupMedia();
      onRecordingStateChange(false);
      setError("Microphone permission denied or unavailable.");
    }
  }, [cleanupMedia, isRecording, onRecordingStateChange, onVoiceDraftChange]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  }, []);

  const discardDraft = useCallback(() => {
    onVoiceDraftChange(null);
    setError(null);
  }, [onVoiceDraftChange]);

  const handleSend = useCallback(async () => {
    if (!voiceDraft || isSending) return;
    setIsSending(true);
    setError(null);
    try {
      await onSendVoiceDraft(voiceDraft);
      onVoiceDraftChange(null);
      onClose();
    } catch {
      setError("Failed to send voice note.");
    } finally {
      setIsSending(false);
    }
  }, [isSending, onClose, onSendVoiceDraft, onVoiceDraftChange, voiceDraft]);

  const handleClose = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      discardOnStopRef.current = true;
      recorder.stop();
    } else {
      cleanupMedia();
      onRecordingStateChange(false);
      onVoiceDraftChange(null);
    }
    setError(null);
    onClose();
  }, [cleanupMedia, onClose, onRecordingStateChange, onVoiceDraftChange]);

  if (!isVisible) return null;

  return (
    <div className="border-t border-slate-700/60 bg-slate-900/90 px-3 py-3">
      <div className="rounded-lg border border-amber-500/30 bg-slate-950/65 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-200/80">Voice Note</div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded px-2 py-1 text-xs text-slate-300 transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          >
            Close
          </button>
        </div>

        {error && (
          <div className="mb-2 rounded border border-red-500/50 bg-red-900/30 px-2 py-1 text-xs text-red-100">
            {error}
          </div>
        )}

        {!voiceDraft && !isRecording && (
          <button
            type="button"
            onClick={startRecording}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-red-400/50 bg-red-700/20 px-3 py-2 text-sm text-red-100 transition-colors hover:bg-red-600/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            aria-label="Start recording voice note"
          >
            <Circle className="h-4 w-4" />
            Start recording
          </button>
        )}

        {isRecording && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-red-100">
              <span className="relative inline-flex h-2.5 w-2.5">
                {!reducedMotion && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-300 opacity-80" />
                )}
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-400" />
              </span>
              Recording...
            </div>
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-amber-400/40 bg-slate-800/70 px-3 py-2 text-sm text-amber-100 transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              aria-label="Stop recording voice note"
            >
              <Square className="h-4 w-4" />
              Stop
            </button>
          </div>
        )}

        {voiceDraft && !isRecording && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-200/80">
              <span>Ready to send</span>
              <span>{formatDuration(voiceDraft.durationMs)}</span>
            </div>
            <VoiceMessageWaveform peaks={voiceDraft.waveformPeaks} progress={0} />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSend}
                disabled={isSending}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-amber-500/45 bg-amber-700/25 px-3 py-2 text-sm text-amber-100 transition-colors hover:bg-amber-600/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:opacity-45"
              >
                <Send className="h-4 w-4" />
                {isSending ? "Sending..." : "Send"}
              </button>
              <button
                type="button"
                onClick={discardDraft}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-slate-500/50 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              >
                <Trash2 className="h-4 w-4" />
                Discard
              </button>
              <button
                type="button"
                onClick={() => {
                  discardDraft();
                  void startRecording();
                }}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-slate-500/50 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              >
                <RotateCcw className="h-4 w-4" />
                Re-record
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
