import React from 'react';
import { motion } from 'framer-motion';

interface AnimatedBackgroundProps {
  variant?: 'particles' | 'grid' | 'waves' | 'sacred';
  intensity?: 'low' | 'medium' | 'high';
  color?: 'blue' | 'purple' | 'gold' | 'green';
}

export function AnimatedBackground({ 
  variant = 'particles', 
  intensity = 'medium',
  color = 'blue'
}: AnimatedBackgroundProps) {
  const getColorClasses = () => {
    switch (color) {
      case 'blue': return 'from-blue-500/20 to-purple-500/20';
      case 'purple': return 'from-purple-500/20 to-pink-500/20';
      case 'gold': return 'from-yellow-500/20 to-orange-500/20';
      case 'green': return 'from-green-500/20 to-emerald-500/20';
      default: return 'from-blue-500/20 to-purple-500/20';
    }
  };

  const getParticleCount = () => {
    switch (intensity) {
      case 'low': return 20;
      case 'medium': return 40;
      case 'high': return 60;
      default: return 40;
    }
  };

  if (variant === 'particles') {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(getParticleCount())].map((_, i) => (
          <motion.div
            key={i}
            className={`absolute w-1 h-1 bg-gradient-to-r ${getColorClasses()} rounded-full`}
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
              opacity: 0,
            }}
            animate={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: Math.random() * 10 + 5,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}
      </div>
    );
  }

  if (variant === 'grid') {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
        <motion.div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(147, 51, 234, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(147, 51, 234, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '100px 100px',
          }}
          animate={{ x: [0, 50], y: [0, 50] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  if (variant === 'waves') {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className={`absolute inset-0 bg-gradient-to-r ${getColorClasses()} opacity-20`}
          animate={{
            background: [
              'linear-gradient(45deg, rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.1))',
              'linear-gradient(135deg, rgba(147, 51, 234, 0.1), rgba(59, 130, 246, 0.1))',
              'linear-gradient(225deg, rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.1))',
              'linear-gradient(315deg, rgba(147, 51, 234, 0.1), rgba(59, 130, 246, 0.1))',
            ],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    );
  }

  if (variant === 'sacred') {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Sacred Geometry Patterns */}
        <motion.div
          className="absolute top-1/4 left-1/4 w-32 h-32 border border-yellow-400/20 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute top-3/4 right-1/4 w-24 h-24 border border-purple-400/20"
          style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}
          animate={{ rotate: -360 }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute top-1/2 right-1/3 w-20 h-20 border border-blue-400/20 rotate-45"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        
        {/* Floating Light Orbs */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={`orb-${i}`}
            className={`absolute w-2 h-2 bg-gradient-radial ${getColorClasses()} rounded-full`}
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
            }}
            animate={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
              opacity: [0.2, 0.8, 0.2],
            }}
            transition={{
              duration: Math.random() * 15 + 10,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    );
  }

  return null;
}

// Preset backgrounds for common UI sections
export function MenuBackground() {
  return <AnimatedBackground variant="sacred" intensity="medium" color="purple" />;
}

export function GameBackground() {
  return <AnimatedBackground variant="particles" intensity="low" color="blue" />;
}

export function ModalBackground() {
  return <AnimatedBackground variant="waves" intensity="low" color="blue" />;
}

export function BuildingMenuBackground() {
  return <AnimatedBackground variant="grid" intensity="medium" color="purple" />;
}