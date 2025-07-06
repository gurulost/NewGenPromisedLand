import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Hammer, 
  Crown, 
  Shield, 
  Zap, 
  Star, 
  Coins, 
  Clock, 
  CheckCircle,
  Lock,
  TrendingUp,
  Users,
  Swords,
  Heart,
  Eye,
  Mountain,
  Wheat,
  Pickaxe,
  Home,
  Castle
} from 'lucide-react';
import { City, GameState, PlayerState } from '../../../shared/types/game';
import { Tooltip, ActionTooltip } from './TooltipSystem';
import { BuildingMenuBackground } from './AnimatedBackground';
import { PrimaryButton, SuccessButton, GhostButton } from './EnhancedButton';
import { getUnitDefinition, UNIT_DEFINITIONS } from '@shared/data/units';
import { STRUCTURE_DEFINITIONS, IMPROVEMENT_DEFINITIONS } from '@shared/types/city';

interface BuildingOption {
  id: string;
  name: string;
  description: string;
  category: 'units' | 'structures' | 'improvements';
  cost: {
    stars?: number;
    faith?: number;
    pride?: number;
  };
  requirements?: string[];
  effects: {
    description: string;
    icon: React.ReactNode;
    value: string;
  }[];
  buildTime: number;
  icon: React.ReactNode;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlocked: boolean;
}

interface BuildingMenuProps {
  city: City;
  player: PlayerState;
  gameState: GameState;
  onBuild: (optionId: string) => void;
  onClose: () => void;
}

