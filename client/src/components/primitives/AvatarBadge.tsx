import React from 'react';
import clsx from 'clsx';

interface AvatarBadgeProps {
  color: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  'aria-label'?: string;
}

const sizeClasses = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4', 
  lg: 'w-6 h-6'
};

export function AvatarBadge({ 
  color, 
  size = 'md', 
  className,
  'aria-label': ariaLabel 
}: AvatarBadgeProps) {
  return (
    <div 
      className={clsx(
        "rounded-full border-2 border-amber-400 shadow-sm flex-shrink-0",
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: color }}
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
    />
  );
}