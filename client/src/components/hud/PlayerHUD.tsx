import React, { useMemo } from 'react';
import { Star, TrendingUp, Book, Hammer, Sparkles, Shield, Clock, Target, RefreshCw } from 'lucide-react';

import { HUDShell } from '../primitives/HUDShell';
import { AvatarBadge } from '../primitives/AvatarBadge';
import { GlowingButton } from '../primitives/GlowingButton';
import { HoverCard } from '../primitives/HoverCard';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Progress } from '../ui/progress';
import { InfoTooltip } from '../primitives/InfoTooltip';

import { PlayerState, GameState } from '@shared/types/game';
import { getFaction } from '@shared/data/factions';
<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
import { GAME_RULES } from '@shared/data/gameRules';
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
import { getPlayerStats, PlayerStats } from '../../selectors/player';

interface HUDAbilityMeta {
  cooldown?: number;
  cooldownRemaining?: number;
  cost?: number;
  requirements?: {
    faith?: number;
    pride?: number;
    dissent?: number;
  };
  target?: string;
  isToggle?: boolean;
}

interface HUDAbilityOption {
  id: string;
  name: string;
  description: string;
  canUse: boolean;
  disabledReason?: string;
  requiresTarget: boolean;
  meta?: HUDAbilityMeta;
}

interface PlayerHUDProps {
  player: PlayerState;
  gameState: GameState;
  onShowTechPanel: () => void;
  onShowConstructionHall: () => void;
  onEndTurn: () => void;
  abilities?: HUDAbilityOption[];
  onActivateAbility?: (abilityId: string) => void;
}

export function PlayerHUD({
  player,
  gameState,
  onShowTechPanel,
  onShowConstructionHall,
  onEndTurn,
  abilities = [],
  onActivateAbility
}: PlayerHUDProps) {
  const faction = getFaction(player.factionId as any);
  
  if (!faction) {
    console.error(`Invalid faction ID: ${player.factionId}`);
    return null;
  }
  
  // Moved expensive calculations to selector
  const playerStats = useMemo(() => 
    getPlayerStats(player, gameState), 
    [player, gameState]
  );

  return (
    <HUDShell position="top-left">
      <Card className="w-72 bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-900/95 
                     border-2 border-amber-500/30 shadow-2xl shadow-amber-500/20 backdrop-blur-sm">
        <CardHeader className="pb-3 bg-gradient-to-r from-amber-900/20 to-amber-800/20 border-b border-amber-500/20">
          <CardTitle className="flex items-center gap-3 text-amber-100 font-cinzel text-lg font-semibold tracking-wide">
            <AvatarBadge 
              color={faction.color} 
              size="md"
              aria-label={`${faction.name} faction`}
            >
              <span className="text-white font-bold text-sm">
                {faction.name.charAt(0)}
              </span>
            </AvatarBadge>
            {player.name}
          </CardTitle>
          <div className="text-xs text-amber-300/70 font-normal">
            - Leader of the Promised Land -
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4 bg-slate-900/40 p-4">
          {/* Star Resources */}
          <StarResourcesSection 
            stars={player.stars}
            starProduction={playerStats.starProduction}
            breakdown={playerStats.starProductionBreakdown}
            inspiration={playerStats.researchInspiration}
          />

          {/* Faith/Pride/Dissent Progress Bars */}
          <ResourceProgressSection playerStats={playerStats} />

          {/* Action Buttons */}
          <ActionButtonsSection 
            onShowTechPanel={onShowTechPanel}
            onShowConstructionHall={onShowConstructionHall}
            onEndTurn={onEndTurn}
          />

          {abilities.length > 0 && (
            <FactionAbilitiesSection 
              abilities={abilities}
              onActivateAbility={onActivateAbility}
            />
          )}
        </CardContent>
      </Card>
    </HUDShell>
  );
}

