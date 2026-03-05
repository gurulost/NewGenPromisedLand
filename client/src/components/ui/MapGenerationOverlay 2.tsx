import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useLocalGame } from "../../lib/stores/useLocalGame";

const MESSAGES = [
  "Raising the landforms…",
  "Seeding the wilderness…",
  "Guiding the first settlements…",
];

const pickMessage = () => MESSAGES[Math.floor(Math.random() * MESSAGES.length)];

export function MapGenerationOverlay() {
  const isGeneratingMap = useLocalGame((state) => state.isGeneratingMap);
  const message = useMemo(
    () => (isGeneratingMap ? pickMessage() : MESSAGES[0]),
    [isGeneratingMap]
  );

  return (
    <AnimatePresence>
      {isGeneratingMap && (
        <motion.div
          className="fixed inset-0 z-[var(--z-tutorial)] flex items-center justify-center bg-slate-950/80 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="rounded-2xl border border-amber-500/40 bg-slate-900/80 px-8 py-6 text-center text-amber-100 shadow-2xl"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 160, damping: 18 }}
          >
            <div className="flex items-center justify-center gap-2 text-lg font-semibold text-amber-200">
              <Sparkles className="h-5 w-5 animate-pulse" />
              Forging the World
            </div>
            <div className="mt-2 text-sm text-amber-100/70">{message}</div>
            <div className="mt-4 flex justify-center">
              <span className="h-2 w-2 animate-bounce rounded-full bg-amber-300" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
