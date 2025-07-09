import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Progress } from "./progress";
import { Button } from "./button";
import { Badge } from "./badge";
import { Separator } from "./separator";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { useGameState } from "../../lib/stores/useGameState";
import { getUnitDefinition } from "@shared/data/units";
import type { Unit } from "@shared/types/unit";
import { 
  Hammer, Eye, Shield, Heart, Crown, Target, 
  Anchor, Bomb, Sparkles, Move, Settings, Info 
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

          {/* Main Action Buttons */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              onClick={() => setAttackMode(true)}
              className="bg-red-600 hover:bg-red-700 text-white"
              size="sm"
              disabled={unit.hasAttacked}
            >
              <Target className="w-4 h-4 mr-1" />
              Attack
            </Button>
            
            <Button
              onClick={() => setMovementMode(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              size="sm"
              disabled={unit.remainingMovement === 0}
            >
              <Move className="w-4 h-4 mr-1" />
              Move
            </Button>

            <Button
              onClick={() => setShowActionsPanel(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white"
              size="sm"
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