// Memoized sub-components for performance
const StarResourcesSection = React.memo(({ stars, starProduction, breakdown, inspiration }: {
  stars: number;
  starProduction: number;
  breakdown: PlayerStats['starProductionBreakdown'];
  inspiration: number;
}) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between text-amber-100">
      <div className="flex items-center gap-2 relative">
        <Star className="w-4 h-4 text-amber-400" />
        <span className="font-semibold text-amber-200">{stars}</span>
        <InfoTooltip content={<StarProductionTooltip totalIncome={starProduction} breakdown={breakdown} />} />
      </div>
      <div className="flex items-center gap-1 text-sm text-amber-300">
        <TrendingUp className="w-3 h-3" />
        <span>+{starProduction}/turn</span>
      </div>
    </div>

    <div className="flex items-center justify-between text-xs text-emerald-200/80 bg-emerald-900/10 border border-emerald-500/20 rounded-lg px-3 py-2">
      <span className="flex items-center gap-1 uppercase tracking-[0.2em]">
        <Sparkles className="w-3 h-3 text-emerald-300" />
        Inspiration
        <InfoTooltip content={<InspirationTooltip />} />
      </span>
      <span className="font-semibold text-emerald-200">{inspiration}</span>
    </div>
    
    <details className="group">
      <summary className="text-xs text-amber-300/70 cursor-pointer hover:text-amber-300 flex items-center gap-1">
        <span>Production breakdown</span>
        <span className="transition-transform group-open:rotate-90">&gt;</span>
      </summary>
      <div className="mt-2 space-y-1 text-xs bg-amber-900/10 rounded-lg p-3 border border-amber-500/20">
        {breakdown.map((item, index) => (
          <div key={index} className="flex justify-between text-amber-200">
            <span>{item.source}:</span>
            <span className="text-amber-300">+{item.amount}</span>
          </div>
        ))}
        <div className="flex justify-between font-semibold text-amber-100 border-t border-amber-600/50 pt-1 mt-2">
          <span>Total:</span>
          <span className="text-amber-300">+{starProduction}</span>
        </div>
      </div>
    </details>
  </div>
));

const ResourceProgressSection = React.memo(({ playerStats }: {
  playerStats: PlayerStats;
}) => (
  <>
    {/* Faith Progress */}
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-blue-300 font-cinzel font-medium flex items-center gap-1">
          Faith
          <InfoTooltip content={<FaithSystemTooltip />} />
        </span>
        <span className="text-amber-100 font-body font-medium">{playerStats.faithPercentage}/100</span>
      </div>
      <Progress value={playerStats.faithPercentage} className="h-2" aria-label={`Faith progress: ${playerStats.faithPercentage} out of 100`} />
    </div>
    
    {/* Pride Progress */}
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-purple-300 font-cinzel font-medium flex items-center gap-1">
          Pride
          <InfoTooltip content={<PrideSystemTooltip />} />
        </span>
        <span className="text-amber-100 font-body font-medium">{playerStats.pridePercentage}/100</span>
      </div>
      <Progress value={playerStats.pridePercentage} className="h-2" aria-label={`Pride progress: ${playerStats.pridePercentage} out of 100`} />
    </div>
    
    {/* Dissent Progress */}
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-red-300 font-cinzel font-medium">Dissent</span>
        <span className="text-amber-100 font-body font-medium">{playerStats.dissentPercentage}/100</span>
      </div>
      <Progress value={playerStats.dissentPercentage} className="h-2" aria-label={`Dissent progress: ${playerStats.dissentPercentage} out of 100`} />
    </div>
  </>
));

const ActionButtonsSection = React.memo(({ onShowTechPanel, onShowConstructionHall, onEndTurn }: {
  onShowTechPanel: () => void;
  onShowConstructionHall: () => void;
  onEndTurn: () => void;
}) => (
  <div className="space-y-2">
    <div className="grid grid-cols-2 gap-2">
      <GlowingButton
        variant="outline"
        size="sm"
        glowColor="blue"
        intensity="medium"
        className="w-full bg-gradient-to-r from-blue-600/20 to-blue-700/20 border-blue-400/60 
                   text-blue-100 text-xs px-2 py-2 min-h-[44px]"
        onClick={onShowTechPanel}
        soundEffect="cta-click"
      >
        <Book className="w-3 h-3 mr-1 flex-shrink-0" />
        <span>Sacred Knowledge</span>
      </GlowingButton>
      
      <GlowingButton
        variant="outline"
        size="sm"
        glowColor="amber"
        intensity="medium"
        className="w-full bg-gradient-to-r from-amber-600/20 to-amber-700/20 border-amber-400/60 
                   text-amber-100 text-xs px-2 py-2 min-h-[44px]"
        onClick={onShowConstructionHall}
        soundEffect="cta-click"
      >
        <div className="flex flex-col items-center justify-center">
          <Hammer className="w-3 h-3 mb-1" />
          <span className="text-xs leading-tight">Construction Hall</span>
        </div>
      </GlowingButton>
    </div>
    
    <GlowingButton
      variant="default"
      size="sm"
      glowColor="green"
      intensity="high"
      className="w-full bg-gradient-to-r from-green-600/30 to-green-700/30 border-green-400/60 
                 text-green-100 text-sm px-3 py-3 min-h-[48px] font-semibold"
      onClick={onEndTurn}
      soundEffect="cta-click"
    >
      End Turn
    </GlowingButton>
  </div>
));

