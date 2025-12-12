import React from 'react';
import { motion } from 'framer-motion';
import { Button, ButtonProps } from '../ui/button';
import clsx from 'clsx';

import { useSfxEngine } from '../../hooks/useSfx';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface GlowingButtonProps extends Omit<ButtonProps, 'onClick'> {
  onClick?: (event?: React.MouseEvent<HTMLButtonElement>) => void;
  glowColor?: 'amber' | 'blue' | 'red' | 'green' | 'purple';
  intensity?: 'low' | 'medium' | 'high';
  soundEffect?: string;
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
  }
};

export function GlowingButton({ 
  onClick,
  glowColor = 'amber',
  intensity = 'medium',
  soundEffect = 'cta-click',
  className,
  disabled,
  children,
  ...props 
}: GlowingButtonProps) {
  const reducedMotion = useReducedMotion();
  const playSfx = useSfxEngine();

  const handleClick = () => {
    if (!disabled && onClick) {
      playSfx('cta-click');
      onClick();
    }
  };

  const motionProps = reducedMotion 
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
        onClick={handleClick}
        disabled={disabled}
        className={clsx(
          "relative overflow-hidden transition-all duration-200 flex items-center justify-center gap-2",
          "shadow-lg hover:shadow-xl",
          glowStyles[glowColor][intensity],
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        {...props}
      >
        {/* Glow effect background */}
        {!disabled && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent 
                          -translate-x-full hover:translate-x-full transition-transform duration-700" />
        )}
        
        {/* Content */}
        <span className="relative z-10 flex items-center justify-center gap-2">
          {children}
        </span>
      </Button>
    </motion.div>
  );
}
