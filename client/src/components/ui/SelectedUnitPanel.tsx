import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Progress } from "./progress";
import { Button } from "./button";
import { Badge } from "./badge";
import { Separator } from "./separator";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { useGameState } from "../../lib/stores/useGameState";
import { getUnitDefinition } from "@shared/data/units";
import { ABILITIES } from "@shared/data/abilities";
import { getActionAvailability } from "../../lib/helpers/actionAvailabilityHelpers";
import type { Unit } from "@shared/types/unit";
import { 
  Sparkles, Move, Settings, Swords 
} from "lucide-react";
import UnitActionsPanel from "./AbilitiesPanel";
import { InfoTooltip } from "./TooltipSystem";
import { getUnitAbilityStates } from "../../utils/unitAbilityState";

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

  const unitOwner = useMemo(
    () => gameState?.players.find(player => player.id === unit.playerId) ?? null,
    [gameState, unit.playerId]
  );

  const abilityStates = useMemo(() => {
    if (!unitOwner || !gameState) return [];
    return getUnitAbilityStates(unit, unitOwner, gameState);
  }, [unit, unitOwner, gameState]);

  const abilityStateMap = useMemo(() => {
    const entries = abilityStates.map(state => [state.abilityId.toUpperCase(), state] as const);
    return new Map(entries);
  }, [abilityStates]);

  const describeAbilityStatus = (abilityId: string) => {
    const state = abilityStateMap.get(abilityId.toUpperCase());
    if (!state || state.status === 'passive') {
      return {
        label: 'Passive',
        className: 'text-xs text-amber-200 border-amber-500/40 bg-amber-500/10',
        helper: state?.reason,
      };
    }

    switch (state.status) {
      case 'ready':
        return {
          label: 'Ready',
          className: 'text-xs text-emerald-200 border-emerald-500/40 bg-emerald-500/10',
          helper: state.reason,
        };
      case 'exhausted':
        return {
          label: 'Spent',
          className: 'text-xs text-slate-200 border-slate-500/40 bg-slate-800/40',
          helper: state.reason || 'Already acted this turn',
        };
      case 'locked':
      default:
        return {
          label: 'Locked',
          className: 'text-xs text-amber-200 border-amber-500/40 bg-amber-800/30',
          helper: state.reason || 'Requirements not met',
        };
    }
  };

  return (
    <div className="absolute bottom-4 left-4 pointer-events-auto">
      <Card className="w-64 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-amber-500/30 shadow-2xl shadow-amber-500/20">
        <CardHeader className="pb-2 bg-gradient-to-r from-amber-900/20 to-amber-800/20 border-b border-amber-500/20">
          <CardTitle className="text-amber-100 font-cinzel font-semibold tracking-wide">{unitStats.definition.name}</CardTitle>
          <div className="text-xs text-amber-300/70 font-normal">— Chosen Warrior of the Promised Land —</div>
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
          
          {/* Unit Stats */}
          <div className="grid grid-cols-2 gap-2 text-sm font-body">
            <div className="flex justify-between">
              <span className="text-amber-300/70">Attack:</span>
              <span className="text-amber-100">{unit.attack}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-amber-300/70">Defense:</span>
              <span className="text-amber-100">{unit.defense}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-amber-300/70 flex items-center gap-1">
                Movement:
                <InfoTooltip 
                  content={
                    <div className="space-y-2">
                      <div className="font-semibold text-green-300">Movement System</div>
                      <div className="text-xs text-slate-300">
                        Shows remaining movement points this turn.
                      </div>
                      <div className="text-xs space-y-1">
                        <div>• Each tile costs movement points</div>
                        <div>• Different terrain has different costs</div>
                        <div>• Movement resets each turn</div>
                      </div>
                    </div>
                  }
                />
              </span>
              <span className="text-amber-100">{unitStats.movementDisplay}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-amber-300/70">Vision:</span>
              <span className="text-amber-100">{unitStats.definition.baseStats.visionRadius || 2}</span>
            </div>
          </div>
          
          {/* Unit Position */}
          <div className="text-xs text-amber-300/50 font-body">
            Position: ({unit.coordinate.q}, {unit.coordinate.r})
          </div>

          <Separator className="bg-amber-500/30" />

          {/* Unit Abilities */}
          {unitStats.definition.abilities.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-amber-100 mb-2 font-cinzel">Abilities</h4>
              <div className="space-y-2">
                {unitStats.definition.abilities.map((abilityId) => {
                  const abilityKey = abilityId.toUpperCase();
                  const abilityDefinition = ABILITIES[abilityKey];
                  const abilityName = abilityDefinition?.name ?? abilityKey.replace(/_/g, ' ');
                  const abilityState = abilityStateMap.get(abilityKey);
                  const statusInfo = describeAbilityStatus(abilityKey);
                  const description = abilityDefinition?.description || abilityState?.description;
                  return (
                    <div
                      key={abilityKey}
                      className="rounded-xl border border-amber-500/25 bg-amber-900/15 px-3 py-2 text-xs text-amber-100/90 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-amber-100">{abilityName}</span>
                        <Badge
                          variant="outline"
                          className={statusInfo.className}
                        >
                          {statusInfo.label}
                        </Badge>
                      </div>
                      {description && (
                        <p className="text-[11px] leading-relaxed text-amber-200/80">
                          {description}
                        </p>
                      )}
                      {statusInfo.helper && (
                        <p className="text-[10px] text-amber-300/80 italic">
                          {statusInfo.helper}
                        </p>
                      )}
                    </div>
                  );
                })}
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
            
            {/* Enhanced Quick Status Summary with Dynamic Colors */}
            <div className="flex justify-center gap-4 text-xs bg-amber-900/20 rounded-lg p-2 border border-amber-500/20">
              <div className={`flex items-center gap-1 transition-colors duration-200 ${
                actionAvailability.canMove 
                  ? 'text-green-400 font-medium' 
                  : 'text-red-400'
              }`}>
                <Move className={`w-3 h-3 ${actionAvailability.canMove ? 'text-green-400' : 'text-red-400'}`} />
                Move: {actionAvailability.canMove ? `${actionAvailability.reachableTilesCount} tiles` : 'Unavailable'}
              </div>
              <div className={`flex items-center gap-1 transition-colors duration-200 ${
                actionAvailability.canAttack 
                  ? 'text-red-400 font-medium' 
                  : 'text-red-400/50'
              }`}>
                <Swords className={`w-3 h-3 ${actionAvailability.canAttack ? 'text-red-400' : 'text-red-400/50'}`} />
                Attack: {actionAvailability.canAttack ? `${actionAvailability.attackTargetsCount} targets` : 'Unavailable'}
              </div>
              <div className={`flex items-center gap-1 transition-colors duration-200 ${
                actionAvailability.hasAbilities 
                  ? 'text-purple-400 font-medium' 
                  : 'text-purple-400/50'
              }`}>
                <Settings className={`w-3 h-3 ${actionAvailability.hasAbilities ? 'text-purple-400' : 'text-purple-400/50'}`} />
                Abilities: {actionAvailability.hasAbilities ? 'Available' : 'Unavailable'}
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