export function BuildingMenu({ city, player, gameState, onBuild, onClose }: BuildingMenuProps) {
  const [selectedCategory, setSelectedCategory] = useState<'units' | 'structures' | 'improvements'>('units');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'cost' | 'name' | 'buildTime'>('name');
  const audioRef = useRef<HTMLAudioElement>(null);

  // Play UI sounds
  const playSound = (soundType: 'hover' | 'select' | 'build' | 'error') => {
    // Sound effects would be implemented here
    console.log(`Playing ${soundType} sound`);
  };

  // Generate building options from actual game data
  const buildingOptions: BuildingOption[] = [
    // Units from game data
    ...Object.values(UNIT_DEFINITIONS).map(unit => ({
      id: unit.type,
      name: unit.name,
      description: unit.description,
      category: 'units' as const,
      cost: { stars: unit.cost, ...(unit.requirements || {}) },
      effects: [
        { description: 'Attack', icon: <Swords className="w-4 h-4" />, value: `${unit.baseStats.attack}` },
        { description: 'Defense', icon: <Shield className="w-4 h-4" />, value: `${unit.baseStats.defense}` },
        { description: 'Health', icon: <Heart className="w-4 h-4" />, value: `${unit.baseStats.hp} HP` },
        { description: 'Movement', icon: <TrendingUp className="w-4 h-4" />, value: `${unit.baseStats.movement}` }
      ],
      buildTime: 2,
      icon: <Users className="w-6 h-6" />,
      rarity: unit.factionSpecific.length > 0 ? 'rare' : 'common' as const,
      unlocked: unit.factionSpecific.length === 0 || unit.factionSpecific.includes(player.factionId)
    })),
    
    // Structures from game data
    ...Object.values(STRUCTURE_DEFINITIONS).map(structure => ({
      id: structure.id,
      name: structure.name,
      description: structure.description,
      category: 'structures' as const,
      cost: { stars: structure.cost },
      requirements: [structure.requiredTech],
      effects: [
        ...(structure.effects.starProduction > 0 ? [{ 
          description: 'Star Production', 
          icon: <Star className="w-4 h-4" />, 
          value: `+${structure.effects.starProduction}/turn` 
        }] : []),
        ...(structure.effects.defenseBonus > 0 ? [{ 
          description: 'Defense Bonus', 
          icon: <Shield className="w-4 h-4" />, 
          value: `+${structure.effects.defenseBonus}` 
        }] : []),
        ...(structure.effects.unitProduction > 0 ? [{ 
          description: 'Unit Production', 
          icon: <Users className="w-4 h-4" />, 
          value: `+${structure.effects.unitProduction}` 
        }] : [])
      ],
      buildTime: 3,
      icon: <Castle className="w-6 h-6" />,
      rarity: structure.effects.starProduction >= 3 ? 'epic' : 'common' as const,
      unlocked: player.researchedTechs.includes(structure.requiredTech)
    })),
    
    // Improvements from game data  
    ...Object.values(IMPROVEMENT_DEFINITIONS).map(improvement => ({
      id: improvement.id,
      name: improvement.name,
      description: improvement.description,
      category: 'improvements' as const,
      cost: { stars: improvement.cost },
      effects: [
        ...(improvement.starProduction > 0 ? [{ 
          description: 'Star Production', 
          icon: <Star className="w-4 h-4" />, 
          value: `+${improvement.starProduction}/turn` 
        }] : [])
      ],
      buildTime: improvement.constructionTime,
      icon: <TrendingUp className="w-6 h-6" />,
      rarity: improvement.starProduction >= 3 ? 'rare' : 'common' as const,
      unlocked: player.researchedTechs.includes(improvement.requiredTech)
    }))
  ];

  const filteredOptions = buildingOptions
    .filter(option => option.category === selectedCategory)
    .filter(option => 
      searchQuery === '' || 
      option.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      option.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'cost':
          return (a.cost.stars || 0) - (b.cost.stars || 0);
        case 'buildTime':
          return a.buildTime - b.buildTime;
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'border-gray-500 bg-gray-500/10';
      case 'rare': return 'border-blue-500 bg-blue-500/10';
      case 'epic': return 'border-purple-500 bg-purple-500/10';
      case 'legendary': return 'border-yellow-500 bg-yellow-500/10';
      default: return 'border-gray-500 bg-gray-500/10';
    }
  };

  const getRarityGlow = (rarity: string) => {
    switch (rarity) {
      case 'rare': return 'shadow-blue-500/20';
      case 'epic': return 'shadow-purple-500/20';
      case 'legendary': return 'shadow-yellow-500/20';
      default: return '';
    }
  };

  const canAfford = (option: BuildingOption) => {
    return (
      (option.cost.stars || 0) <= player.stars &&
      (option.cost.faith || 0) <= player.stats.faith &&
      (option.cost.pride || 0) <= player.stats.pride
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50">
      <motion.div
        className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl border-2 border-slate-600 w-[1200px] h-[800px] overflow-hidden shadow-2xl"
        initial={{ scale: 0.8, opacity: 0, y: 50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 50 }}
        transition={{ type: "spring", duration: 0.6 }}
      >
        {/* Animated Background */}
        <BuildingMenuBackground />
        
        {/* Content Overlay */}
        <div className="relative z-10 h-full flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-8 py-6 border-b border-slate-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center">
                <Hammer className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white font-cinzel">Construction Hall</h1>
                <p className="text-slate-300 font-body">{city.name} - Build your empire</p>
              </div>
            </div>
            
            {/* Resources Display */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-400" />
                <span className="text-white font-semibold">{player.stars}</span>
              </div>
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-purple-400" />
                <span className="text-white font-semibold">{player.stats.faith}</span>
              </div>
              <div className="flex items-center gap-2">
                <Swords className="w-5 h-5 text-red-400" />
                <span className="text-white font-semibold">{player.stats.pride}</span>
              </div>
              
              <button
                onClick={onClose}
                className="ml-4 text-slate-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        <div className="flex h-[calc(100%-88px)]">
          {/* Sidebar */}
          <div className="w-80 bg-slate-800/50 border-r border-slate-600 p-6">
            {/* Category Tabs */}
            <div className="space-y-2 mb-6">
              {[
                { id: 'units', name: 'Units', icon: <Users className="w-5 h-5" /> },
                { id: 'structures', name: 'Structures', icon: <Castle className="w-5 h-5" /> },
                { id: 'improvements', name: 'Improvements', icon: <TrendingUp className="w-5 h-5" /> }
              ].map((category) => (
                <motion.button
                  key={category.id}
                  className={`
                    w-full p-4 rounded-xl text-left transition-all flex items-center gap-3
                    ${selectedCategory === category.id 
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' 
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                    }
                  `}
                  onClick={() => {
                    setSelectedCategory(category.id as any);
                    playSound('select');
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {category.icon}
                  <span className="font-semibold">{category.name}</span>
                </motion.button>
              ))}
            </div>

            {/* Search and Sort */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Search</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search buildings..."
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-2">Sort by</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="name">Name</option>
                  <option value="cost">Cost</option>
                  <option value="buildTime">Build Time</option>
                </select>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6">
            <div className="grid grid-cols-2 gap-6 h-full overflow-y-auto">
              <AnimatePresence>
                {filteredOptions.map((option, index) => (
                  <BuildingCard
                    key={option.id}
                    option={option}
                    isSelected={selectedOption === option.id}
                    canAfford={canAfford(option)}
                    onClick={() => {
                      setSelectedOption(option.id);
                      playSound('hover');
                    }}
                    onBuild={() => {
                      if (canAfford(option) && option.unlocked) {
                        onBuild(option.id);
                        playSound('build');
                      } else {
                        playSound('error');
                      }
                    }}
                    delay={index * 0.1}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function BuildingCard({
  option,
  isSelected,
  canAfford,
  onClick,
  onBuild,
  delay
}: {
  option: BuildingOption;
  isSelected: boolean;
  canAfford: boolean;
  onClick: () => void;
  onBuild: () => void;
  delay: number;
}) {
  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'rare': return 'border-blue-500/50 bg-blue-500/5';
      case 'epic': return 'border-purple-500/50 bg-purple-500/5';
      case 'legendary': return 'border-yellow-500/50 bg-yellow-500/5';
      default: return 'border-slate-600 bg-slate-800/50';
    }
  };

  const getRarityGlow = (rarity: string) => {
    switch (rarity) {
      case 'rare': return 'shadow-lg shadow-blue-500/20';
      case 'epic': return 'shadow-lg shadow-purple-500/20';
      case 'legendary': return 'shadow-lg shadow-yellow-500/20';
      default: return '';
    }
  };

  return (
    <motion.div
      className={`
        relative p-6 rounded-xl border-2 cursor-pointer transition-all duration-300
        ${getRarityColor(option.rarity)}
        ${getRarityGlow(option.rarity)}
        ${isSelected ? 'ring-2 ring-blue-400 scale-105' : ''}
        ${!option.unlocked ? 'opacity-60' : ''}
        hover:scale-102 hover:shadow-xl
      `}
      onClick={onClick}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ y: -5 }}
    >
      {/* Rarity Indicator */}
      <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wide
        ${option.rarity === 'rare' ? 'bg-blue-500/20 text-blue-300' : ''}
        ${option.rarity === 'epic' ? 'bg-purple-500/20 text-purple-300' : ''}
        ${option.rarity === 'legendary' ? 'bg-yellow-500/20 text-yellow-300' : ''}
        ${option.rarity === 'common' ? 'bg-gray-500/20 text-gray-300' : ''}
      `}>
        {option.rarity}
      </div>

      {/* Lock Overlay */}
      {!option.unlocked && (
        <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
          <Lock className="w-8 h-8 text-slate-400" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center
          ${option.rarity === 'rare' ? 'bg-blue-500/20' : ''}
          ${option.rarity === 'epic' ? 'bg-purple-500/20' : ''}
          ${option.rarity === 'legendary' ? 'bg-yellow-500/20' : ''}
          ${option.rarity === 'common' ? 'bg-slate-600/50' : ''}
        `}>
          <div className="text-white">{option.icon}</div>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white font-cinzel">{option.name}</h3>
          <p className="text-sm text-slate-300 line-clamp-2">{option.description}</p>
        </div>
      </div>

      {/* Effects */}
      <div className="space-y-2 mb-4">
        {option.effects.map((effect, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div className="text-blue-400">{effect.icon}</div>
            <span className="text-slate-300">{effect.description}:</span>
            <span className="text-green-400 font-semibold">{effect.value}</span>
          </div>
        ))}
      </div>

      {/* Cost and Build */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-600">
        <div className="flex items-center gap-4">
          {option.cost.stars && (
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-400" />
              <span className={`text-sm font-semibold ${canAfford ? 'text-white' : 'text-red-400'}`}>
                {option.cost.stars}
              </span>
            </div>
          )}
          {option.cost.faith && (
            <div className="flex items-center gap-1">
              <Crown className="w-4 h-4 text-purple-400" />
              <span className={`text-sm font-semibold ${canAfford ? 'text-white' : 'text-red-400'}`}>
                {option.cost.faith}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-400">{option.buildTime}T</span>
          </div>
        </div>

        <Tooltip content={
          <ActionTooltip
            title={canAfford && option.unlocked ? "Build Now" : "Cannot Build"}
            description={!option.unlocked ? "Requirements not met" : !canAfford ? "Insufficient resources" : `Build ${option.name}`}
            cost={`${option.cost.stars || 0} stars, ${option.buildTime} turns`}
          />
        }>
          <motion.button
            className={`
              px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2
              ${canAfford && option.unlocked
                ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white'
                : 'bg-slate-600 text-slate-400 cursor-not-allowed'
              }
            `}
            onClick={(e) => {
              e.stopPropagation();
              onBuild();
            }}
            disabled={!canAfford || !option.unlocked}
            whileHover={canAfford && option.unlocked ? { scale: 1.05 } : {}}
            whileTap={canAfford && option.unlocked ? { scale: 0.95 } : {}}
          >
            {canAfford && option.unlocked ? (
              <>
                <Hammer className="w-4 h-4" />
                Build
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Locked
              </>
            )}
          </motion.button>
        </Tooltip>
      </div>
    </motion.div>
  );
}