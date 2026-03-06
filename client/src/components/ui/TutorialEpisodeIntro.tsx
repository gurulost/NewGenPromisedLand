import { motion } from "framer-motion";
import { BookOpen, ChevronLeft, Play } from "lucide-react";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { ContentShell } from "../primitives/ContentShell";
import { PanelHeader } from "../primitives/PanelHeader";
import { StepFretDivider } from "../primitives/StepFretDivider";
import { GlowingButton } from "../primitives/GlowingButton";
import { TempleIcon } from "../primitives/ThematicIcons";
import { HeroBackground } from "./HeroBackground";
import BugReportSupportCallout from "./BugReportSupportCallout";

export default function TutorialEpisodeIntro() {
  const setGamePhase = useLocalGame((state) => state.setGamePhase);
  const startTutorialEpisode = useLocalGame((state) => state.startTutorialEpisode);

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <HeroBackground />

      <div className="relative z-10 w-full max-w-2xl px-4">
        <ContentShell size="lg" shimmerBorder showCornerOrnaments>
          <div className="p-6 md:p-8 space-y-6">
            <PanelHeader
              icon={<TempleIcon size="lg" />}
              title="Tutorial Episode"
              description="A guided, playable story to learn the covenant of the land"
              animated
            />

            <div className="space-y-4 font-body text-amber-100/85 leading-relaxed">
              <p>
                You are not here to conquer for conquest&apos;s sake. You are here to build a people who can endure prosperity
                without being consumed by pride.
              </p>
              <p className="text-amber-100/75">
                This episode is designed to teach the essentials by doing: movement, fog of war, world elements and moral
                choices, technology, workers, combat basics, and a village decision that shows what your values cost.
              </p>
            </div>

            <div className="rounded-xl border border-amber-500/25 bg-gradient-to-br from-slate-950/70 via-slate-900/60 to-slate-950/70 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-amber-300/70">
                <BookOpen className="h-4 w-4" />
                What You&apos;ll Do
              </div>
              <ul className="mt-3 space-y-2 text-sm text-amber-100/90">
                <li>Scout into the fog and uncover an ancient Jaredite ruin.</li>
                <li>Claim knowledge through research, then raise a Worker to shape the land.</li>
                <li>Make a moral choice at a Grain Patch: quick gain or faithful stewardship.</li>
                <li>Face a small patrol, then decide how to bring a village into your fold.</li>
              </ul>
            </div>

            <BugReportSupportCallout />

            <StepFretDivider />

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col gap-3"
            >
              <GlowingButton
                onClick={() => startTutorialEpisode()}
                data-testid="tutorial-begin-episode"
                className="w-full"
                size="lg"
              >
                <span className="flex items-center justify-center gap-2">
                  <Play />
                  Begin Episode
                </span>
              </GlowingButton>

              <GlowingButton
                onClick={() => setGamePhase("menu")}
                className="w-full"
                size="lg"
                variant="secondary"
              >
                <span className="flex items-center justify-center gap-2">
                  <ChevronLeft />
                  Back to Main Menu
                </span>
              </GlowingButton>
            </motion.div>
          </div>
        </ContentShell>
      </div>
    </div>
  );
}
