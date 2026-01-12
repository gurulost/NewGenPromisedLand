import React, { useMemo, useState } from 'react';
import { Star, TrendingUp, Book, Hammer, Info, Trophy, ChevronDown, ChevronUp } from 'lucide-react';

import { HUDShell } from '../primitives/HUDShell';
import { AvatarBadge } from '../primitives/AvatarBadge';
import { GlowingButton } from '../primitives/GlowingButton';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Progress } from '../ui/progress';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../ui/collapsible';
import { InfoTooltip } from '../primitives/InfoTooltip';
import { DissentSystemTooltip, FaithSystemTooltip, PrideSystemTooltip, StarProductionTooltip } from '../ui/TooltipSystem';

import { PlayerState, GameState } from '@shared/types/game';
import { getFaction } from '@shared/data/factions';
import { GameRuleHelpers, GAME_RULES } from '@shared/data/gameRules';
import { TECHNOLOGIES } from '@shared/data/technologies';
import { getPlayerStats, PlayerStats } from '../../selectors/player';
import { useAutosaveStatus } from '../../lib/stores/useAutosaveStatus';

function formatRelativeTime(ts: number): string {
  const deltaMs = Date.now() - ts;
  if (deltaMs < 15_000) return 'just now';
  const mins = Math.floor(deltaMs / 60_000);
  if (mins < 1) return '<1m ago';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

interface PlayerHUDProps {
  player: PlayerState;
  gameState: GameState | null;
  onShowTechPanel: () => void;
  onShowConstructionHall: () => void;
  onShowDiplomacy: () => void;
  onEndTurn?: () => void;
}

export function PlayerHUD({ player, gameState, onShowTechPanel, onShowConstructionHall, onShowDiplomacy, onEndTurn }: PlayerHUDProps) {
  const faction = getFaction(player.factionId as any);
  const handleEndTurn = onEndTurn ?? (() => { });
  const autosaveStatus = useAutosaveStatus();
  const [victoryOpen, setVictoryOpen] = useState(false);

  // Moved expensive calculations to selector
  const playerStats = useMemo(() =>
    getPlayerStats(player, gameState),
    [player, gameState]
  );

  const testimonyPressureLastTurn = useMemo(() => {
    if (!gameState) return { unitsAffected: 0, attackPenalty: 0, durationTurns: 0 };

    const action: any = gameState.lastAction;
    if (!action) return { unitsAffected: 0, attackPenalty: 0, durationTurns: 0 };

    if (action.type === 'END_TURN_RESOLUTION') {
      const events = action.payload?.events || [];
      const pressureEvent = events.find((e: any) => e?.type === 'TESTIMONY_PRESSURE');
      const affected: Array<{ playerId: string; unitIds: string[] }> = pressureEvent?.payload?.affected || [];
      const mine = affected.find(a => a.playerId === player.id);
      return {
        unitsAffected: mine?.unitIds?.length || 0,
        attackPenalty: pressureEvent?.payload?.attackPenalty || 0,
        durationTurns: pressureEvent?.payload?.durationTurns || 0,
      };
    }

    if (action.type === 'TESTIMONY_PRESSURE') {
      const affected: Array<{ playerId: string; unitIds: string[] }> = action.payload?.affected || [];
      const mine = affected.find(a => a.playerId === player.id);
      return {
        unitsAffected: mine?.unitIds?.length || 0,
        attackPenalty: action.payload?.attackPenalty || 0,
        durationTurns: action.payload?.durationTurns || 0,
      };
    }

    return { unitsAffected: 0, attackPenalty: 0, durationTurns: 0 };
  }, [gameState?.lastAction, player.id]);

  if (!gameState) return null;

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
          {autosaveStatus.lastFailureAt ? (
            <div className="text-xs text-red-200/90 font-body">
              Autosave unavailable — progress may be lost on reload
            </div>
          ) : autosaveStatus.lastSuccessAt ? (
            <div className="text-xs text-amber-200/70 font-body">
              Autosaved {autosaveStatus.lastSuccessTurn ? `turn ${autosaveStatus.lastSuccessTurn}` : 'game'} {formatRelativeTime(autosaveStatus.lastSuccessAt)}
              {autosaveStatus.isSaving ? ' (saving…)': ''}
            </div>
          ) : autosaveStatus.isSaving ? (
            <div className="text-xs text-amber-200/70 font-body">Autosaving…</div>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-4 bg-slate-900/40 p-4">
          {/* Star Resources */}
          <StarResourcesSection
            stars={player.stars}
            starProduction={playerStats.starProduction}
            breakdown={playerStats.starProductionBreakdown}
          />

          {/* Faith/Pride/Dissent Progress Bars */}
          <ResourceProgressSection playerStats={playerStats} testimonyPressureLastTurn={testimonyPressureLastTurn} />

          {/* Victory Progress */}
          <VictoryProgressSection
            player={player}
            gameState={gameState}
            playerStats={playerStats}
            isOpen={victoryOpen}
            onToggle={setVictoryOpen}
          />

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

const ResourceProgressSection = React.memo(({ playerStats, testimonyPressureLastTurn }: {
  playerStats: PlayerStats;
  testimonyPressureLastTurn: { unitsAffected: number; attackPenalty: number; durationTurns: number };
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
      {testimonyPressureLastTurn.unitsAffected > 0 && testimonyPressureLastTurn.attackPenalty > 0 && (
        <div className="mt-1 text-xs text-blue-200/70 font-body">
          Testimony pressure: {testimonyPressureLastTurn.unitsAffected} unit(s) -{testimonyPressureLastTurn.attackPenalty} attack ({testimonyPressureLastTurn.durationTurns} turn)
        </div>
      )}
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

const VictoryProgressSection = React.memo(({ player, gameState, playerStats, isOpen, onToggle }: {
  player: PlayerState;
  gameState: GameState;
  playerStats: PlayerStats;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
}) => {
  const playerCount = gameState.players.length;
  const economicTargets = GameRuleHelpers.getEconomicVictoryThresholds(playerCount);
  const culturalTargets = GameRuleHelpers.getCulturalVictoryThresholds(playerCount);
  const totalTechs = Object.keys(TECHNOLOGIES).length || 1;
  const techPercent = Math.round((player.researchedTechs.length / totalTechs) * 100);

  const ownedCities = (gameState.cities || []).filter(c => c.ownerId === player.id);
  const population = ownedCities.reduce((sum, city) => sum + (city.population || 0), 0);

  const culturalStructureCount =
    (gameState.structures || []).filter(
      s => s.ownerId === player.id &&
        s.constructionTurns === 0 &&
        culturalTargets.structureTypes.includes(s.type)
    ).length +
    (gameState.improvements || []).filter(
      i => i.ownerId === player.id &&
        i.constructionTurns === 0 &&
        culturalTargets.improvementTypes.includes(i.type)
    ).length;

  const totalOwnedCities = gameState.players.reduce((sum, p) => sum + p.citiesOwned.length, 0);
  const territoryPercent = totalOwnedCities > 0
    ? Math.round((player.citiesOwned.length / totalOwnedCities) * 100)
    : 0;
  const territoryTarget = Math.round(GAME_RULES.victory.territoryControlThreshold * 100);
  const maxTurns = GAME_RULES.turns.maxTurnsPerGame;
  const turnLabel = maxTurns > 0 ? `${gameState.turn}/${maxTurns}` : `${gameState.turn}/no cap`;

  const summaryItems = [
    { label: 'F', value: `${player.stats.faith}/${GAME_RULES.victory.faithThreshold}` },
    { label: 'E', value: `+${playerStats.starProduction}/${economicTargets.income}` },
    { label: 'C', value: `${population}/${culturalTargets.population}` },
    { label: 'T', value: `${territoryPercent}%/${territoryTarget}%` },
  ];

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle} className="space-y-2">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full rounded-lg border border-amber-500/20 bg-slate-900/40 px-3 py-2 text-left transition-colors hover:bg-slate-800/50"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-amber-100 font-cinzel font-semibold">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Victory</span>
              <InfoTooltip content={
                <div className="space-y-1 text-xs">
                  <div>Faith: reach threshold with low dissent.</div>
                  <div>Economic: income + treasury + tech percent.</div>
                  <div>Cultural: population + cultural sites + low dissent.</div>
                  <div>Territory: share of owned cities.</div>
                </div>
              }>
                <Info
                  className="w-3 h-3 text-amber-400/60 hover:text-amber-400 cursor-help transition-colors"
                  onClick={(event) => event.stopPropagation()}
                />
              </InfoTooltip>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-amber-200/70">
              <span>{turnLabel}</span>
              {isOpen ? (
                <ChevronUp className="w-3 h-3 text-amber-300" />
              ) : (
                <ChevronDown className="w-3 h-3 text-amber-300" />
              )}
            </div>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-amber-200/80 font-body">
            {summaryItems.map(item => (
              <span key={item.label} className="flex items-center gap-1">
                <span className="text-amber-300/80">{item.label}</span>
                <span>{item.value}</span>
              </span>
            ))}
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid grid-cols-2 gap-2 text-xs text-amber-200/80 font-body">
          <div>
            <div className="text-amber-200">Faith</div>
            <div className="text-amber-100">
              {player.stats.faith}/{GAME_RULES.victory.faithThreshold}
              <span className="text-amber-200/70"> (dissent &lt;= {GAME_RULES.victory.faithDissentMax})</span>
            </div>
          </div>
          <div>
            <div className="text-amber-200">Territory</div>
            <div className="text-amber-100">{territoryPercent}% / {territoryTarget}%</div>
          </div>
          <div>
            <div className="text-amber-200">Economic</div>
            <div className="text-amber-100">
              +{playerStats.starProduction}/{economicTargets.income} stars
            </div>
            <div className="text-amber-100">
              {player.stars}/{economicTargets.treasury} stars | {techPercent}%/{Math.round(economicTargets.techPercent * 100)}%
            </div>
          </div>
          <div>
            <div className="text-amber-200">Cultural</div>
            <div className="text-amber-100">
              Pop {population}/{culturalTargets.population}
            </div>
            <div className="text-amber-100">
              Sites {culturalStructureCount}/{culturalTargets.structures} | Dissent &lt;= {culturalTargets.dissentMax}
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
});

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
