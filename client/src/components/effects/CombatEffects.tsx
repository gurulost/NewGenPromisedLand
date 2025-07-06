import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DamageNumber {
  id: string;
  damage: number;
  position: { x: number; y: number };
  type: 'damage' | 'heal' | 'miss' | 'critical' | 'block' | 'dodge';
  timestamp: number;
}

interface CombatEffect {
  id: string;
  type: 'hit' | 'death' | 'heal' | 'levelup' | 'battle_start' | 'charge' | 'slash' | 'explosion' | 'shield_block' | 'arrow_shot' | 'magic_cast';
  position: { x: number; y: number };
  timestamp: number;
  unitType?: string;
  attackerPosition?: { x: number; y: number };
}

interface BattleSequence {
  id: string;
  attacker: { x: number; y: number; unitType: string };
  defender: { x: number; y: number; unitType: string };
  damage: number;
  sequence: Array<{
    type: CombatEffect['type'];
    delay: number;
    position: { x: number; y: number };
  }>;
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
    const timer = setTimeout(onComplete, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const getColorClass = (type: DamageNumber['type']) => {
    switch (type) {
      case 'damage':
        return 'text-red-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]';
      case 'critical':
        return 'text-red-600 font-black text-shadow-glow';
      case 'heal':
        return 'text-green-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]';
      case 'miss':
        return 'text-gray-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]';
      case 'block':
        return 'text-blue-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]';
      case 'dodge':
        return 'text-yellow-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]';
      default:
        return 'text-white';
    }
  };

  const getDisplayText = () => {
    switch (damage.type) {
      case 'miss':
        return 'MISS';
      case 'block':
        return 'BLOCKED';
      case 'dodge':
        return 'DODGED';
      case 'critical':
        return `${damage.damage}! CRITICAL!`;
      default:
        return damage.damage.toString();
    }
  };

  return (
    <motion.div
      className={`absolute font-bold drop-shadow-lg ${getColorClass(damage.type)} ${
        damage.type === 'critical' ? 'text-4xl' : 'text-3xl'
      }`}
      style={{
        left: damage.position.x,
        top: damage.position.y,
        transform: 'translate(-50%, -50%)',
        textShadow: damage.type === 'critical' ? '0 0 20px rgba(255,255,0,0.8)' : '0 2px 4px rgba(0,0,0,0.8)'
      }}
      initial={{ 
        opacity: 0, 
        scale: 0.3, 
        y: 0,
        rotate: damage.type === 'critical' ? -15 : 0
      }}
      animate={{ 
        opacity: [0, 1, 1, 0.8, 0], 
        scale: damage.type === 'critical' ? [0.3, 1.8, 1.4, 1.2, 0.9] : [0.3, 1.4, 1.1, 1, 0.8], 
        y: [-10, -30, -50, -70, -90],
        rotate: damage.type === 'critical' ? [-15, 15, 0, -5, 0] : [0, 3, -2, 1, 0]
      }}
      transition={{ 
        duration: 2.5, 
        times: [0, 0.15, 0.3, 0.7, 1],
        ease: "easeOut" 
      }}
    >
      {/* Critical Hit Effects */}
      {damage.type === 'critical' && (
        <>
          <motion.div
            className="absolute inset-0 text-yellow-300 text-2xl"
            initial={{ scale: 2, opacity: 1, rotate: 0 }}
            animate={{ scale: 4, opacity: 0, rotate: 360 }}
            transition={{ duration: 0.8 }}
          >
            ✨
          </motion.div>
          <motion.div
            className="absolute inset-0 border-4 border-yellow-400 rounded-full"
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 6, opacity: 0 }}
            transition={{ duration: 1 }}
          />
        </>
      )}
      
      {/* Block/Dodge Shield Effect */}
      {(damage.type === 'block' || damage.type === 'dodge') && (
        <motion.div
          className="absolute inset-0 text-blue-400 text-2xl"
          initial={{ scale: 0.5, opacity: 1 }}
          animate={{ scale: 2, opacity: 0, x: damage.type === 'dodge' ? 20 : 0 }}
          transition={{ duration: 1 }}
        >
          {damage.type === 'block' ? '🛡️' : '💨'}
        </motion.div>
      )}

      <motion.span
        initial={{ filter: 'blur(2px)' }}
        animate={{ filter: 'blur(0px)' }}
        transition={{ duration: 0.3 }}
      >
        {getDisplayText()}
      </motion.span>
    </motion.div>
  );
}

