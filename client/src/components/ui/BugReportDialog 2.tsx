import { useEffect, useState } from "react";

import type {
  BugReportCategory,
  BugReportReproFrequency,
  BugReportSource,
} from "@shared/types/bugReport";

import type { BugReportDraftInput, BugReportSubmitResult } from "@/utils/bugReport";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Input } from "./input";
import { Textarea } from "./textarea";

interface BugReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSource: BugReportSource;
  initialCategory: BugReportCategory;
  initialMessage?: string;
  initialExpectedBehavior?: string;
  onSubmit: (draft: BugReportDraftInput) => Promise<BugReportSubmitResult>;
}

const CATEGORY_OPTIONS: Array<{ value: BugReportCategory; label: string }> = [
  { value: "gameplay", label: "Gameplay" },
  { value: "ui", label: "UI" },
  { value: "performance", label: "Performance" },
  { value: "crash", label: "Crash" },
  { value: "multiplayer", label: "Multiplayer" },
  { value: "audio", label: "Audio" },
  { value: "save_load", label: "Save / Load" },
  { value: "other", label: "Other" },
];

const REPRO_OPTIONS: Array<{ value: BugReportReproFrequency; label: string }> = [
  { value: "always", label: "Every time" },
  { value: "sometimes", label: "Sometimes" },
  { value: "once", label: "Just once" },
  { value: "unknown", label: "Not sure" },
];

