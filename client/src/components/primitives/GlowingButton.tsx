import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

import { useSfxEngine } from '../../hooks/useSfx';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useTouchMode } from '../../hooks/useTouchMode';

type GlowingVariant = 'primary' | 'secondary' | 'ghost';
type GlowingSize = 'sm' | 'md' | 'lg' | 'xl';

interface GlowingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onClick?: (event?: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => void;
  glowColor?: 'amber' | 'blue' | 'red' | 'green' | 'purple';
  intensity?: 'low' | 'medium' | 'high';
  variant?: GlowingVariant;
  size?: GlowingSize;
  soundEffect?: string;
}

const palette = {
  amber: {
    gradient: 'from-amber-200/95 via-amber-300/80 to-amber-500/90',
    border: 'border-amber-100/50',
    focus: 'focus-visible:ring-amber-200/80',
    accentShadow: 'shadow-[0_14px_36px_-16px_rgba(251,191,36,0.55)]',
    text: 'text-slate-900',
  },
  blue: {
    gradient: 'from-sky-200/95 via-sky-300/80 to-blue-500/90',
    border: 'border-sky-100/50',
    focus: 'focus-visible:ring-sky-200/80',
    accentShadow: 'shadow-[0_14px_36px_-16px_rgba(56,189,248,0.55)]',
    text: 'text-slate-900',
  },
  red: {
    gradient: 'from-rose-200/95 via-rose-300/80 to-rose-500/90',
    border: 'border-rose-100/50',
    focus: 'focus-visible:ring-rose-200/80',
    accentShadow: 'shadow-[0_14px_36px_-16px_rgba(244,63,94,0.55)]',
    text: 'text-slate-900',
  },
  green: {
    gradient: 'from-emerald-200/95 via-emerald-300/80 to-emerald-500/90',
    border: 'border-emerald-100/50',
    focus: 'focus-visible:ring-emerald-200/80',
    accentShadow: 'shadow-[0_14px_36px_-16px_rgba(52,211,153,0.55)]',
    text: 'text-slate-950',
  },
  purple: {
    gradient: 'from-violet-200/95 via-violet-300/80 to-indigo-500/90',
    border: 'border-violet-100/50',
    focus: 'focus-visible:ring-violet-200/80',
    accentShadow: 'shadow-[0_14px_36px_-16px_rgba(129,140,248,0.55)]',
    text: 'text-slate-900',
  },
};

const sizeStyles: Record<GlowingSize, string> = {
  sm: 'min-h-[40px] px-4 py-2 text-sm',
  md: 'min-h-[44px] px-5 py-2.5 text-sm',
  lg: 'min-h-[48px] px-6 py-3 text-base',
  xl: 'min-h-[56px] px-7 py-3.5 text-lg',
};

const intensityStyles = {
  low: 'shadow-lg',
  medium: 'shadow-xl',
  high: 'shadow-2xl',
};

export function GlowingButton({
  onClick,
  glowColor = 'amber',
  intensity = 'medium',
  variant = 'primary',
  size = 'md',
  soundEffect = 'cta-click',
  className,
  disabled,
  children,
  ...props
}: GlowingButtonProps) {
  const reducedMotion = useReducedMotion();
  const { isTouchDevice } = useTouchMode();
  const playSfx = useSfxEngine();
  const paletteChoice = palette[glowColor];

  const handleClick = (
    event?: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>
  ) => {
    if (disabled) return;
    playSfx(soundEffect);
    onClick?.(event);
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLButtonElement>) => {
    event.preventDefault();
    handleClick(event);
  };

  const motionProps =
    reducedMotion || disabled || isTouchDevice
      ? {}
      : {
          whileTap: { scale: 0.985, y: 0 },
          whileHover: {
            scale: 1.01,
            y: -1,
            transition: { duration: 0.15, ease: 'easeOut' },
          },
        };

  const variantStyles: Record<GlowingVariant, string> = {
    primary: clsx(
      'bg-gradient-to-b',
      paletteChoice.gradient,
      paletteChoice.border,
      paletteChoice.text,
      'shadow-[0_12px_30px_-14px_rgba(0,0,0,0.7)]',
      paletteChoice.accentShadow,
      'hover:brightness-105'
    ),
    secondary: clsx(
      'bg-gradient-to-b from-slate-800/70 via-slate-900/70 to-slate-950/75',
      'text-amber-50 border border-white/10 ring-1 ring-white/5',
      'shadow-[0_12px_28px_-16px_rgba(0,0,0,0.7)]',
      paletteChoice.accentShadow
    ),
    ghost: clsx(
      'bg-white/5 text-amber-50 border border-white/10',
      'shadow-none hover:border-amber-100/40'
    ),
  };

  return (
    <motion.button
      type="button"
      data-testid="glowing-button"
      onClick={handleClick}
      onTouchEnd={isTouchDevice ? handleTouchEnd : undefined}
      disabled={disabled}
      className={clsx(
        'relative inline-flex items-center justify-center overflow-hidden rounded-2xl font-semibold tracking-wide transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
        paletteChoice.focus,
        sizeStyles[size],
        variantStyles[variant],
        intensityStyles[intensity],
        disabled && 'cursor-not-allowed opacity-70 shadow-none saturate-75',
        className
      )}
      {...motionProps}
      {...props}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/12 via-white/0 to-black/20"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/8"
      />
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
    </motion.button>
  );
}
