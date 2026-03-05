import { KeyboardEvent, useMemo } from "react";
import { Send, Mic } from "lucide-react";

import { cn } from "@/lib/utils";

interface TextComposerProps {
  value: string;
  disabled?: boolean;
  recordingActive?: boolean;
  onChange: (nextValue: string) => void;
  onSend: () => void;
  onOpenVoiceRecorder: () => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
}

export function TextComposer({
  value,
  disabled = false,
  recordingActive = false,
  onChange,
  onSend,
  onOpenVoiceRecorder,
  onTypingStart,
  onTypingStop,
}: TextComposerProps) {
  const canSend = useMemo(() => value.trim().length > 0 && !disabled, [value, disabled]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) {
        onSend();
      }
    }
  };

  return (
    <div className="border-t border-slate-700/60 bg-slate-900/90 p-2">
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={onOpenVoiceRecorder}
          className={cn(
            "inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
            recordingActive
              ? "border-red-400/70 bg-red-600/20 text-red-100"
              : "border-amber-500/35 bg-slate-800/70 text-amber-200 hover:bg-slate-700",
          )}
          aria-label="Record voice note"
        >
          <Mic className="h-4 w-4" />
        </button>

        <label className="min-w-0 flex-1">
          <span className="sr-only">Message composer</span>
          <textarea
            value={value}
            onChange={(event) => {
              const nextValue = event.target.value;
              onChange(nextValue);
              if (nextValue.trim().length > 0) {
                onTypingStart();
              } else {
                onTypingStop();
              }
            }}
            onBlur={onTypingStop}
            onKeyDown={handleKeyDown}
            rows={2}
            disabled={disabled}
            placeholder="Send message"
          className="w-full resize-none rounded-lg border border-slate-600/70 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-400/80 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-500/35 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </label>

        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-amber-500/35 bg-amber-700/25 text-amber-100 transition-colors hover:bg-amber-600/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-45"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
