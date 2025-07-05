import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Progress } from "./progress";
import { Button } from "./button";
import { Badge } from "./badge";
import { Separator } from "./separator";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { getUnitDefinition } from "@shared/data/units";
import type { Unit } from "@shared/types/unit";
import { 
  Hammer, Eye, Shield, Heart, Crown, Target, 
  Anchor, Bomb, Sparkles, Move, Settings 
} from "lucide-react";
import UnitActionsPanel from "./UnitActionsPanel";

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
              <span className="text-gray-400">Movement:</span>
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

          {/* Unit Actions */}
          <div className="space-y-2">
            <Button
              onClick={() => setShowActionsPanel(true)}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white"
              size="sm"
            >
              <Settings className="w-4 h-4 mr-2" />
              Unit Actions
            </Button>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-2 gap-1">
              {unit.type === 'scout' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs bg-slate-800/50 border-slate-600 text-slate-300"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Stealth
                </Button>
              )}

              {unit.type === 'missionary' && gameState && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs bg-slate-800/50 border-slate-600 text-slate-300"
                >
                  <Heart className="w-3 h-3 mr-1" />
                  Heal
                </Button>
              )}

              {unit.type === 'catapult' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs bg-slate-800/50 border-slate-600 text-slate-300"
                >
                  <Bomb className="w-3 h-3 mr-1" />
                  Setup
                </Button>
              )}

              {unit.type === 'commander' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs bg-slate-800/50 border-slate-600 text-slate-300"
                >
                  <Crown className="w-3 h-3 mr-1" />
                  Rally
                </Button>
              )}
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