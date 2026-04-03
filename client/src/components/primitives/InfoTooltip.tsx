import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useUIPreferences } from '../../hooks/useUIPreferences';

interface InfoTooltipProps {
  content: React.ReactNode;
  children?: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  ariaLabel?: string;
}

type ResolvedPosition = 'top' | 'bottom' | 'left' | 'right';

export function InfoTooltip({
  content,
  children,
  position = 'top',
  className,
  ariaLabel = 'More information',
}: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [resolvedPosition, setResolvedPosition] = useState<ResolvedPosition>(position);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const { preferences } = useUIPreferences();

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current || !isVisible) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const padding = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let finalPosition = position;
    let offsetX = 0;
    let offsetY = 0;

    const spaceAbove = triggerRect.top;
    const spaceBelow = viewportHeight - triggerRect.bottom;
    const spaceLeft = triggerRect.left;
    const spaceRight = viewportWidth - triggerRect.right;

    if (position === 'top') {
      if (spaceAbove < tooltipRect.height + padding) {
        finalPosition = 'bottom';
      }
    } else if (position === 'bottom') {
      if (spaceBelow < tooltipRect.height + padding) {
        finalPosition = 'top';
      }
    } else if (position === 'left') {
      if (spaceLeft < tooltipRect.width + padding) {
        finalPosition = 'right';
      }
    } else if (position === 'right') {
      if (spaceRight < tooltipRect.width + padding) {
        finalPosition = 'left';
      }
    }

    if (finalPosition === 'top' || finalPosition === 'bottom') {
      const tooltipCenter = triggerRect.left + triggerRect.width / 2;
      const tooltipHalfWidth = tooltipRect.width / 2;
      
      if (tooltipCenter - tooltipHalfWidth < padding) {
        offsetX = padding - (tooltipCenter - tooltipHalfWidth);
      } else if (tooltipCenter + tooltipHalfWidth > viewportWidth - padding) {
        offsetX = viewportWidth - padding - (tooltipCenter + tooltipHalfWidth);
      }
    }

    if (finalPosition === 'left' || finalPosition === 'right') {
      const tooltipCenter = triggerRect.top + triggerRect.height / 2;
      const tooltipHalfHeight = tooltipRect.height / 2;
      
      if (tooltipCenter - tooltipHalfHeight < padding) {
        offsetY = padding - (tooltipCenter - tooltipHalfHeight);
      } else if (tooltipCenter + tooltipHalfHeight > viewportHeight - padding) {
        offsetY = viewportHeight - padding - (tooltipCenter + tooltipHalfHeight);
      }
    }

    setResolvedPosition(finalPosition);
    setTooltipStyle({
      transform: `translate(calc(-50% + ${offsetX}px), ${offsetY}px)`,
    });
  }, [position, isVisible]);

  useLayoutEffect(() => {
    if (isVisible) {
      requestAnimationFrame(calculatePosition);
    }
  }, [isVisible, calculatePosition]);

  useEffect(() => {
    if (!isVisible) return;
    
    const handleResize = () => calculatePosition();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [isVisible, calculatePosition]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const hasModal = document.querySelector('[class*="z-5"]');
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

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!preferences.showTooltips) {
      return;
    }
    e.preventDefault();
    setIsVisible(prev => !prev);
  };

  useEffect(() => {
    if (!isVisible) return;
    
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setIsVisible(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isVisible]);

  const getPositionClasses = (pos: ResolvedPosition) => {
    switch (pos) {
      case 'top':
        return 'bottom-full left-1/2 mb-2';
      case 'bottom':
        return 'top-full left-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 -translate-y-1/2 ml-2';
    }
  };

  const getArrowClasses = (pos: ResolvedPosition) => {
    switch (pos) {
      case 'top':
        return 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-slate-900';
      case 'bottom':
        return 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-slate-900';
      case 'left':
        return 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-slate-900';
      case 'right':
        return 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-slate-900';
    }
  };

  const motionProps = reducedMotion 
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, scale: 0.9 },
        animate: { 
          opacity: 1, 
          scale: 1,
          transition: { type: 'spring', stiffness: 400, damping: 25 }
        },
        exit: { 
          opacity: 0, 
          scale: 0.95,
          transition: { duration: 0.1 }
        }
      };

  if (!preferences.showTooltips) {
    return children ? <>{children}</> : null;
  }

  return (
    <div 
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onTouchStart={handleTouchStart}
    >
      {children || (
        <motion.div
          whileHover={reducedMotion ? {} : { scale: 1.1 }}
          whileTap={reducedMotion ? {} : { scale: 0.95 }}
          className={clsx(
            "w-5 h-5 rounded-full flex items-center justify-center cursor-help",
            "bg-gradient-to-br from-blue-500/80 to-blue-600/80 text-blue-100",
            "border border-blue-400/40 shadow-md shadow-blue-500/20",
            "hover:shadow-blue-400/40 transition-shadow duration-300",
            className
          )}
          aria-label={ariaLabel}
        >
          <span className="text-xs font-bold">?</span>
        </motion.div>
      )}

      <AnimatePresence>
        {isVisible && (
          <motion.div
            ref={tooltipRef}
            {...motionProps}
            className={clsx(
              "absolute z-[100] px-3 py-2 rounded-lg",
              "bg-slate-900/95 border border-amber-500/30 shadow-xl shadow-black/50",
              "text-sm text-amber-100 max-w-[280px] w-max backdrop-blur-sm",
              getPositionClasses(resolvedPosition)
            )}
            style={{ 
              ...tooltipStyle,
              filter: 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.3))'
            }}
          >
            {content}
            
            <div 
              className={clsx(
                "absolute w-0 h-0 border-4",
                getArrowClasses(resolvedPosition)
              )}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
