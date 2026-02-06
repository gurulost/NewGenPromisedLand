import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

import { useReducedMotion } from '../../hooks/useReducedMotion';

interface HUDShellProps {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  children: React.ReactNode;
  className?: string;
  spacing?: 'sm' | 'md' | 'lg';
}

const positionClasses = {
  'top-left': 'top-[calc(env(safe-area-inset-top)+1rem)] left-[calc(env(safe-area-inset-left)+1rem)]',
  'top-right': 'top-[calc(env(safe-area-inset-top)+1rem)] right-[calc(env(safe-area-inset-right)+1rem)]',
  'bottom-left': 'bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-[calc(env(safe-area-inset-left)+1rem)]',
  'bottom-right': 'bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-[calc(env(safe-area-inset-right)+1rem)]',
  'top-center': 'top-[calc(env(safe-area-inset-top)+1rem)] left-1/2 -translate-x-1/2',
  'bottom-center': 'bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-1/2 -translate-x-1/2'
};

const spacingClasses = {
  sm: 'space-y-2',
  md: 'space-y-4',
  lg: 'space-y-6'
};

export function HUDShell({ 
  position, 
  children, 
  className,
  spacing = 'md' 
}: HUDShellProps) {
  const reducedMotion = useReducedMotion();

  const motionProps = reducedMotion 
    ? {}
    : {
        initial: { opacity: 0, y: position.includes('top') ? -20 : 20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: position.includes('top') ? -20 : 20 },
        transition: { duration: 0.3, ease: 'easeOut' }
      };

  return (
    <motion.div
      {...motionProps}
      className={clsx(
        "absolute pointer-events-auto z-[var(--z-hud)]",
        positionClasses[position],
        spacingClasses[spacing],
        className
      )}
    >
      {children}
    </motion.div>
  );
}
