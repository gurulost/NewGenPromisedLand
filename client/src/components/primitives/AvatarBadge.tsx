import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

import { useReducedMotion } from '../../hooks/useReducedMotion';

interface AvatarBadgeProps {
  color: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  children?: React.ReactNode;
  'aria-label'?: string;
}

const sizeClasses = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
  xl: 'w-12 h-12 text-lg'
};

export function AvatarBadge({ 
  color, 
  size = 'md', 
  className,
  children,
  'aria-label': ariaLabel
}: AvatarBadgeProps) {
  const reducedMotion = useReducedMotion();
  
  const motionProps = reducedMotion 
    ? {}
    : {
        whileHover: { scale: 1.05 },
        whileTap: { scale: 0.95 },
        transition: { type: 'spring', stiffness: 400, damping: 17 }
      };

  return (
    <motion.div
      {...motionProps}
      className={clsx(
        "rounded-full border-2 border-amber-400/60 shadow-lg flex items-center justify-center font-bold",
        "bg-gradient-to-br from-slate-800 to-slate-900",
        sizeClasses[size],
        className
      )}
      style={{ 
        backgroundColor: color,
        boxShadow: `0 0 20px ${color}40, inset 0 1px 0 rgba(255,255,255,0.1)`
      }}
      aria-label={ariaLabel}
    >
      {children || (
        <div 
          className="w-full h-full rounded-full border border-white/20"
          style={{ backgroundColor: color }}
        />
      )}
    </motion.div>
  );
}