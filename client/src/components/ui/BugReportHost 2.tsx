import { useEffect, useState } from "react";

import type { BugReportCategory, BugReportSource } from "@shared/types/bugReport";

import {
  BUG_REPORT_OPEN_EVENT,
  flushQueuedBugReports,
  isBugReportingEnabled,
  submitBugReport,
} from "@/utils/bugReport";
import { capture } from "@/utils/telemetry/posthog";

import { useVisualFeedback } from "./VisualFeedback";
import BugReportDialog from "./BugReportDialog";

interface OpenState {
  source: BugReportSource;
  category: BugReportCategory;
  playerMessage?: string;
  expectedBehavior?: string;
}

const DEFAULT_OPEN_STATE: OpenState = {
  source: "desktop_corner",
  category: "gameplay",
};

export function BugReportHost() {
  const [isOpen, setIsOpen] = useState(false);
  const [openState, setOpenState] = useState<OpenState>(DEFAULT_OPEN_STATE);
  const { showToast } = useVisualFeedback();

  useEffect(() => {
    if (!isBugReportingEnabled() || typeof window === "undefined") return;

    const flush = async (announce = false) => {
      const result = await flushQueuedBugReports();
      if (announce && result.sentCount > 0) {
        showToast(`Queued reports sent: ${result.sentCount}`, "success");
      }
    };

    void flush(false);
    const handleOnline = () => {
      void flush(true);
    };
    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<Partial<OpenState>>).detail ?? {};
      setOpenState({
        source: detail.source ?? "desktop_corner",
        category: detail.category ?? "gameplay",
        playerMessage: detail.playerMessage,
        expectedBehavior: detail.expectedBehavior,
      });
      setIsOpen(true);
      capture("bug_report_opened", {
        source: detail.source ?? "desktop_corner",
        category: detail.category ?? "gameplay",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener(BUG_REPORT_OPEN_EVENT, handleOpen as EventListener);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener(BUG_REPORT_OPEN_EVENT, handleOpen as EventListener);
    };
  }, [showToast]);

  if (!isBugReportingEnabled()) return null;

  return (
    <BugReportDialog
      open={isOpen}
      onOpenChange={setIsOpen}
      initialSource={openState.source}
      initialCategory={openState.category}
      initialMessage={openState.playerMessage}
      initialExpectedBehavior={openState.expectedBehavior}
      onSubmit={async (draft) => {
        const result = await submitBugReport(draft);
        if (result.queued) {
          showToast("Bug report queued. It will retry automatically.", "warning");
        } else if (result.response?.reportId) {
          showToast(`Report sent: ${result.response.reportId}`, "success");
        }
        return result;
      }}
    />
  );
}

export default BugReportHost;
