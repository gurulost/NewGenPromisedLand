import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Swords, Shield } from 'lucide-react';
import { PlayerState } from '@shared/types/game';
import { AvatarBadge } from '../primitives/AvatarBadge';
import { ModalLayer, ModalLayerContent } from '../primitives/ModalLayer';
import { getFaction } from '@shared/data/factions';

interface TurnTransitionProps {
  isVisible: boolean;
  currentPlayer: PlayerState;
  onComplete: () => void;
  duration?: number;
}

type TurnTransitionPhase = 'enter' | 'display' | 'exit';

const MIN_TRANSITION_DURATION_MS = 1000;
const DISPLAY_PHASE_TARGET_MS = 800;
const EXIT_PHASE_OFFSET_MS = 600;

export function getTurnTransitionTimings(duration: number) {
  const totalDuration = Math.max(MIN_TRANSITION_DURATION_MS, Math.floor(duration));
  const displayDelay = Math.min(
    DISPLAY_PHASE_TARGET_MS,
    Math.max(200, Math.floor(totalDuration * 0.4)),
  );
  const exitDelay = Math.max(displayDelay + 1, totalDuration - EXIT_PHASE_OFFSET_MS);

  return { totalDuration, displayDelay, exitDelay };
}

export function TurnTransition({ 
  isVisible, 
  currentPlayer, 
  onComplete, 
  duration = 2000 
}: TurnTransitionProps) {
  const [phase, setPhase] = useState<TurnTransitionPhase>('enter');
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useLayoutEffect(() => {
    if (!isVisible) return;
    setPhase('enter');
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    const { totalDuration, displayDelay, exitDelay } = getTurnTransitionTimings(duration);
    const displayTimeout = window.setTimeout(() => setPhase('display'), displayDelay);
    const exitTimeout = window.setTimeout(() => setPhase('exit'), exitDelay);
    const completeTimeout = window.setTimeout(() => onCompleteRef.current(), totalDuration);

    return () => {
      window.clearTimeout(displayTimeout);
      window.clearTimeout(exitTimeout);
      window.clearTimeout(completeTimeout);
    };
  }, [isVisible, duration]);

  useEffect(() => {
    if (isVisible && !currentPlayer) {
      console.warn('TurnTransition: currentPlayer is undefined');
    }
  }, [isVisible, currentPlayer]);

  return (
    <AnimatePresence>
      {isVisible && currentPlayer && (
        <ModalLayer asChild>
          <motion.div
            className="fixed inset-0 z-[var(--z-tutorial)] flex items-center justify-center"
            data-transition-phase={phase}
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
            <ModalLayerContent className="relative text-center space-y-8">
              {/* Player Avatar */}
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
                <AvatarBadge 
                  playerId={currentPlayer.id}
                  playerName={currentPlayer.name}
                  factionId={currentPlayer.factionId as any}
                  size="large"
                  className="shadow-2xl shadow-amber-500/30"
                />
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
                <h1 className="text-4xl font-bold text-amber-100 font-cinzel">
                  {currentPlayer.name}'s Turn
                </h1>
                <p className="text-xl text-amber-300 font-body">
                  {getFaction(currentPlayer.factionId as any)?.name || currentPlayer.factionId}
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
            </ModalLayerContent>
          </motion.div>
        </ModalLayer>
      )}
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
      className="bg-gradient-to-br from-slate-800/50 via-slate-700/30 to-slate-800/50 rounded-lg p-4 border border-amber-600/30 backdrop-blur-sm shadow-lg shadow-black/40"
      whileHover={{ scale: 1.05, borderColor: 'rgb(245 158 11 / 0.5)' }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className={color}>{icon}</div>
        <span className="text-sm text-amber-100/80">{label}</span>
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
