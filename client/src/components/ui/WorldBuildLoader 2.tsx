import { useEffect, useMemo, useState, useCallback } from "react";
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

// Glyph symbols for the ritual ring
const GLYPHS = ["◇", "△", "○", "☆", "◈", "▽", "⬡", "✦", "⬢", "◎", "✧", "⬣"];

// Orbiting ember configuration
const EMBERS = [
  { radius: 88, size: 6, speed: 18, delay: 0, color: "rgba(251,191,36,0.9)" },
  { radius: 92, size: 4, speed: 22, delay: 2, color: "rgba(254,243,199,0.85)" },
  { radius: 78, size: 5, speed: 16, delay: 4, color: "rgba(251,191,36,0.8)" },
  { radius: 95, size: 3, speed: 28, delay: 1, color: "rgba(226,232,240,0.7)" },
  { radius: 70, size: 4, speed: 14, delay: 3, color: "rgba(251,191,36,0.75)" },
  { radius: 85, size: 5, speed: 20, delay: 5, color: "rgba(254,243,199,0.8)" },
  { radius: 100, size: 3, speed: 32, delay: 0.5, color: "rgba(251,191,36,0.6)" },
  { radius: 65, size: 4, speed: 12, delay: 2.5, color: "rgba(226,232,240,0.65)" },
];

// Twinkling star particles
const STARS = Array.from({ length: 24 }, (_, i) => ({
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 2 + 1,
  delay: Math.random() * 4,
  duration: Math.random() * 2 + 2,
}));

const formatItemLabel = (item?: string) => {
  if (!item) return null;
  const raw = item.split("/").pop() ?? item;
  const trimmed = raw.replace(/\.(glb|png|jpg|jpeg|webm|mp3)$/i, "");
  return trimmed.replace(/[_-]+/g, " ").trim();
};