function CombatEffectAnimation({ effect, onComplete }: { effect: CombatEffect; onComplete: () => void }) {
  useEffect(() => {
    const effectDuration = effect.type === 'battle_start' ? 3000 : 
                          effect.type === 'charge' ? 2000 :
                          effect.type === 'explosion' ? 2500 : 1500;
    const timer = setTimeout(onComplete, effectDuration);
    return () => clearTimeout(timer);
  }, [onComplete, effect.type]);

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
      case 'battle_start':
        return <BattleStartEffect position={effect.position} />;
      case 'charge':
        return <ChargeEffect 
          position={effect.position} 
          attackerPosition={effect.attackerPosition}
          unitType={effect.unitType}
        />;
      case 'slash':
        return <SlashEffect position={effect.position} />;
      case 'explosion':
        return <ExplosionEffect position={effect.position} />;
      case 'shield_block':
        return <ShieldBlockEffect position={effect.position} />;
      case 'arrow_shot':
        return <ArrowShotEffect 
          position={effect.position}
          attackerPosition={effect.attackerPosition}
        />;
      case 'magic_cast':
        return <MagicCastEffect position={effect.position} />;
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

// New Battle Start Effect
function BattleStartEffect({ position }: { position: { x: number; y: number } }) {
  return (
    <motion.div
      className="relative"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Screen Shake Simulation */}
      <motion.div
        className="absolute inset-0"
        animate={{ 
          x: [0, -2, 2, -1, 1, 0],
          y: [0, 1, -1, 2, -2, 0]
        }}
        transition={{ 
          duration: 0.6,
          repeat: 2
        }}
      >
        {/* War Drums Circle */}
        <motion.div
          className="w-32 h-32 border-8 border-red-600 rounded-full"
          initial={{ scale: 0, opacity: 1, rotate: 0 }}
          animate={{ 
            scale: [0, 1.5, 2.5], 
            opacity: [1, 0.7, 0],
            rotate: 360
          }}
          transition={{ duration: 2.5 }}
        />
        
        {/* Battle Cry Text */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center text-2xl font-black text-red-500"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ 
            opacity: [0, 1, 1, 0], 
            scale: [0.5, 1.2, 1, 0.8]
          }}
          transition={{ 
            duration: 3,
            times: [0, 0.2, 0.8, 1]
          }}
        >
          ⚔️ BATTLE! ⚔️
        </motion.div>

        {/* Lightning Strikes */}
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-20 bg-gradient-to-b from-yellow-300 to-transparent"
            style={{
              left: Math.cos(i * 90 * Math.PI / 180) * 50 + 64,
              top: Math.sin(i * 90 * Math.PI / 180) * 50 + 64,
              transformOrigin: 'bottom center'
            }}
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ 
              scaleY: [0, 1, 0], 
              opacity: [0, 1, 0]
            }}
            transition={{ 
              duration: 0.3, 
              delay: 0.5 + i * 0.1,
              repeat: 2
            }}
          />
        ))}
      </motion.div>
    </motion.div>
  );
}

// Charge Effect
function ChargeEffect({ 
  position, 
  attackerPosition, 
  unitType 
}: { 
  position: { x: number; y: number };
  attackerPosition?: { x: number; y: number };
  unitType?: string;
}) {
  const startPos = attackerPosition || { x: position.x - 100, y: position.y };
  
  return (
    <motion.div className="relative">
      {/* Dust Trail */}
      <motion.div
        className="absolute w-2 h-40 bg-gradient-to-t from-brown-400 via-brown-300 to-transparent"
        style={{
          left: startPos.x,
          top: startPos.y,
        }}
        initial={{ scaleY: 0, opacity: 0 }}
        animate={{ scaleY: 1, opacity: [0, 0.8, 0] }}
        transition={{ duration: 1.5 }}
      />
      
      {/* Charging Unit Representation */}
      <motion.div
        className="absolute text-4xl"
        style={{
          left: startPos.x,
          top: startPos.y,
        }}
        initial={{ x: 0, y: 0, scale: 0.5 }}
        animate={{ 
          x: position.x - startPos.x,
          y: position.y - startPos.y,
          scale: [0.5, 1.2, 1]
        }}
        transition={{ 
          duration: 1.5,
          ease: "easeInOut"
        }}
      >
        {unitType === 'spearman' ? '🛡️' : 
         unitType === 'commander' ? '👑' : 
         unitType === 'warrior' ? '⚔️' : '🏃‍♂️'}
      </motion.div>

      {/* Impact Shockwave */}
      <motion.div
        className="absolute w-16 h-16 border-4 border-orange-500 rounded-full"
        style={{
          left: position.x - 32,
          top: position.y - 32,
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ 
          scale: [0, 3, 5], 
          opacity: [0, 1, 0]
        }}
        transition={{ 
          duration: 0.8,
          delay: 1.2
        }}
      />
    </motion.div>
  );
}

