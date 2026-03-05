import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Hammer, 
  Crown, 
  Shield, 
  Zap, 
  Star, 
  Clock, 
  Lock,
  TrendingUp,
  Users,
  Swords,
  Heart,
  Eye,
  Anchor,
  Target,
  Home,
  Castle,
  AlertTriangle
} from 'lucide-react';
import { GameState, PlayerState } from '@shared/types/game';
import { City } from '@shared/types/city';
import { InfoTooltip, ActionTooltip, StarProductionTooltip, FaithSystemTooltip, PrideSystemTooltip, DissentTooltip } from './TooltipSystem';
import { BuildingMenuBackground } from './AnimatedBackground';
import { PrimaryButton, SuccessButton, GhostButton } from './EnhancedButton';
import { UNIT_DEFINITIONS } from '@shared/data/units';
import { getFaction } from '@shared/data/factions';
import { STRUCTURE_DEFINITIONS, IMPROVEMENT_DEFINITIONS } from '@shared/types/city';
import { getPlayerStats } from '../../selectors/player';
import { useMobileUI } from '../../hooks/useMobileUI';
import {
  getImprovementEffectSummary,
  getStructureEffectSummary,
  getUnitEffectSummary,
  type EffectDescriptor,
  type EffectIconKey,
} from '@shared/data/buildingEffects';
import {
  getImprovementBuildRequirements,
  getStructureBuildRequirements,
  getUnitBuildRequirements,
  type BuildRequirement,
} from '@shared/logic/buildingRequirements';

