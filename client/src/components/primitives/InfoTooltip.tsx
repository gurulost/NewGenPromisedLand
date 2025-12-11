import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

import { useReducedMotion } from '../../hooks/useReducedMotion';

interface InfoTooltipProps {
  content: React.ReactNode;
  children?: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function InfoTooltip({ 
  content, 
  children, 
  position = 'top',
  className 
}: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const reducedMotion = useReducedMotion();

  // Hide tooltip when modals open (z-index > 50)
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const hasModal = document.querySelector('[class*="z-"][class*="5"]:not([class*="z-4"]):not([class*="z-3"]):not([class*="z-2"]):not([class*="z-1"])');
      if (hasModal && isVisible) {
        setIsVisible(false);
      }
    });
    
    observer.observe(document.body, { 
      childList: true, 
      subtree: true, 
      attributes: true, 
      attributeFilter: ['class'] 
    });
    
    return () => observer.disconnect();
  }, [isVisible]);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2', 
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  const motionProps = reducedMotion 
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, scale: 0.85, rotateX: -10 },
        animate: { 
          opacity: 1, 
          scale: 1, 
          rotateX: 0,
          transition: { type: 'spring', stiffness: 400, damping: 25 }
        },
        exit: { 
          opacity: 0, 
          scale: 0.9, 
          rotateX: -5,
          transition: { duration: 0.15 }
        }
      };

  return (
    <div 
      className="relative inline-flex"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {/* Tooltip trigger - premium glowing orb */}
      {children || (
        <motion.div
          whileHover={reducedMotion ? {} : { scale: 1.1, rotate: 5 }}
          whileTap={reducedMotion ? {} : { scale: 0.95 }}
          className={clsx(
            "w-8 h-8 rounded-full flex items-center justify-center cursor-help",
            "bg-gradient-to-br from-blue-500 to-blue-600 text-blue-100",
            "border border-blue-400/50 shadow-lg shadow-blue-500/25",
            "hover:shadow-blue-400/40 transition-shadow duration-300",
            "animate-pulse",
            className
          )}
          aria-label="Information"
        >
          <span className="text-xs font-bold">?</span>
        </motion.div>
      )}

      {/* Tooltip content */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            {...motionProps}
            className={clsx(
              "absolute z-45 px-3 py-2 rounded-lg pointer-events-none",
              "bg-slate-900/95 border border-amber-500/30 shadow-xl shadow-black/50",
              "text-sm text-amber-100 max-w-xs backdrop-blur-sm",
              positionClasses[position]
            )}
            style={{ 
              filter: 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.3))'
            }}
          >
            {content}
            
            {/* Arrow pointer */}
            <div 
              className={clsx(
                "absolute w-0 h-0 border-4",
                position === 'top' && "top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-slate-900",
                position === 'bottom' && "bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-slate-900",
                position === 'left' && "left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-slate-900",
                position === 'right' && "right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-slate-900"
              )}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}