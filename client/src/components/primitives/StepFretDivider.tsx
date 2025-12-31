import React from 'react';
import clsx from 'clsx';

interface StepFretDividerProps {
    className?: string;
    /** Orientation of the divider */
    orientation?: 'horizontal' | 'vertical';
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
}

/**
 * Mesoamerican step-fret pattern divider
 * Creates a decorative divider with a gold gradient and step pattern
 */
export function StepFretDivider({
    className,
    orientation = 'horizontal',
    size = 'md'
}: StepFretDividerProps) {
    const sizeClasses = {
        sm: orientation === 'horizontal' ? 'h-[2px]' : 'w-[2px]',
        md: orientation === 'horizontal' ? 'h-[3px]' : 'w-[3px]',
        lg: orientation === 'horizontal' ? 'h-[4px]' : 'w-[4px]',
    };

    if (orientation === 'vertical') {
        return (
            <div
                className={clsx(
                    'relative bg-gradient-to-b from-transparent via-amber-500/50 to-transparent',
                    sizeClasses[size],
                    'min-h-[20px]',
                    className
                )}
                role="separator"
                aria-orientation="vertical"
            >
                {/* Step pattern accent */}
                <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_4px,rgba(251,191,36,0.3)_4px,rgba(251,191,36,0.3)_8px)]" />
            </div>
        );
    }

    return (
        <div
            className={clsx(
                'relative w-full my-3',
                className
            )}
            role="separator"
            aria-orientation="horizontal"
        >
            {/* Main gradient line */}
            <div
                className={clsx(
                    'w-full bg-gradient-to-r from-transparent via-amber-500/60 to-transparent',
                    sizeClasses[size]
                )}
            />

            {/* Center ornament */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rotate-45 bg-amber-500/60" />
                    <div className="w-2 h-2 rotate-45 bg-amber-400/80 shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                    <div className="w-1.5 h-1.5 rotate-45 bg-amber-500/60" />
                </div>
            </div>
        </div>
    );
}

/**
 * Simple gold gradient divider without step pattern
 */
export function GoldDivider({ className }: { className?: string }) {
    return (
        <div
            className={clsx(
                'w-full h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent my-2',
                className
            )}
            role="separator"
        />
    );
}
