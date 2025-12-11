// app/components/world/WorldElementPanel.tsx
import React, { Fragment, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

import { Button } from './button';
import { Badge } from './badge';
import { Separator } from './separator';
import { HexCoordinate } from '../../../../shared/types/coordinates';
import { getWorldElement } from '../../../../shared/data/worldElements';
import { canExecuteElementAction } from '../../../../shared/logic/worldElementActions';
import { GameState } from '../../../../shared/types/game';

import { TOKENS } from '../../theme/tokens';          // central colour tokens
import { useHotkeys } from '../../hooks/useHotkeys'; // tiny custom hook
import { useSfx } from '../../hooks/useSfx';         // optional SFX hook

interface WorldElementPanelProps {
  gameState: GameState;
  playerId: string;
  elementId: string;
  coordinate: HexCoordinate;
  onAction: (actionType: 'harvest' | 'build') => void;
  onClose: () => void;
}

export function WorldElementPanel({
  gameState,
  playerId,
  elementId,
  coordinate,
  onAction,
  onClose
}: WorldElementPanelProps) {
  const element = getWorldElement(elementId);
  const player = gameState.players.find(p => p.id === playerId);
  
  if (!element || !player) return null;

  const harvestCheck = canExecuteElementAction(gameState, playerId, elementId, 'harvest');
  const buildCheck = canExecuteElementAction(gameState, playerId, elementId, 'build');

  const renderResourceDelta = (value: number, type: 'stars' | 'faith' | 'pride' | 'dissent') => {
    if (value === 0) return null;
    
    const config = {
      stars: {
        color: 'text-yellow-300',
        bgColor: 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20',
        borderColor: 'border-yellow-400/40',
        glowColor: 'shadow-yellow-400/25',
        icon: '✦',
        name: 'Stars'
      },
      faith: {
        color: 'text-blue-300',
        bgColor: 'bg-gradient-to-r from-blue-500/20 to-sky-500/20', 
        borderColor: 'border-blue-400/40',
        glowColor: 'shadow-blue-400/25',
        icon: '✠',
        name: 'Faith'
      },
      pride: {
        color: 'text-red-300',
        bgColor: 'bg-gradient-to-r from-red-500/20 to-rose-500/20',
        borderColor: 'border-red-400/40', 
        glowColor: 'shadow-red-400/25',
        icon: '⚔',
        name: 'Pride'
      },
      dissent: {
        color: 'text-orange-300',
        bgColor: 'bg-gradient-to-r from-orange-500/20 to-amber-600/20',
        borderColor: 'border-orange-400/40',
        glowColor: 'shadow-orange-400/25',
        icon: '⚡',
        name: 'Dissent'
      }
    };
    
    const style = config[type];
    const isPositive = value > 0;
    const displayValue = isPositive ? `+${value}` : `${value}`;
    
    return (
      <div 
        className={`
          inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200 
          md:hover:scale-105 md:hover:shadow-lg group relative cursor-default
          ${style.bgColor} ${style.borderColor} ${style.glowColor} shadow-sm
        `}
        title={`${displayValue} ${style.name}`}
        role="tooltip"
        aria-label={`${isPositive ? 'Gain' : 'Loss'} of ${Math.abs(value)} ${style.name}`}
      >
        <div className={`
          w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold
          ${style.color} bg-black/20 border ${style.borderColor}
          md:group-hover:animate-pulse flex-shrink-0
        `}>
          {style.icon}
        </div>
        <div className="flex flex-col min-w-0">
          <span className={`${style.color} font-bold text-sm leading-none`}>
            {displayValue}
          </span>
          <span className="text-amber-200/60 text-xs leading-none truncate">
            {style.name}
          </span>
        </div>
        
        {/* Subtle glow effect on hover - desktop only */}
        <div className={`
          absolute inset-0 rounded-lg opacity-0 md:group-hover:opacity-30 transition-opacity duration-300
          ${style.bgColor} blur-sm -z-10 pointer-events-none
        `} />
      </div>
    );
  };

  return (
    <Card className="w-96 max-w-[95vw] bg-gradient-to-br from-stone-900/98 to-stone-800/95 border-amber-600/40 text-amber-100 shadow-2xl shadow-black/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-amber-200 font-cinzel text-lg">
              {element.displayName}
            </CardTitle>
            <CardDescription className="text-amber-300/80 text-sm">
              {element.scriptureRef}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="text-amber-300 md:hover:text-amber-100 md:hover:bg-amber-600/20 rounded-full w-10 h-10 min-h-[44px] min-w-[44px] p-0 transition-all duration-200 md:hover:scale-110 bg-amber-600/10 border border-amber-600/30 active:scale-95 touch-manipulation"
          >
            <span className="text-lg font-bold">×</span>
          </Button>
        </div>
        <p className="text-amber-200/90 text-sm leading-relaxed">
          {element.description}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Immediate Action (Harvest/Exploit) */}
        {element.immediateAction && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="bg-gradient-to-r from-red-900/60 to-red-800/50 text-red-200 border border-red-600/30 shadow-sm">
                ⚡ Immediate
              </Badge>
              <h3 className="font-semibold text-amber-200">
                {element.immediateAction.name}
              </h3>
            </div>
            
            <div className="bg-stone-800/50 p-3 rounded-lg">
              <p className="text-amber-100/80 text-sm mb-2">
                {element.uiTooltipHarvest}
              </p>
              
              <div className="flex flex-wrap gap-3 mb-4">
                {renderResourceDelta(element.immediateAction.starsDelta, 'stars')}
                {renderResourceDelta(element.immediateAction.faithDelta, 'faith')}
                {renderResourceDelta(element.immediateAction.prideDelta, 'pride')}
                {renderResourceDelta(element.immediateAction.dissentDelta, 'dissent')}
              </div>
              
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onAction('harvest');
                }}
                disabled={!harvestCheck.canExecute}
                className="w-full bg-gradient-to-r from-red-800 to-red-700 md:hover:from-red-700 md:hover:to-red-600 text-white font-semibold py-4 min-h-[44px] transition-all duration-200 md:hover:shadow-lg md:hover:shadow-red-500/25 disabled:opacity-50 disabled:cursor-not-allowed border border-red-600/30 shadow-lg active:scale-95 touch-manipulation"
                size="sm"
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg">⚔</span>
                  <span>
                    {harvestCheck.canExecute ? element.immediateAction.name : harvestCheck.reason}
                  </span>
                </div>
              </Button>
            </div>
          </div>
        )}

        {element.immediateAction && element.longTermBuild && (
          <Separator className="bg-amber-600/30" />
        )}

        {/* Long-term Action (Build/Stewardship) */}
        {element.longTermBuild && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-gradient-to-r from-blue-900/60 to-blue-800/50 text-blue-200 border border-blue-600/30 shadow-sm">
                🏗 Long-term
              </Badge>
              <h3 className="font-semibold text-amber-200">
                Build {element.longTermBuild.name}
              </h3>
            </div>
            
            <div className="bg-stone-800/50 p-4 rounded-lg border border-stone-700/50">
              <p className="text-amber-100/80 text-sm mb-4 leading-relaxed">
                {element.uiTooltipBuild}
              </p>
              
              {/* Cost Section */}
              <div className="bg-stone-900/50 p-3 rounded-md border border-amber-600/20 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-amber-200 font-medium text-sm">Construction Cost:</span>
                  <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-yellow-500/10 border border-yellow-400/30">
                    <div className="w-4 h-4 rounded-full bg-yellow-400/20 border border-yellow-400/40 flex items-center justify-center">
                      <span className="text-yellow-300 text-xs font-bold">✦</span>
                    </div>
                    <span className="text-yellow-300 font-bold text-sm">
                      {element.longTermBuild.costStars}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Benefits Grid */}
              <div className="space-y-3 mb-4">
                <h4 className="text-amber-200 font-medium text-sm">Immediate Effects:</h4>
                <div className="flex flex-wrap gap-3">
                  {renderResourceDelta(element.longTermBuild.faithDelta, 'faith')}
                  {renderResourceDelta(element.longTermBuild.prideDelta, 'pride')}
                  {renderResourceDelta(element.longTermBuild.dissentDelta, 'dissent')}
                </div>
                
                {(element.longTermBuild.effectPermanent.popDelta > 0 || element.longTermBuild.effectPermanent.starsPerTurn > 0) && (
                  <>
                    <h4 className="text-amber-200 font-medium text-sm mt-4">Permanent Benefits:</h4>
                    <div className="flex flex-col gap-3">
                      {element.longTermBuild.effectPermanent.popDelta > 0 && (
                        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200 md:hover:scale-105 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-400/40 shadow-sm">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold text-green-300 bg-black/20 border border-green-400/40">
                            👥
                          </div>
                          <div className="flex flex-col">
                            <span className="text-green-300 font-bold text-sm leading-none">
                              +{element.longTermBuild.effectPermanent.popDelta}
                            </span>
                            <span className="text-amber-200/60 text-xs leading-none">
                              Population
                            </span>
                          </div>
                        </div>
                      )}
                      {element.longTermBuild.effectPermanent.starsPerTurn > 0 && (
                        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200 md:hover:scale-105 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-400/40 shadow-sm">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold text-yellow-300 bg-black/20 border border-yellow-400/40">
                            🔄
                          </div>
                          <div className="flex flex-col">
                            <span className="text-yellow-300 font-bold text-sm leading-none">
                              +{element.longTermBuild.effectPermanent.starsPerTurn}/turn
                            </span>
                            <span className="text-amber-200/60 text-xs leading-none">
                              Income
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onAction('build');
                }}
                disabled={!buildCheck.canExecute}
                className="w-full bg-gradient-to-r from-blue-800 to-blue-700 md:hover:from-blue-700 md:hover:to-blue-600 text-white font-semibold py-4 min-h-[44px] transition-all duration-200 md:hover:shadow-lg md:hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed border border-blue-600/30 shadow-lg active:scale-95 touch-manipulation"
                size="sm"
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg">🏗</span>
                  <span>
                    {buildCheck.canExecute ? `Build ${element.longTermBuild.name}` : buildCheck.reason}
                  </span>
                </div>
              </Button>
            </div>
          </div>
        )}

        {/* Enhanced Moral Choice Indicator */}
        <div className="bg-gradient-to-r from-amber-900/30 to-amber-800/20 p-4 rounded-lg border border-amber-600/40 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-amber-400/5 animate-pulse" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center">
                <span className="text-amber-300 text-xs font-bold">⚖</span>
              </div>
              <h4 className="text-amber-200 font-semibold text-sm">Moral Consequence</h4>
            </div>
            <p className="text-amber-100/90 text-xs leading-relaxed">
              {element.immediateAction && element.immediateAction.prideDelta > 0
                ? "⚔ Immediate exploitation increases Pride and Dissent, risking spiritual consequence."
                : ""}
              {element.longTermBuild && element.longTermBuild.faithDelta > 0
                ? " ✠ Patient stewardship builds Faith and strengthens your covenant path."
                : ""}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}