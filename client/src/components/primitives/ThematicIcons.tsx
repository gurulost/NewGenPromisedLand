import React from 'react';
import clsx from 'clsx';

interface ThematicIconProps {
    className?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    style?: React.CSSProperties;
}

const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8',
};

/**
 * Mesoamerican Sun Disk icon
 * Represents divinity, power, and cosmic order
 */
export function SunDiskIcon({ className, size = 'md' }: ThematicIconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            className={clsx(sizeMap[size], 'text-current', className)}
            aria-hidden="true"
        >
            {/* Outer rays */}
            <path
                d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
            {/* Inner circle with face */}
            <circle cx="12" cy="12" r="5" fill="currentColor" opacity="0.2" />
            <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" />
            {/* Center dot */}
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </svg>
    );
}

/**
 * Feathered Serpent (Quetzalcoatl-style) icon
 * Represents wisdom, wind, and civilization
 */
export function SerpentIcon({ className, size = 'md' }: ThematicIconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            className={clsx(sizeMap[size], 'text-current', className)}
            aria-hidden="true"
        >
            {/* Serpent body */}
            <path
                d="M4 12c2-4 6-6 8-4s2 6 0 8-6 2-8 0"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="currentColor"
                fillOpacity="0.15"
            />
            {/* Head */}
            <circle cx="18" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.2" />
            {/* Eye */}
            <circle cx="18.5" cy="7.5" r="0.75" fill="currentColor" />
            {/* Feathers/crest */}
            <path
                d="M19 5.5l1.5-2M20 6l2-1M17 5l-1-2"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
            />
            {/* Tongue */}
            <path
                d="M20.5 8.5l1.5 0.5M20.5 9l1 1"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
            />
        </svg>
    );
}

/**
 * Jaguar Head icon
 * Represents strength, power, and the underworld
 */
export function JaguarIcon({ className, size = 'md' }: ThematicIconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            className={clsx(sizeMap[size], 'text-current', className)}
            aria-hidden="true"
        >
            {/* Head shape */}
            <path
                d="M12 4C8 4 5 7 5 11c0 3 2 6 7 9 5-3 7-6 7-9 0-4-3-7-7-7z"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="currentColor"
                fillOpacity="0.15"
            />
            {/* Ears */}
            <path
                d="M7 6l-1-2.5L8 5M17 6l1-2.5L16 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Eyes */}
            <ellipse cx="9" cy="10" rx="1.5" ry="1" fill="currentColor" />
            <ellipse cx="15" cy="10" rx="1.5" ry="1" fill="currentColor" />
            {/* Nose */}
            <path
                d="M10.5 13h3L12 15z"
                fill="currentColor"
                opacity="0.7"
            />
            {/* Spots */}
            <circle cx="7" cy="12" r="0.5" fill="currentColor" opacity="0.5" />
            <circle cx="17" cy="12" r="0.5" fill="currentColor" opacity="0.5" />
        </svg>
    );
}

/**
 * Temple/Pyramid icon
 * Represents civilization, worship, and achievement
 */
export function TempleIcon({ className, size = 'md' }: ThematicIconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            className={clsx(sizeMap[size], 'text-current', className)}
            aria-hidden="true"
        >
            {/* Pyramid steps */}
            <path
                d="M12 3L4 21h16L12 3z"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="currentColor"
                fillOpacity="0.1"
            />
            {/* Steps */}
            <path
                d="M6 17h12M7 14h10M8 11h8M9.5 8h5"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                opacity="0.6"
            />
            {/* Temple top */}
            <rect x="10" y="4" width="4" height="3" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.2" />
        </svg>
    );
}

/**
 * Crown/Headdress icon
 * Represents royalty, leadership, and authority
 */
export function HeaddressIcon({ className, size = 'md' }: ThematicIconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            className={clsx(sizeMap[size], 'text-current', className)}
            aria-hidden="true"
        >
            {/* Base crown */}
            <path
                d="M4 18l2-10 4 4 2-8 2 8 4-4 2 10H4z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
                fill="currentColor"
                fillOpacity="0.15"
            />
            {/* Feathers */}
            <path
                d="M12 4V2M8 8L6 5M16 8l2-3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
            {/* Jewels */}
            <circle cx="12" cy="14" r="1" fill="currentColor" />
            <circle cx="8" cy="15" r="0.75" fill="currentColor" opacity="0.7" />
            <circle cx="16" cy="15" r="0.75" fill="currentColor" opacity="0.7" />
        </svg>
    );
}

/**
 * Warrior Shield icon
 * Represents defense, battle, and protection
 */
export function WarriorShieldIcon({ className, size = 'md' }: ThematicIconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            className={clsx(sizeMap[size], 'text-current', className)}
            aria-hidden="true"
        >
            {/* Shield shape */}
            <path
                d="M12 3L4 6v6c0 5 4 8 8 11 4-3 8-6 8-11V6l-8-3z"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="currentColor"
                fillOpacity="0.15"
            />
            {/* Inner decoration */}
            <path
                d="M12 7v8M8 11h8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
            {/* Corner accents */}
            <path
                d="M9 8l-1-1M15 8l1-1M9 14l-1 1M15 14l1 1"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                opacity="0.6"
            />
        </svg>
    );
}

/**
 * Map of faction IDs to their thematic icons
 */
export const FactionIcons: Record<string, React.FC<ThematicIconProps>> = {
    NEPHITES: WarriorShieldIcon,
    LAMANITES: JaguarIcon,
    MULEKITES: TempleIcon,
    ANTI_NEPHI_LEHIES: SunDiskIcon,
    ZORAMITES: HeaddressIcon,
    JAREDITES: SerpentIcon,
};

/**
 * Get the appropriate icon component for a faction
 */
export function getFactionIcon(factionId: string): React.FC<ThematicIconProps> | null {
    return FactionIcons[factionId] || null;
}
