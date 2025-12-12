import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface EnhancedButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: LucideIcon;
  className?: string;
  glow?: boolean;
  pulse?: boolean;
}

export function EnhancedButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon: Icon,
  className = '',
  glow = false,
  pulse = false
}: EnhancedButtonProps) {
  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-transparent';
      case 'secondary':
        return 'bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 text-white border-transparent';
      case 'success':
        return 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white border-transparent';
      case 'danger':
        return 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white border-transparent';
      case 'warning':
        return 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white border-transparent';
      case 'ghost':
        return 'bg-transparent hover:bg-slate-700/20 text-slate-300 border-slate-600 hover:border-slate-500';
      default:
        return 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-transparent';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-1.5 text-sm';
      case 'md':
        return 'px-4 py-2 text-base';
      case 'lg':
        return 'px-6 py-3 text-lg';
      default:
        return 'px-4 py-2 text-base';
    }
  };

  const baseClasses = `
    relative inline-flex items-center justify-center gap-2 
    font-semibold rounded-lg border transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-blue-500/50
    disabled:opacity-50 disabled:cursor-not-allowed
    ${getVariantClasses()}
    ${getSizeClasses()}
    ${glow ? 'shadow-lg' : ''}
    ${className}
  `;

  return (
    <motion.button
      className={baseClasses}
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      animate={pulse ? { 
        boxShadow: [
          '0 0 0 0 rgba(59, 130, 246, 0.4)',
          '0 0 0 10px rgba(59, 130, 246, 0)',
          '0 0 0 0 rgba(59, 130, 246, 0)'
        ]
      } : {}}
      transition={pulse ? { 
        duration: 2, 
        repeat: Infinity 
      } : { 
        type: "spring", 
        stiffness: 400, 
        damping: 17 
      }}
    >
      {/* Glow Effect */}
      {glow && (
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-lg blur-lg -z-10" />
      )}
      
      {/* Loading Spinner */}
      {loading && (
        <motion.div
          className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      )}
      
      {/* Icon */}
      {Icon && !loading && (
        <Icon className="w-4 h-4" />
      )}
      
      {/* Content */}
      <span>{children}</span>
      
      {/* Ripple Effect */}
      <div className="absolute inset-0 rounded-lg overflow-hidden">
        <motion.div
          className="absolute inset-0 bg-white/20 rounded-full scale-0"
          whileTap={{ scale: 4, opacity: [0.3, 0] }}
          transition={{ duration: 0.4 }}
        />
      </div>
    </motion.button>
  );
}

// Preset button variants for common use cases
export function PrimaryButton(props: Omit<EnhancedButtonProps, 'variant'>) {
  return <EnhancedButton {...props} variant="primary" glow />;
}

export function SecondaryButton(props: Omit<EnhancedButtonProps, 'variant'>) {
  return <EnhancedButton {...props} variant="secondary" />;
}

export function SuccessButton(props: Omit<EnhancedButtonProps, 'variant'>) {
  return <EnhancedButton {...props} variant="success" />;
}

export function DangerButton(props: Omit<EnhancedButtonProps, 'variant'>) {
  return <EnhancedButton {...props} variant="danger" />;
}

export function GhostButton(props: Omit<EnhancedButtonProps, 'variant'>) {
  return <EnhancedButton {...props} variant="ghost" />;
}