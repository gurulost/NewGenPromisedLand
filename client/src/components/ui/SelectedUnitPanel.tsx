import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Progress } from "./progress";
import { Button } from "./button";
import { Badge } from "./badge";
import { Separator } from "./separator";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { useGameState } from "../../lib/stores/useGameState";
import { getUnitDefinition } from "@shared/data/units";
import { getActionAvailability, getDetailedActionFeedback } from "../../lib/helpers/actionAvailabilityHelpers";
import type { Unit } from "@shared/types/unit";
import {
  Sparkles, Move, Settings, Swords
} from "lucide-react";
import UnitActionsPanel from "./AbilitiesPanel";

interface SelectedUnitPanelProps {
  unit: Unit;
}

export default function SelectedUnitPanel({ unit }: SelectedUnitPanelProps) {
  const { gameState } = useLocalGame();
  const [showActionsPanel, setShowActionsPanel] = useState(false);

  // Memoize unit definition lookup and calculated stats
  const unitStats = useMemo(() => {
    const unitDef = getUnitDefinition(unit.type);
    return {
      definition: unitDef,
      hpPercentage: (unit.hp / unitDef.baseStats.hp) * 100,
      movementDisplay: `${unit.remainingMovement}/${unitDef.baseStats.movement}`,
      isWounded: unit.hp < unitDef.baseStats.hp,
      isFullMovement: unit.remainingMovement === unitDef.baseStats.movement
    };
  }, [unit.type, unit.hp, unit.remainingMovement, unit.movement]);

  // Memoize action availability to determine button states
  const actionAvailability = useMemo(() => {
    if (!gameState) return {
      canMove: false, canAttack: false, hasAbilities: false,
      reachableTilesCount: 0, attackTargetsCount: 0, isPlayerTurn: false,
      movementReason: "", attackReason: "", abilityReason: ""
    };

    return getActionAvailability(unit, gameState);
  }, [gameState, unit]);

  return (
    <div className="absolute bottom-4 left-4 pointer-events-auto">
      <Card className="w-64 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-amber-500/30 shadow-2xl shadow-amber-500/20">
        <CardHeader className="pb-2 px-4 bg-gradient-to-r from-amber-900/20 to-amber-800/20 border-b border-amber-500/20">
          <CardTitle className="text-amber-100 font-cinzel font-semibold tracking-wide text-center">{unitStats.definition.name}</CardTitle>
          <div className="text-xs text-amber-300/70 font-normal text-center truncate">— Chosen Warrior of the Promised Land —</div>
        </CardHeader>
        <CardContent className="space-y-2 bg-slate-900/40">
          <div className="text-sm text-amber-200/90 font-body bg-amber-900/10 rounded p-2 border border-amber-500/20">
            {unitStats.definition.description}
          </div>

          {/* Unit HP */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-red-300 font-cinzel font-medium">Health</span>
              <span className="text-amber-100 font-body font-medium">{unit.hp}/{unitStats.definition.baseStats.hp}</span>
            </div>
            <Progress
              value={unitStats.hpPercentage}
              className="h-2"
            />
          </div>

          {/* Unit Stats - Clean grid layout */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm font-body">
            <div className="flex justify-between items-center">
              <span className="text-amber-300/70">Attack:</span>
              <span className="text-amber-100 font-medium">{unit.attack}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-amber-300/70">Defense:</span>
              <span className="text-amber-100 font-medium">{unit.defense}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-amber-300/70">Movement:</span>
              <span className="text-amber-100 font-medium">{unitStats.movementDisplay}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-amber-300/70">Vision:</span>
              <span className="text-amber-100 font-medium">{unit.visionRadius ?? unitStats.definition.baseStats.visionRadius ?? 2}</span>
            </div>
          </div>

          {/* Unit Position */}
          <div className="text-xs text-amber-300/50 font-body">
            Position: ({unit.coordinate.q}, {unit.coordinate.r})
          </div>

          {/* Unit Upgrades - Show if any upgrades exist */}
          {unit.upgrades && (unit.upgrades.attack || unit.upgrades.defense || unit.upgrades.movement || unit.upgrades.vision) ? (
            <div className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 rounded-lg p-2 border border-cyan-500/30">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-cinzel text-cyan-300 font-medium flex items-center gap-1">
                  ⭐ Upgrades
                </span>
                <span className="text-xs text-cyan-200 font-bold">
                  +{(unit.upgrades.attack || 0) + (unit.upgrades.defense || 0) + (unit.upgrades.movement || 0) + (unit.upgrades.vision || 0)} total
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                {unit.upgrades.attack ? (
                  <div className="flex justify-between">
                    <span className="text-red-300/70">Attack:</span>
                    <span className="text-red-200">+{unit.upgrades.attack}</span>
                  </div>
                ) : null}
                {unit.upgrades.defense ? (
                  <div className="flex justify-between">
                    <span className="text-blue-300/70">Defense:</span>
                    <span className="text-blue-200">+{unit.upgrades.defense}</span>
                  </div>
                ) : null}
                {unit.upgrades.movement ? (
                  <div className="flex justify-between">
                    <span className="text-green-300/70">Movement:</span>
                    <span className="text-green-200">+{unit.upgrades.movement}</span>
                  </div>
                ) : null}
                {unit.upgrades.vision ? (
                  <div className="flex justify-between">
                    <span className="text-yellow-300/70">Vision:</span>
                    <span className="text-yellow-200">+{unit.upgrades.vision}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <Separator className="bg-amber-500/30" />

          {/* Unit Abilities */}
          {unitStats.definition.abilities.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-amber-100 mb-2 font-cinzel">Abilities</h4>
              <div className="flex flex-wrap gap-1">
                {unitStats.definition.abilities.map((ability) => (
                  <Badge key={ability} variant="outline" className="text-xs text-amber-300 border-amber-500/50 bg-amber-900/20">
                    {ability.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Passive Effects (SSOT from unit definition) */}
          {unitStats.definition.passiveEffects && (
            <div className="bg-amber-900/10 rounded p-2 border border-amber-500/20">
              <h4 className="text-sm font-semibold text-amber-100 mb-1 font-cinzel">Per Turn</h4>
              <div className="text-xs text-amber-200/90 space-y-1 font-body">
                {unitStats.definition.passiveEffects.perTurn?.stars ? (
                  <div>{unitStats.definition.passiveEffects.perTurn.stars > 0 ? '+' : ''}{unitStats.definition.passiveEffects.perTurn.stars}★</div>
                ) : null}
                {unitStats.definition.passiveEffects.perTurn?.faith ? (
                  <div>{unitStats.definition.passiveEffects.perTurn.faith > 0 ? '+' : ''}{unitStats.definition.passiveEffects.perTurn.faith} Faith</div>
                ) : null}
                {unitStats.definition.passiveEffects.perTurn?.pride ? (
                  <div>{unitStats.definition.passiveEffects.perTurn.pride > 0 ? '+' : ''}{unitStats.definition.passiveEffects.perTurn.pride} Pride</div>
                ) : null}
                {unitStats.definition.passiveEffects.perTurn?.dissent ? (
                  <div>{unitStats.definition.passiveEffects.perTurn.dissent > 0 ? '+' : ''}{unitStats.definition.passiveEffects.perTurn.dissent} Dissent</div>
                ) : null}
                {(unitStats.definition.passiveEffects.perTurnWhen || []).map((cond, idx) => {
                  const statLabel = cond.stat === 'internalDissent' ? 'Dissent' : (cond.stat.charAt(0).toUpperCase() + cond.stat.slice(1));
                  const condition = typeof cond.gte === 'number'
                    ? `${statLabel} ≥ ${cond.gte}`
                    : typeof cond.lte === 'number'
                      ? `${statLabel} ≤ ${cond.lte}`
                      : statLabel;
                  const perTurn = cond?.perTurn ?? {};
                  const parts: string[] = [];
                  if (perTurn.stars) parts.push(`${perTurn.stars > 0 ? '+' : ''}${perTurn.stars}★`);
                  if (perTurn.faith) parts.push(`${perTurn.faith > 0 ? '+' : ''}${perTurn.faith} Faith`);
                  if (perTurn.pride) parts.push(`${perTurn.pride > 0 ? '+' : ''}${perTurn.pride} Pride`);
                  if (perTurn.dissent) parts.push(`${perTurn.dissent > 0 ? '+' : ''}${perTurn.dissent} Dissent`);
                  if (parts.length === 0) return null;
                  return <div key={idx}>When {condition}: {parts.join(', ')}</div>;
                })}
                {(() => {
                  const cooldownDeltaPerTurn = unitStats.definition.passiveEffects.diplomacyCooldownDelta?.perTurn;
                  if (!cooldownDeltaPerTurn) return null;

                  const entries = Object.entries(cooldownDeltaPerTurn).filter(
                    (entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] !== 0
                  );
                  if (entries.length === 0) return null;

                  const formatCooldownName = (cooldownKey: string) =>
                    cooldownKey
                      .replace(/_/g, ' ')
                      .replace(/([a-z])([A-Z])/g, '$1 $2')
                      .replace(/^./, (c) => c.toUpperCase());

                  return (
                    <>
                      {entries.map(([cooldownKey, delta]) => (
                        <div key={cooldownKey}>
                          {formatCooldownName(cooldownKey)} cooldown: {delta > 0 ? '+' : ''}{delta}/turn
                        </div>
                      ))}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Unified Actions Button */}
          <div className="space-y-2">
            <Button
              onClick={() => setShowActionsPanel(true)}
              className="w-full min-h-[44px] px-4 bg-gradient-to-r from-purple-600 to-purple-700 md:hover:from-purple-700 md:hover:to-purple-800 active:from-purple-800 active:to-purple-900 text-white shadow-lg shadow-purple-500/25 border border-purple-500/30 transition-all duration-200 active:scale-95 touch-manipulation"
              size="sm"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              View All Actions
            </Button>

            {/* Quick Status Summary - Vertical layout for better readability */}
            <div className="grid grid-cols-3 gap-2 text-xs bg-amber-900/20 rounded-lg p-3 border border-amber-500/20">
              <div className={`flex flex-col items-center gap-1 ${actionAvailability.canMove ? 'text-green-400' : 'text-slate-500'
                }`}>
                <Move className="w-4 h-4" />
                <span className="font-medium">Move</span>
                <span className="text-[10px]">
                  {actionAvailability.canMove ? `${actionAvailability.reachableTilesCount} tiles` : 'None'}
                </span>
              </div>
              <div className={`flex flex-col items-center gap-1 ${actionAvailability.canAttack ? 'text-red-400' : 'text-slate-500'
                }`}>
                <Swords className="w-4 h-4" />
                <span className="font-medium">Attack</span>
                <span className="text-[10px]">
                  {actionAvailability.canAttack ? `${actionAvailability.attackTargetsCount} targets` : 'None'}
                </span>
              </div>
              <div className={`flex flex-col items-center gap-1 ${actionAvailability.hasAbilities ? 'text-purple-400' : 'text-slate-500'
                }`}>
                <Settings className="w-4 h-4" />
                <span className="font-medium">Abilities</span>
                <span className="text-[10px]">
                  {actionAvailability.hasAbilities ? 'Ready' : 'None'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unit Actions Panel */}
      {showActionsPanel && (
        <UnitActionsPanel
          unit={unit}
          onClose={() => setShowActionsPanel(false)}
        />
      )}
    </div>
  );
}
