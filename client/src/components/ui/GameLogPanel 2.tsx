import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scroll, X } from 'lucide-react';
import { useMobileUI } from '../../hooks/useMobileUI';
import { ModalLayer, ModalLayerContent } from '../primitives/ModalLayer';

export type GameLogEntryType =
    | 'combat'
    | 'capture'
    | 'diplomacy'
    | 'resource'
    | 'tech'
    | 'unit'
    | 'system';

export interface GameLogEntry {
    id: string;
    turn: number;
    playerId: string;
    playerName: string;
    type: GameLogEntryType;
    message: string;
    timestamp: number;
    details?: Record<string, unknown>;
}

interface GameLogPanelProps {
    entries: GameLogEntry[];
    currentTurn: number;
    isOpen: boolean;
    onToggle: () => void;
    maxEntries?: number;
    avoidBottomLeft?: boolean;
}

const typeIcons: Record<GameLogEntryType, string> = {
    combat: '⚔️',
    capture: '🏰',
    diplomacy: '🤝',
    resource: '⭐',
    tech: '📜',
    unit: '👤',
    system: '⚙️',
};

const typeColors: Record<GameLogEntryType, string> = {
    combat: 'text-red-400',
    capture: 'text-amber-400',
    diplomacy: 'text-blue-400',
    resource: 'text-yellow-400',
    tech: 'text-cyan-400',
    unit: 'text-green-400',
    system: 'text-gray-400',
};