// Slash Effect
function SlashEffect({ position }: { position: { x: number; y: number } }) {
  return (
    <motion.div
      className="relative"
      style={{
        left: position.x - 50,
        top: position.y - 50,
      }}
    >
      {/* Slash Trail */}
      <motion.div
        className="absolute w-24 h-2 bg-gradient-to-r from-transparent via-white to-transparent"
        style={{
          transformOrigin: 'left center',
        }}
        initial={{ 
          scaleX: 0, 
          opacity: 0, 
          rotate: -45 
        }}
        animate={{ 
          scaleX: [0, 1, 0], 
          opacity: [0, 1, 0],
          rotate: -45
        }}
        transition={{ duration: 0.4 }}
      />
      
      {/* Slash Sparkles */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-white rounded-full"
          style={{
            left: 20 + i * 8,
            top: 48 - i * 6,
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ 
            scale: [0, 1, 0], 
            opacity: [0, 1, 0],
            x: [0, Math.random() * 20 - 10],
            y: [0, Math.random() * 20 - 10]
          }}
          transition={{ 
            duration: 0.6, 
            delay: i * 0.05
          }}
        />
      ))}
    </motion.div>
  );
}

// Explosion Effect
function ExplosionEffect({ position }: { position: { x: number; y: number } }) {
  return (
    <motion.div
      className="relative"
      style={{
        left: position.x - 60,
        top: position.y - 60,
      }}
    >
      {/* Main Explosion */}
      <motion.div
        className="w-32 h-32 bg-gradient-radial from-orange-500 via-red-500 to-transparent rounded-full"
        initial={{ scale: 0, opacity: 1 }}
        animate={{ 
          scale: [0, 1.5, 2.5], 
          opacity: [1, 0.8, 0]
        }}
        transition={{ duration: 1.5 }}
      />
      
      {/* Secondary Blast */}
      <motion.div
        className="absolute inset-0 w-32 h-32 bg-gradient-radial from-yellow-400 via-orange-400 to-transparent rounded-full"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ 
          scale: [0, 1, 2], 
          opacity: [0, 1, 0]
        }}
        transition={{ 
          duration: 1.2,
          delay: 0.2
        }}
      />

      {/* Debris */}
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 bg-gray-600 rounded-full"
          style={{
            left: 64,
            top: 64,
          }}
          initial={{ scale: 0 }}
          animate={{ 
            scale: [0, 1, 0.5],
            x: Math.cos(i * 30 * Math.PI / 180) * (60 + Math.random() * 40),
            y: Math.sin(i * 30 * Math.PI / 180) * (60 + Math.random() * 40)
          }}
          transition={{ 
            duration: 2,
            delay: 0.1
          }}
        />
      ))}
    </motion.div>
  );
}

// Shield Block Effect
function ShieldBlockEffect({ position }: { position: { x: number; y: number } }) {
  return (
    <motion.div
      className="relative"
      style={{
        left: position.x - 30,
        top: position.y - 30,
      }}
    >
      {/* Shield Glow */}
      <motion.div
        className="w-16 h-16 bg-gradient-radial from-blue-400 via-cyan-300 to-transparent rounded-full"
        initial={{ scale: 0, opacity: 1 }}
        animate={{ 
          scale: [0, 1.5, 2], 
          opacity: [1, 0.6, 0]
        }}
        transition={{ duration: 1 }}
      />
      
      {/* Shield Icon */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center text-3xl"
        initial={{ scale: 0, rotate: -30 }}
        animate={{ 
          scale: [0, 1.3, 1], 
          rotate: [-30, 10, 0]
        }}
        transition={{ duration: 0.8 }}
      >
        🛡️
      </motion.div>

      {/* Block Sparks */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-4 bg-blue-300 rounded-full"
          style={{
            left: 32,
            top: 32,
            transformOrigin: 'bottom center',
          }}
          initial={{ scale: 0, rotate: i * 60 }}
          animate={{ 
            scale: [0, 1, 0],
            x: Math.cos(i * 60 * Math.PI / 180) * 25,
            y: Math.sin(i * 60 * Math.PI / 180) * 25
          }}
          transition={{ 
            duration: 0.8, 
            delay: 0.2
          }}
        />
      ))}
    </motion.div>
  );
}

