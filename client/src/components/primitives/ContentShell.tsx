import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

import { useReducedMotion } from '../../hooks/useReducedMotion';

interface ContentShellProps {
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  className?: string;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md', 
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: 'max-w-7xl'
};

export function ContentShell({ 
  children, 
  size = 'lg',
  className
}: ContentShellProps) {
  const reducedMotion = useReducedMotion();

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
        "relative w-full text-amber-100 shadow-2xl shadow-black/60",
        "max-h-[90vh] overflow-y-auto rounded-2xl",
        "bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-900/95",
        "border border-amber-600/40 shadow-amber-500/20",
        sizeClasses[size],
        className
      )}
    >
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