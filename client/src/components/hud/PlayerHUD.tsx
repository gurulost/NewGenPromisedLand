import React, { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  Star,
  TrendingUp,
  Book,
  Hammer,
  Info,
  Trophy,
  ChevronDown,
  ChevronUp,
  ScrollText,
} from 'lucide-react';

import { HUDShell } from '../primitives/HUDShell';
import { AvatarBadge } from '../primitives/AvatarBadge';
import { GlowingButton } from '../primitives/GlowingButton';
import { FactionAbilityButtons } from './FactionAbilityButtons';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Progress } from '../ui/progress';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../ui/collapsible';
import { InfoTooltip } from '../primitives/InfoTooltip';
import {
  DissentSystemTooltip,
  FaithSystemTooltip,
  PrideSystemTooltip,
  StarProductionTooltip,
} from '../ui/TooltipSystem';
import { TutorialHelpIcon } from '../ui/TutorialHelpIcon';

import { PlayerState, GameState } from '@shared/types/game';
import { getFaction } from '@shared/data/factions';
import { coerceFactionId } from '@shared/types/factionId';
import { GameRuleHelpers, GAME_RULES } from '@shared/data/gameRules';
import { TECHNOLOGIES } from '@shared/data/technologies';
import { getActiveFaithProject } from '@shared/logic/faithProject';
import { getPlayerStats, PlayerStats } from '../../selectors/player';
import { useAutosaveStatus } from '../../lib/stores/useAutosaveStatus';
import { useTutorialStore } from '../../lib/stores/useTutorial';
import { useLocalGame } from '../../lib/stores/useLocalGame';
import { useMobileUI } from '../../hooks/useMobileUI';
import { FaithProjectPanel } from './FaithProjectPanel';

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
  onToggleGameLog?: () => void;
  gameLogEntryCount?: number;
  isGameLogOpen?: boolean;
  onEndTurn?: () => void;
  onUseFactionAbility?: (abilityId: string) => void;
}

type AuraSummary = {
  unitsAffected: number;
  attackPenalty: number;
  durationTurns: number;
};

type AuraPayload = {
  attackPenalty: number;
  durationTurns: number;
  affected: Array<{ playerId: string; unitIds: string[] }>;
};

function extractAuraEffect(
  action: GameState['lastAction'],
  eventType: 'TESTIMONY_PRESSURE' | 'INTIMIDATION_AURA',
  playerId: string,
): AuraSummary {
  const empty = { unitsAffected: 0, attackPenalty: 0, durationTurns: 0 };
  if (!action) return empty;

  let payload: AuraPayload | undefined;

  if (action.type === 'END_TURN_RESOLUTION') {
    const endTurnPayload = action.payload as { events: Array<{ type: string; payload: unknown }> };
    const hit = endTurnPayload.events.find((event) => event.type === eventType);
    payload = hit?.payload as AuraPayload | undefined;
  } else if (action.type === eventType) {
    payload = action.payload as AuraPayload;
  }

  if (!payload) return empty;
  const mine = payload.affected?.find((affectedPlayer) => affectedPlayer.playerId === playerId);
  return {
    unitsAffected: mine?.unitIds?.length ?? 0,
    attackPenalty: payload.attackPenalty ?? 0,
    durationTurns: payload.durationTurns ?? 0,
  };
}