export function BugReportDialog({
  open,
  onOpenChange,
  initialSource,
  initialCategory,
  initialMessage,
  initialExpectedBehavior,
  onSubmit,
}: BugReportDialogProps) {
  const [category, setCategory] = useState<BugReportCategory>(initialCategory);
  const [playerMessage, setPlayerMessage] = useState(initialMessage ?? "");
  const [expectedBehavior, setExpectedBehavior] = useState(initialExpectedBehavior ?? "");
  const [reproFrequency, setReproFrequency] = useState<BugReportReproFrequency>("sometimes");
  const [contact, setContact] = useState("");
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [includeScreenshot, setIncludeScreenshot] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 768 : true,
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<BugReportSubmitResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setCategory(initialCategory);
    setPlayerMessage(initialMessage ?? "");
    setExpectedBehavior(initialExpectedBehavior ?? "");
    setReproFrequency(initialCategory === "crash" ? "always" : "sometimes");
    setContact("");
    setIncludeDiagnostics(true);
    setIncludeScreenshot(typeof window !== "undefined" ? window.innerWidth >= 768 : true);
    setSubmitting(false);
    setErrorMessage(null);
    setResult(null);
  }, [open, initialCategory, initialExpectedBehavior, initialMessage]);

  const trimmedMessage = playerMessage.trim();
  const canSubmit = trimmedMessage.length >= 10 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const nextResult = await onSubmit({
        source: initialSource,
        category,
        playerMessage,
        expectedBehavior,
        reproFrequency,
        contact,
        includeDiagnostics,
        includeScreenshot,
      });
      setResult(nextResult);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to send bug report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[min(720px,calc(100vw-1rem))] max-w-[720px] border-amber-500/30 bg-gradient-to-br from-stone-950 via-slate-950 to-stone-900 p-0 text-amber-50 shadow-2xl shadow-amber-950/40"
        data-testid="bug-report-dialog"
      >
        <div className="relative overflow-hidden rounded-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.12),transparent_34%)]" />
          <div className="relative space-y-5 p-6">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="font-cinzel text-2xl text-amber-50">
                Something not working?
              </DialogTitle>
              <DialogDescription className="max-w-2xl text-sm text-amber-100/75">
                Tell me what broke in your own words. The report can automatically attach the current game state,
                recent actions, and a screenshot so the issue is easier to reproduce.
              </DialogDescription>
            </DialogHeader>

            {result ? (
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-5">
                <div className="text-lg font-semibold text-emerald-200">
                  {result.queued ? "Report queued" : "Report sent"}
                </div>
                <p className="mt-2 text-sm text-emerald-50/80">
                  {result.queued
                    ? "Your report is saved locally and will retry automatically when the connection is available."
                    : `Saved as ${result.response?.reportId}.`}
                </p>
                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={() => onOpenChange(false)}
                    className="bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                  >
                    Close
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-[1fr_210px]">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-amber-100">What happened?</span>
                    <Textarea
                      value={playerMessage}
                      onChange={(event) => setPlayerMessage(event.target.value)}
                      placeholder="Example: After I ended my turn, the AI moved forever and I could not click anything."
                      className="min-h-[160px] border-amber-500/20 bg-black/30 text-amber-50 placeholder:text-amber-100/35"
                    />
                    <span className="text-xs text-amber-100/45">
                      Required. The more concrete this is, the faster the bug is to pin down.
                    </span>
                  </label>

                  <div className="space-y-4 rounded-2xl border border-white/10 bg-black/25 p-4">
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-amber-100">Category</span>
                      <select
                        value={category}
                        onChange={(event) => setCategory(event.target.value as BugReportCategory)}
                        className="flex h-10 w-full rounded-md border border-amber-500/20 bg-black/35 px-3 py-2 text-sm text-amber-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-300"
                      >
                        {CATEGORY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value} className="bg-slate-950 text-amber-50">
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-amber-100">How often?</span>
                      <select
                        value={reproFrequency}
                        onChange={(event) => setReproFrequency(event.target.value as BugReportReproFrequency)}
                        className="flex h-10 w-full rounded-md border border-amber-500/20 bg-black/35 px-3 py-2 text-sm text-amber-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-300"
                      >
                        {REPRO_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value} className="bg-slate-950 text-amber-50">
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex items-start gap-3 rounded-xl border border-amber-500/15 bg-amber-500/5 p-3">
                      <Checkbox
                        checked={includeDiagnostics}
                        onCheckedChange={(checked) => setIncludeDiagnostics(Boolean(checked))}
                        className="mt-0.5 border-amber-400/70 data-[state=checked]:bg-amber-400 data-[state=checked]:text-slate-950"
                      />
                      <span className="space-y-1">
                        <span className="block text-sm font-medium text-amber-100">Attach diagnostics</span>
                        <span className="block text-xs text-amber-100/55">
                          Includes game state, recent actions, recent errors, and session details.
                        </span>
                      </span>
                    </label>

                    <label className="flex items-start gap-3 rounded-xl border border-sky-400/15 bg-sky-500/5 p-3">
                      <Checkbox
                        checked={includeScreenshot}
                        onCheckedChange={(checked) => setIncludeScreenshot(Boolean(checked))}
                        className="mt-0.5 border-sky-300/70 data-[state=checked]:bg-sky-300 data-[state=checked]:text-slate-950"
                      />
                      <span className="space-y-1">
                        <span className="block text-sm font-medium text-amber-100">Attach screenshot</span>
                        <span className="block text-xs text-amber-100/55">
                          Captures the current board view when available.
                        </span>
                      </span>
                    </label>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-amber-100">What did you expect?</span>
                    <Textarea
                      value={expectedBehavior}
                      onChange={(event) => setExpectedBehavior(event.target.value)}
                      placeholder="Optional, but useful for logic bugs and UI dead-ends."
                      className="min-h-[110px] border-amber-500/20 bg-black/30 text-amber-50 placeholder:text-amber-100/35"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-amber-100">Contact</span>
                    <Input
                      value={contact}
                      onChange={(event) => setContact(event.target.value)}
                      placeholder="Optional email or Discord handle"
                      className="border-amber-500/20 bg-black/30 text-amber-50 placeholder:text-amber-100/35"
                    />
                    <span className="text-xs text-amber-100/45">
                      Only include this if you want follow-up questions.
                    </span>
                  </label>
                </div>

                {errorMessage ? (
                  <div className="rounded-xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                    {errorMessage}
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 border-t border-white/10 pt-4 md:flex-row md:items-center md:justify-between">
                  <p className="text-xs text-amber-100/50">
                    Reports always use the current game session and are rate-limited server-side.
                  </p>
                  <div className="flex gap-3 self-end">
                    <Button
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                      className="border-white/15 bg-white/5 text-amber-50 hover:bg-white/10"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={!canSubmit}
                      className="bg-amber-400 text-slate-950 hover:bg-amber-300 disabled:bg-amber-900/60 disabled:text-amber-100/50"
                    >
                      {submitting ? "Sending..." : "Send report"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default BugReportDialog;
