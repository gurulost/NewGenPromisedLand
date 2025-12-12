import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

import { useReducedMotion } from '../../hooks/useReducedMotion';
import { getFaction } from '@shared/data/factions';

interface AvatarBadgeProps {
  color?: string;
  playerId?: string;
  playerName?: string;
  factionId?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'small' | 'large';
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
  playerName,
  factionId,
  size = 'md', 
  className,
  children,
  'aria-label': ariaLabel
}: AvatarBadgeProps) {
  const reducedMotion = useReducedMotion();
  const faction = factionId ? getFaction(factionId as any) : null;
  const resolvedColor = color || faction?.color || '#fbbf24';
  const normalizedSize = size === 'large' ? 'xl' : size === 'small' ? 'sm' : size;
  
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
        sizeClasses[normalizedSize],
        className
      )}
      style={{ 
        backgroundColor: resolvedColor,
        boxShadow: `0 0 20px ${resolvedColor}40, inset 0 1px 0 rgba(255,255,255,0.1)`
      }}
      aria-label={ariaLabel}
    >
      {children || (
        <div 
          className="w-full h-full rounded-full border border-white/20 flex items-center justify-center text-xs uppercase"
          style={{ backgroundColor: resolvedColor }}
        >
          {playerName ? playerName.slice(0, 2) : null}
        </div>
      )}
    </motion.div>
  );
}
