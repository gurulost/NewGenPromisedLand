import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, Eye, Scroll, Moon, Flame, Swords } from 'lucide-react';

interface AITurnIndicatorProps {
    isVisible: boolean;
    aiName?: string;
    factionId?: string;
}

// Animation variants - randomly selected each time
const INDICATOR_VARIANTS = [
    {
        id: 'liahona',
        icon: Compass,
        title: 'Consulting the Liahona...',
        color: 'from-amber-400 to-yellow-600',
        glowColor: 'shadow-amber-500/50',
    },
    {
        id: 'war_council',
        icon: Swords,
        title: 'The war council deliberates...',
        color: 'from-red-400 to-rose-600',
        glowColor: 'shadow-red-500/50',
    },
    {
        id: 'prophetic_vision',
        icon: Eye,
        title: 'Gazing beyond the veil...',
        color: 'from-purple-400 to-indigo-600',
        glowColor: 'shadow-purple-500/50',
    },
    {
        id: 'sacred_records',
        icon: Scroll,
        title: 'Searching the records...',
        color: 'from-emerald-400 to-teal-600',
        glowColor: 'shadow-emerald-500/50',
    },
    {
        id: 'stone_interpreter',
        icon: Moon,
        title: 'Reading the seer stones...',
        color: 'from-sky-400 to-blue-600',
        glowColor: 'shadow-sky-500/50',
    },
    {
        id: 'altar',
        icon: Flame,
        title: 'Seeking divine favor...',
        color: 'from-orange-400 to-red-600',
        glowColor: 'shadow-orange-500/50',
    },
];

// Liahona animation - spinning compass with orbiting runes
const LiahonaAnimation = () => (
    <div className="relative w-32 h-32">
        {/* Orbiting runes */}
        {[...Array(8)].map((_, i) => (
            <motion.div
                key={i}
                className="absolute w-3 h-3 rounded-full bg-gradient-to-r from-amber-300 to-yellow-500"
                style={{
                    top: '50%',
                    left: '50%',
                }}
                animate={{
                    x: [0, Math.cos((i * Math.PI * 2) / 8) * 60],
                    y: [0, Math.sin((i * Math.PI * 2) / 8) * 60],
                    rotate: [0, 360],
                    opacity: [0.3, 1, 0.3],
                }}
                transition={{
                    duration: 3,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: 'easeInOut',
                }}
            />
        ))}
        {/* Central compass */}
        <motion.div
            className="absolute inset-0 flex items-center justify-center"
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        >
            <Compass className="w-16 h-16 text-amber-400 drop-shadow-lg" />
        </motion.div>
    </div>
);

// War Council animation - advisors whispering
const WarCouncilAnimation = () => (
    <div className="relative w-32 h-32 flex items-center justify-center">
        {/* Central figure */}
        <motion.div
            className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-rose-700 flex items-center justify-center shadow-xl shadow-red-500/40"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
        >
            <Swords className="w-8 h-8 text-white" />
        </motion.div>
        {/* Thought bubbles */}
        {[...Array(5)].map((_, i) => (
            <motion.div
                key={i}
                className="absolute w-2 h-2 rounded-full bg-white/60"
                style={{
                    top: '50%',
                    left: '50%',
                }}
                animate={{
                    x: [0, Math.cos((i * Math.PI * 2) / 5 - Math.PI / 2) * 50],
                    y: [0, Math.sin((i * Math.PI * 2) / 5 - Math.PI / 2) * 50 - 20],
                    scale: [0, 1.5, 0],
                    opacity: [0, 0.8, 0],
                }}
                transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    delay: i * 0.4,
                }}
            />
        ))}
    </div>
);

// Prophetic Vision animation - opening eye with stars
const PropheticVisionAnimation = () => (
    <div className="relative w-32 h-32 flex items-center justify-center">
        {/* Swirling stars */}
        {[...Array(12)].map((_, i) => (
            <motion.div
                key={i}
                className="absolute w-1.5 h-1.5 rounded-full bg-white"
                style={{
                    top: '50%',
                    left: '50%',
                }}
                animate={{
                    x: Math.cos((i * Math.PI * 2) / 12) * (30 + (i % 3) * 15),
                    y: Math.sin((i * Math.PI * 2) / 12) * (30 + (i % 3) * 15),
                    rotate: [0, 360],
                    scale: [0.5, 1, 0.5],
                    opacity: [0.3, 1, 0.3],
                }}
                transition={{
                    duration: 4,
                    repeat: Infinity,
                    delay: i * 0.1,
                    ease: 'linear',
                }}
            />
        ))}
        {/* Eye */}
        <motion.div
            className="relative"
            animate={{ scale: [0.9, 1.1, 0.9] }}
            transition={{ duration: 3, repeat: Infinity }}
        >
            <Eye className="w-16 h-16 text-purple-400 drop-shadow-lg" />
            <motion.div
                className="absolute inset-0 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full blur-xl opacity-30"
                animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 2, repeat: Infinity }}
            />
        </motion.div>
    </div>
);

