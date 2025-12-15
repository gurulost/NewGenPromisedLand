import React, { useMemo } from 'react';
import { Star, TrendingUp, Book, Hammer, Info } from 'lucide-react';

import { HUDShell } from '../primitives/HUDShell';
import { AvatarBadge } from '../primitives/AvatarBadge';
import { GlowingButton } from '../primitives/GlowingButton';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Progress } from '../ui/progress';
import { InfoTooltip } from '../primitives/InfoTooltip';
import { DissentSystemTooltip, FaithSystemTooltip, PrideSystemTooltip, StarProductionTooltip } from '../ui/TooltipSystem';

import { PlayerState, GameState } from '@shared/types/game';
import { getFaction } from '@shared/data/factions';
import { getPlayerStats, PlayerStats } from '../../selectors/player';

interface PlayerHUDProps {
  player: PlayerState;
  gameState: GameState;
  onShowTechPanel: () => void;
  onShowConstructionHall: () => void;
  onShowDiplomacy: () => void;
  onEndTurn?: () => void;
}

export function PlayerHUD({ player, gameState, onShowTechPanel, onShowConstructionHall, onShowDiplomacy, onEndTurn }: PlayerHUDProps) {
  const faction = getFaction(player.factionId as any);
  const handleEndTurn = onEndTurn ?? (() => { });

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
            — Leader of the Promised Land —
          </div>
        </CardHeader>

        <CardContent className="space-y-4 bg-slate-900/40 p-4">
          {/* Star Resources */}
          <StarResourcesSection
            stars={player.stars}
            starProduction={playerStats.starProduction}
            breakdown={playerStats.starProductionBreakdown}
          />

          {/* Faith/Pride/Dissent Progress Bars */}
          <ResourceProgressSection playerStats={playerStats} />

          {/* Action Buttons */}
          <ActionButtonsSection
            onShowTechPanel={onShowTechPanel}
            onShowConstructionHall={onShowConstructionHall}
            onShowDiplomacy={onShowDiplomacy}
            onEndTurn={handleEndTurn}
          />
        </CardContent>
      </Card>
    </HUDShell>
  );
}

