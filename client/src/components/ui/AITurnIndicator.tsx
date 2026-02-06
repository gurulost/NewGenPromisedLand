import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, Eye, Scroll, Moon, Flame, Swords, Sparkles } from 'lucide-react';
import { usePerformanceMode } from '../../hooks/usePerformanceMode';

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
        subtitle: 'The needle points the way',
        color: 'from-amber-400 via-yellow-500 to-amber-600',
        glowColor: 'shadow-amber-500/60',
        bgGradient: 'from-amber-900/40 via-yellow-900/20 to-amber-900/40',
    },
    {
        id: 'war_council',
        icon: Swords,
        title: 'The war council deliberates...',
        subtitle: 'Strategy unfolds in silence',
        color: 'from-red-400 via-rose-500 to-red-600',
        glowColor: 'shadow-red-500/60',
        bgGradient: 'from-red-900/40 via-rose-900/20 to-red-900/40',
    },
    {
        id: 'prophetic_vision',
        icon: Eye,
        title: 'Gazing beyond the veil...',
        subtitle: 'Visions of things to come',
        color: 'from-purple-400 via-violet-500 to-indigo-600',
        glowColor: 'shadow-purple-500/60',
        bgGradient: 'from-purple-900/40 via-indigo-900/20 to-purple-900/40',
    },
    {
        id: 'sacred_records',
        icon: Scroll,
        title: 'Searching the records...',
        subtitle: 'Ancient wisdom guides the path',
        color: 'from-emerald-400 via-green-500 to-teal-600',
        glowColor: 'shadow-emerald-500/60',
        bgGradient: 'from-emerald-900/40 via-teal-900/20 to-emerald-900/40',
    },
    {
        id: 'stone_interpreter',
        icon: Moon,
        title: 'Reading the seer stones...',
        subtitle: 'Light pierces the darkness',
        color: 'from-sky-400 via-cyan-500 to-blue-600',
        glowColor: 'shadow-sky-500/60',
        bgGradient: 'from-sky-900/40 via-blue-900/20 to-sky-900/40',
    },
    {
        id: 'altar',
        icon: Flame,
        title: 'Seeking divine favor...',
        subtitle: 'The smoke rises heavenward',
        color: 'from-orange-400 via-amber-500 to-red-600',
        glowColor: 'shadow-orange-500/60',
        bgGradient: 'from-orange-900/40 via-red-900/20 to-orange-900/40',
    },
];

// Liahona animation - spinning compass with orbiting glowing runes
const LiahonaAnimation = ({ highPerf }: { highPerf: boolean }) => (
    <div className="relative w-36 h-36">
        {/* Outer ring glow */}
        <motion.div
            className="absolute inset-0 rounded-full border-2 border-amber-400/30"
            animate={{ rotate: -360, scale: [1, 1.05, 1] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        />

        {/* Orbiting runes - reduced count for perf */}
        {[...Array(highPerf ? 8 : 4)].map((_, i) => (
            <motion.div
                key={i}
                className="absolute"
                style={{ top: '50%', left: '50%' }}
                animate={{
                    rotate: [i * (360 / (highPerf ? 8 : 4)), i * (360 / (highPerf ? 8 : 4)) + 360],
                }}
                transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
            >
                <motion.div
                    className="w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500"
                    style={{ transform: 'translateX(55px)' }}
                    animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.25 }}
                >
                    {highPerf && (
                        <div className="absolute inset-0 rounded-full bg-amber-300 blur-sm opacity-60" />
                    )}
                </motion.div>
            </motion.div>
        ))}

        {/* Central compass with golden glow */}
        <motion.div
            className="absolute inset-0 flex items-center justify-center"
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
            <div className="relative">
                <Compass className="w-16 h-16 text-amber-400" style={{ filter: 'drop-shadow(0 0 12px rgba(251, 191, 36, 0.6))' }} />
                {highPerf && (
                    <motion.div
                        className="absolute inset-0 flex items-center justify-center"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                    >
                        <Sparkles className="w-6 h-6 text-yellow-300 opacity-80" />
                    </motion.div>
                )}
            </div>
        </motion.div>
    </div>
);