export function GameLogPanel({
    entries,
    currentTurn,
    isOpen,
    onToggle,
    maxEntries = 100,
    avoidBottomLeft = false
}: GameLogPanelProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const { isMobileUI } = useMobileUI();
    const desktopBottomClass = avoidBottomLeft
        ? 'bottom-[calc(env(safe-area-inset-bottom)+1rem+var(--selected-unit-panel-height,0px)+0.75rem)]'
        : 'bottom-[calc(env(safe-area-inset-bottom)+1rem)]';
    const desktopLeftClass = 'left-[calc(env(safe-area-inset-left)+1rem)]';

    // Auto-scroll to bottom when new entries come in
    useEffect(() => {
        if (autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [entries, autoScroll]);

    const displayEntries = entries.slice(-maxEntries);

    // Group entries by turn
    const entriesByTurn = displayEntries.reduce((acc, entry) => {
        if (!acc[entry.turn]) acc[entry.turn] = [];
        acc[entry.turn].push(entry);
        return acc;
    }, {} as Record<number, GameLogEntry[]>);

    if (isMobileUI) {
        if (!isOpen) return null;

        return (
            <ModalLayer className="fixed inset-0 z-[var(--z-modal-backdrop)] bg-black/80 backdrop-blur-sm">
                <ModalLayerContent className="z-[var(--z-modal-content)] mobile-safe-top mobile-safe-bottom h-full flex flex-col">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-stone-700/50 bg-stone-900/80">
                        <div className="flex items-center gap-2">
                            <Scroll className="w-4 h-4 text-amber-400" />
                            <h3 className="text-sm font-bold text-stone-200">Game History</h3>
                        </div>
                        <button
                            onClick={onToggle}
                            className="p-2 rounded-lg bg-stone-800/60 text-stone-200"
                            aria-label="Close game log"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto p-3 space-y-2 touch-scroll"
                        onScroll={(e) => {
                            const target = e.target as HTMLDivElement;
                            const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 20;
                            setAutoScroll(isAtBottom);
                        }}
                    >
                        {Object.entries(entriesByTurn).map(([turn, turnEntries]) => (
                            <div key={turn} className="mb-2">
                                <div className="text-xs text-stone-500 uppercase tracking-wide mb-1 px-2">
                                    Turn {turn}
                                </div>
                                {turnEntries.map(entry => (
                                    <div
                                        key={entry.id}
                                        className="flex items-start gap-2 px-2 py-2 rounded bg-stone-900/40"
                                    >
                                        <span className="text-sm mt-0.5">{typeIcons[entry.type]}</span>
                                        <div className="flex-1 min-w-0">
                                            <span className={`text-xs font-medium ${typeColors[entry.type]}`}>
                                                {entry.playerName}:
                                            </span>
                                            <p className="text-xs text-stone-300 break-words">
                                                {entry.message}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}

                        {entries.length === 0 && (
                            <div className="text-center py-8 text-stone-500 text-sm">
                                No events yet
                            </div>
                        )}
                    </div>

                    <div className="px-4 py-3 border-t border-stone-700/50 bg-stone-900/80">
                        <div className="flex items-center justify-between text-xs text-stone-400">
                            <span>{entries.length} events</span>
                            <button
                                onClick={() => setAutoScroll(!autoScroll)}
                                className={`px-2 py-1 rounded ${autoScroll ? 'bg-amber-600/20 text-amber-400' : 'bg-stone-700/50'}`}
                            >
                                {autoScroll ? 'Auto-scroll: ON' : 'Auto-scroll: OFF'}
                            </button>
                        </div>
                    </div>
                </ModalLayerContent>
            </ModalLayer>
        );
    }

    return (
        <>
            {/* Collapsed Button */}
            {!isOpen && (
                <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={onToggle}
                    className={`fixed ${desktopBottomClass} ${desktopLeftClass} z-[var(--z-floating)] pointer-events-auto flex items-center gap-2 px-3 py-2 bg-stone-800/90 border border-stone-600/50 rounded-lg hover:bg-stone-700/90 transition-colors backdrop-blur-sm`}
                >
                    <Scroll className="w-4 h-4 text-amber-400" />
                    <span className="text-sm text-stone-300">Game Log</span>
                    {entries.length > 0 && (
                        <span className="px-1.5 py-0.5 text-xs bg-amber-600/30 text-amber-300 rounded">
                            {entries.length}
                        </span>
                    )}
                </motion.button>
            )}

            {/* Expanded Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, x: -300 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -300 }}
                        transition={{ type: 'spring', damping: 25 }}
                        className={`fixed ${desktopBottomClass} ${desktopLeftClass} z-[var(--z-floating)] pointer-events-auto w-80 max-w-[calc(100vw-env(safe-area-inset-left)-env(safe-area-inset-right)-2rem)] max-h-[calc(100vh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem)] bg-stone-900/95 border border-stone-600/50 rounded-xl shadow-xl backdrop-blur-sm overflow-hidden flex flex-col`}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-700/50 bg-stone-800/50">
                            <div className="flex items-center gap-2">
                                <Scroll className="w-4 h-4 text-amber-400" />
                                <h3 className="text-sm font-bold text-stone-200">Game History</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-stone-500">Turn {currentTurn}</span>
                                <button
                                    onClick={onToggle}
                                    className="p-1 hover:bg-stone-700/50 rounded transition-colors"
                                >
                                    <X className="w-4 h-4 text-stone-400" />
                                </button>
                            </div>
                        </div>

                        {/* Entries List */}
                        <div
                            ref={scrollRef}
                            className="min-h-0 flex-1 overflow-y-auto p-2 space-y-1"
                            onScroll={(e) => {
                                const target = e.target as HTMLDivElement;
                                const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 20;
                                setAutoScroll(isAtBottom);
                            }}
                        >
                            {Object.entries(entriesByTurn).map(([turn, turnEntries]) => (
                                <div key={turn} className="mb-2">
                                    <div className="text-xs text-stone-500 uppercase tracking-wide mb-1 px-2">
                                        Turn {turn}
                                    </div>
                                    {turnEntries.map(entry => (
                                        <div
                                            key={entry.id}
                                            className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-stone-800/50 transition-colors"
                                        >
                                            <span className="text-sm mt-0.5">{typeIcons[entry.type]}</span>
                                            <div className="flex-1 min-w-0">
                                                <span className={`text-xs font-medium ${typeColors[entry.type]}`}>
                                                    {entry.playerName}:
                                                </span>
                                                <p className="text-xs text-stone-300 break-words">
                                                    {entry.message}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}

                            {entries.length === 0 && (
                                <div className="text-center py-8 text-stone-500 text-sm">
                                    No events yet
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-3 py-2 border-t border-stone-700/50 bg-stone-800/30">
                            <div className="flex items-center justify-between text-xs text-stone-500">
                                <span>{entries.length} events</span>
                                <button
                                    onClick={() => setAutoScroll(!autoScroll)}
                                    className={`px-2 py-0.5 rounded ${autoScroll ? 'bg-amber-600/20 text-amber-400' : 'bg-stone-700/50'}`}
                                >
                                    {autoScroll ? 'Auto-scroll: ON' : 'Auto-scroll: OFF'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

// Hook for managing game log with bounded memory
import { pushCapped, MEMORY_LIMITS } from '../../lib/memoryUtils';

export function useGameLog() {
    const [entries, setEntries] = useState<GameLogEntry[]>([]);

    const addEntry = (
        turn: number,
        playerId: string,
        playerName: string,
        type: GameLogEntryType,
        message: string,
        details?: Record<string, unknown>
    ) => {
        const entry: GameLogEntry = {
            id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            turn,
            playerId,
            playerName,
            type,
            message,
            timestamp: Date.now(),
            details,
        };
        setEntries(prev => pushCapped(prev, entry, MEMORY_LIMITS.GAME_LOG_MAX_ENTRIES));
        return entry.id;
    };

    const clearLog = () => setEntries([]);

    return { entries, addEntry, clearLog };
}
