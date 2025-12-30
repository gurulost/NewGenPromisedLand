import React from 'react';
import { Button } from '../ui/button';
import clsx from 'clsx';

interface PanelHeaderProps {
  icon?: React.ReactNode;
  title: string;
  scripture?: string;
  description?: string;
  onClose?: () => void;
  className?: string;
  /** Enable animated stone glow effect on title */
  animated?: boolean;
}

export function PanelHeader({
  icon,
  title,
  scripture,
  description,
  onClose,
  className,
  animated = false,
}: PanelHeaderProps) {
  return (
    <header className={clsx("mb-6 flex items-start justify-between gap-4", className)}>
      <div className="flex-1">
        <div className="flex items-center gap-3">
          {icon && (
            <div className={clsx(
              "flex h-8 w-8 items-center justify-center text-amber-400",
              animated && "animate-subtle-pulse"
            )}>
              {icon}
            </div>
          )}
          <h2
            id="panel-title"
            className={clsx(
              "font-cinzel text-xl font-bold tracking-wider",
              // Carved stone inscription effect
              "text-amber-200",
              "drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]",
              animated && "animate-stone-glow"
            )}
            style={{
              letterSpacing: '0.08em',
              textShadow: '0 2px 8px rgba(251, 191, 36, 0.3), 0 1px 0 rgba(0, 0, 0, 0.5)',
            }}
          >
            {title}
          </h2>
        </div>

        {scripture && (
          <p className="mt-1 text-sm text-amber-300/80 font-medium">
            {scripture}
          </p>
        )}

        {description && (
          <p className="mt-2 text-sm text-amber-300/70 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {onClose && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close panel"
          onClick={onClose}
          onTouchEnd={(e) => {
            e.preventDefault();
            onClose();
          }}
          className="h-12 w-12 min-h-[48px] min-w-[48px] rounded-full bg-amber-600/20 p-0 text-amber-300
                     transition-all duration-200 hover:scale-110 hover:bg-amber-600/30 
                     hover:text-amber-100 active:scale-95 active:bg-amber-600/40"
        >
          <span className="text-2xl font-bold">×</span>
        </Button>
      )}
    </header>
  );
}