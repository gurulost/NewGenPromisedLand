import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Scroll, X } from 'lucide-react';

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
    maxEntries = 100
}: GameLogPanelProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);

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

    return (
        <>
            {/* Collapsed Button */}
            {!isOpen && (
                <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={onToggle}
                    className="fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3 py-2 bg-stone-800/90 border border-stone-600/50 rounded-lg hover:bg-stone-700/90 transition-colors backdrop-blur-sm"
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
                        className="fixed bottom-4 left-4 z-50 w-80 max-h-96 bg-stone-900/95 border border-stone-600/50 rounded-xl shadow-xl backdrop-blur-sm overflow-hidden"
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
                            className="max-h-72 overflow-y-auto p-2 space-y-1"
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