// Sacred Records animation - unrolling scroll
const SacredRecordsAnimation = () => (
    <div className="relative w-32 h-32 flex items-center justify-center">
        <motion.div
            className="relative"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
        >
            <Scroll className="w-16 h-16 text-emerald-400 drop-shadow-lg" />
            {/* Glowing text lines */}
            {[...Array(3)].map((_, i) => (
                <motion.div
                    key={i}
                    className="absolute w-8 h-0.5 bg-gradient-to-r from-emerald-300 to-transparent rounded-full"
                    style={{ left: '60%', top: `${35 + i * 10}%` }}
                    animate={{
                        opacity: [0, 1, 0],
                        scaleX: [0, 1, 0],
                    }}
                    transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        delay: i * 0.3,
                    }}
                />
            ))}
        </motion.div>
    </div>
);

// Stone Interpreter animation - floating seer stones
const StoneInterpreterAnimation = () => (
    <div className="relative w-32 h-32 flex items-center justify-center">
        {[...Array(3)].map((_, i) => (
            <motion.div
                key={i}
                className="absolute w-8 h-8 rounded-full bg-gradient-to-br from-sky-300 to-blue-600 shadow-lg shadow-sky-500/50"
                animate={{
                    y: [0, -15, 0],
                    x: [-20 + i * 20, -20 + i * 20 + (i % 2 === 0 ? 5 : -5), -20 + i * 20],
                    rotate: [0, 360],
                    boxShadow: [
                        '0 0 10px rgba(56, 189, 248, 0.5)',
                        '0 0 25px rgba(56, 189, 248, 0.8)',
                        '0 0 10px rgba(56, 189, 248, 0.5)',
                    ],
                }}
                transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    delay: i * 0.4,
                    ease: 'easeInOut',
                }}
            />
        ))}
        {/* Central glow */}
        <motion.div
            className="absolute w-20 h-20 rounded-full bg-sky-400/20 blur-xl"
            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
        />
    </div>
);

// Altar animation - rising flames
const AltarAnimation = () => (
    <div className="relative w-32 h-32 flex items-center justify-center">
        {/* Flames */}
        {[...Array(6)].map((_, i) => (
            <motion.div
                key={i}
                className="absolute bottom-4 w-4 rounded-full bg-gradient-to-t from-orange-500 via-yellow-400 to-transparent"
                style={{ left: `${20 + i * 10}%` }}
                animate={{
                    height: [20, 40, 20],
                    opacity: [0.6, 1, 0.6],
                    scaleX: [1, 0.8, 1],
                }}
                transition={{
                    duration: 0.8 + i * 0.1,
                    repeat: Infinity,
                    delay: i * 0.1,
                }}
            />
        ))}
        {/* Central flame icon */}
        <motion.div
            className="relative z-10"
            animate={{ y: [0, -5, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
        >
            <Flame className="w-12 h-12 text-orange-400 drop-shadow-lg" />
        </motion.div>
        {/* Smoke particles */}
        {[...Array(4)].map((_, i) => (
            <motion.div
                key={`smoke-${i}`}
                className="absolute w-3 h-3 rounded-full bg-slate-400/30"
                style={{ bottom: '60%', left: `${30 + i * 15}%` }}
                animate={{
                    y: [-10, -60],
                    x: [0, (i % 2 === 0 ? 10 : -10)],
                    opacity: [0.5, 0],
                    scale: [0.5, 2],
                }}
                transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.5,
                }}
            />
        ))}
    </div>
);

const ANIMATION_COMPONENTS: Record<string, React.FC> = {
    liahona: LiahonaAnimation,
    war_council: WarCouncilAnimation,
    prophetic_vision: PropheticVisionAnimation,
    sacred_records: SacredRecordsAnimation,
    stone_interpreter: StoneInterpreterAnimation,
    altar: AltarAnimation,
};

export function AITurnIndicator({ isVisible, aiName }: AITurnIndicatorProps) {
    // Select random variant when component becomes visible
    const variant = useMemo(() => {
        return INDICATOR_VARIANTS[Math.floor(Math.random() * INDICATOR_VARIANTS.length)];
    }, [isVisible]);

    const AnimationComponent = ANIMATION_COMPONENTS[variant.id];

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    className="fixed inset-0 z-[90] flex items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    {/* Backdrop */}
                    <motion.div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    />

                    {/* Content */}
                    <motion.div
                        className="relative flex flex-col items-center gap-6"
                        initial={{ scale: 0.8, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.8, y: -20 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                    >
                        {/* Animation container with glow */}
                        <div className={`relative p-8 rounded-full bg-slate-900/80 border border-white/10 shadow-2xl ${variant.glowColor}`}>
                            <AnimationComponent />
                        </div>

                        {/* Title */}
                        <motion.div
                            className="text-center"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <h2 className={`text-2xl font-cinzel font-bold bg-gradient-to-r ${variant.color} bg-clip-text text-transparent`}>
                                {aiName ? `${aiName}` : 'The opponent'}
                            </h2>
                            <p className="text-lg text-slate-300 mt-2 font-body">
                                {variant.title}
                            </p>
                        </motion.div>

                        {/* Pulsing dots */}
                        <div className="flex gap-2">
                            {[...Array(3)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    className={`w-2 h-2 rounded-full bg-gradient-to-r ${variant.color}`}
                                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                                    transition={{
                                        duration: 1,
                                        repeat: Infinity,
                                        delay: i * 0.2,
                                    }}
                                />
                            ))}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default AITurnIndicator;
