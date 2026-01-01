import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useProgress } from "@react-three/drei";

const MIN_VISIBLE_MS = 900;

const STAGES = [
  {
    threshold: 0,
    title: "Forging the Firmament",
    message: "Stone is rising. The land is finding its shape."
  },
  {
    threshold: 30,
    title: "The Veil is Lifting",
    message: "Light is threading through fog and shadow."
  },
  {
    threshold: 60,
    title: "The People are Gathering",
    message: "Paths are being woven. Banners are stirring."
  },
  {
    threshold: 86,
    title: "The Covenant is Sealing",
    message: "The world is bound and ready for its stewards."
  }
];

const formatItemLabel = (item?: string) => {
  if (!item) return null;
  const raw = item.split("/").pop() ?? item;
  const trimmed = raw.replace(/\.(glb|png|jpg|jpeg|webm|mp3)$/i, "");
  return trimmed.replace(/[_-]+/g, " ").trim();
};

export function WorldBuildLoader({ enabled }: { enabled: boolean }) {
  const { active, progress, item, loaded, total } = useProgress();
  const safeProgress = Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) : 0;
  const itemLabel = useMemo(() => formatItemLabel(item), [item]);
  const stage = useMemo(() => {
    const sorted = [...STAGES].sort((a, b) => a.threshold - b.threshold);
    return sorted.reduce((acc, next) => (safeProgress >= next.threshold ? next : acc), sorted[0]);
  }, [safeProgress]);

  const [visible, setVisible] = useState(false);
  const [completedOnce, setCompletedOnce] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled || completedOnce) return;
    const isLoading =
      active ||
      (safeProgress > 0 && safeProgress < 100) ||
      (total > 0 && safeProgress < 100);

    if (isLoading) {
      if (!visible) {
        setVisible(true);
      }
      if (startedAt === null) {
        setStartedAt(Date.now());
      }
      return;
    }

    if (visible) {
      const elapsed = startedAt ? Date.now() - startedAt : 0;
      const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
      const timer = window.setTimeout(() => {
        setVisible(false);
        setCompletedOnce(true);
      }, remaining);
      return () => window.clearTimeout(timer);
    }
  }, [enabled, completedOnce, active, safeProgress, total, visible, startedAt]);

  if (!enabled || (!visible && completedOnce)) {
    return null;
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute inset-0 z-[9999] flex items-center justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
          <div
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, rgba(251,191,36,0.12), transparent 45%), radial-gradient(circle at 80% 20%, rgba(226,232,240,0.08), transparent 50%), radial-gradient(circle at 50% 80%, rgba(251,191,36,0.1), transparent 55%)"
            }}
          />
          <motion.div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "linear-gradient(120deg, transparent 0%, rgba(251,191,36,0.12) 40%, rgba(226,232,240,0.1) 55%, transparent 70%)"
            }}
            animate={{ x: ["-60%", "60%"] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          <div
            className="absolute inset-0 opacity-25 mix-blend-soft-light"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(251,191,36,0.08) 0 1px, transparent 1px 7px), repeating-linear-gradient(90deg, rgba(148,163,184,0.08) 0 1px, transparent 1px 8px)"
            }}
          />
          <motion.div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(251,191,36,0.55) 1px, transparent 2px)",
              backgroundSize: "140px 140px"
            }}
            animate={{ backgroundPosition: ["0px 0px", "120px 240px"] }}
            transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
          />
          <div className="absolute inset-0 opacity-30 mix-blend-screen">
            <div className="absolute -top-24 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full border border-amber-200/30 blur-2xl" />
            <div className="absolute -bottom-32 left-1/3 h-[380px] w-[380px] rounded-full border border-cyan-200/20 blur-2xl" />
          </div>

          <div className="relative z-10 flex w-full max-w-2xl flex-col items-center px-6 text-center">
            <div className="relative h-56 w-56">
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle, rgba(251,191,36,0.3) 0%, rgba(251,191,36,0.08) 35%, transparent 65%)"
                }}
                animate={{ opacity: [0.4, 0.7, 0.4], scale: [0.96, 1.06, 0.96] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    "conic-gradient(from 90deg, rgba(251,191,36,0.2), rgba(251,191,36,0.05), rgba(226,232,240,0.12), rgba(251,191,36,0.2))",
                  maskImage:
                    "radial-gradient(circle, transparent 58%, black 60%, black 68%, transparent 70%)",
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="absolute inset-2 rounded-full"
                style={{
                  background:
                    "repeating-conic-gradient(from 0deg, rgba(251,191,36,0.55) 0deg 6deg, transparent 6deg 12deg)",
                  maskImage:
                    "radial-gradient(circle, transparent 62%, black 64%, black 68%, transparent 70%)",
                }}
                animate={{ rotate: -360 }}
                transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="absolute inset-3 rounded-full"
                style={{
                  background:
                    "conic-gradient(from 0deg, rgba(226,232,240,0.15), rgba(251,191,36,0.35), rgba(226,232,240,0.15))",
                  maskImage:
                    "radial-gradient(circle, transparent 55%, black 56%, black 58%, transparent 60%)",
                }}
                animate={{ rotate: -360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="absolute inset-6 rounded-full border border-amber-200/30"
                style={{
                  boxShadow: "0 0 35px rgba(251,191,36,0.2)",
                }}
                animate={{ rotate: -360 }}
                transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="absolute inset-10 rounded-full"
                style={{
                  background:
                    "conic-gradient(from 270deg, rgba(148,163,184,0.2), rgba(251,191,36,0.25), rgba(148,163,184,0.1))",
                  maskImage:
                    "radial-gradient(circle, transparent 52%, black 54%, black 62%, transparent 64%)",
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="absolute inset-16 rounded-full border border-amber-100/20"
                animate={{ rotate: -360 }}
                transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="absolute inset-20 rounded-full border border-amber-200/20"
                animate={{ rotate: 360 }}
                transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                key={stage.title}
                className="absolute inset-0 rounded-full bg-amber-200/20"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 0.25, scale: 1.25 }}
                transition={{ duration: 1.1, ease: "easeOut" }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  className="h-16 w-16 rotate-45 bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 shadow-2xl shadow-amber-500/50"
                  animate={{ scale: [1, 1.08, 1], opacity: [0.9, 1, 0.9] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                />
                <div className="absolute h-14 w-1 rounded-full bg-amber-100/40 shadow-[0_0_8px_rgba(251,191,36,0.4)]" />
                <div className="absolute h-1 w-14 rounded-full bg-amber-100/40 shadow-[0_0_8px_rgba(251,191,36,0.4)]" />
              </div>
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                animate={{ rotate: 360 }}
                transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
              >
                <div className="absolute top-1 h-2 w-2 rounded-full bg-amber-200/80 shadow-[0_0_10px_rgba(251,191,36,0.7)]" />
                <div className="absolute bottom-2 h-1.5 w-1.5 rounded-full bg-amber-100/70 shadow-[0_0_10px_rgba(251,191,36,0.45)]" />
              </motion.div>
              <div className="absolute inset-0 rounded-full bg-amber-500/10 blur-3xl" />
              <div className="absolute inset-0 opacity-30">
                <div className="absolute left-1/2 top-2 h-2 w-2 -translate-x-1/2 rounded-full bg-amber-200/70 shadow-[0_0_12px_rgba(251,191,36,0.7)]" />
                <div className="absolute right-6 top-1/2 h-1.5 w-1.5 rounded-full bg-cyan-200/70 shadow-[0_0_10px_rgba(34,211,238,0.6)]" />
                <div className="absolute bottom-4 left-10 h-1.5 w-1.5 rounded-full bg-amber-100/60 shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
              </div>
            </div>

            <div className="mt-8 text-3xl font-cinzel font-semibold uppercase tracking-[0.24em] text-amber-100">
              <span className="bg-gradient-to-r from-amber-100 via-amber-300 to-amber-100 bg-clip-text text-transparent">
                The World is Awakening
              </span>
            </div>
            <div className="mt-2 text-[0.65rem] font-body uppercase tracking-[0.5em] text-amber-200/40">
              ===
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={stage.title}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <div className="mt-3 text-sm font-body uppercase tracking-[0.34em] text-amber-300/70">
                  {stage.title}
                </div>
                <div className="mt-3 text-base font-body text-amber-100/80">
                  {stage.message}
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="mt-8 w-full max-w-md">
              <div className="flex items-center justify-between text-[0.7rem] uppercase tracking-[0.26em] text-amber-200/60 font-body">
                <span>World Weave</span>
                <span className="tabular-nums">{Math.round(safeProgress)}%</span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-amber-100/10">
                <motion.div
                  className="h-full bg-gradient-to-r from-amber-300 via-amber-400 to-amber-200"
                  initial={false}
                  animate={{ width: `${Math.max(6, safeProgress)}%` }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
              </div>
              <motion.div
                className="mt-1 h-px w-full bg-gradient-to-r from-transparent via-amber-200/70 to-transparent"
                animate={{ opacity: [0.2, 0.8, 0.2] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="mt-4 flex items-center justify-center">
                <svg viewBox="0 0 120 120" className="h-28 w-28">
                  <defs>
                    <linearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#fbbf24" />
                      <stop offset="50%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#fef3c7" />
                    </linearGradient>
                  </defs>
                  <circle
                    cx="60"
                    cy="60"
                    r="46"
                    stroke="rgba(148,163,184,0.25)"
                    strokeWidth="6"
                    fill="none"
                  />
                  <motion.circle
                    cx="60"
                    cy="60"
                    r="46"
                    stroke="url(#arcGradient)"
                    strokeWidth="6"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={Math.PI * 2 * 46}
                    animate={{
                      strokeDashoffset:
                        Math.PI * 2 * 46 * (1 - Math.max(0.02, safeProgress / 100)),
                    }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    style={{ transformOrigin: "60px 60px", transform: "rotate(-90deg)" }}
                  />
                </svg>
              </div>
              {total > 0 && (
                <div className="mt-2 text-xs font-body text-amber-200/60">
                  Assets {loaded}/{total}
                </div>
              )}
              {itemLabel && (
                <div className="mt-3 text-xs font-body text-amber-100/50">
                  Loading {itemLabel}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