export function PlayerHUD({
  player,
  gameState,
  onShowTechPanel,
  onShowConstructionHall,
  onShowDiplomacy,
  onToggleGameLog,
  gameLogEntryCount = 0,
  isGameLogOpen = false,
  onEndTurn,
  onUseFactionAbility,
}: PlayerHUDProps) {
  const faction = getFaction(coerceFactionId(player.factionId)!);
  const handleEndTurn = onEndTurn ?? (() => {});
  const autosaveStatus = useAutosaveStatus();
  const [victoryOpen, setVictoryOpen] = useState(false);
  const openTutorialIfNeeded = useTutorialStore((state) => state.openIfNeeded);
  const gameMode = useLocalGame((state) => state.gameMode);
  const dispatch = useLocalGame((state) => state.dispatch);
  const { isSmallViewport } = useMobileUI();
  const panelRef = useRef<HTMLDivElement>(null);
  const compactLayout = isSmallViewport;

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const updateHeight = () => {
      const height = Math.ceil(panelRef.current?.getBoundingClientRect().height ?? 0);
      document.documentElement.style.setProperty('--player-hud-height', `${height}px`);
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    const observer =
      typeof ResizeObserver !== 'undefined' && panelRef.current
        ? new ResizeObserver(updateHeight)
        : null;
    if (observer && panelRef.current) {
      observer.observe(panelRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateHeight);
      observer?.disconnect();
      document.documentElement.style.removeProperty('--player-hud-height');
    };
  }, []);

  const openIfAllowed = (cardId: Parameters<typeof openTutorialIfNeeded>[0]) => {
    if (gameMode === 'tutorialEpisode') return;
    openTutorialIfNeeded(cardId);
  };

  const playerStats = useMemo(() => getPlayerStats(player, gameState), [player, gameState]);

  const handleTechPanel = () => {
    openIfAllowed('hud');
    onShowTechPanel();
  };

  const handleConstructionHall = () => {
    openIfAllowed('hud');
    onShowConstructionHall();
  };

  const handleDiplomacyPanel = () => {
    openIfAllowed('hud');
    onShowDiplomacy();
  };

  const handleGameLog = () => {
    openIfAllowed('hud');
    onToggleGameLog?.();
  };

  const handleEndTurnClick = () => {
    openIfAllowed('end-turn');
    handleEndTurn();
  };

  const handleVictoryToggle = (open: boolean) => {
    if (open) {
      openIfAllowed('victory');
    }
    setVictoryOpen(open);
  };

  const testimonyPressureLastTurn = useMemo(
    () => extractAuraEffect(gameState?.lastAction, 'TESTIMONY_PRESSURE', player.id),
    [gameState?.lastAction, player.id],
  );

  const intimidationAuraLastTurn = useMemo(
    () => extractAuraEffect(gameState?.lastAction, 'INTIMIDATION_AURA', player.id),
    [gameState?.lastAction, player.id],
  );

  if (!gameState) return null;

  return (
    <HUDShell position="top-left">
      <Card
        ref={panelRef}
        className={clsx(
          compactLayout ? 'w-80' : 'w-72',
          'max-w-[calc(100vw-env(safe-area-inset-left)-env(safe-area-inset-right)-2rem)]',
          'max-h-[calc(100vh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem)]',
          'flex flex-col overflow-hidden bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-900/95',
          'border-2 border-amber-500/30 shadow-2xl shadow-amber-500/20 backdrop-blur-sm',
        )}
      >
        <CardHeader
          className={clsx(
            'border-b border-amber-500/20 bg-gradient-to-r from-amber-900/20 to-amber-800/20',
            compactLayout ? 'space-y-2 px-4 py-4' : 'pb-3',
          )}
        >
          <CardTitle
            className={clsx(
              'flex w-full items-center gap-3 font-cinzel font-semibold tracking-wide text-amber-100',
              compactLayout ? 'text-base' : 'text-lg',
            )}
          >
            <AvatarBadge color={faction.color} size="md" aria-label={`${faction.name} faction`}>
              <span className="text-sm font-bold text-white">{faction.name.charAt(0)}</span>
            </AvatarBadge>
            <span className="truncate">{player.name}</span>
            <div className="ml-auto flex items-center gap-2">
              <div className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.24em] text-amber-200/80">
                Turn {gameState.turn}
              </div>
              <TutorialHelpIcon cardId="hud" label="Open HUD tutorial" />
            </div>
          </CardTitle>

          <div className="text-xs font-normal text-amber-300/70">— Leader of the Promised Land —</div>

          {autosaveStatus.lastFailureAt ? (
            <div className="text-xs font-body text-red-200/90">
              Autosave unavailable — progress may be lost on reload
            </div>
          ) : autosaveStatus.lastSuccessAt ? (
            <div className="text-xs font-body text-amber-200/70">
              Autosaved {autosaveStatus.lastSuccessTurn ? `turn ${autosaveStatus.lastSuccessTurn}` : 'game'}{' '}
              {formatRelativeTime(autosaveStatus.lastSuccessAt)}
              {autosaveStatus.isSaving ? ' (saving...)' : ''}
            </div>
          ) : autosaveStatus.isSaving ? (
            <div className="text-xs font-body text-amber-200/70">Autosaving...</div>
          ) : null}
        </CardHeader>

        <CardContent
          className={clsx(
            'flex-1 min-h-0 overflow-y-auto touch-scroll bg-slate-900/40',
            compactLayout ? 'space-y-3 p-3 pt-3' : 'space-y-4 p-4 pt-4',
          )}
        >
          <StarResourcesSection
            stars={player.stars}
            starProduction={playerStats.starProduction}
            breakdown={playerStats.starProductionBreakdown}
            compact={compactLayout}
          />

          <ResourceProgressSection
            playerStats={playerStats}
            testimonyPressureLastTurn={testimonyPressureLastTurn}
            intimidationAuraLastTurn={intimidationAuraLastTurn}
            compact={compactLayout}
          />

          <VictoryProgressSection
            player={player}
            gameState={gameState}
            playerStats={playerStats}
            isOpen={victoryOpen}
            onToggle={handleVictoryToggle}
            onStartFaithProject={(holyCityIds) => {
              dispatch({
                type: 'START_FAITH_PROJECT',
                payload: { playerId: player.id, holyCityIds },
              });
            }}
            compact={compactLayout}
          />

          <FactionAbilityButtons
            player={player}
            gameState={gameState}
            onUseFactionAbility={onUseFactionAbility}
            compact={compactLayout}
          />

          <ActionButtonsSection
            onShowTechPanel={handleTechPanel}
            onShowConstructionHall={handleConstructionHall}
            onShowDiplomacy={handleDiplomacyPanel}
            onToggleGameLog={handleGameLog}
            gameLogEntryCount={gameLogEntryCount}
            isGameLogOpen={isGameLogOpen}
            onEndTurn={handleEndTurnClick}
            compact={compactLayout}
          />
        </CardContent>
      </Card>
    </HUDShell>
  );
}

