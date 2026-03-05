import { memo } from "react";

import { cn } from "@/lib/utils";

interface VoiceMessageWaveformProps {
  peaks: number[];
  progress: number;
  className?: string;
}

function normalizePeaks(peaks: number[], sampleCount = 48): number[] {
  if (!Array.isArray(peaks) || peaks.length === 0) {
    return Array.from({ length: sampleCount }, (_, index) => (index % 4 === 0 ? 0.7 : 0.35));
  }

  if (peaks.length <= sampleCount) {
    return peaks.map((value) => Math.min(1, Math.max(0.08, value)));
  }

  const step = peaks.length / sampleCount;
  return Array.from({ length: sampleCount }, (_, index) => {
    const start = Math.floor(index * step);
    const end = Math.min(peaks.length, Math.floor((index + 1) * step));
    const slice = peaks.slice(start, end);
    const average = slice.reduce((sum, value) => sum + value, 0) / Math.max(1, slice.length);
    return Math.min(1, Math.max(0.08, average));
  });
}

export const VoiceMessageWaveform = memo(function VoiceMessageWaveform({
  peaks,
  progress,
  className,
}: VoiceMessageWaveformProps) {
  const normalized = normalizePeaks(peaks);
  const clampedProgress = Math.min(1, Math.max(0, progress));

  return (
    <div
      className={cn(
        "flex h-8 items-end gap-[2px] rounded-md bg-slate-900/40 px-2 py-1",
        className,
      )}
      aria-hidden="true"
    >
      {normalized.map((heightFactor, index) => {
        const threshold = (index + 1) / normalized.length;
        const isPlayed = threshold <= clampedProgress;
        return (
          <span
            key={`${index}_${heightFactor}`}
            className={cn(
              "block w-[3px] rounded-full transition-colors duration-150",
              isPlayed ? "bg-amber-300" : "bg-slate-500/60",
            )}
            style={{ height: `${Math.round(5 + heightFactor * 20)}px` }}
          />
        );
      })}
    </div>
  );
});
