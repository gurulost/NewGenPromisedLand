import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquareText } from "lucide-react";
import clsx from "clsx";

import { isBugReportingEnabled, openBugReportDialog } from "@/utils/bugReport";
import {
  getInGameBugReportGuidance,
  markBugReportMatchHintSeen,
  shouldShowBugReportMatchHint,
} from "@/utils/bugReportGuidance";
import { capture } from "@/utils/telemetry/posthog";

import { Button } from "./button";

interface BugReportStartHintProps {
  gameId: string;
  turn: number;
  isMobile: boolean;
  blocked?: boolean;
}

export function BugReportStartHint({ gameId, turn, isMobile, blocked = false }: BugReportStartHintProps) {
  const enabled = isBugReportingEnabled();
  const [visible, setVisible] = useState(() =>
    !blocked && shouldShowBugReportMatchHint({ enabled, gameId, turn }),
  );
  const announcedGameIdRef = useRef<string | null>(null);

  useEffect(() => {
    const nextVisible = shouldShowBugReportMatchHint({ enabled, gameId, turn });
    if (!nextVisible || blocked) {
      setVisible(false);
      return;
    }

    setVisible(true);

    markBugReportMatchHintSeen(gameId);
    if (announcedGameIdRef.current === gameId) return;
    announcedGameIdRef.current = gameId;
    capture("bug_report_guidance_shown", {
      surface: "in_game",
      entry: isMobile ? "mobile" : "desktop",
    });
  }, [blocked, enabled, gameId, isMobile, turn]);

  if (!enabled || !visible) return null;

  const dismiss = () => {
    setVisible(false);
    capture("bug_report_guidance_dismissed", {
      surface: "in_game",
      entry: isMobile ? "mobile" : "desktop",
    });
  };

  const handleReportNow = () => {
    capture("bug_report_guidance_cta_clicked", {
      surface: "in_game",
      entry: isMobile ? "mobile" : "desktop",
    });
    setVisible(false);
    openBugReportDialog({
      source: "in_game_hint",
      category: "gameplay",
    });
  };

  return (
    <AnimatePresence>
      <motion.aside
        key={gameId}
        initial={{ opacity: 0, y: isMobile ? -12 : 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: isMobile ? -10 : 10, scale: 0.98 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        data-testid="bug-report-start-hint"
        className={clsx(
          "pointer-events-auto rounded-2xl border border-amber-400/25 bg-[linear-gradient(145deg,rgba(15,23,42,0.96),rgba(41,37,36,0.95))] p-4 text-amber-50 shadow-[0_22px_50px_-24px_rgba(0,0,0,0.75)] ring-1 ring-white/8 backdrop-blur-md",
          isMobile
            ? "fixed left-3 right-3 z-[var(--z-floating)]"
            : "w-[min(22rem,calc(100vw-5rem))] self-end",
        )}
        style={isMobile ? { top: "calc(var(--mobile-hud-height, 0px) + 0.75rem)" } : undefined}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-500/10 text-amber-200">
            <MessageSquareText className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <div className="text-[11px] uppercase tracking-[0.25em] text-amber-300/70">Playtest Help</div>
              <h3 className="mt-1 text-sm font-semibold text-amber-50">If something breaks mid-match</h3>
            </div>
            <p className="text-sm leading-relaxed text-amber-100/78">{getInGameBugReportGuidance(isMobile)}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="bg-white/8 text-amber-100 hover:bg-white/14"
                onClick={dismiss}
              >
                Noted
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-amber-300 text-slate-950 hover:bg-amber-200"
                onClick={handleReportNow}
              >
                Report now
              </Button>
            </div>
          </div>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}

export default BugReportStartHint;
