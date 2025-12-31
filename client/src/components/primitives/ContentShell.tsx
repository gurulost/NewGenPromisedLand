import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

import { useReducedMotion } from '../../hooks/useReducedMotion';
import { usePerformanceMode } from '../../hooks/usePerformanceMode';

interface ContentShellProps {
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  className?: string;
  /** Show decorative Mesoamerican step-fret corner ornaments */
  showCornerOrnaments?: boolean;
  /** Show animated gold shimmer border */
  shimmerBorder?: boolean;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: 'max-w-7xl'
};

/** Mesoamerican step-fret corner ornament */
function StepFretCorner({ position }: { position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' }) {
  const positionClasses = {
    'top-left': 'top-2 left-2',
    'top-right': 'top-2 right-2 rotate-90',
    'bottom-left': 'bottom-2 left-2 -rotate-90',
    'bottom-right': 'bottom-2 right-2 rotate-180',
  };

  return (
    <div
      className={clsx('step-fret-corner pointer-events-none', positionClasses[position])}
      aria-hidden="true"
    />
  );
}

export function ContentShell({
  children,
  size = 'lg',
  className,
  showCornerOrnaments = false,
  shimmerBorder = false,
}: ContentShellProps) {
  const reducedMotion = useReducedMotion();
  const perfMode = usePerformanceMode();

  // Disable heavy effects in low-power mode
  const enableEffects = perfMode === 'high';

  const motionProps = reducedMotion
    ? {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 }
    }
    : {
      initial: { scale: 0.85, opacity: 0 },
      animate: { scale: 1, opacity: 1 },
      exit: { scale: 0.9, opacity: 0 },
      transition: { type: 'spring', stiffness: 300, damping: 30 }
    };

  return (
    <motion.div
      {...motionProps}
      className={clsx(
        "relative w-full text-amber-100",
        "max-h-[90vh] overflow-y-auto rounded-2xl",
        // Glassmorphism effect (disabled in low-power mode)
        enableEffects ? "glass-panel" : "bg-slate-900/95",
        "border border-amber-600/40",
        // Layered shadows for depth
        "shadow-2xl shadow-black/60",
        "shadow-amber-500/10",
        sizeClasses[size],
        className
      )}
    >
      {/* Animated gold shimmer border overlay (only in high-power mode) */}
      {shimmerBorder && enableEffects && !reducedMotion && (
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden"
          aria-hidden="true"
        >
          <div className="absolute inset-0 rounded-2xl border-2 border-transparent">
            <div className="absolute inset-[-2px] rounded-2xl animate-gold-shimmer opacity-60" />
          </div>
        </div>
      )}

      {/* Step-fret corner ornaments */}
      {showCornerOrnaments && (
        <>
          <StepFretCorner position="top-left" />
          <StepFretCorner position="top-right" />
          <StepFretCorner position="bottom-left" />
          <StepFretCorner position="bottom-right" />
        </>
      )}

      {/* Particle sparkle overlay (disabled for reduced motion) */}
      {!reducedMotion && (
        <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(circle_at_center,white,transparent)]">
          <div className="absolute inset-0 animate-sparkle-slow opacity-30 bg-gradient-to-br from-amber-400/20 via-transparent to-amber-600/20" />
        </div>
      )}

      {/* Content with proper staggered animations */}
      <motion.div
        className="relative z-10"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: 0.1,
              delayChildren: 0.2
            }
          }
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}