// War Council animation - pulsing shield with radiating energy
const WarCouncilAnimation = ({ highPerf }: { highPerf: boolean }) => (
    <div className="relative w-36 h-36 flex items-center justify-center">
        {/* Radiating rings */}
        {[...Array(highPerf ? 3 : 2)].map((_, i) => (
            <motion.div
                key={i}
                className="absolute rounded-full border border-red-400/40"
                style={{ width: 80 + i * 30, height: 80 + i * 30 }}
                animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
            />
        ))}

        {/* Central war emblem */}
        <motion.div
            className="relative w-20 h-20 rounded-full bg-gradient-to-br from-red-500 via-rose-600 to-red-700 flex items-center justify-center"
            style={{ boxShadow: '0 0 30px rgba(239, 68, 68, 0.5), inset 0 -4px 10px rgba(0,0,0,0.3)' }}
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
        >
            <Swords className="w-10 h-10 text-white" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }} />
        </motion.div>

        {/* Floating battle sparks */}
        {highPerf && [...Array(6)].map((_, i) => (
            <motion.div
                key={i}
                className="absolute w-1 h-1 rounded-full bg-red-300"
                style={{ top: '50%', left: '50%' }}
                animate={{
                    x: [0, Math.cos((i * Math.PI * 2) / 6) * 60],
                    y: [0, Math.sin((i * Math.PI * 2) / 6) * 60],
                    opacity: [0, 1, 0],
                    scale: [0, 1.5, 0],
                }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
            />
        ))}
    </div>
);

// Prophetic Vision animation - mystical eye with cosmic swirl
const PropheticVisionAnimation = ({ highPerf }: { highPerf: boolean }) => (
    <div className="relative w-36 h-36 flex items-center justify-center">
        {/* Cosmic swirl */}
        <motion.div
            className="absolute w-32 h-32 rounded-full"
            style={{
                background: 'conic-gradient(from 0deg, transparent, rgba(139, 92, 246, 0.3), transparent, rgba(99, 102, 241, 0.3), transparent)',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        />

        {/* Swirling constellation */}
        {[...Array(highPerf ? 10 : 5)].map((_, i) => (
            <motion.div
                key={i}
                className="absolute"
                style={{ top: '50%', left: '50%' }}
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 6 + i * 0.5, repeat: Infinity, ease: 'linear' }}
            >
                <motion.div
                    className={`rounded-full bg-white ${i % 3 === 0 ? 'w-2 h-2' : 'w-1 h-1'}`}
                    style={{ transform: `translateX(${25 + (i % 4) * 12}px)` }}
                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.15 }}
                />
            </motion.div>
        ))}

        {/* Central eye */}
        <motion.div
            className="relative z-10"
            animate={{ scale: [0.95, 1.1, 0.95] }}
            transition={{ duration: 3, repeat: Infinity }}
        >
            <Eye
                className="w-16 h-16 text-purple-400"
                style={{ filter: 'drop-shadow(0 0 15px rgba(139, 92, 246, 0.7))' }}
            />
            {highPerf && (
                <motion.div
                    className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500/30 to-indigo-500/30 blur-lg"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.8, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity }}
                />
            )}
        </motion.div>
    </div>
);

