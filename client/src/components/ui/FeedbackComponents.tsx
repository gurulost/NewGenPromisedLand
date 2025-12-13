import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, AlertCircle, Info, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

// Loading Spinner with customizable size and color
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
}

export function LoadingSpinner({ size = 'md', color = 'currentColor', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <motion.div
      className={cn(sizeClasses[size], 'inline-block', className)}
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
    >
      <Loader2 className="w-full h-full" style={{ color }} />
    </motion.div>
  );
}

// Pulse loading indicator
export function PulseLoader({ className }: { className?: string }) {
  return (
    <div className={cn('flex space-x-1', className)}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 bg-primary rounded-full"
          animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
  );
}

// Success/Error/Warning Toast notifications with game themes
export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'combat' | 'discovery' | 'faith' | 'pride';

interface ToastProps {
  type: ToastType;
  title: string;
  message?: string;
  onClose?: () => void;
  duration?: number;
}

export function Toast({ type, title, message, onClose }: ToastProps) {

  const config: Record<ToastType, { icon: typeof Check; bgColor: string; textColor: string; iconBg: string; glow?: string }> = {
    success: {
      icon: Check,
      bgColor: 'bg-green-500',
      textColor: 'text-white',
      iconBg: 'bg-green-600'
    },
    error: {
      icon: X,
      bgColor: 'bg-red-500',
      textColor: 'text-white',
      iconBg: 'bg-red-600'
    },
    warning: {
      icon: AlertCircle,
      bgColor: 'bg-yellow-500',
      textColor: 'text-black',
      iconBg: 'bg-yellow-600'
    },
    info: {
      icon: Info,
      bgColor: 'bg-blue-500',
      textColor: 'text-white',
      iconBg: 'bg-blue-600'
    },
    // === GAME-THEMED VARIANTS ===
    combat: {
      icon: AlertCircle, // Would be Swords ideally
      bgColor: 'bg-gradient-to-r from-red-600 to-orange-600',
      textColor: 'text-white',
      iconBg: 'bg-red-700',
      glow: 'shadow-[0_0_20px_rgba(239,68,68,0.5)]'
    },
    discovery: {
      icon: Check, // Would be Map ideally
      bgColor: 'bg-gradient-to-r from-emerald-600 to-teal-600',
      textColor: 'text-white',
      iconBg: 'bg-emerald-700',
      glow: 'shadow-[0_0_20px_rgba(16,185,129,0.5)]'
    },
    faith: {
      icon: Check, // Would be Cross ideally
      bgColor: 'bg-gradient-to-r from-blue-600 to-indigo-600',
      textColor: 'text-white',
      iconBg: 'bg-blue-700',
      glow: 'shadow-[0_0_20px_rgba(59,130,246,0.5)]'
    },
    pride: {
      icon: AlertCircle, // Would be Crown ideally
      bgColor: 'bg-gradient-to-r from-amber-600 to-yellow-500',
      textColor: 'text-black',
      iconBg: 'bg-amber-700',
      glow: 'shadow-[0_0_20px_rgba(251,191,36,0.5)]'
    },
  };

  const { icon: Icon, bgColor, textColor, iconBg, glow } = config[type];

  return (
    <motion.div
      initial={{ opacity: 0, x: 50, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 50, scale: 0.9 }}
      className={cn(
        'flex items-center gap-3 p-4 rounded-lg shadow-lg max-w-sm border border-white/10',
        bgColor,
        textColor,
        glow
      )}
    >
      <div className={cn('p-1.5 rounded-full', iconBg)}>
        <Icon className="w-4 h-4" />
      </div>

      <div className="flex-1">
        <div className="font-semibold text-sm">{title}</div>
        {message && <div className="text-xs opacity-90 mt-1">{message}</div>}
      </div>

      {onClose && (
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-black/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
}


// Button with built-in loading and success states
interface ActionButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onDrag' | 'onDragEnd' | 'onDragEnter' | 'onDragExit' | 'onDragLeave' | 'onDragOver' | 'onDragStart' | 'onDrop' | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration'> {
  loading?: boolean;
  success?: boolean;
  error?: boolean;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export function ActionButton({
  loading,
  success,
  error,
  children,
  variant = 'primary',
  size = 'md',
  disabled,
  className,
  ...props
}: ActionButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:ring-secondary',
    danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive'
  };

  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base'
  };

  const isDisabled = disabled || loading;

  return (
    <motion.button
      className={cn(
        baseClasses,
        variants[variant],
        sizes[size],
        isDisabled && 'opacity-50 cursor-not-allowed',
        success && 'bg-green-500 hover:bg-green-500',
        error && 'bg-red-500 hover:bg-red-500',
        className
      )}
      disabled={isDisabled}
      whileHover={!isDisabled ? { scale: 1.02 } : undefined}
      whileTap={!isDisabled ? { scale: 0.98 } : undefined}
      {...props}
    >
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: 0.2 }}
          >
            <LoadingSpinner size="sm" />
          </motion.div>
        )}

        {success && !loading && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Check className="w-4 h-4" />
          </motion.div>
        )}

        {error && !loading && !success && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: 0.2 }}
          >
            <X className="w-4 h-4" />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.span
        layout
        className={cn(loading && 'ml-2')}
      >
        {children}
      </motion.span>
    </motion.button>
  );
}