// Orbiting Ember Component
function OrbitingEmber({ radius, size, speed, delay, color }: typeof EMBERS[0]) {
  return (
    <motion.div
      className="absolute"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 ${size * 2}px ${color}, 0 0 ${size * 4}px ${color}`,
        left: "50%",
        top: "50%",
        marginLeft: -size / 2,
        marginTop: -size / 2,
      }}
      animate={{
        x: [
          Math.cos(0) * radius,
          Math.cos(Math.PI * 0.5) * radius,
          Math.cos(Math.PI) * radius,
          Math.cos(Math.PI * 1.5) * radius,
          Math.cos(Math.PI * 2) * radius,
        ],
        y: [
          Math.sin(0) * radius,
          Math.sin(Math.PI * 0.5) * radius,
          Math.sin(Math.PI) * radius,
          Math.sin(Math.PI * 1.5) * radius,
          Math.sin(Math.PI * 2) * radius,
        ],
        opacity: [0.4, 1, 0.6, 1, 0.4],
        scale: [0.8, 1.2, 0.9, 1.1, 0.8],
      }}
      transition={{
        duration: speed,
        repeat: Infinity,
        ease: "linear",
        delay,
      }}
    />
  );
}

// Ember Trail Component
function EmberTrail({ radius, speed, delay, color }: { radius: number; speed: number; delay: number; color: string }) {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        width: 20,
        height: 2,
        background: `linear-gradient(90deg, ${color}, transparent)`,
        borderRadius: 2,
        left: "50%",
        top: "50%",
        transformOrigin: `${-radius + 10}px center`,
      }}
      animate={{ rotate: 360 }}
      transition={{
        duration: speed,
        repeat: Infinity,
        ease: "linear",
        delay,
      }}
    />
  );
}

// Glyph Ring Component
function GlyphRing({ radius, glyphs, duration, direction = 1 }: {
  radius: number;
  glyphs: string[];
  duration: number;
  direction?: number;
}) {
  return (
    <motion.div
      className="absolute inset-0"
      animate={{ rotate: 360 * direction }}
      transition={{ duration, repeat: Infinity, ease: "linear" }}
    >
      {glyphs.map((glyph, i) => {
        const angle = (i / glyphs.length) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        return (
          <motion.span
            key={i}
            className="absolute text-amber-200/50 font-serif"
            style={{
              left: "50%",
              top: "50%",
              transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
              fontSize: 10,
              textShadow: "0 0 8px rgba(251,191,36,0.5)",
            }}
            animate={{
              opacity: [0.3, 0.7, 0.3],
              textShadow: [
                "0 0 4px rgba(251,191,36,0.3)",
                "0 0 12px rgba(251,191,36,0.7)",
                "0 0 4px rgba(251,191,36,0.3)",
              ],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          >
            {glyph}
          </motion.span>
        );
      })}
    </motion.div>
  );
}

// Central Sigil Component with enhanced geometry
function CentralSigil() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {/* Outer rays */}
      {[0, 45, 90, 135].map((angle) => (
        <motion.div
          key={angle}
          className="absolute h-24 w-0.5 bg-gradient-to-t from-amber-400/60 via-amber-200/30 to-transparent"
          style={{ transform: `rotate(${angle}deg)`, transformOrigin: "center center" }}
          animate={{ opacity: [0.3, 0.6, 0.3], scaleY: [0.9, 1.1, 0.9] }}
          transition={{ duration: 3, repeat: Infinity, delay: angle * 0.01 }}
        />
      ))}

      {/* Inner nested circle */}
      <motion.div
        className="absolute h-20 w-20 rounded-full border border-amber-300/30"
        style={{ boxShadow: "inset 0 0 20px rgba(251,191,36,0.15)" }}
        animate={{ scale: [1, 1.05, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 4, repeat: Infinity }}
      />

      {/* Primary diamond */}
      <motion.div
        className="h-14 w-14 rotate-45 bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600"
        style={{
          boxShadow: "0 0 40px rgba(251,191,36,0.6), 0 0 80px rgba(251,191,36,0.3), inset 0 0 20px rgba(254,243,199,0.4)",
        }}
        animate={{ scale: [1, 1.08, 1], opacity: [0.9, 1, 0.9] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Inner diamond */}
      <motion.div
        className="absolute h-8 w-8 rotate-45 border-2 border-amber-100/50"
        animate={{ scale: [1.1, 0.95, 1.1], rotate: [45, 45, 45] }}
        transition={{ duration: 3.5, repeat: Infinity }}
      />

      {/* Central cross */}
      <div className="absolute h-12 w-0.5 rounded-full bg-amber-100/50 shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
      <div className="absolute h-0.5 w-12 rounded-full bg-amber-100/50 shadow-[0_0_10px_rgba(251,191,36,0.5)]" />

      {/* Pulsing core */}
      <motion.div
        className="absolute h-3 w-3 rounded-full bg-amber-100"
        style={{ boxShadow: "0 0 20px rgba(254,243,199,0.8), 0 0 40px rgba(251,191,36,0.6)" }}
        animate={{ scale: [1, 1.5, 1], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </div>
  );
}

// Stage Surge Effect Component
function StageSurge({ stageKey }: { stageKey: string }) {
  return (
    <motion.div
      key={stageKey}
      className="absolute inset-0 rounded-full pointer-events-none"
      initial={{ scale: 0.3, opacity: 0.9 }}
      animate={{ scale: 2.5, opacity: 0 }}
      transition={{ duration: 1.2, ease: "easeOut" }}
      style={{
        background: "radial-gradient(circle, rgba(251,191,36,0.4) 0%, rgba(251,191,36,0.1) 40%, transparent 70%)",
      }}
    />
  );
}

// Completion Consecration Effect
function ConsecrationFlash({ isComplete }: { isComplete: boolean }) {
  if (!isComplete) return null;

  return (
    <>
      {/* Radial expansion */}
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none"
        initial={{ scale: 1, opacity: 0 }}
        animate={{ scale: 3, opacity: [0, 0.8, 0] }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        style={{
          background: "radial-gradient(circle, rgba(254,243,199,0.6) 0%, rgba(251,191,36,0.3) 30%, transparent 60%)",
        }}
      />
      {/* Flash burst */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={{ background: "rgba(254,243,199,0.3)" }}
      />
    </>
  );
}

// Twinkling Star Component
function TwinklingStar({ x, y, size, delay, duration }: typeof STARS[0]) {
  return (
    <motion.div
      className="absolute rounded-full bg-amber-100"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        boxShadow: `0 0 ${size * 2}px rgba(254,243,199,0.6)`,
      }}
      animate={{
        opacity: [0.2, 0.8, 0.2],
        scale: [0.8, 1.2, 0.8],
      }}
      transition={{
        duration,
        repeat: Infinity,
        delay,
        ease: "easeInOut",
      }}
    />
  );
}

export function WorldBuildLoader({ enabled }: { enabled: boolean }) {
  const { active, progress, item, loaded, total } = useProgress();
  const safeProgress = Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) : 0;
  // Drei progress can plateau just below 100 due floating-point drift even when all assets are loaded.
  // Treat near-100 or fully-loaded counts as complete so the loader can dismiss deterministically.
  const isComplete = safeProgress >= 99.9 || (total > 0 && loaded >= total);
  const isLoading = !isComplete && (active || safeProgress > 0);
  const itemLabel = useMemo(() => formatItemLabel(item), [item]);
  const stage = useMemo(() => {
    const sorted = [...STAGES].sort((a, b) => a.threshold - b.threshold);
    return sorted.reduce((acc, next) => (safeProgress >= next.threshold ? next : acc), sorted[0]);
  }, [safeProgress]);

  const [visible, setVisible] = useState(false);
  const [completedOnce, setCompletedOnce] = useState(false);
  const [completionLatched, setCompletionLatched] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [prevStage, setPrevStage] = useState(stage.title);
  const [showSurge, setShowSurge] = useState(false);
  const [isConsecrating, setIsConsecrating] = useState(false);

  // Detect stage changes for surge effect
  useEffect(() => {
    if (stage.title !== prevStage) {
      setPrevStage(stage.title);
      setShowSurge(true);
      const timer = setTimeout(() => setShowSurge(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [stage.title, prevStage]);

  useEffect(() => {
    if (isComplete && !completionLatched) {
      setCompletionLatched(true);
    }
  }, [isComplete, completionLatched]);

  useEffect(() => {
    if (!enabled || completedOnce) return;
    if (completionLatched) return;

    if (isLoading) {
      if (!visible) {
        setVisible(true);
      }
      if (startedAt === null) {
        setStartedAt(Date.now());
      }
      return;
    }
  }, [enabled, completedOnce, completionLatched, isLoading, visible, startedAt]);

  useEffect(() => {
    if (!enabled || completedOnce || !visible || !completionLatched) return;

    setIsConsecrating((value) => (value ? value : true));

    const elapsed = startedAt ? Date.now() - startedAt : 0;
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
    const timer = window.setTimeout(() => {
      setVisible(false);
      setCompletedOnce(true);
    }, remaining + 1200);

    return () => window.clearTimeout(timer);
  }, [enabled, completedOnce, visible, completionLatched, startedAt]);

  if (!enabled || (!visible && completedOnce)) {
    return null;
  }

  const circumference = Math.PI * 2 * 50;
  const progressOffset = circumference * (1 - Math.max(0.02, safeProgress / 100));

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          data-testid="world-build-loader"
          className={`absolute inset-0 z-[var(--z-critical)] flex items-center justify-center overflow-hidden ${isLoading ? "pointer-events-auto" : "pointer-events-none"}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {/* Deep background */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />

          {/* Ambient glow spots */}
          <div
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, rgba(251,191,36,0.12), transparent 45%), radial-gradient(circle at 80% 20%, rgba(226,232,240,0.08), transparent 50%), radial-gradient(circle at 50% 80%, rgba(251,191,36,0.1), transparent 55%)"
            }}
          />

          {/* Shimmer sweep - priest's lamp */}
          <motion.div
            className="absolute inset-0 opacity-25"
            style={{
              backgroundImage:
                "linear-gradient(120deg, transparent 0%, rgba(251,191,36,0.15) 40%, rgba(254,243,199,0.12) 50%, rgba(226,232,240,0.1) 55%, transparent 70%)"
            }}
            animate={{ x: ["-80%", "80%"] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Stone texture grid */}
          <div
            className="absolute inset-0 opacity-20 mix-blend-soft-light"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(251,191,36,0.1) 0 1px, transparent 1px 6px), repeating-linear-gradient(90deg, rgba(148,163,184,0.1) 0 1px, transparent 1px 7px)"
            }}
          />

          {/* Twinkling stars background */}
          <div className="absolute inset-0 pointer-events-none">
            {STARS.map((star, i) => (
              <TwinklingStar key={i} {...star} />
            ))}
          </div>

          {/* Slow-drifting cosmic dust */}
          <motion.div
            className="absolute inset-0 opacity-15"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(251,191,36,0.6) 1px, transparent 2px)",
              backgroundSize: "100px 100px"
            }}
            animate={{ backgroundPosition: ["0px 0px", "80px 160px"] }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          />

          {/* Soft outer halos */}
          <div className="absolute inset-0 opacity-25 mix-blend-screen pointer-events-none">
            <div className="absolute -top-24 left-1/2 h-[400px] w-[400px] -translate-x-1/2 rounded-full border border-amber-200/25 blur-2xl" />
            <div className="absolute -bottom-32 left-1/3 h-[350px] w-[350px] rounded-full border border-cyan-200/15 blur-2xl" />
          </div>

          {/* Main content */}
          <div className="relative z-10 flex w-full max-w-2xl flex-col items-center px-6 text-center">
            {/* Sacred Seal Container */}
            <div className="relative h-64 w-64">
              {/* Consecration flash on completion */}
              <ConsecrationFlash isComplete={isConsecrating} />

              {/* Stage surge effect */}
              <AnimatePresence>
                {showSurge && <StageSurge stageKey={stage.title} />}
              </AnimatePresence>

              {/* Outermost aura */}
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle, rgba(251,191,36,0.25) 0%, rgba(251,191,36,0.06) 40%, transparent 70%)"
                }}
                animate={{ opacity: [0.4, 0.7, 0.4], scale: [0.95, 1.08, 0.95] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              />

              {/* Outer rotating conic ring */}
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    "conic-gradient(from 90deg, rgba(251,191,36,0.2), rgba(251,191,36,0.04), rgba(226,232,240,0.1), rgba(251,191,36,0.2))",
                  maskImage:
                    "radial-gradient(circle, transparent 56%, black 58%, black 66%, transparent 68%)",
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              />

              {/* Glyph ring - outer */}
              <GlyphRing radius={100} glyphs={GLYPHS} duration={45} direction={1} />

              {/* Segmented ring */}
              <motion.div
                className="absolute inset-3 rounded-full"
                style={{
                  background:
                    "repeating-conic-gradient(from 0deg, rgba(251,191,36,0.5) 0deg 5deg, transparent 5deg 10deg)",
                  maskImage:
                    "radial-gradient(circle, transparent 60%, black 62%, black 66%, transparent 68%)",
                }}
                animate={{ rotate: -360 }}
                transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
              />

              {/* Inner conic gradient ring */}
              <motion.div
                className="absolute inset-5 rounded-full"
                style={{
                  background:
                    "conic-gradient(from 0deg, rgba(226,232,240,0.12), rgba(251,191,36,0.3), rgba(226,232,240,0.12))",
                  maskImage:
                    "radial-gradient(circle, transparent 54%, black 55%, black 58%, transparent 60%)",
                }}
                animate={{ rotate: -360 }}
                transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
              />

              {/* Glowing border ring */}
              <motion.div
                className="absolute inset-8 rounded-full border border-amber-200/35"
                style={{
                  boxShadow: "0 0 30px rgba(251,191,36,0.2), inset 0 0 20px rgba(251,191,36,0.1)",
                }}
                animate={{ rotate: -360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              />

              {/* Glyph ring - inner */}
              <GlyphRing radius={68} glyphs={GLYPHS.slice(0, 8)} duration={35} direction={-1} />

              {/* Mid ring with conic gradient */}
              <motion.div
                className="absolute inset-12 rounded-full"
                style={{
                  background:
                    "conic-gradient(from 270deg, rgba(148,163,184,0.15), rgba(251,191,36,0.22), rgba(148,163,184,0.08))",
                  maskImage:
                    "radial-gradient(circle, transparent 50%, black 52%, black 60%, transparent 62%)",
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
              />

              {/* Inner decorative rings */}
              <motion.div
                className="absolute inset-[70px] rounded-full border border-amber-100/25"
                animate={{ rotate: -360 }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="absolute inset-[85px] rounded-full border border-amber-200/20"
                animate={{ rotate: 360 }}
                transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
              />

              {/* Central Sigil */}
              <CentralSigil />

              {/* Orbiting Embers */}
              <div className="absolute inset-0 flex items-center justify-center">
                {EMBERS.map((ember, i) => (
                  <OrbitingEmber key={i} {...ember} />
                ))}
              </div>

              {/* Ember trails */}
              <div className="absolute inset-0 flex items-center justify-center opacity-40">
                {EMBERS.slice(0, 4).map((ember, i) => (
                  <EmberTrail
                    key={i}
                    radius={ember.radius}
                    speed={ember.speed}
                    delay={ember.delay}
                    color={ember.color}
                  />
                ))}
              </div>

              {/* Ambient blur glow */}
              <div className="absolute inset-0 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
            </div>

            {/* Title */}
            <motion.div
              className="mt-10 text-3xl font-cinzel font-semibold uppercase tracking-[0.24em]"
              animate={{
                textShadow: [
                  "0 0 20px rgba(251,191,36,0.3)",
                  "0 0 40px rgba(251,191,36,0.5)",
                  "0 0 20px rgba(251,191,36,0.3)",
                ]
              }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              <span className="bg-gradient-to-r from-amber-100 via-amber-300 to-amber-100 bg-clip-text text-transparent">
                The World is Awakening
              </span>
            </motion.div>

            {/* Decorative separator */}
            <motion.div
              className="mt-3 flex items-center gap-3 text-amber-200/40"
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <span className="h-px w-8 bg-gradient-to-r from-transparent to-amber-200/40" />
              <span className="text-xs tracking-[0.4em]">✦ ✦ ✦</span>
              <span className="h-px w-8 bg-gradient-to-l from-transparent to-amber-200/40" />
            </motion.div>

            {/* Stage messaging */}
            <AnimatePresence mode="wait">
              <motion.div
                key={stage.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                <div className="mt-4 text-sm font-body uppercase tracking-[0.34em] text-amber-300/80">
                  {stage.title}
                </div>
                <div className="mt-3 text-base font-body text-amber-100/70 max-w-sm">
                  {stage.message}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Ritual Arc Progress (Hero) */}
            <div className="mt-10 flex flex-col items-center">
              <svg viewBox="0 0 120 120" className="h-32 w-32">
                <defs>
                  <linearGradient id="ritualArcGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="50%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#fef3c7" />
                  </linearGradient>
                  <filter id="arcGlow">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Background track with tick marks */}
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  stroke="rgba(148,163,184,0.2)"
                  strokeWidth="4"
                  fill="none"
                />

                {/* Tick marks like a sundial */}
                {Array.from({ length: 24 }).map((_, i) => {
                  const angle = (i / 24) * Math.PI * 2 - Math.PI / 2;
                  const innerR = i % 6 === 0 ? 42 : 45;
                  const outerR = 50;
                  return (
                    <line
                      key={i}
                      x1={60 + Math.cos(angle) * innerR}
                      y1={60 + Math.sin(angle) * innerR}
                      x2={60 + Math.cos(angle) * outerR}
                      y2={60 + Math.sin(angle) * outerR}
                      stroke="rgba(251,191,36,0.3)"
                      strokeWidth={i % 6 === 0 ? 2 : 1}
                    />
                  );
                })}

                {/* Progress arc */}
                <motion.circle
                  cx="60"
                  cy="60"
                  r="50"
                  stroke="url(#ritualArcGradient)"
                  strokeWidth="5"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  filter="url(#arcGlow)"
                  animate={{ strokeDashoffset: progressOffset }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  style={{ transformOrigin: "60px 60px", transform: "rotate(-90deg)" }}
                />

                {/* Center percentage */}
                <text
                  x="60"
                  y="60"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="rgba(254,243,199,0.9)"
                  fontSize="16"
                  fontFamily="Cinzel, serif"
                  fontWeight="600"
                >
                  {Math.round(safeProgress)}%
                </text>
                <text
                  x="60"
                  y="75"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="rgba(251,191,36,0.5)"
                  fontSize="7"
                  fontFamily="sans-serif"
                  letterSpacing="0.15em"
                >
                  SEALED
                </text>
              </svg>

              {/* Pulsing underline */}
              <motion.div
                className="mt-2 h-px w-24 bg-gradient-to-r from-transparent via-amber-200/60 to-transparent"
                animate={{ opacity: [0.3, 0.8, 0.3], scaleX: [0.9, 1.1, 0.9] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>

            {/* Asset counter */}
            {total > 0 && (
              <motion.div
                className="mt-4 text-xs font-body text-amber-200/50"
                animate={{ opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                Weaving {loaded} of {total} elements
              </motion.div>
            )}

            {/* Current item label */}
            {itemLabel && (
              <div className="mt-2 text-xs font-body text-amber-100/40 italic">
                ✦ {itemLabel}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
