/**
 * World Element Panel - UI for moral choices on Book of Mormon resources
 * Displays harvest vs build options with faith/pride/dissent consequences
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { HexCoordinate } from '../../../../shared/types/coordinates';
import { getWorldElement } from '../../../../shared/data/worldElements';
import { canExecuteElementAction } from '../../../../shared/logic/worldElementActions';
import { GameState } from '../../../../shared/types/game';

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
    
    const colors = {
      stars: 'text-yellow-400',
      faith: 'text-blue-400',
      pride: 'text-red-400',
      dissent: 'text-orange-400'
    };
    
    const symbols = {
      stars: '★',
      faith: '✝',
      pride: '⚔',
      dissent: '⚡'
    };
    
    return (
      <span className={`${colors[type]} font-semibold`}>
        {value > 0 ? '+' : ''}{value} {symbols[type]}
      </span>
    );
  };

  return (
    <Card className="w-96 bg-stone-900/95 border-amber-600/30 text-amber-100">
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
            onClick={onClose}
            className="text-amber-300 hover:text-amber-100"
          >
            ✕
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
              <Badge variant="destructive" className="bg-red-900/50 text-red-200">
                Immediate
              </Badge>
              <h3 className="font-semibold text-amber-200">
                {element.immediateAction.name}
              </h3>
            </div>
            
            <div className="bg-stone-800/50 p-3 rounded-lg">
              <p className="text-amber-100/80 text-sm mb-2">
                {element.uiTooltipHarvest}
              </p>
              
              <div className="flex flex-wrap gap-2 mb-3">
                {renderResourceDelta(element.immediateAction.starsDelta, 'stars')}
                {renderResourceDelta(element.immediateAction.faithDelta, 'faith')}
                {renderResourceDelta(element.immediateAction.prideDelta, 'pride')}
                {renderResourceDelta(element.immediateAction.dissentDelta, 'dissent')}
              </div>
              
              <Button
                onClick={() => onAction('harvest')}
                disabled={!harvestCheck.canExecute}
                className="w-full bg-red-800 hover:bg-red-700 text-white"
                size="sm"
              >
                {harvestCheck.canExecute ? element.immediateAction.name : harvestCheck.reason}
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
              <Badge variant="secondary" className="bg-blue-900/50 text-blue-200">
                Long-term
              </Badge>
              <h3 className="font-semibold text-amber-200">
                Build {element.longTermBuild.name}
              </h3>
            </div>
            
            <div className="bg-stone-800/50 p-3 rounded-lg">
              <p className="text-amber-100/80 text-sm mb-2">
                {element.uiTooltipBuild}
              </p>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-amber-300">Cost:</span>
                  <span className="text-yellow-400">
                    {element.longTermBuild.costStars} ★
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-3">
                  {renderResourceDelta(element.longTermBuild.faithDelta, 'faith')}
                  {renderResourceDelta(element.longTermBuild.prideDelta, 'pride')}
                  {renderResourceDelta(element.longTermBuild.dissentDelta, 'dissent')}
                  {element.longTermBuild.effectPermanent.popDelta > 0 && (
                    <span className="text-green-400 font-semibold">
                      +{element.longTermBuild.effectPermanent.popDelta} Pop
                    </span>
                  )}
                  {element.longTermBuild.effectPermanent.starsPerTurn > 0 && (
                    <span className="text-yellow-400 font-semibold">
                      +{element.longTermBuild.effectPermanent.starsPerTurn} ★/turn
                    </span>
                  )}
                </div>
              </div>
              
              <Button
                onClick={() => onAction('build')}
                disabled={!buildCheck.canExecute}
                className="w-full bg-blue-800 hover:bg-blue-700 text-white"
                size="sm"
              >
                {buildCheck.canExecute ? `Build ${element.longTermBuild.name}` : buildCheck.reason}
              </Button>
            </div>
          </div>
        )}

        {/* Moral Choice Indicator */}
        <div className="bg-amber-900/20 p-3 rounded-lg border border-amber-600/30">
          <h4 className="text-amber-200 font-semibold text-sm mb-2">Moral Choice</h4>
          <p className="text-amber-100/80 text-xs leading-relaxed">
            {element.immediateAction && element.immediateAction.prideDelta > 0
              ? "Immediate exploitation increases Pride and Dissent, risking spiritual consequence."
              : ""}
            {element.longTermBuild && element.longTermBuild.faithDelta > 0
              ? " Patient stewardship builds Faith and strengthens your covenant path."
              : ""}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}