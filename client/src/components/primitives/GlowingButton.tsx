import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

import { useSfxEngine } from '../../hooks/useSfx';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useTouchMode } from '../../hooks/useTouchMode';
import { useHaptic } from '../../hooks/useHaptic';

type GlowingVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'default' | 'destructive';
type GlowingSize = 'sm' | 'md' | 'lg' | 'xl';

// Exclude React event handlers that conflict with framer-motion
type SafeButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd'
>;

interface GlowingButtonProps extends SafeButtonProps {
  onClick?: (event?: React.MouseEvent<HTMLButtonElement>) => void;
  glowColor?: 'amber' | 'blue' | 'red' | 'green' | 'purple' | 'slate' | 'none';
  intensity?: 'low' | 'medium' | 'high';
  variant?: GlowingVariant;
  size?: GlowingSize;
  soundEffect?: string;
  enableSfx?: boolean;
  loading?: boolean;
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
  slate: {
    gradient: 'from-slate-200/95 via-slate-300/80 to-slate-500/90',
    border: 'border-slate-100/50',
    focus: 'focus-visible:ring-slate-200/80',
    accentShadow: 'shadow-[0_14px_36px_-16px_rgba(100,116,139,0.55)]',
    text: 'text-slate-900',
  },
  none: {
    gradient: '',
    border: 'border-transparent',
    focus: 'focus-visible:ring-slate-200/80',
    accentShadow: '',
    text: 'text-inherit',
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

export const GlowingButton = forwardRef<HTMLButtonElement, GlowingButtonProps>(({
  onClick,
  glowColor = 'amber',
  intensity = 'medium',
  variant = 'primary',
  size = 'md',
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
  const paletteChoice = palette[glowColor];

  const isDisabled = disabled || loading;

  const handleClick = (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) return;
    haptic('light');
    if (enableSfx) playSfx(soundEffect);
    onClick?.(e);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (isDisabled) return;
    haptic('light');
    if (enableSfx) playSfx(soundEffect);
    onClick?.();
  };

  const motionProps = reducedMotion || isDisabled || isTouchDevice
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
      glowColor !== 'none' && 'bg-gradient-to-b',
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
    outline: clsx(
      'bg-transparent text-amber-50 border-2 border-amber-500/60',
      'hover:bg-amber-500/10 hover:border-amber-400',
      'shadow-none'
    ),
    default: clsx(
      'bg-gradient-to-b from-slate-700/80 via-slate-800/80 to-slate-900/80',
      'text-slate-100 border border-slate-600/50',
      'shadow-md hover:brightness-110'
    ),
    destructive: clsx(
      'bg-gradient-to-b from-red-600/90 via-red-700/90 to-red-800/90',
      'text-white border border-red-400/50',
      'shadow-[0_12px_30px_-14px_rgba(239,68,68,0.5)]',
      'hover:brightness-110'
    ),
  };

  return (
    <motion.button
      ref={ref}
      type="button"
      data-testid="glowing-button"
      onClick={handleClick}
      onTouchEnd={isTouchDevice ? handleTouchEnd : undefined}
      disabled={isDisabled}
      tabIndex={isDisabled ? -1 : undefined}
      aria-busy={loading ? true : undefined}
      aria-disabled={isDisabled ? true : undefined}
      className={clsx(
        'relative inline-flex items-center justify-center overflow-hidden rounded-2xl font-semibold tracking-wide transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
        paletteChoice.focus,
        sizeStyles[size],
        variantStyles[variant],
        intensityStyles[intensity],
        isDisabled && 'cursor-not-allowed opacity-70 shadow-none saturate-75 pointer-events-none',
        isTouchDevice && 'min-h-[48px] min-w-[48px] touch-spacing',
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
    </motion.button>
  );
});

GlowingButton.displayName = 'GlowingButton';