// Arrow Shot Effect
function ArrowShotEffect({ 
  position, 
  attackerPosition 
}: { 
  position: { x: number; y: number };
  attackerPosition?: { x: number; y: number };
}) {
  const startPos = attackerPosition || { x: position.x - 150, y: position.y - 50 };
  
  return (
    <motion.div className="relative">
      {/* Arrow Trail */}
      <motion.div
        className="absolute w-1 h-12 bg-gradient-to-t from-brown-600 to-gray-400"
        style={{
          left: startPos.x,
          top: startPos.y,
          transformOrigin: 'bottom center',
        }}
        initial={{ 
          x: 0, 
          y: 0, 
          rotate: Math.atan2(position.y - startPos.y, position.x - startPos.x) * 180 / Math.PI
        }}
        animate={{ 
          x: position.x - startPos.x,
          y: position.y - startPos.y,
        }}
        transition={{ 
          duration: 0.6,
          ease: "easeOut"
        }}
      />

      {/* Impact Effect */}
      <motion.div
        className="absolute w-8 h-8 border-2 border-brown-600 rounded-full"
        style={{
          left: position.x - 16,
          top: position.y - 16,
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ 
          scale: [0, 1.5, 0], 
          opacity: [0, 1, 0]
        }}
        transition={{ 
          duration: 0.4,
          delay: 0.5
        }}
      />
    </motion.div>
  );
}

// Magic Cast Effect
function MagicCastEffect({ position }: { position: { x: number; y: number } }) {
  return (
    <motion.div
      className="relative"
      style={{
        left: position.x - 40,
        top: position.y - 40,
      }}
    >
      {/* Magic Circle */}
      <motion.div
        className="w-20 h-20 border-4 border-purple-400 rounded-full"
        style={{
          borderStyle: 'dashed',
        }}
        initial={{ scale: 0, opacity: 0, rotate: 0 }}
        animate={{ 
          scale: [0, 1, 1.5], 
          opacity: [0, 1, 0],
          rotate: 360
        }}
        transition={{ duration: 1.5 }}
      />
      
      {/* Magic Sparkles */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-lg"
          style={{
            left: Math.cos(i * 45 * Math.PI / 180) * 30 + 40,
            top: Math.sin(i * 45 * Math.PI / 180) * 30 + 40,
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ 
            scale: [0, 1, 0], 
            opacity: [0, 1, 0],
            rotate: [0, 180, 360]
          }}
          transition={{ 
            duration: 1.2, 
            delay: i * 0.1
          }}
        >
          ✨
        </motion.div>
      ))}

      {/* Central Magic Burst */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center text-2xl"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ 
          scale: [0, 1.5, 1], 
          opacity: [0, 1, 0]
        }}
        transition={{ 
          duration: 1,
          delay: 0.5
        }}
      >
        🔮
      </motion.div>
    </motion.div>
  );
}