const StarResourcesSection = React.memo(
  ({
    stars,
    starProduction,
    breakdown,
    compact = false,
  }: {
    stars: number;
    starProduction: number;
    breakdown: PlayerStats['starProductionBreakdown'];
    compact?: boolean;
  }) => (
    <div
      className={clsx(
        compact && 'rounded-xl border border-amber-500/20 bg-amber-900/10 px-3 py-3 shadow-[inset_0_1px_0_rgba(251,191,36,0.08)]',
      )}
    >
      <div className="flex items-center justify-between gap-3 text-amber-100">
        <div className="flex items-center gap-2">
          <Star className={clsx('text-amber-400', compact ? 'h-4 w-4' : 'h-4 w-4')} />
          <div>
            {compact && (
              <div className="text-[10px] uppercase tracking-[0.28em] text-amber-200/55">Stars</div>
            )}
            <div className="flex items-center gap-2">
              <span className={clsx('font-semibold text-amber-100', compact ? 'text-2xl leading-none' : 'text-base')}>
                {stars}
              </span>
              <InfoTooltip
                content={<StarProductionTooltip totalIncome={starProduction} breakdown={breakdown} />}
                ariaLabel="Star production breakdown"
              >
                <Info className="h-3 w-3 cursor-help text-amber-400/60 transition-colors hover:text-amber-400" />
              </InfoTooltip>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-sm text-amber-300">
          <TrendingUp className="h-3 w-3" />
          <span>+{starProduction}/turn</span>
        </div>
      </div>

      <details className="group mt-2">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-amber-300/70 hover:text-amber-300 [&::-webkit-details-marker]:hidden">
          <span>{compact ? 'Income details' : 'Production breakdown'}</span>
          <span className="transition-transform group-open:rotate-90">▶</span>
        </summary>
        <div className="mt-2 space-y-1 rounded-lg border border-amber-500/20 bg-amber-900/10 p-3 text-xs">
          {breakdown.map((item, index) => (
            <div key={index} className="flex justify-between text-amber-200">
              <span>{item.source}:</span>
              <span className="text-amber-300">{item.amount >= 0 ? `+${item.amount}` : `${item.amount}`}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-amber-600/50 pt-1 font-semibold text-amber-100">
            <span>Total:</span>
            <span className="text-amber-300">+{starProduction}</span>
          </div>
        </div>
      </details>
    </div>
  ),
);

const ResourceProgressSection = React.memo(
  ({
    playerStats,
    testimonyPressureLastTurn,
    intimidationAuraLastTurn,
    compact = false,
  }: {
    playerStats: PlayerStats;
    testimonyPressureLastTurn: AuraSummary;
    intimidationAuraLastTurn: AuraSummary;
    compact?: boolean;
  }) => {
    if (compact) {
      const statCards = [
        {
          key: 'faith',
          label: 'Faith',
          value: playerStats.faithPercentage,
          shellClass: 'border-sky-400/25 bg-sky-500/10',
          labelClass: 'text-sky-200/90',
          valueClass: 'text-sky-50',
          iconClass: 'text-sky-300/70 hover:text-sky-200',
          barClass: 'bg-sky-300',
          tooltip: <FaithSystemTooltip />,
        },
        {
          key: 'pride',
          label: 'Pride',
          value: playerStats.pridePercentage,
          shellClass: 'border-violet-400/25 bg-violet-500/10',
          labelClass: 'text-violet-200/90',
          valueClass: 'text-violet-50',
          iconClass: 'text-violet-300/70 hover:text-violet-200',
          barClass: 'bg-violet-300',
          tooltip: <PrideSystemTooltip />,
        },
        {
          key: 'dissent',
          label: 'Dissent',
          value: playerStats.dissentPercentage,
          shellClass: 'border-rose-400/25 bg-rose-500/10',
          labelClass: 'text-rose-200/90',
          valueClass: 'text-rose-50',
          iconClass: 'text-rose-300/70 hover:text-rose-200',
          barClass: 'bg-rose-300',
          tooltip: <DissentSystemTooltip />,
        },
      ] as const;

      return (
        <div className="space-y-2 rounded-xl border border-amber-500/20 bg-slate-950/35 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <div className="grid grid-cols-3 gap-2">
            {statCards.map((card) => (
              <div key={card.key} className={clsx('rounded-xl border px-2.5 py-2', card.shellClass)}>
                <div className="flex items-center justify-between gap-1">
                  <span className={clsx('text-[10px] uppercase tracking-[0.22em]', card.labelClass)}>{card.label}</span>
                  <InfoTooltip content={card.tooltip} ariaLabel={`How ${card.label.toLowerCase()} works`}>
                    <Info className={clsx('h-3 w-3 cursor-help transition-colors', card.iconClass)} />
                  </InfoTooltip>
                </div>

                <div className="mt-2 text-center">
                  <div className={clsx('text-lg font-semibold leading-none', card.valueClass)}>{card.value}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-amber-100/45">of 100</div>
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/25">
                  <div className={clsx('h-full rounded-full transition-all', card.barClass)} style={{ width: `${card.value}%` }} />
                </div>
              </div>
            ))}
          </div>

          {(testimonyPressureLastTurn.unitsAffected > 0 || intimidationAuraLastTurn.unitsAffected > 0) && (
            <div className="flex flex-wrap gap-2 text-[11px]">
              {testimonyPressureLastTurn.unitsAffected > 0 && testimonyPressureLastTurn.attackPenalty > 0 && (
                <div className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-1 text-sky-100">
                  Testimony pressure: {testimonyPressureLastTurn.unitsAffected} unit(s), -
                  {testimonyPressureLastTurn.attackPenalty} attack
                </div>
              )}
              {intimidationAuraLastTurn.unitsAffected > 0 && intimidationAuraLastTurn.attackPenalty > 0 && (
                <div className="rounded-full border border-rose-400/20 bg-rose-500/10 px-2.5 py-1 text-rose-100">
                  Intimidation aura: {intimidationAuraLastTurn.unitsAffected} unit(s), -
                  {intimidationAuraLastTurn.attackPenalty} attack
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span className="flex items-center gap-1 font-cinzel font-medium text-blue-300">
              Faith
              <InfoTooltip content={<FaithSystemTooltip />} ariaLabel="How faith works">
                <Info className="h-3 w-3 cursor-help text-blue-400/60 transition-colors hover:text-blue-400" />
              </InfoTooltip>
            </span>
            <span className="font-body font-medium text-amber-100">{playerStats.faithPercentage}/100</span>
          </div>
          <Progress value={playerStats.faithPercentage} className="h-2" />
          {testimonyPressureLastTurn.unitsAffected > 0 && testimonyPressureLastTurn.attackPenalty > 0 && (
            <div className="mt-1 text-xs font-body text-blue-200/70">
              Testimony pressure: {testimonyPressureLastTurn.unitsAffected} unit(s) -
              {testimonyPressureLastTurn.attackPenalty} attack ({testimonyPressureLastTurn.durationTurns} turn)
            </div>
          )}
        </div>

        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span className="flex items-center gap-1 font-cinzel font-medium text-purple-300">
              Pride
              <InfoTooltip content={<PrideSystemTooltip />} ariaLabel="How pride works">
                <Info className="h-3 w-3 cursor-help text-purple-400/60 transition-colors hover:text-purple-400" />
              </InfoTooltip>
            </span>
            <span className="font-body font-medium text-amber-100">{playerStats.pridePercentage}/100</span>
          </div>
          <Progress value={playerStats.pridePercentage} className="h-2" />
        </div>

        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span className="flex items-center gap-1 font-cinzel font-medium text-red-300">
              Dissent
              <InfoTooltip content={<DissentSystemTooltip />} ariaLabel="How dissent works">
                <Info className="h-3 w-3 cursor-help text-red-400/60 transition-colors hover:text-red-400" />
              </InfoTooltip>
            </span>
            <span className="font-body font-medium text-amber-100">{playerStats.dissentPercentage}/100</span>
          </div>
          <Progress value={playerStats.dissentPercentage} className="h-2" />
          {intimidationAuraLastTurn.unitsAffected > 0 && intimidationAuraLastTurn.attackPenalty > 0 && (
            <div className="mt-1 text-xs font-body text-red-200/70">
              Intimidation aura: {intimidationAuraLastTurn.unitsAffected} unit(s) -
              {intimidationAuraLastTurn.attackPenalty} attack ({intimidationAuraLastTurn.durationTurns} turn)
            </div>
          )}
        </div>
      </div>
    );
  },
);

const VictoryProgressSection = React.memo(
  ({
    player,
    gameState,
    playerStats,
    isOpen,
    onToggle,
    onStartFaithProject,
    compact = false,
  }: {
    player: PlayerState;
    gameState: GameState;
    playerStats: PlayerStats;
    isOpen: boolean;
    onToggle: (open: boolean) => void;
    onStartFaithProject: (holyCityIds: [string, string, string]) => void;
    compact?: boolean;
  }) => {
    const playerCount = gameState.players.length;
    const economicTargets = GameRuleHelpers.getEconomicVictoryThresholds(playerCount);
    const culturalTargets = GameRuleHelpers.getCulturalVictoryThresholds(playerCount);
    const faithVictory = GAME_RULES.victory.faithVictory;
    const totalTechs = Object.keys(TECHNOLOGIES).length || 1;
    const techPercent = Math.round((player.researchedTechs.length / totalTechs) * 100);

    const ownedCities = (gameState.cities || []).filter((city) => city.ownerId === player.id);
    const population = ownedCities.reduce((sum, city) => sum + (city.population || 0), 0);
    const activeFaithProject = getActiveFaithProject(player);

    const culturalStructureCount =
      (gameState.structures || []).filter(
        (structure) =>
          structure.ownerId === player.id &&
          structure.constructionTurns === 0 &&
          culturalTargets.structureTypes.includes(structure.type),
      ).length +
      (gameState.improvements || []).filter(
        (improvement) =>
          improvement.ownerId === player.id &&
          improvement.constructionTurns === 0 &&
          culturalTargets.improvementTypes.includes(improvement.type),
      ).length;

    const totalOwnedCities = gameState.players.reduce((sum, currentPlayer) => sum + currentPlayer.citiesOwned.length, 0);
    const territoryPercent = totalOwnedCities > 0
      ? Math.round((player.citiesOwned.length / totalOwnedCities) * 100)
      : 0;
    const territoryTarget = Math.round(GAME_RULES.victory.territoryControlThreshold * 100);
    const maxTurns = GAME_RULES.turns.maxTurnsPerGame;
    const turnLabel = maxTurns > 0 ? `${gameState.turn}/${maxTurns}` : `${gameState.turn}/no cap`;

    const faithTileDetail = activeFaithProject
      ? activeFaithProject.pausedReason
        ? `Paused: ${activeFaithProject.pausedReason}`
        : `Pay ${faithVictory.faithCostPerProgress} Faith and ${faithVictory.starsCostPerProgress} Stars at your turn end.`
      : `Start on turn ${faithVictory.minTurnToStart}+ with ${faithVictory.minFaithToStart} Faith, Dissent ${faithVictory.maxDissentToStart} or lower, and 3 Temple cities.`;

    const summaryTiles = [
      ...(faithVictory.enabled
        ? [{
            key: 'faithProject',
            label: 'Consecration',
            value: activeFaithProject
              ? `${activeFaithProject.progress}/${faithVictory.progressToWin}`
              : `${player.stats.faith}/${faithVictory.minFaithToStart}`,
            tone: 'border-sky-400/20 bg-sky-500/10 text-sky-50',
            detail: faithTileDetail,
          }]
        : []),
      {
        key: 'economy',
        label: 'Income',
        value: `+${playerStats.starProduction}/${economicTargets.income}`,
        tone: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-50',
        detail: `Treasury ${player.stars}/${economicTargets.treasury} and research ${techPercent}%/${Math.round(
          economicTargets.techPercent * 100,
        )}% are also required.`,
      },
      {
        key: 'population',
        label: 'Population',
        value: `${population}/${culturalTargets.population}`,
        tone: 'border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-50',
        detail: `Culture path also needs ${culturalStructureCount}/${culturalTargets.structures} sites and Dissent at ${culturalTargets.dissentMax} or lower.`,
      },
      {
        key: 'territory',
        label: 'Territory',
        value: `${territoryPercent}%/${territoryTarget}%`,
        tone: 'border-amber-400/20 bg-amber-500/10 text-amber-50',
        detail: `You currently control ${player.citiesOwned.length} of ${Math.max(totalOwnedCities, 1)} occupied cities.`,
      },
    ] as const;

    return (
      <Collapsible open={isOpen} onOpenChange={onToggle} className="space-y-2">
        <div className="flex items-start gap-2">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className={clsx(
                'flex-1 rounded-xl border border-amber-500/20 bg-slate-900/40 text-left transition-colors hover:bg-slate-800/50',
                compact ? 'px-3 py-3' : 'px-3 py-2',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-cinzel font-semibold text-amber-100">
                  <Trophy className="h-4 w-4 text-amber-400" />
                  <span className={clsx(compact && 'whitespace-nowrap text-[0.95rem] leading-none')}>
                    {compact ? 'Victory Paths' : 'Victory'}
                  </span>
                  <InfoTooltip
                    ariaLabel="Victory conditions"
                    content={
                      <div className="space-y-1 text-xs">
                        {faithVictory.enabled && (
                          <div>Consecration: sustain a 3-turn Faith Project through 3 Temple cities.</div>
                        )}
                        <div>Economic: income + treasury + tech percent.</div>
                        <div>Cultural: population + cultural sites + low dissent.</div>
                        <div>Territory: share of owned cities.</div>
                      </div>
                    }
                  >
                    <Info
                      className="h-3 w-3 cursor-help text-amber-400/60 transition-colors hover:text-amber-400"
                      onClick={(event) => event.stopPropagation()}
                    />
                  </InfoTooltip>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-amber-500/15 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200/80">
                    Turn {turnLabel}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="h-3 w-3 text-amber-300" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-amber-300" />
                  )}
                </div>
              </div>

              {compact ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {summaryTiles.map((tile) => (
                    <div key={tile.key} className={clsx('rounded-lg border px-2.5 py-2', tile.tone)}>
                      <div className="text-[10px] uppercase tracking-[0.22em] text-white/70">{tile.label}</div>
                      <div className="mt-1 text-sm font-semibold">{tile.value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-body text-amber-200/80">
                  {summaryTiles.map((tile) => (
                    <span key={tile.key} className="flex items-center gap-1">
                      <span className="text-amber-300/80">{tile.label}</span>
                      <span>{tile.value}</span>
                    </span>
                  ))}
                </div>
              )}
            </button>
          </CollapsibleTrigger>

          <TutorialHelpIcon
            cardId="victory"
            label="Open victory tutorial"
            className={compact ? 'mt-1 h-8 w-8' : 'mt-1 h-8 w-8'}
            iconClassName="h-4 w-4"
          />
        </div>

        <CollapsibleContent>
          <div className={clsx(compact ? 'grid gap-2' : 'grid grid-cols-2 gap-2', 'text-xs font-body')}>
            {summaryTiles.map((tile) => (
              <div key={tile.key} className="rounded-lg border border-amber-500/15 bg-slate-950/35 px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.22em] text-amber-200/75">{tile.label}</div>
                <div className="mt-1 text-sm font-semibold text-amber-100">{tile.value}</div>
                <div className="mt-1 leading-relaxed text-amber-100/70">{tile.detail}</div>
              </div>
            ))}
          </div>

          <FaithProjectPanel
            player={player}
            gameState={gameState}
            onStartFaithProject={onStartFaithProject}
          />
        </CollapsibleContent>
      </Collapsible>
    );
  },
);

const ActionButtonsSection = React.memo(
  ({
    onShowTechPanel,
    onShowConstructionHall,
    onShowDiplomacy,
    onToggleGameLog,
    gameLogEntryCount = 0,
    isGameLogOpen = false,
    onEndTurn,
    compact = false,
  }: {
    onShowTechPanel: () => void;
    onShowConstructionHall: () => void;
    onShowDiplomacy: () => void;
    onToggleGameLog?: () => void;
    gameLogEntryCount?: number;
    isGameLogOpen?: boolean;
    onEndTurn: () => void;
    compact?: boolean;
  }) => {
    if (compact) {
      const compactButtonClass =
        'min-h-[44px] justify-center px-3 py-2 text-xs';

      return (
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <GlowingButton
              variant="outline"
              size="sm"
              glowColor="blue"
              intensity="medium"
              data-testid="hud-knowledge-button"
              className={clsx(
                compactButtonClass,
                'w-full border-blue-400/60 bg-gradient-to-r from-blue-600/20 to-blue-700/20 text-blue-100',
              )}
              onClick={onShowTechPanel}
              soundEffect="cta-click"
            >
              <Book className="h-4 w-4 flex-shrink-0" />
              <span className="ml-2">Knowledge</span>
            </GlowingButton>

            <GlowingButton
              variant="outline"
              size="sm"
              glowColor="amber"
              intensity="medium"
              className={clsx(
                compactButtonClass,
                'w-full border-amber-400/60 bg-gradient-to-r from-amber-600/20 to-amber-700/20 text-amber-100',
              )}
              onClick={onShowConstructionHall}
              soundEffect="cta-click"
            >
              <Hammer className="h-4 w-4 flex-shrink-0" />
              <span className="ml-2">Build</span>
            </GlowingButton>

            <GlowingButton
              variant="outline"
              size="sm"
              glowColor="purple"
              intensity="medium"
              className={clsx(
                compactButtonClass,
                'w-full border-purple-400/60 bg-gradient-to-r from-purple-600/20 to-purple-700/20 text-purple-100',
              )}
              onClick={onShowDiplomacy}
              soundEffect="cta-click"
            >
              <span className="mr-2 text-base">🤝</span>
              <span>Diplomacy</span>
            </GlowingButton>

            <GlowingButton
              variant="outline"
              size="sm"
              glowColor="amber"
              intensity="medium"
              data-testid="hud-game-log-button"
              className={clsx(
                compactButtonClass,
                'w-full border-stone-500/50 bg-gradient-to-r from-stone-800/80 to-slate-800/70 text-stone-100',
                isGameLogOpen && 'border-amber-400/60 text-amber-100',
              )}
              onClick={onToggleGameLog}
              soundEffect="cta-click"
            >
              <ScrollText className="h-4 w-4 flex-shrink-0 text-amber-300" />
              <span className="ml-2">Game Log</span>
              {gameLogEntryCount > 0 && (
                <span className="ml-2 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-200">
                  {gameLogEntryCount}
                </span>
              )}
            </GlowingButton>
          </div>

          <div className="flex items-center gap-2">
            <GlowingButton
              variant="default"
              size="sm"
              glowColor="green"
              intensity="high"
              data-testid="hud-end-turn-button"
              className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-sm font-semibold text-white border border-green-400/60 hover:from-green-500 hover:to-green-600"
              onClick={onEndTurn}
              soundEffect="cta-click"
            >
              End Turn
            </GlowingButton>
            <TutorialHelpIcon
              cardId="end-turn"
              label="Open turn flow tutorial"
              className="h-10 w-10 shrink-0"
              iconClassName="h-4 w-4"
            />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2 pt-2">
        <div className="grid grid-cols-2 gap-2">
          <GlowingButton
            variant="outline"
            size="sm"
            glowColor="blue"
            intensity="medium"
            data-testid="hud-knowledge-button"
            className="w-full min-h-[48px] justify-center bg-gradient-to-r from-blue-600/20 to-blue-700/20 px-4 py-3 text-xs text-blue-100 border-blue-400/60"
            onClick={onShowTechPanel}
            soundEffect="cta-click"
          >
            <Book className="h-4 w-4 flex-shrink-0" />
            <span className="ml-2">Knowledge</span>
          </GlowingButton>

          <GlowingButton
            variant="outline"
            size="sm"
            glowColor="amber"
            intensity="medium"
            className="w-full min-h-[48px] justify-center bg-gradient-to-r from-amber-600/20 to-amber-700/20 px-4 py-3 text-xs text-amber-100 border-amber-400/60"
            onClick={onShowConstructionHall}
            soundEffect="cta-click"
          >
            <Hammer className="h-4 w-4 flex-shrink-0" />
            <span className="ml-2">Build</span>
          </GlowingButton>
        </div>

        <GlowingButton
          variant="outline"
          size="sm"
          glowColor="purple"
          intensity="medium"
          className="w-full min-h-[48px] justify-center bg-gradient-to-r from-purple-600/20 to-purple-700/20 px-4 py-3 text-xs text-purple-100 border-purple-400/60"
          onClick={onShowDiplomacy}
          soundEffect="cta-click"
        >
          <span className="mr-2 text-base">🤝</span>
          <span>Diplomacy</span>
        </GlowingButton>

        <div className="flex items-center gap-2">
          <GlowingButton
            variant="default"
            size="sm"
            glowColor="green"
            intensity="high"
            data-testid="hud-end-turn-button"
            className="flex-1 border border-green-400/60 bg-gradient-to-r from-green-600 to-green-700 text-sm font-semibold text-white hover:from-green-500 hover:to-green-600"
            onClick={onEndTurn}
            soundEffect="cta-click"
          >
            End Turn
          </GlowingButton>
          <TutorialHelpIcon
            cardId="end-turn"
            label="Open turn flow tutorial"
            className="h-9 w-9"
            iconClassName="h-4 w-4"
          />
        </div>
      </div>
    );
  },
);

// Tooltip content components are centralized in `client/src/components/ui/TooltipSystem.tsx`
