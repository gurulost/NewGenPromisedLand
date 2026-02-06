import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { pushCapped, MEMORY_LIMITS } from '../../lib/memoryUtils';

export type FloatingTextType = 'damage' | 'heal' | 'ability' | 'resource' | 'faith' | 'critical';

export interface FloatingTextData {
    id: string;
    text: string;
    type: FloatingTextType;
    x: number;
    y: number;
    icon?: string;
    createdAt: number;
}

interface FloatingTextProps {
    data: FloatingTextData;
    onComplete: (id: string) => void;
}

const typeStyles: Record<FloatingTextType, { color: string; glow: string; scale: number }> = {
    damage: {
        color: 'text-red-500',
        glow: 'drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]',
        scale: 1.2
    },
    heal: {
        color: 'text-green-400',
        glow: 'drop-shadow-[0_0_8px_rgba(74,222,128,0.8)]',
        scale: 1.1
    },
    ability: {
        color: 'text-purple-400',
        glow: 'drop-shadow-[0_0_10px_rgba(192,132,252,0.9)]',
        scale: 1.3
    },
    resource: {
        color: 'text-amber-400',
        glow: 'drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]',
        scale: 1.1
    },
    faith: {
        color: 'text-blue-400',
        glow: 'drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]',
        scale: 1.1
    },
    critical: {
        color: 'text-orange-500',
        glow: 'drop-shadow-[0_0_12px_rgba(249,115,22,1)]',
        scale: 1.5
    },
};

/**
 * Individual floating text element with animations
 */
function FloatingTextItem({ data, onComplete }: FloatingTextProps) {
    const style = typeStyles[data.type];

    useEffect(() => {
        const timer = setTimeout(() => {
            onComplete(data.id);
        }, 1500);
        return () => clearTimeout(timer);
    }, [data.id, onComplete]);

    return (
        <motion.div
            className={cn(
                'absolute pointer-events-none font-bold text-lg select-none z-50',
                style.color,
                style.glow
            )}
            style={{
                left: data.x,
                top: data.y,
                transform: 'translate(-50%, -50%)',
            }}
            initial={{
                opacity: 0,
                scale: 0.5,
                y: 0
            }}
            animate={{
                opacity: [0, 1, 1, 0],
                scale: [0.5, style.scale, style.scale * 0.9, style.scale * 0.8],
                y: -60
            }}
            transition={{
                duration: 1.5,
                ease: 'easeOut',
                times: [0, 0.1, 0.7, 1]
            }}
        >
            {data.icon && <span className="mr-1">{data.icon}</span>}
            {data.text}
        </motion.div>
    );
}

/**
 * Manager component that handles multiple floating texts with bounded memory
 */
export function FloatingTextManager() {
    const [texts, setTexts] = useState<FloatingTextData[]>([]);

    // Expose a global method to spawn floating text
    useEffect(() => {
        (window as any).spawnFloatingText = (text: string, type: FloatingTextType, x: number, y: number, icon?: string) => {
            const id = `float-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const newText: FloatingTextData = { id, text, type, x, y, icon, createdAt: Date.now() };
            setTexts(prev => pushCapped(prev, newText, MEMORY_LIMITS.FLOATING_TEXT_MAX_ITEMS));
        };

        return () => {
            delete (window as any).spawnFloatingText;
        };
    }, []);

    // TTL cleanup for stale floating texts (in case animation callbacks fail)
    useEffect(() => {
        const cleanupInterval = setInterval(() => {
            const now = Date.now();
            setTexts(prev => prev.filter(t => now - t.createdAt < MEMORY_LIMITS.FLOATING_TEXT_TTL_MS));
        }, 2000);
        return () => clearInterval(cleanupInterval);
    }, []);

    const handleComplete = (id: string) => {
        setTexts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-[var(--z-feedback)]">
            <AnimatePresence>
                {texts.map((data) => (
                    <FloatingTextItem key={data.id} data={data} onComplete={handleComplete} />
                ))}
            </AnimatePresence>
        </div>
    );
}

/**
 * Hook to spawn floating text from React components
 */
export function useFloatingText() {
    const spawn = (text: string, type: FloatingTextType, x: number, y: number, icon?: string) => {
        if ((window as any).spawnFloatingText) {
            (window as any).spawnFloatingText(text, type, x, y, icon);
        }
    };

    return {
        damage: (text: string, x: number, y: number) => spawn(text, 'damage', x, y, '⚔️'),
        heal: (text: string, x: number, y: number) => spawn(text, 'heal', x, y, '💚'),
        ability: (text: string, x: number, y: number) => spawn(text, 'ability', x, y, '✨'),
        resource: (text: string, x: number, y: number) => spawn(text, 'resource', x, y, '⭐'),
        faith: (text: string, x: number, y: number) => spawn(text, 'faith', x, y, '✝️'),
        critical: (text: string, x: number, y: number) => spawn(text, 'critical', x, y, '💥'),
        custom: spawn,
    };
}

export default FloatingTextManager;