// Progress indicator
interface ProgressProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'success' | 'warning' | 'danger';
  showPercentage?: boolean;
  animated?: boolean;
}

export function Progress({
  value,
  max = 100,
  size = 'md',
  color = 'primary',
  showPercentage = false,
  animated = true
}: ProgressProps) {
  const percentage = Math.min((value / max) * 100, 100);

  const heights = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  const colors = {
    primary: 'bg-primary',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    danger: 'bg-red-500'
  };

  return (
    <div className="w-full space-y-1">
      <div className={cn('w-full bg-secondary rounded-full overflow-hidden', heights[size])}>
        <motion.div
          className={cn('h-full rounded-full', colors[color])}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={animated ? { duration: 0.5, ease: 'easeOut' } : { duration: 0 }}
        />
      </div>

      {showPercentage && (
        <div className="text-xs text-muted-foreground text-right">
          {Math.round(percentage)}%
        </div>
      )}
    </div>
  );
}

// Floating Action Button with ripple effect
interface FABProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onDrag' | 'onDragEnd' | 'onDragEnter' | 'onDragExit' | 'onDragLeave' | 'onDragOver' | 'onDragStart' | 'onDrop' | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration'> {
  icon: React.ReactNode;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

export function FloatingActionButton({ icon, position = 'bottom-right', className, ...props }: FABProps) {
  const [ripples, setRipples] = React.useState<Array<{ id: number; x: number; y: number }>>([]);

  const positions = {
    'bottom-right': 'fixed bottom-6 right-6',
    'bottom-left': 'fixed bottom-6 left-6',
    'top-right': 'fixed top-6 right-6',
    'top-left': 'fixed top-6 left-6'
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newRipple = { id: Date.now(), x, y };
    setRipples(prev => [...prev, newRipple]);

    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== newRipple.id));
    }, 600);

    props.onClick?.(e);
  };

  return (
    <motion.button
      className={cn(
        'relative w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg overflow-hidden',
        'hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        'flex items-center justify-center z-50',
        positions[position],
        className
      )}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={handleClick}
      {...props}
    >
      {icon}

      {ripples.map(({ id, x, y }) => (
        <motion.span
          key={id}
          className="absolute bg-white/30 rounded-full"
          style={{ left: x - 10, top: y - 10 }}
          initial={{ width: 20, height: 20, opacity: 1 }}
          animate={{ width: 100, height: 100, opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      ))}
    </motion.button>
  );
}