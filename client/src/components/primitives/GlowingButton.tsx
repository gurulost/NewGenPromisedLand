import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Button, ButtonProps } from '../ui/button';
import clsx from 'clsx';

import { useSfxEngine } from '../../hooks/useSfx';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useTouchMode } from '../../hooks/useTouchMode';
import { useHaptic } from '../../hooks/useHaptic';

interface GlowingButtonProps extends Omit<ButtonProps, 'onClick'> {
  onClick?: (event?: React.MouseEvent<HTMLButtonElement>) => void;
  glowColor?: 'amber' | 'blue' | 'red' | 'green' | 'purple' | 'slate' | 'none';
  intensity?: 'low' | 'medium' | 'high';
  soundEffect?: string;
  enableSfx?: boolean;
  loading?: boolean;
}

const glowStyles = {
  amber: {
    low: 'shadow-amber-500/20 hover:shadow-amber-500/30',
    medium: 'shadow-amber-500/30 hover:shadow-amber-500/40', 
    high: 'shadow-amber-500/40 hover:shadow-amber-500/50'
  },
  blue: {
    low: 'shadow-blue-500/20 hover:shadow-blue-500/30',
    medium: 'shadow-blue-500/30 hover:shadow-blue-500/40',
    high: 'shadow-blue-500/40 hover:shadow-blue-500/50'
  },
  red: {
    low: 'shadow-red-500/20 hover:shadow-red-500/30',
    medium: 'shadow-red-500/30 hover:shadow-red-500/40',
    high: 'shadow-red-500/40 hover:shadow-red-500/50'
  },
  green: {
    low: 'shadow-green-500/20 hover:shadow-green-500/30',
    medium: 'shadow-green-500/30 hover:shadow-green-500/40',
    high: 'shadow-green-500/40 hover:shadow-green-500/50'
  },
  purple: {
    low: 'shadow-purple-500/20 hover:shadow-purple-500/30',
    medium: 'shadow-purple-500/30 hover:shadow-purple-500/40',
    high: 'shadow-purple-500/40 hover:shadow-purple-500/50'
  },
  slate: {
    low: 'shadow-slate-500/20 hover:shadow-slate-500/30',
    medium: 'shadow-slate-500/30 hover:shadow-slate-500/40',
    high: 'shadow-slate-500/40 hover:shadow-slate-500/50'
  },
  none: {
    low: '',
    medium: '',
    high: ''
  }
};

export const GlowingButton = forwardRef<HTMLButtonElement, GlowingButtonProps>(({ 
  onClick,
  glowColor = 'amber',
  intensity = 'medium',
  soundEffect = 'cta-click',
  enableSfx = true,
  loading = false,
  className,
  disabled,
  children,
  ...props 
}, ref) => {
  const reducedMotion = useReducedMotion();
  const { isTouchDevice } = useTouchMode();
  const playSfx = useSfxEngine();
  const haptic = useHaptic();

  const isDisabled = disabled || loading;

  const handleClick = (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (!isDisabled && onClick) {
      if (enableSfx) playSfx('cta-click');
      onClick(e);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!isDisabled && onClick) {
      haptic('light');
      if (enableSfx) playSfx('cta-click');
      onClick();
    }
  };

  const motionProps = reducedMotion || isTouchDevice
    ? {}
    : {
        whileTap: { scale: 0.97 },
        whileHover: { 
          scale: 1.02,
          rotateX: 2,
          rotateY: 2,
          transition: { duration: 0.2 }
        }
      };

  return (
    <motion.div {...motionProps}>
      <Button
        ref={ref}
        onClick={handleClick}
        onTouchEnd={isTouchDevice ? handleTouchEnd : undefined}
        disabled={isDisabled}
        tabIndex={isDisabled ? -1 : undefined}
        aria-busy={loading ? true : undefined}
        aria-disabled={isDisabled ? true : undefined}
        className={clsx(
          "relative overflow-hidden transition-all duration-200 flex items-center justify-center gap-2",
          glowColor !== 'none' && "shadow-lg hover:shadow-xl",
          glowStyles[glowColor][intensity],
          isDisabled && "opacity-50 cursor-not-allowed pointer-events-none",
          isTouchDevice && "min-h-[48px] min-w-[48px] touch-spacing",
          className
        )}
        {...props}
      >
        {/* Glow effect background */}
        {!isDisabled && glowColor !== 'none' && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent 
                          -translate-x-full hover:translate-x-full transition-transform duration-700" />
        )}
        
        {/* Content */}
        <span className="relative z-10 flex items-center justify-center gap-2">
          {loading ? (
            <>
              <svg 
                className="animate-spin h-4 w-4" 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle 
                  className="opacity-25" 
                  cx="12" 
                  cy="12" 
                  r="10" 
                  stroke="currentColor" 
                  strokeWidth="4"
                />
                <path 
                  className="opacity-75" 
                  fill="currentColor" 
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="sr-only">Loading...</span>
            </>
          ) : children}
        </span>
      </Button>
    </motion.div>
  );
});

GlowingButton.displayName = 'GlowingButton';
