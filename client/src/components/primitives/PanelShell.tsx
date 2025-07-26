import React, { Fragment, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

import { useHotkeys } from '../../hooks/useHotkeys';
import { useSfx } from '../../hooks/useSfx';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface PanelShellProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  className?: string;
  fullScreen?: boolean;
  'aria-labelledby'?: string;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md', 
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: 'max-w-7xl'
};

export function PanelShell({ 
  isOpen, 
  onClose, 
  children, 
  size = 'lg',
  className,
  fullScreen = false,
  'aria-labelledby': ariaLabelledBy
}: PanelShellProps) {
  const reducedMotion = useReducedMotion();
  
  // Sound effects
  if (isOpen) {
    useSfx('panel-open');
  }
  
  // Hotkeys for closing
  useHotkeys('Escape', onClose);
  useHotkeys('KeyB', onClose);

  // Focus trap and body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

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
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog 
        as="div" 
        className={clsx(
          "fixed inset-0 z-50",
          fullScreen ? "flex" : "flex items-center justify-center p-4"
        )}
        onClose={onClose}
        aria-labelledby={ariaLabelledBy}
      >
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md" />
        </Transition.Child>

        {/* Panel */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom={reducedMotion ? "opacity-0" : "opacity-0 scale-95"}
          enterTo={reducedMotion ? "opacity-100" : "opacity-100 scale-100"}
          leave="ease-in duration-200"
          leaveFrom={reducedMotion ? "opacity-100" : "opacity-100 scale-100"}
          leaveTo={reducedMotion ? "opacity-0" : "opacity-0 scale-95"}
        >
          <motion.div
            {...motionProps}
            className={clsx(
              "relative w-full text-amber-100 shadow-2xl shadow-black/60",
              fullScreen 
                ? "h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" 
                : clsx(
                    "max-h-[90vh] overflow-y-auto rounded-2xl",
                    "bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-900/95",
                    "border border-amber-600/40 shadow-amber-500/20",
                    sizeClasses[size]
                  ),
              className
            )}
          >
            {/* Particle sparkle overlay (disabled for reduced motion) */}
            {!reducedMotion && (
              <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(circle_at_center,white,transparent)]">
                <div className="absolute inset-0 animate-sparkle-slow opacity-30 bg-gradient-to-br from-amber-400/20 via-transparent to-amber-600/20" />
              </div>
            )}
            
            {/* Content with proper focus management */}
            <div className={clsx(
              "relative z-10",
              fullScreen ? "h-full" : "p-6"
            )}>
              {children}
            </div>
          </motion.div>
        </Transition.Child>
      </Dialog>
    </Transition>
  );
}