// Sacred Records animation - floating scroll with glowing ancient text
const SacredRecordsAnimation = ({ highPerf }: { highPerf: boolean }) => (
    <div className="relative w-36 h-36 flex items-center justify-center">
        {/* Mystical aura */}
        {highPerf && (
            <motion.div
                className="absolute w-28 h-28 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 blur-xl"
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 3, repeat: Infinity }}
            />
        )}

        {/* Floating scroll */}
        <motion.div
            className="relative"
            animate={{ y: [0, -8, 0], rotate: [0, 2, -2, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
            <Scroll
                className="w-16 h-16 text-emerald-400"
                style={{ filter: 'drop-shadow(0 0 12px rgba(52, 211, 153, 0.6))' }}
            />

            {/* Glowing text lines emanating */}
            {[...Array(highPerf ? 5 : 3)].map((_, i) => (
                <motion.div
                    key={i}
                    className="absolute h-0.5 rounded-full"
                    style={{
                        left: '55%',
                        top: `${30 + i * 12}%`,
                        width: 20 + i * 4,
                        background: `linear-gradient(to right, rgba(52, 211, 153, 0.9), transparent)`,
                    }}
                    animate={{ opacity: [0, 1, 0], scaleX: [0, 1, 0], x: [0, 10, 20] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.25 }}
                />
            ))}
        </motion.div>

        {/* Floating letter particles */}
        {highPerf && [...Array(4)].map((_, i) => (
            <motion.div
                key={i}
                className="absolute text-emerald-300/60 text-xs font-cinzel"
                style={{ top: '50%', left: '50%' }}
                animate={{
                    y: [-20 - i * 15, -60 - i * 15],
                    x: [-30 + i * 20, -20 + i * 20],
                    opacity: [0, 0.7, 0],
                    rotate: [0, 10, -10],
                }}
                transition={{ duration: 3, repeat: Infinity, delay: i * 0.6 }}
            >
                ✦
            </motion.div>
        ))}
    </div>
);

// Stone Interpreter animation - mystical floating seer stones with inner light
const StoneInterpreterAnimation = ({ highPerf }: { highPerf: boolean }) => (
    <div className="relative w-36 h-36 flex items-center justify-center">
        {/* Background glow */}
        <motion.div
            className="absolute w-24 h-24 rounded-full bg-sky-400/20 blur-2xl"
            animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 3, repeat: Infinity }}
        />

        {/* Three floating stones in triangle formation */}
        {[...Array(3)].map((_, i) => {
            const angle = (i * 2 * Math.PI) / 3 - Math.PI / 2;
            const radius = 35;
            return (
                <motion.div
                    key={i}
                    className="absolute"
                    style={{
                        top: '50%',
                        left: '50%',
                        x: Math.cos(angle) * radius - 16,
                        y: Math.sin(angle) * radius - 16,
                    }}
                    animate={{
                        y: [Math.sin(angle) * radius - 16, Math.sin(angle) * radius - 26, Math.sin(angle) * radius - 16],
                        rotate: [0, 180, 360],
                    }}
                    transition={{ duration: 3 + i * 0.5, repeat: Infinity, delay: i * 0.3 }}
                >
                    <div
                        className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-300 via-cyan-400 to-blue-600"
                        style={{
                            boxShadow: '0 0 20px rgba(56, 189, 248, 0.6), inset 0 -3px 8px rgba(0,0,0,0.2), inset 0 3px 8px rgba(255,255,255,0.3)',
                        }}
                    >
                        {/* Inner glow */}
                        <motion.div
                            className="absolute inset-2 rounded-full bg-white/40 blur-sm"
                            animate={{ opacity: [0.3, 0.7, 0.3] }}
                            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                        />
                    </div>
                </motion.div>
            );
        })}

        {/* Central light beam effect */}
        {highPerf && (
            <motion.div
                className="absolute w-1 h-16 bg-gradient-to-t from-transparent via-sky-300 to-transparent rounded-full"
                animate={{ opacity: [0.2, 0.8, 0.2], scaleY: [0.8, 1.2, 0.8] }}
                transition={{ duration: 2, repeat: Infinity }}
            />
        )}
    </div>
);

// Altar animation - rising sacred flames with swirling embers
const AltarAnimation = ({ highPerf }: { highPerf: boolean }) => (
    <div className="relative w-36 h-36 flex items-center justify-center">
        {/* Flame base glow */}
        <motion.div
            className="absolute bottom-4 w-24 h-8 rounded-full bg-orange-500/40 blur-xl"
            animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity }}
        />

        {/* Main flames */}
        {[...Array(highPerf ? 7 : 5)].map((_, i) => (
            <motion.div
                key={i}
                className="absolute bottom-8 rounded-t-full"
                style={{
                    left: `${30 + i * (highPerf ? 6 : 8)}%`,
                    width: 8 + (i % 2) * 4,
                    background: `linear-gradient(to top, #f97316, #fbbf24, #fef3c7, transparent)`,
                }}
                animate={{
                    height: [25 + i * 3, 45 + i * 3, 25 + i * 3],
                    opacity: [0.7, 1, 0.7],
                    scaleX: [1, 0.7, 1],
                }}
                transition={{
                    duration: 0.6 + i * 0.08,
                    repeat: Infinity,
                    delay: i * 0.08,
                }}
            />
        ))}

        {/* Central flame icon */}
        <motion.div
            className="relative z-10"
            animate={{ y: [0, -6, 0], scale: [1, 1.08, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
        >
            <Flame
                className="w-14 h-14 text-orange-400"
                style={{ filter: 'drop-shadow(0 0 15px rgba(251, 146, 60, 0.8))' }}
            />
        </motion.div>

        {/* Rising embers */}
        {highPerf && [...Array(6)].map((_, i) => (
            <motion.div
                key={`ember-${i}`}
                className="absolute w-1 h-1 rounded-full bg-gradient-to-t from-orange-400 to-yellow-200"
                style={{ bottom: '40%', left: `${25 + i * 10}%` }}
                animate={{
                    y: [-5, -70],
                    x: [0, (i % 2 === 0 ? 15 : -15)],
                    opacity: [0.8, 0],
                    scale: [1, 0.3],
                }}
                transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.25 }}
            />
        ))}

        {/* Smoke wisps */}
        {[...Array(highPerf ? 3 : 2)].map((_, i) => (
            <motion.div
                key={`smoke-${i}`}
                className="absolute w-4 h-4 rounded-full bg-slate-400/20"
                style={{ bottom: '55%', left: `${35 + i * 15}%` }}
                animate={{
                    y: [-5, -50],
                    x: [0, (i % 2 === 0 ? 12 : -12)],
                    opacity: [0.3, 0],
                    scale: [0.5, 2.5],
                }}
                transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.7 }}
            />
        ))}
    </div>
);

