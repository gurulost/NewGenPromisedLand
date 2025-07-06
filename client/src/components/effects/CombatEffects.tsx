import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HexCoordinate } from '../../../shared/types/coordinates';

interface DamageNumber {
  id: string;
  damage: number;
  position: { x: number; y: number };
  type: 'damage' | 'heal' | 'miss' | 'critical';
  timestamp: number;
}

interface CombatEffect {
  id: string;
  type: 'hit' | 'death' | 'heal' | 'levelup';
  position: { x: number; y: number };
  timestamp: number;
}

interface CombatEffectsProps {
  damageNumbers: DamageNumber[];
  effects: CombatEffect[];
  onEffectComplete: (id: string) => void;
}

export function CombatEffects({ damageNumbers, effects, onEffectComplete }: CombatEffectsProps) {
  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {/* Damage Numbers */}
      <AnimatePresence>
        {damageNumbers.map((damage) => (
          <DamageNumberEffect
            key={damage.id}
            damage={damage}
            onComplete={() => onEffectComplete(damage.id)}
          />
        ))}
      </AnimatePresence>

      {/* Combat Effects */}
      <AnimatePresence>
        {effects.map((effect) => (
          <CombatEffectAnimation
            key={effect.id}
            effect={effect}
            onComplete={() => onEffectComplete(effect.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function DamageNumberEffect({ damage, onComplete }: { damage: DamageNumber; onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const getColorClass = (type: DamageNumber['type']) => {
    switch (type) {
      case 'damage':
        return 'text-red-400';
      case 'critical':
        return 'text-red-600 font-bold';
      case 'heal':
        return 'text-green-400';
      case 'miss':
        return 'text-gray-400';
      default:
        return 'text-white';
    }
  };

  const getDisplayText = () => {
    switch (damage.type) {
      case 'miss':
        return 'MISS';
      case 'critical':
        return `${damage.damage}!`;
      default:
        return damage.damage.toString();
    }
  };

  return (
    <motion.div
      className={`absolute text-2xl font-bold drop-shadow-lg ${getColorClass(damage.type)}`}
      style={{
        left: damage.position.x,
        top: damage.position.y,
        transform: 'translate(-50%, -50%)'
      }}
      initial={{ 
        opacity: 0, 
        scale: 0.5, 
        y: 0 
      }}
      animate={{ 
        opacity: [0, 1, 1, 0], 
        scale: [0.5, 1.2, 1, 0.8], 
        y: [-20, -40, -60, -80] 
      }}
      transition={{ 
        duration: 2, 
        times: [0, 0.2, 0.8, 1],
        ease: "easeOut" 
      }}
    >
      {damage.type === 'critical' && (
        <motion.div
          className="absolute inset-0 text-yellow-300"
          initial={{ scale: 1.5, opacity: 0.8 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          ✨
        </motion.div>
      )}
      {getDisplayText()}
    </motion.div>
  );
}

function CombatEffectAnimation({ effect, onComplete }: { effect: CombatEffect; onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 1500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const renderEffect = () => {
    switch (effect.type) {
      case 'hit':
        return <HitEffect position={effect.position} />;
      case 'death':
        return <DeathEffect position={effect.position} />;
      case 'heal':
        return <HealEffect position={effect.position} />;
      case 'levelup':
        return <LevelUpEffect position={effect.position} />;
      default:
        return null;
    }
  };

  return (
    <div
      className="absolute"
      style={{
        left: effect.position.x,
        top: effect.position.y,
        transform: 'translate(-50%, -50%)'
      }}
    >
      {renderEffect()}
    </div>
  );
}

function HitEffect({ position }: { position: { x: number; y: number } }) {
  return (
    <motion.div
      className="relative"
      initial={{ scale: 0 }}
      animate={{ scale: [0, 1.5, 0] }}
      transition={{ duration: 0.6, times: [0, 0.3, 1] }}
    >
      {/* Impact Burst */}
      <motion.div
        className="w-16 h-16 border-4 border-red-400 rounded-full"
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: 3, opacity: 0 }}
        transition={{ duration: 0.5 }}
      />
      
      {/* Sparks */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-4 bg-orange-400 rounded-full"
          style={{
            transformOrigin: 'bottom center',
            rotate: i * 45
          }}
          initial={{ scale: 0, x: 0, y: 0 }}
          animate={{ 
            scale: 1, 
            x: Math.cos(i * 45 * Math.PI / 180) * 30,
            y: Math.sin(i * 45 * Math.PI / 180) * 30
          }}
          transition={{ duration: 0.4, delay: 0.1 }}
        />
      ))}
    </motion.div>
  );
}

function DeathEffect({ position }: { position: { x: number; y: number } }) {
  return (
    <motion.div
      className="relative"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Death Explosion */}
      <motion.div
        className="w-20 h-20 bg-gradient-radial from-red-600 via-orange-500 to-transparent rounded-full"
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: 4, opacity: 0 }}
        transition={{ duration: 1 }}
      />
      
      {/* Skull Icon */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center text-4xl"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: [0, 1, 0], y: [10, 0, -20] }}
        transition={{ duration: 1.5 }}
      >
        💀
      </motion.div>
    </motion.div>
  );
}

function HealEffect({ position }: { position: { x: number; y: number } }) {
  return (
    <motion.div
      className="relative"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Healing Glow */}
      <motion.div
        className="w-16 h-16 bg-gradient-radial from-green-400 via-emerald-300 to-transparent rounded-full"
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: 3, opacity: 0 }}
        transition={{ duration: 1.2 }}
      />
      
      {/* Plus Sign */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center text-3xl text-green-300 font-bold"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: [0, 1, 0], scale: [0, 1.2, 0.8] }}
        transition={{ duration: 1.5 }}
      >
        +
      </motion.div>

      {/* Sparkles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 bg-green-300 rounded-full"
          style={{
            left: Math.cos(i * 60 * Math.PI / 180) * 25 + 32,
            top: Math.sin(i * 60 * Math.PI / 180) * 25 + 32
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ 
            scale: [0, 1, 0], 
            opacity: [0, 1, 0],
            y: [0, -10, -20]
          }}
          transition={{ 
            duration: 1.5, 
            delay: i * 0.1,
            times: [0, 0.5, 1]
          }}
        />
      ))}
    </motion.div>
  );
}

function LevelUpEffect({ position }: { position: { x: number; y: number } }) {
  return (
    <motion.div
      className="relative"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Golden Burst */}
      <motion.div
        className="w-24 h-24 bg-gradient-radial from-yellow-400 via-gold-300 to-transparent rounded-full"
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: 3, opacity: 0 }}
        transition={{ duration: 1.5 }}
      />
      
      {/* Level Up Text */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center text-lg font-bold text-yellow-300"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: [0, 1, 0], y: [20, 0, -30] }}
        transition={{ duration: 2 }}
      >
        LEVEL UP!
      </motion.div>

      {/* Stars */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-2xl"
          style={{
            left: Math.cos(i * 72 * Math.PI / 180) * 40 + 48,
            top: Math.sin(i * 72 * Math.PI / 180) * 40 + 48
          }}
          initial={{ scale: 0, rotate: 0 }}
          animate={{ 
            scale: [0, 1.5, 1], 
            rotate: [0, 360, 720]
          }}
          transition={{ 
            duration: 2, 
            delay: i * 0.2
          }}
        >
          ⭐
        </motion.div>
      ))}
    </motion.div>
  );
}

// Hook for managing combat effects
export function useCombatEffects() {
  const [damageNumbers, setDamageNumbers] = useState<DamageNumber[]>([]);
  const [effects, setEffects] = useState<CombatEffect[]>([]);

  const addDamageNumber = (
    damage: number, 
    position: { x: number; y: number }, 
    type: DamageNumber['type'] = 'damage'
  ) => {
    const id = `damage-${Date.now()}-${Math.random()}`;
    setDamageNumbers(prev => [...prev, { id, damage, position, type, timestamp: Date.now() }]);
  };

  const addEffect = (
    type: CombatEffect['type'], 
    position: { x: number; y: number }
  ) => {
    const id = `effect-${Date.now()}-${Math.random()}`;
    setEffects(prev => [...prev, { id, type, position, timestamp: Date.now() }]);
  };

  const removeEffect = (id: string) => {
    setDamageNumbers(prev => prev.filter(d => d.id !== id));
    setEffects(prev => prev.filter(e => e.id !== id));
  };

  return {
    damageNumbers,
    effects,
    addDamageNumber,
    addEffect,
    removeEffect
  };
}