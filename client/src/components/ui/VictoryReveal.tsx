import { motion } from "framer-motion";
import { Crown, Landmark, Sparkles, SkipForward } from "lucide-react";

import { GlowingButton } from "../primitives/GlowingButton";
import { Badge } from "./badge";
import { useHotkeys } from "../../hooks/useHotkeys";
import type { VictoryType } from "../../lib/victoryPresentation";
import { getVictoryTheme } from "../../lib/victoryPresentation";

interface VictoryRevealProps {
  winnerName: string;
  factionName: string;
  victoryType: VictoryType;
  turn: number;
  focusCityName?: string | null;
  onSkip: () => void;
}

export function VictoryReveal({
  winnerName,
  factionName,
  victoryType,
  turn,
  focusCityName,
  onSkip,
}: VictoryRevealProps) {
  const theme = getVictoryTheme(victoryType);

  useHotkeys("Enter", onSkip);
  useHotkeys("Space", onSkip);

  return (
    <div
      className="fixed inset-0 z-[calc(var(--z-modal-backdrop)+8)] overflow-hidden pointer-events-auto"
      data-ui-layer="modal"
      role="dialog"
      aria-modal="true"
      aria-label="Victory reveal"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${theme.heroClass}`} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_55%)]" />
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />

      {[0, 1, 2, 3].map((index) => (
        <motion.div
          key={index}
          className={`absolute left-1/2 top-1/2 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br ${theme.glowClass} blur-3xl`}
          initial={{ opacity: 0, scale: 0.78 }}
          animate={{ opacity: 0.8 - index * 0.14, scale: 1 + index * 0.18 }}
          transition={{ duration: 1.2, delay: index * 0.14, ease: "easeOut" }}
        />
      ))}

      {[0, 1, 2, 3, 4, 5].map((index) => (
        <motion.div
          key={`ring-${index}`}
          className={`absolute left-1/2 top-1/2 h-[22rem] w-[22rem] -translate-x-1/2 -translate-y-1/2 rounded-full border ${theme.edgeClass}`}
          initial={{ opacity: 0, scale: 0.45 }}
          animate={{ opacity: [0, 0.35, 0], scale: [0.45, 1.08 + index * 0.15, 1.22 + index * 0.18] }}
          transition={{ duration: 2.6, delay: index * 0.24, ease: "easeOut" }}
        />
      ))}

      <div className="absolute inset-x-0 top-5 flex justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3 rounded-full border border-white/12 bg-black/30 px-4 py-2 text-xs uppercase tracking-[0.34em] text-amber-100/80 backdrop-blur-md"
        >
          <Sparkles className="h-4 w-4 text-amber-200" />
          {theme.banner}
        </motion.div>
      </div>

      <div className="relative z-10 flex h-full items-center justify-center px-4 py-16">
        <div className="mx-auto max-w-5xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.7, ease: "easeOut" }}
            className="space-y-6"
          >
            <Badge className={`${theme.badgeClass} rounded-full px-4 py-2 text-xs uppercase tracking-[0.32em]`}>
              {theme.shortTitle} Victory
            </Badge>

            <div className="space-y-4">
              <div className="text-[11px] uppercase tracking-[0.48em] text-amber-100/60">
                Final turn {turn}
              </div>
              <h1 className="font-cinzel text-5xl font-semibold leading-none text-amber-50 sm:text-7xl">
                {winnerName}
              </h1>
              <div className="text-xl font-body text-amber-100/86 sm:text-2xl">
                {theme.title}
              </div>
            </div>

            <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-3 text-sm text-amber-100/80">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-md">
                <Crown className="h-4 w-4" />
                {factionName}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-md">
                <Landmark className="h-4 w-4" />
                {focusCityName ? `Capital focus: ${focusCityName}` : "The world pauses to witness the end"}
              </div>
            </div>

            <p className="mx-auto max-w-3xl text-lg leading-relaxed text-amber-100/72 sm:text-xl">
              {theme.revealLine}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.6 }}
            className="mt-10 flex justify-center"
          >
            <GlowingButton
              onClick={onSkip}
              variant="secondary"
              glowColor="slate"
              size="lg"
              className="min-w-[220px]"
            >
              <span className="flex items-center justify-center gap-2">
                <SkipForward className="h-5 w-5" />
                Continue To Report
              </span>
            </GlowingButton>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