interface BuildingOption {
  id: string;
  name: string;
  description: string;
  lore?: string;
  factionTag?: string;
  category: 'units' | 'structures' | 'improvements';
  cost: {
    stars?: number;
    faith?: number;
    pride?: number;
  };
  requirements?: BuildRequirement[];
  effects: EffectDescriptor[];
  buildTime: number;
  icon: React.ReactNode;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

interface BuildingMenuProps {
  city: City;
  player: PlayerState;
  gameState: GameState;
  onBuild: (optionId: string) => void;
  onClose: () => void;
  onShowCities?: () => void;
}

const effectIconMap: Record<EffectIconKey, React.ReactNode> = {
  attack: <Swords className="w-4 h-4" />,
  defense: <Shield className="w-4 h-4" />,
  health: <Heart className="w-4 h-4" />,
  movement: <TrendingUp className="w-4 h-4" />,
  vision: <Eye className="w-4 h-4" />,
  range: <Target className="w-4 h-4" />,
  actions: <Zap className="w-4 h-4" />,
  stars: <Star className="w-4 h-4" />,
  faith: <Crown className="w-4 h-4" />,
  pride: <Swords className="w-4 h-4" />,
  dissent: <AlertTriangle className="w-4 h-4" />,
  population: <Users className="w-4 h-4" />,
  unitProduction: <Users className="w-4 h-4" />,
  defenseBonus: <Shield className="w-4 h-4" />,
  road: <TrendingUp className="w-4 h-4" />,
  naval: <Anchor className="w-4 h-4" />,
  ability: <Zap className="w-4 h-4" />,
  cooldown: <Clock className="w-4 h-4" />,
  special: <Zap className="w-4 h-4" />,
};

const formatRequirement = (req: BuildRequirement) =>
  req.value ? `${req.label}: ${req.value}` : req.label;

const requirementSummary = (reqs?: BuildRequirement[]) =>
  (reqs || []).map(formatRequirement).join(" • ");

export function BuildingMenu({ city, player, gameState, onBuild, onClose, onShowCities }: BuildingMenuProps) {
  const { isMobileUI } = useMobileUI();
  const [selectedCategory, setSelectedCategory] = useState<'units' | 'structures' | 'improvements'>('units');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'cost' | 'name' | 'buildTime'>('cost');

  const playerStats = getPlayerStats(player, gameState);
  const totalStarProduction = playerStats.starProduction;
  const breakdown = playerStats.starProductionBreakdown;

  // Play UI sounds
  const playSound = (soundType: 'hover' | 'select' | 'build' | 'error') => {
    void soundType;
    // Sound effects can be wired in here when a shared UI sound bus is enabled.
  };

  const resolveFactionNames = (ids: string[]) =>
    ids.map((id) => {
      const faction = getFaction(id as any);
      return faction ? faction.name : String(id);
    });

  const loreById: Record<string, string> = {
    slinger: '"armed with stones and slings" (Alma 43:19)',
    wilderness_hunter: '"the bow, and the arrow, and the dart, and the javelin" (Jarom 1:8)',
    catapult: '"they did cast over stones and arrows" (Alma 49:22)',
    fortress: '"could not cast their stones and their arrows that they might take effect" (Alma 49:4)',
  };

  // Generate building options from actual game data
  const buildingOptions: BuildingOption[] = [
    // Units from game data
    ...Object.values(UNIT_DEFINITIONS).map(unit => {
      const factionNames = resolveFactionNames(unit.factionSpecific);
      const factionTag = factionNames.length > 0
        ? (factionNames.length === 1 ? `${factionNames[0]} only` : `Only: ${factionNames.join(', ')}`)
        : undefined;

      return ({
      id: unit.type,
      name: unit.name,
      description: unit.description,
      lore: loreById[unit.type],
      factionTag,
      category: 'units' as const,
      cost: { stars: unit.cost },
      requirements: getUnitBuildRequirements(gameState, player, city.id, unit),
      effects: getUnitEffectSummary(unit),
      buildTime: 1,
      icon: <Users className="w-6 h-6" />,
      rarity: unit.factionSpecific.length > 0 ? 'rare' : 'common' as const
    });
    }),
    
    // Structures from game data
    ...Object.values(STRUCTURE_DEFINITIONS).map(structure => {
      return {
        id: structure.id,
        name: structure.name,
        description: structure.description,
        lore: loreById[structure.id],
        category: 'structures' as const,
        cost: { stars: structure.cost },
        requirements: getStructureBuildRequirements(gameState, player, city.id, structure),
        effects: getStructureEffectSummary(structure),
        buildTime: structure.constructionTime,
        icon: <Castle className="w-6 h-6" />,
        rarity: structure.effects.starProduction >= 3 ? 'epic' : 'common' as const
      };
    }),
    
    // Improvements from game data  
    ...Object.values(IMPROVEMENT_DEFINITIONS).map(improvement => ({
      id: improvement.id,
      name: improvement.name,
      description: improvement.description,
      category: 'improvements' as const,
      cost: { stars: improvement.cost },
      requirements: getImprovementBuildRequirements(gameState, player, city.id, improvement),
      effects: getImprovementEffectSummary(improvement),
      buildTime: improvement.constructionTime,
      icon: <TrendingUp className="w-6 h-6" />,
      rarity: improvement.starProduction >= 3 ? 'rare' : 'common' as const
    }))
  ] as BuildingOption[];

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
    return (option.cost.stars || 0) <= player.stars;
  };

  const meetsNonCostRequirements = (option: BuildingOption) => {
    if (!option.requirements || option.requirements.length === 0) return true;
    return option.requirements.every(req => req.status !== "unmet" || req.id === "stars_cost");
  };

