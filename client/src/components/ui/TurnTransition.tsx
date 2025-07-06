import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Swords, Shield } from 'lucide-react';
import { PlayerState } from '../../../shared/types/game';

interface TurnTransitionProps {
  isVisible: boolean;
  currentPlayer: PlayerState;
  onComplete: () => void;
  duration?: number;
}

export function TurnTransition({ 
  isVisible, 
  currentPlayer, 
  onComplete, 
  duration = 2000 
}: TurnTransitionProps) {
  const [phase, setPhase] = useState<'enter' | 'display' | 'exit'>('enter');

  useEffect(() => {
    if (!isVisible) return;

    const timeline = [
      { phase: 'enter', delay: 0 },
      { phase: 'display', delay: 800 },
      { phase: 'exit', delay: duration - 600 }
    ];

    const timeouts = timeline.map(({ phase, delay }) => 
      setTimeout(() => setPhase(phase as any), delay)
    );

    const completeTimeout = setTimeout(onComplete, duration);

    return () => {
      timeouts.forEach(clearTimeout);
      clearTimeout(completeTimeout);
    };
  }, [isVisible, duration, onComplete]);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-900/95 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        {/* Content */}
        <div className="relative text-center space-y-8">
          {/* Player Icon */}
          <motion.div
            className="flex justify-center"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ 
              scale: phase === 'enter' ? 1 : phase === 'display' ? 1.1 : 0.9,
              rotate: phase === 'enter' ? 0 : phase === 'display' ? 5 : -5
            }}
            transition={{ 
              type: "spring", 
              stiffness: 200, 
              damping: 20,
              duration: 0.6 
            }}
          >
            <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center shadow-2xl border-4 border-white/20">
              <Crown className="w-12 h-12 text-white" />
            </div>
          </motion.div>

          {/* Player Name */}
          <motion.div
            className="space-y-2"
            initial={{ y: 50, opacity: 0 }}
            animate={{ 
              y: 0, 
              opacity: 1,
              scale: phase === 'display' ? 1.05 : 1
            }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <h1 className="text-4xl font-bold text-white font-cinzel">
              {currentPlayer.name}'s Turn
            </h1>
            <p className="text-xl text-slate-300 font-body">
              Faction: {currentPlayer.factionId}
            </p>
          </motion.div>

          {/* Stats Display */}
          <motion.div
            className="flex justify-center gap-8"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            <StatCard
              icon={<Crown className="w-5 h-5" />}
              label="Faith"
              value={currentPlayer.stats.faith}
              color="text-yellow-400"
            />
            <StatCard
              icon={<Swords className="w-5 h-5" />}
              label="Pride"
              value={currentPlayer.stats.pride}
              color="text-red-400"
            />
            <StatCard
              icon={<Shield className="w-5 h-5" />}
              label="Dissent"
              value={currentPlayer.stats.internalDissent}
              color="text-blue-400"
            />
          </motion.div>

          {/* Turn Counter */}
          <motion.div
            className="text-slate-400 font-body"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.4 }}
          >
            Turn {Math.floor((currentPlayer.turnOrder || 0) + 1)}
          </motion.div>

          {/* Animated Particles */}
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full"
                initial={{ 
                  x: Math.random() * 400 - 200,
                  y: Math.random() * 400 - 200,
                  opacity: 0,
                  scale: 0
                }}
                animate={{ 
                  x: Math.random() * 600 - 300,
                  y: Math.random() * 600 - 300,
                  opacity: [0, 1, 0],
                  scale: [0, 1, 0]
                }}
                transition={{ 
                  duration: 2,
                  delay: Math.random() * 1,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function StatCard({ 
  icon, 
  label, 
  value, 
  color 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: number; 
  color: string; 
}) {
  return (
    <motion.div
      className="bg-slate-800/50 rounded-lg p-4 border border-slate-600 backdrop-blur-sm"
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className={color}>{icon}</div>
        <span className="text-sm text-slate-300">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>
        {value}
      </div>
    </motion.div>
  );
}

// Hook for managing turn transitions
export function useTurnTransition() {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [pendingPlayer, setPendingPlayer] = useState<PlayerState | null>(null);

  const startTransition = (player: PlayerState) => {
    setPendingPlayer(player);
    setIsTransitioning(true);
  };

  const completeTransition = () => {
    setIsTransitioning(false);
    setPendingPlayer(null);
  };

  return {
    isTransitioning,
    pendingPlayer,
    startTransition,
    completeTransition
  };
}