// Hook for managing combat effects with enhanced orchestration
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
    position: { x: number; y: number },
    attackerPosition?: { x: number; y: number },
    unitType?: string
  ) => {
    const id = `effect-${Date.now()}-${Math.random()}`;
    setEffects(prev => [...prev, { 
      id, 
      type, 
      position, 
      attackerPosition,
      unitType,
      timestamp: Date.now() 
    }]);
  };

  const removeEffect = (id: string) => {
    setDamageNumbers(prev => prev.filter(d => d.id !== id));
    setEffects(prev => prev.filter(e => e.id !== id));
  };

  // Enhanced battle sequence orchestration for cinematic combat
  const triggerBattleSequence = (
    attacker: { x: number; y: number; unitType: string },
    defender: { x: number; y: number; unitType: string },
    damage: number,
    combatType: 'melee' | 'ranged' | 'magic' | 'siege' = 'melee'
  ) => {
    const midpoint = { 
      x: (attacker.x + defender.x) / 2, 
      y: (attacker.y + defender.y) / 2 
    };

    // Phase 1: Battle Start Announcement (dramatic opening)
    addEffect('battle_start', midpoint);

    // Phase 2: Attack Animation based on combat type
    setTimeout(() => {
      switch (combatType) {
        case 'melee':
          addEffect('charge', defender, attacker, attacker.unitType);
          break;
        case 'ranged':
          addEffect('arrow_shot', defender, attacker);
          break;
        case 'magic':
          addEffect('magic_cast', attacker);
          break;
        case 'siege':
          addEffect('explosion', defender);
          break;
      }
    }, 1000); // Dramatic pause before attack

    // Phase 3: Impact and Damage Resolution
    const impactDelay = combatType === 'melee' ? 2200 : 
                       combatType === 'ranged' ? 1800 : 
                       combatType === 'magic' ? 1500 : 1200;

    setTimeout(() => {
      if (damage > 0) {
        const isCritical = damage > 15;
        const isHeavyDamage = damage > 20;
        
        // Damage number with enhanced visual feedback
        addDamageNumber(damage, defender, isCritical ? 'critical' : 'damage');

        // Impact effects based on damage severity
        if (isHeavyDamage) {
          addEffect('explosion', defender);
        } else if (isCritical) {
          addEffect('hit', defender);
          addEffect('slash', defender);
        } else {
          addEffect('hit', defender);
        }

        // Additional melee slash effect for sword combat
        if (combatType === 'melee' && ['warrior', 'commander', 'spearman'].includes(attacker.unitType)) {
          setTimeout(() => addEffect('slash', defender), 200);
        }
      } else {
        // Miss, block, or dodge scenarios
        const missType = Math.random() > 0.5 ? 'miss' : 'block';
        addDamageNumber(0, defender, missType);
        
        if (missType === 'block') {
          addEffect('shield_block', defender);
        }
      }
    }, impactDelay);

    // Phase 4: Death effect if damage is fatal
    if (damage >= 100) { // Assuming 100+ damage is lethal
      setTimeout(() => {
        addEffect('death', defender);
      }, impactDelay + 500);
    }
  };

  // Spell casting with magical effects
  const triggerSpellEffect = (
    caster: { x: number; y: number },
    target: { x: number; y: number },
    spellType: 'heal' | 'buff' | 'debuff' | 'damage' | 'blessing'
  ) => {
    // Magical preparation
    addEffect('magic_cast', caster);

    // Spell resolution based on type
    setTimeout(() => {
      switch (spellType) {
        case 'heal':
        case 'blessing':
          addEffect('heal', target);
          if (spellType === 'heal') {
            addDamageNumber(-10, target, 'heal'); // Negative damage = healing
          }
          break;
        case 'damage':
          addEffect('explosion', target);
          addDamageNumber(12, target, 'damage');
          break;
        case 'buff':
          addEffect('levelup', target);
          break;
        case 'debuff':
          addEffect('hit', target);
          break;
      }
    }, 1000);
  };

  // Unit advancement celebration
  const triggerLevelUp = (position: { x: number; y: number }) => {
    addEffect('levelup', position);
  };

  // Defensive maneuvers
  const triggerDefensiveAction = (
    position: { x: number; y: number },
    actionType: 'block' | 'dodge' | 'formation'
  ) => {
    if (actionType === 'block' || actionType === 'formation') {
      addEffect('shield_block', position);
      addDamageNumber(0, position, 'block');
    } else {
      addDamageNumber(0, position, 'dodge');
    }
  };

  // Mass battle effects for larger conflicts
  const triggerMassBattle = (
    battleCenter: { x: number; y: number },
    participants: Array<{ x: number; y: number; unitType: string }>
  ) => {
    // Epic battle start
    addEffect('battle_start', battleCenter);

    // Staggered charges from all participants
    participants.forEach((unit, index) => {
      setTimeout(() => {
        addEffect('charge', battleCenter, unit, unit.unitType);
      }, 1200 + index * 300);
    });

    // Climactic explosion finish
    setTimeout(() => {
      addEffect('explosion', battleCenter);
    }, 1200 + participants.length * 300 + 1000);
  };

  return {
    damageNumbers,
    effects,
    addDamageNumber,
    addEffect,
    removeEffect,
    triggerBattleSequence,
    triggerSpellEffect,
    triggerLevelUp,
    triggerDefensiveAction,
    triggerMassBattle
  };
}