  return (
    <div 
      className={`fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[var(--z-modal-backdrop)] pointer-events-auto ${isMobileUI ? 'p-0' : 'p-4'}`}
      data-ui-layer="modal"
      data-testid="building-menu"
      onClick={(e) => {
        // Close menu if clicking on backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <motion.div
        data-ui-layer="modal-content"
        className={`relative z-[var(--z-modal-content)] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-amber-500/30 w-full h-full overflow-hidden shadow-2xl shadow-amber-500/10 ${isMobileUI ? 'max-w-full max-h-full rounded-none mobile-safe-top mobile-safe-bottom' : 'max-w-[1200px] max-h-[90vh] rounded-2xl'}`}
        onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from closing it
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
        <div className={`bg-gradient-to-r from-amber-900/20 to-amber-800/20 border-b border-amber-500/20 ${isMobileUI ? 'px-4 py-4' : 'px-8 py-6'}`}>
          <div className={`flex items-center justify-between ${isMobileUI ? 'flex-wrap gap-3' : ''}`}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-600 to-amber-700 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/25">
                <Hammer className="w-7 h-7 text-amber-100" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-amber-100 font-cinzel">Construction Hall</h1>
                <p className="text-amber-300/70 font-body">{city.name} — Build in the Promised Land</p>
              </div>
            </div>
            
            {/* Resources Display */}
            <div className={`flex items-center gap-6 ${isMobileUI ? 'flex-wrap gap-3 justify-end' : ''}`}>
              <div className="flex items-center gap-2 bg-amber-900/30 border border-amber-500/30 px-3 py-2 rounded-lg">
                <Star className="w-5 h-5 text-amber-400" />
                <span aria-label="Stars" className="text-amber-100 font-semibold">{player.stars}</span>
                <InfoTooltip content={<StarProductionTooltip totalIncome={totalStarProduction} breakdown={breakdown} />} />
              </div>
              <div className="flex items-center gap-2 bg-amber-900/30 border border-amber-500/30 px-3 py-2 rounded-lg">
                <Crown className="w-5 h-5 text-blue-400" />
                <span aria-label="Faith" className="text-amber-100 font-semibold">{player.stats.faith}</span>
                <InfoTooltip content={<FaithSystemTooltip />} />
              </div>
              <div className="flex items-center gap-2">
                <Swords className="w-5 h-5 text-red-400" />
                <span aria-label="Pride" className="text-white font-semibold">{player.stats.pride}</span>
                <InfoTooltip content={<PrideSystemTooltip />} />
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
                <span aria-label="Dissent" className="text-white font-semibold">{player.stats.internalDissent}</span>
                <InfoTooltip content={<DissentTooltip />} />
              </div>
              
              {/* Cities Button */}
              {onShowCities && (
                <button
                  onClick={onShowCities}
                  className="ml-4 px-4 py-2 bg-blue-600/20 border border-blue-400/50 text-blue-100 hover:bg-blue-600/40 transition-colors rounded-lg flex items-center gap-2"
                >
                  <Home className="w-4 h-4" />
                  Cities
                </button>
              )}
              
              <button
                onClick={onClose}
                className="ml-4 text-slate-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        <div className={`flex h-[calc(100%-88px)] ${isMobileUI ? 'flex-col' : ''}`}>
          {/* Sidebar */}
          <div className={`bg-slate-800/50 border-slate-600 ${isMobileUI ? 'w-full border-b p-4' : 'w-80 border-r p-6'}`}>
            {/* Category Tabs */}
            <div className={`${isMobileUI ? 'flex gap-2 overflow-x-auto touch-scroll pb-2 mb-4' : 'space-y-2 mb-6'}`}>
              {[
                { id: 'units', name: 'Units', icon: <Users className="w-5 h-5" /> },
                { id: 'structures', name: 'Structures', icon: <Castle className="w-5 h-5" /> },
                { id: 'improvements', name: 'Improvements', icon: <TrendingUp className="w-5 h-5" /> }
              ].map((category) => (
                <motion.button
                  key={category.id}
                  className={`
                    ${isMobileUI ? 'min-w-[140px]' : 'w-full'} p-4 rounded-xl text-left transition-all flex items-center gap-3
                    ${selectedCategory === category.id 
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' 
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                    }
                  `}
                  onClick={() => {
                    setSelectedCategory(category.id as any);
                    playSound('select');
                  }}
                  whileHover={isMobileUI ? {} : { scale: 1.02 }}
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
          <div className={`flex-1 ${isMobileUI ? 'p-4' : 'p-6'}`}>
            <div className={`grid gap-6 h-full overflow-y-auto touch-scroll ${isMobileUI ? 'grid-cols-1' : 'grid-cols-2'}`}>
              <AnimatePresence>
                {filteredOptions.map((option, index) => (
                  <BuildingCard
                    key={option.id}
                    option={option}
                    isSelected={selectedOption === option.id}
                    canAfford={canAfford(option)}
                    meetsRequirements={meetsNonCostRequirements(option)}
                    onClick={() => {
                      setSelectedOption(option.id);
                      playSound('hover');
                    }}
                    onBuild={() => {
                      if (canAfford(option) && meetsNonCostRequirements(option)) {
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
  meetsRequirements,
  onClick,
  onBuild,
  delay
}: {
  option: BuildingOption;
  isSelected: boolean;
  canAfford: boolean;
  meetsRequirements: boolean;
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
        ${!meetsRequirements ? 'opacity-60' : ''}
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
      {!meetsRequirements && (
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
          {option.factionTag && (
            <div className="mt-2 inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-200">
              {option.factionTag}
            </div>
          )}
        </div>
      </div>

      {/* Effects */}
      <div className="space-y-2 mb-4">
        {option.effects.map((effect) => {
          const icon = effectIconMap[effect.iconKey] ?? <Zap className="w-4 h-4" />;
          return (
            <div key={effect.id} className="flex items-start gap-2 text-sm">
              <div className="text-blue-400 mt-0.5">{icon}</div>
              <div className="flex-1">
                <span className="text-slate-300">{effect.label}</span>
                {effect.value && (
                  <span className="text-green-400 font-semibold">: {effect.value}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {option.lore && (
        <div className="mb-4 text-xs italic text-amber-200/80">
          {option.lore}
        </div>
      )}

      {/* Requirements */}
      {option.requirements && option.requirements.length > 0 && (
        <div className="mb-4 text-xs text-slate-400 space-y-1">
          <span className="text-slate-300 font-semibold">Requirements:</span>
          {option.requirements.map((req) => {
            const statusColor =
              req.status === "met"
                ? "text-green-400"
                : req.status === "unmet"
                  ? "text-red-400"
                  : "text-slate-400";
            const statusGlyph = req.status === "info" ? "•" : req.status === "met" ? "✓" : "✗";
            return (
              <div key={req.id} className="flex items-start gap-2">
                <span className={`${statusColor} mt-0.5`}>{statusGlyph}</span>
                <span className="text-slate-300">{formatRequirement(req)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Cost and Build */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-600">
        <div className="flex items-center gap-4">
          {option.cost.stars && (
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-400" />
              <span
                aria-label="Stars cost"
                className={`text-sm font-semibold ${canAfford ? 'text-white' : 'text-red-400'}`}
              >
                {option.cost.stars}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4 text-slate-400" />
            <span aria-label="Build time" className="text-sm text-slate-400">{option.buildTime}T</span>
          </div>
        </div>

        <div className="relative">
          <motion.button
            className={`
              px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2
              ${canAfford && meetsRequirements
                ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white'
                : 'bg-slate-600 text-slate-400 cursor-not-allowed'
              }
            `}
            onClick={(e) => {
              e.stopPropagation();
              onBuild();
            }}
            disabled={!canAfford || !meetsRequirements}
            whileHover={canAfford && meetsRequirements ? { scale: 1.05 } : {}}
            whileTap={canAfford && meetsRequirements ? { scale: 0.95 } : {}}
          >
            {canAfford && meetsRequirements ? (
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
          <ActionTooltip
            title={canAfford && meetsRequirements ? "Build Now" : "Cannot Build"}
            description={
              !meetsRequirements
                ? `Requirements: ${requirementSummary(option.requirements) || 'Not met'}`
                : !canAfford
                  ? "Insufficient stars"
                  : `Build ${option.name}`
            }
            cost={`${option.cost.stars || 0} stars, ${option.buildTime} turns`}
          />
        </div>
      </div>
    </motion.div>
  );
}