// Memoized sub-components for performance
const StarResourcesSection = React.memo(({ stars, starProduction, breakdown }: {
  stars: number;
  starProduction: number;
  breakdown: PlayerStats['starProductionBreakdown'];
}) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between text-amber-100">
      <div className="flex items-center gap-2">
        <Star className="w-4 h-4 text-amber-400" />
        <span className="font-semibold text-amber-200">{stars}</span>
        <InfoTooltip content={<StarProductionTooltip totalIncome={starProduction} breakdown={breakdown} />}>
          <Info className="w-3 h-3 text-amber-400/60 hover:text-amber-400 cursor-help transition-colors" />
        </InfoTooltip>
      </div>
      <div className="flex items-center gap-1 text-sm text-amber-300">
        <TrendingUp className="w-3 h-3" />
        <span>+{starProduction}/turn</span>
      </div>
    </div>

    <details className="group">
      <summary className="text-xs text-amber-300/70 cursor-pointer hover:text-amber-300 flex items-center gap-1">
        <span>Production breakdown</span>
        <span className="transition-transform group-open:rotate-90">▶</span>
      </summary>
      <div className="mt-2 space-y-1 text-xs bg-amber-900/10 rounded-lg p-3 border border-amber-500/20">
        {breakdown.map((item, index) => (
          <div key={index} className="flex justify-between text-amber-200">
            <span>{item.source}:</span>
            <span className="text-amber-300">
              {item.amount >= 0 ? `+${item.amount}` : `${item.amount}`}
            </span>
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
  <div className="space-y-3">
    {/* Faith Progress */}
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-blue-300 font-cinzel font-medium flex items-center gap-1">
          Faith
          <InfoTooltip content={<FaithSystemTooltip />}>
            <Info className="w-3 h-3 text-blue-400/60 hover:text-blue-400 cursor-help transition-colors" />
          </InfoTooltip>
        </span>
        <span className="text-amber-100 font-body font-medium">{playerStats.faithPercentage}/100</span>
      </div>
      <Progress value={playerStats.faithPercentage} className="h-2" />
    </div>

    {/* Pride Progress */}
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-purple-300 font-cinzel font-medium flex items-center gap-1">
          Pride
          <InfoTooltip content={<PrideSystemTooltip />}>
            <Info className="w-3 h-3 text-purple-400/60 hover:text-purple-400 cursor-help transition-colors" />
          </InfoTooltip>
        </span>
        <span className="text-amber-100 font-body font-medium">{playerStats.pridePercentage}/100</span>
      </div>
      <Progress value={playerStats.pridePercentage} className="h-2" />
    </div>

    {/* Dissent Progress */}
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-red-300 font-cinzel font-medium flex items-center gap-1">
          Dissent
          <InfoTooltip content={<DissentSystemTooltip />}>
            <Info className="w-3 h-3 text-red-400/60 hover:text-red-400 cursor-help transition-colors" />
          </InfoTooltip>
        </span>
        <span className="text-amber-100 font-body font-medium">{playerStats.dissentPercentage}/100</span>
      </div>
      <Progress value={playerStats.dissentPercentage} className="h-2" />
    </div>
  </div>
));

const ActionButtonsSection = React.memo(({ onShowTechPanel, onShowConstructionHall, onShowDiplomacy, onEndTurn }: {
  onShowTechPanel: () => void;
  onShowConstructionHall: () => void;
  onShowDiplomacy: () => void;
  onEndTurn: () => void;
}) => (
  <div className="space-y-2 pt-2">
    <div className="grid grid-cols-2 gap-2">
      <GlowingButton
        variant="outline"
        size="sm"
        glowColor="blue"
        intensity="medium"
        className="w-full bg-gradient-to-r from-blue-600/20 to-blue-700/20 border-blue-400/60 
                   text-blue-100 text-xs px-4 py-3 min-h-[48px] justify-center"
        onClick={onShowTechPanel}
        soundEffect="cta-click"
      >
        <Book className="w-4 h-4 flex-shrink-0" />
        <span className="ml-2">Knowledge</span>
      </GlowingButton>

      <GlowingButton
        variant="outline"
        size="sm"
        glowColor="amber"
        intensity="medium"
        className="w-full bg-gradient-to-r from-amber-600/20 to-amber-700/20 border-amber-400/60 
                   text-amber-100 text-xs px-4 py-3 min-h-[48px] justify-center"
        onClick={onShowConstructionHall}
        soundEffect="cta-click"
      >
        <Hammer className="w-4 h-4 flex-shrink-0" />
        <span className="ml-2">Build</span>
      </GlowingButton>
    </div>

    <GlowingButton
      variant="outline"
      size="sm"
      glowColor="purple"
      intensity="medium"
      className="w-full bg-gradient-to-r from-purple-600/20 to-purple-700/20 border-purple-400/60 
                 text-purple-100 text-xs px-4 py-3 min-h-[48px] justify-center"
      onClick={onShowDiplomacy}
      soundEffect="cta-click"
    >
      <span className="text-base mr-2">🤝</span>
      <span>Diplomacy</span>
    </GlowingButton>

    <GlowingButton
      variant="default"
      size="sm"
      glowColor="green"
      intensity="high"
      className="w-full text-sm font-semibold bg-gradient-to-r from-green-600 to-green-700 
                 text-white border border-green-400/60 hover:from-green-500 hover:to-green-600"
      onClick={onEndTurn}
      soundEffect="cta-click"
    >
      End Turn
    </GlowingButton>
  </div>
));

// Tooltip content components are centralized in `client/src/components/ui/TooltipSystem.tsx`
