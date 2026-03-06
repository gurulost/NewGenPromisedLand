import { MessageSquareText } from "lucide-react";
import clsx from "clsx";

import type { BugReportCategory, BugReportSource } from "@shared/types/bugReport";

import { useMobileUI } from "@/hooks/useMobileUI";
import { isBugReportingEnabled, openBugReportDialog } from "@/utils/bugReport";
import { capture } from "@/utils/telemetry/posthog";
import { getBugReportEntryLabel, getPregameBugReportGuidance } from "@/utils/bugReportGuidance";

import { Button } from "./button";

interface BugReportSupportCalloutProps {
  className?: string;
  source?: BugReportSource;
  category?: BugReportCategory;
  title?: string;
}

export function BugReportSupportCallout({
  className,
  source = "start_flow_hint",
  category = "ui",
  title = "If something breaks",
}: BugReportSupportCalloutProps) {
  const { isMobileUI } = useMobileUI();

  if (!isBugReportingEnabled()) return null;

  const entryLabel = getBugReportEntryLabel(isMobileUI);
  const guidance = getPregameBugReportGuidance(isMobileUI);

  const handleOpen = () => {
    capture("bug_report_guidance_cta_clicked", {
      surface: "start_flow",
      entry: isMobileUI ? "mobile" : "desktop",
    });
    openBugReportDialog({ source, category });
  };

  return (
    <div
      data-testid="bug-report-support-callout"
      className={clsx(
        "rounded-2xl border border-amber-500/25 bg-gradient-to-br from-slate-950/85 via-slate-900/75 to-stone-950/85 p-4 shadow-[0_18px_45px_-24px_rgba(251,191,36,0.5)]",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-500/10 text-amber-200">
          <MessageSquareText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-amber-300/70">Playtest Help</div>
            <h3 className="mt-1 text-sm font-semibold text-amber-50">{title}</h3>
          </div>
          <p className="text-sm leading-relaxed text-amber-100/78">{guidance}</p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              type="button"
              size="sm"
              onClick={handleOpen}
              className="bg-amber-300 text-slate-950 hover:bg-amber-200"
            >
              Open report form
            </Button>
            <span className="text-xs text-amber-100/55">
              During play: <span className="font-medium text-amber-100/75">{entryLabel}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BugReportSupportCallout;
