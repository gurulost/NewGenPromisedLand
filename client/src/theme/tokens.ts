export const TOKENS = {
  stars:   { 
    color: 'text-yellow-300', 
    bg: 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20',
    border: 'border-yellow-400/40', 
    glow: 'shadow-yellow-400/25', 
    icon: '✦', 
    name: 'Stars' 
  },
  faith:   { 
    color: 'text-blue-300',   
    bg: 'bg-gradient-to-r from-blue-500/20 to-sky-500/20',
    border: 'border-blue-400/40',   
    glow: 'shadow-blue-400/25',   
    icon: '✠', 
    name: 'Faith' 
  },
  pride:   { 
    color: 'text-red-300',    
    bg: 'bg-gradient-to-r from-red-500/20 to-rose-500/20',
    border: 'border-red-400/40',    
    glow: 'shadow-red-400/25',    
    icon: '⚔', 
    name: 'Pride' 
  },
  dissent: { 
    color: 'text-orange-300', 
    bg: 'bg-gradient-to-r from-orange-500/20 to-amber-600/20',
    border: 'border-orange-400/40', 
    glow: 'shadow-orange-400/25', 
    icon: '⚡', 
    name: 'Dissent' 
  },
  population: { 
    color: 'text-green-300', 
    bg: 'bg-gradient-to-r from-emerald-500/20 to-green-600/20',
    border: 'border-green-400/40', 
    glow: 'shadow-green-400/25', 
    icon: '👥', 
    name: 'Population' 
  },
  costStars: { 
    color: 'text-yellow-300', 
    bg: 'bg-slate-900/40', 
    border: 'border-yellow-400/40',
    glow: 'shadow-yellow-400/25', 
    icon: '✪', 
    name: 'Star Cost' 
  },
} as const;