const FactionAbilitiesSection = React.memo(({
  abilities,
  onActivateAbility,
}: {
  abilities: HUDAbilityOption[];
  onActivateAbility?: (abilityId: string) => void;
}) => {
  const badgeClass =
    'inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-100/80';

  const formatRequirement = (label: string) =>
    label.charAt(0).toUpperCase() + label.slice(1);

  const formatTarget = (target?: string) => {
    switch (target) {
      case 'ally':
        return 'Allies';
      case 'enemy':
        return 'Enemy';
      case 'tile':
        return 'Tile';
      case 'area':
        return 'Area';
      case 'global':
        return 'Global';
      default:
        return 'Self';
    }
  };

  const sortedAbilities = [...abilities].sort((a, b) => {
    if (a.canUse === b.canUse) {
      const aRemaining = a.meta?.cooldownRemaining ?? 0;
      const bRemaining = b.meta?.cooldownRemaining ?? 0;
      return aRemaining - bRemaining;
    }
    return a.canUse ? -1 : 1;
  });

  return (
    <div className="space-y-3 pt-1 border-t border-amber-500/20">
      <div className="flex items-center gap-2 text-amber-100 font-cinzel text-sm">
        <Shield className="w-4 h-4 text-amber-300" />
        Faction Abilities
      </div>
      <div className="space-y-2">
        {sortedAbilities.map((ability) => {
          const requirementEntries = ability.meta?.requirements
            ? Object.entries(ability.meta.requirements).filter(
                ([, value]) => typeof value === 'number'
              )
            : [];

          const hasMeta =
            ability.meta?.cooldown ||
            ability.meta?.cooldownRemaining ||
            ability.meta?.cost ||
            ability.meta?.isToggle ||
            ability.meta?.target ||
            requirementEntries.length > 0;

          const isCoolingDown = Boolean(
            ability.meta?.cooldownRemaining && ability.meta.cooldownRemaining > 0
          );
          const cooldownPercent = ability.meta?.cooldown
            ? Math.max(
                0,
                Math.min(
                  100,
                  ((ability.meta.cooldown - (ability.meta.cooldownRemaining ?? 0)) / ability.meta.cooldown) * 100
                )
              )
            : ability.canUse
              ? 100
              : 0;

          return (
            <button
              key={ability.id}
              type="button"
              aria-disabled={!ability.canUse}
              disabled={!ability.canUse}
              className={`w-full text-left rounded-xl border px-4 py-3 transition-colors touch-manipulation ${
                ability.canUse
                  ? 'border-amber-500/60 bg-gradient-to-r from-amber-900/30 to-amber-800/30 hover:from-amber-800/35 hover:to-amber-700/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 shadow-lg shadow-amber-500/10'
                  : 'border-slate-700 bg-slate-800/60 text-slate-400 cursor-not-allowed'
              }`}
              onClick={() => ability.canUse && onActivateAbility?.(ability.id)}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-amber-100 font-semibold">
                    {ability.name}
                  </span>
                  {ability.requiresTarget && (
                    <span className={`${badgeClass} bg-amber-500/15 border-amber-400/40 text-amber-100`}>
                      <Sparkles className="w-3 h-3" />
                      Select Unit
                    </span>
                  )}
                  {ability.canUse && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-emerald-200">
                      Ready
                    </span>
                  )}
                  {isCoolingDown && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/40 bg-slate-700/40 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-200/80">
                      Cooling • {ability.meta?.cooldownRemaining} turn{ability.meta?.cooldownRemaining && ability.meta.cooldownRemaining > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <p className="text-xs text-amber-200/80 leading-relaxed">
                  {ability.description}
                </p>
              </div>
              {hasMeta && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {ability.meta?.cooldown && ability.meta.cooldown > 0 && (
                    <span className={badgeClass}>
                      <Clock className="w-3 h-3" />
                      {ability.meta.cooldown} turn{ability.meta.cooldown > 1 ? 's' : ''}
                    </span>
                  )}
                  {ability.meta?.cooldownRemaining && ability.meta.cooldownRemaining > 0 && (
                    <span className={badgeClass}>
                      <Clock className="w-3 h-3" />
                      Ready in {ability.meta.cooldownRemaining} turn{ability.meta.cooldownRemaining > 1 ? 's' : ''}
                    </span>
                  )}
                  {typeof ability.meta?.cost === 'number' && ability.meta.cost > 0 && (
                    <span className={badgeClass}>
                      <Star className="w-3 h-3" />
                      Cost {ability.meta.cost}
                    </span>
                  )}
                  {ability.meta?.target && (
                    <span className={badgeClass}>
                      <Target className="w-3 h-3" />
                      {formatTarget(ability.meta.target)}
                    </span>
                  )}
                  {ability.meta?.isToggle && (
                    <span className={badgeClass}>
                      <RefreshCw className="w-3 h-3" />
                      Toggle
                    </span>
                  )}
                  {requirementEntries.map(([key, value]) => (
                    <span key={key} className={badgeClass}>
                      {formatRequirement(key)} &gt;= {value}
                    </span>
                  ))}
                </div>
              )}
              {ability.meta?.cooldown && ability.meta.cooldown > 0 && (
                <div className="mt-3 h-1.5 w-full rounded-full bg-slate-800/70 overflow-hidden">
                  <div
                    className={`h-full transition-all ${ability.canUse ? 'bg-emerald-400/80' : 'bg-amber-400/70'}`}
                    style={{ width: `${cooldownPercent}%` }}
                  />
                </div>
              )}
              {!ability.canUse && ability.disabledReason && (
                <div className="text-xs text-slate-300 mt-2">
                  Requirements: {ability.disabledReason}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});

// Tooltip content components
const StarProductionTooltip = ({ totalIncome, breakdown }: {
  totalIncome: number;
  breakdown: PlayerStats['starProductionBreakdown'];
}) => (
  <div className="space-y-2">
    <h4 className="font-semibold text-amber-200">Star Production</h4>
    {breakdown.map((item, index) => (
      <div key={index} className="flex justify-between text-sm">
        <span>{item.source}:</span>
        <span className="text-amber-300">+{item.amount}</span>
      </div>
    ))}
    <div className="border-t border-amber-600/50 pt-1 flex justify-between font-semibold">
      <span>Total per turn:</span>
      <span className="text-amber-300">+{totalIncome}</span>
    </div>
  </div>
);

const FaithSystemTooltip = () => (
  <div className="space-y-2">
    <h4 className="font-semibold text-blue-300">Faith System</h4>
    <p className="text-xs text-blue-200">
      Faith represents your covenant relationship with the Lord. Higher faith unlocks 
      powerful abilities and bonuses for righteous actions.
    </p>
  </div>
);

const PrideSystemTooltip = () => (
  <div className="space-y-2">
    <h4 className="font-semibold text-purple-300">Pride System</h4>
    <p className="text-xs text-purple-200">
      Pride measures worldly power and ambition. Pride enables certain military and 
      economic actions but can lead to spiritual consequences.
    </p>
  </div>
);

const InspirationTooltip = () => (
  <div className="space-y-2">
    <h4 className="font-semibold text-emerald-300">Research Inspiration</h4>
    <p className="text-xs text-emerald-200">
      Inspiration discounts the cost of your next technology. Earn it by exploring ruins,
      capturing villages, and fielding intelligence units. Unused inspiration slowly fades
      each turn, and you can store up to {GAME_RULES.research.maxInspiration} points.
    </p>
  </div>
);

const TechnologyTooltip = () => (
  <div className="space-y-2">
    <h4 className="font-semibold text-blue-300">Sacred Knowledge</h4>
    <p className="text-xs text-blue-200">
      Research technologies inspired by Book of Mormon civilizations to unlock new 
      units, buildings, and abilities.
    </p>
  </div>
);
