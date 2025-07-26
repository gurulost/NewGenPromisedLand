import React from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';

interface RequirementBannerProps {
  type: 'insufficient-stars' | 'prerequisites' | 'tech-required' | 'info';
  message: string;
  className?: string;
}

const bannerStyles = {
  'insufficient-stars': {
    bg: 'bg-red-900/20',
    border: 'border-red-500/30',
    text: 'text-red-300',
    icon: '⚠'
  },
  'prerequisites': {
    bg: 'bg-orange-900/20',
    border: 'border-orange-500/30',
    text: 'text-orange-300',
    icon: '🔒'
  },
  'tech-required': {
    bg: 'bg-blue-900/20',
    border: 'border-blue-500/30',
    text: 'text-blue-300',
    icon: '🔬'
  },
  'info': {
    bg: 'bg-amber-900/20',
    border: 'border-amber-500/30',
    text: 'text-amber-300',
    icon: 'ℹ'
  }
};

export const RequirementBanner: React.FC<RequirementBannerProps> = ({ 
  type, 
  message, 
  className 
}) => {
  const styles = bannerStyles[type];
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        'mt-2 text-xs rounded px-3 py-2 border flex items-center gap-2',
        styles.bg,
        styles.border,
        styles.text,
        className
      )}
    >
      <span className="font-semibold">{styles.icon}</span>
      <span>{message}</span>
    </motion.div>
  );
};