const ANIMATION_COMPONENTS: Record<string, React.FC<{ highPerf: boolean }>> = {
    liahona: LiahonaAnimation,
    war_council: WarCouncilAnimation,
    prophetic_vision: PropheticVisionAnimation,
    sacred_records: SacredRecordsAnimation,
    stone_interpreter: StoneInterpreterAnimation,
    altar: AltarAnimation,
};

export function AITurnIndicator({ isVisible, aiName }: AITurnIndicatorProps) {
    const perfMode = usePerformanceMode();
    const highPerf = perfMode === 'high';

    // Select random variant when component becomes visible
    const variant = useMemo(() => {
        if (!isVisible) {
            return INDICATOR_VARIANTS[0];
        }
        return INDICATOR_VARIANTS[Math.floor(Math.random() * INDICATOR_VARIANTS.length)];
    }, [isVisible]);

    const AnimationComponent = ANIMATION_COMPONENTS[variant.id];

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    className="fixed inset-0 z-[var(--z-feedback)] flex items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    {/* Backdrop with gradient */}
                    <motion.div
                        className={`absolute inset-0 bg-gradient-to-br ${variant.bgGradient} backdrop-blur-md`}
                        style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    />

                    {/* Subtle vignette */}
                    <div className="absolute inset-0 pointer-events-none" style={{
                        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)',
                    }} />

                    {/* Content */}
                    <motion.div
                        className="relative flex flex-col items-center gap-6"
                        initial={{ scale: 0.7, y: 30, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.8, y: -30, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 180, damping: 18 }}
                    >
                        {/* Animation container with enhanced glow */}
                        <motion.div
                            className={`relative p-10 rounded-full bg-gradient-to-br from-slate-800/90 via-slate-900/95 to-slate-800/90 border border-white/10 shadow-2xl ${variant.glowColor}`}
                            animate={highPerf ? {
                                boxShadow: [
                                    `0 0 40px rgba(0,0,0,0.3), 0 0 60px ${variant.glowColor.replace('shadow-', '').replace('/60', '')}`,
                                    `0 0 50px rgba(0,0,0,0.3), 0 0 80px ${variant.glowColor.replace('shadow-', '').replace('/60', '')}`,
                                    `0 0 40px rgba(0,0,0,0.3), 0 0 60px ${variant.glowColor.replace('shadow-', '').replace('/60', '')}`,
                                ]
                            } : {}}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            <AnimationComponent highPerf={highPerf} />
                        </motion.div>

                        {/* Title with enhanced typography */}
                        <motion.div
                            className="text-center space-y-2"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3, duration: 0.5 }}
                        >
                            <h2 className={`text-3xl font-cinzel font-bold bg-gradient-to-r ${variant.color} bg-clip-text text-transparent`}
                                style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                                {aiName || 'The opponent'}
                            </h2>
                            <p className="text-xl text-white/80 font-body italic">
                                {variant.title}
                            </p>
                            <p className="text-sm text-white/50 font-body">
                                {variant.subtitle}
                            </p>
                        </motion.div>

                        {/* Pulsing dots with trail effect */}
                        <div className="flex gap-3 mt-2">
                            {[...Array(3)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${variant.color}`}
                                    animate={{
                                        scale: [1, 1.6, 1],
                                        opacity: [0.4, 1, 0.4],
                                    }}
                                    transition={{
                                        duration: 1.2,
                                        repeat: Infinity,
                                        delay: i * 0.2,
                                        ease: 'easeInOut',
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
