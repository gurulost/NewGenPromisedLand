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
  Hammer, Eye, Shield, Heart, Crown, Target, 
  Anchor, Bomb, Sparkles, Move, Settings, Info, Swords 
} from "lucide-react";
import UnitActionsPanel from "./UnitActionsPanel";
import { InfoTooltip } from "./TooltipSystem";

interface SelectedUnitPanelProps {
  unit: Unit;
}

export default function SelectedUnitPanel({ unit }: SelectedUnitPanelProps) {
  const { gameState } = useLocalGame();
  const { setMovementMode, setAttackMode } = useGameState();
  const [showActionsPanel, setShowActionsPanel] = useState(false);
  
  // Memoize unit definition lookup and calculated stats
  const unitStats = useMemo(() => {
    const unitDef = getUnitDefinition(unit.type);
    return {
      definition: unitDef,
      hpPercentage: (unit.hp / unitDef.baseStats.hp) * 100,
      movementDisplay: `${unit.remainingMovement}/${unit.movement}`,
      isWounded: unit.hp < unitDef.baseStats.hp,
      isFullMovement: unit.remainingMovement === unit.movement
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
      <Card className="w-64 bg-black/80 border-white/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-white font-cinzel font-semibold tracking-wide">{unitStats.definition.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-sm text-gray-300 font-body">
            {unitStats.definition.description}
          </div>
          
          {/* Unit HP */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-red-300 font-cinzel font-medium">Health</span>
              <span className="text-white font-body font-medium">{unit.hp}/{unitStats.definition.baseStats.hp}</span>
            </div>
            <Progress 
              value={unitStats.hpPercentage} 
              className="h-2"
            />
          </div>
          
          {/* Unit Stats */}
          <div className="grid grid-cols-2 gap-2 text-sm font-body">
            <div className="flex justify-between">
              <span className="text-gray-400">Attack:</span>
              <span className="text-white">{unit.attack}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Defense:</span>
              <span className="text-white">{unit.defense}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 flex items-center gap-1">
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
              <span className="text-white">{unitStats.movementDisplay}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Vision:</span>
              <span className="text-white">{unitStats.definition.baseStats.visionRadius || 2}</span>
            </div>
          </div>
          
          {/* Unit Position */}
          <div className="text-xs text-gray-400 font-body">
            Position: ({unit.coordinate.q}, {unit.coordinate.r})
          </div>

          <Separator className="bg-white/20" />

          {/* Unit Abilities */}
          {unitStats.definition.abilities.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-white mb-2 font-cinzel">Abilities</h4>
              <div className="flex flex-wrap gap-1">
                {unitStats.definition.abilities.map((ability) => (
                  <Badge key={ability} variant="outline" className="text-xs text-blue-300 border-blue-500/50">
                    {ability.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Main Action Buttons with Dynamic States */}
          <div className="grid grid-cols-3 gap-2">
            {/* Attack Button */}
            <Button
              onClick={() => setAttackMode(true)}
              className={`${
                actionAvailability.canAttack 
                  ? "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/25" 
                  : "bg-gray-700 text-gray-400 cursor-not-allowed opacity-50"
              } transition-all duration-200`}
              size="sm"
              disabled={!actionAvailability.canAttack}
              title={
                !actionAvailability.isPlayerTurn 
                  ? "Not your turn" 
                  : unit.hasAttacked 
                    ? "Already attacked this turn"
                    : actionAvailability.attackTargetsCount === 0
                      ? "No valid targets in range"
                      : `Attack (${actionAvailability.attackTargetsCount} targets)`
              }
            >
              <Swords className="w-4 h-4 mr-1" />
              Attack
            </Button>
            
            {/* Move Button */}
            <Button
              onClick={() => setMovementMode(true)}
              className={`${
                actionAvailability.canMove 
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25" 
                  : "bg-gray-700 text-gray-400 cursor-not-allowed opacity-50"
              } transition-all duration-200`}
              size="sm"
              disabled={!actionAvailability.canMove}
              title={
                !actionAvailability.isPlayerTurn 
                  ? "Not your turn" 
                  : unit.remainingMovement === 0
                    ? "No movement remaining"
                    : actionAvailability.reachableTilesCount === 0
                      ? "No valid moves available"
                      : `Move (${actionAvailability.reachableTilesCount} tiles)`
              }
            >
              <Move className="w-4 h-4 mr-1" />
              Move
            </Button>

            {/* Abilities Button */}
            <Button
              onClick={() => setShowActionsPanel(true)}
              className={`${
                actionAvailability.hasAbilities 
                  ? "bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/25" 
                  : "bg-gray-700 text-gray-400 cursor-not-allowed opacity-50"
              } transition-all duration-200`}
              size="sm"
              disabled={!actionAvailability.hasAbilities}
              title={
                !actionAvailability.isPlayerTurn 
                  ? "Not your turn" 
                  : unitStats.definition.abilities.length === 0
                    ? "No abilities available"
                    : unit.hasAttacked
                      ? "Already acted this turn"
                      : `Use abilities (${unitStats.definition.abilities.length} available)`
              }
            >
              <Sparkles className="w-4 h-4 mr-1" />
              Ability
            </Button>
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