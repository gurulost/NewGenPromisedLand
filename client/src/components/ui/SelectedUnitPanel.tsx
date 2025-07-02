import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Progress } from "./progress";
import { getUnitDefinition } from "@shared/data/units";
import type { Unit } from "@shared/types/unit";

interface SelectedUnitPanelProps {
  unit: Unit;
}

export default function SelectedUnitPanel({ unit }: SelectedUnitPanelProps) {
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
          <CardTitle className="text-white">{unitStats.definition.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-sm text-gray-300">
            {unitStats.definition.description}
          </div>
          
          {/* Unit HP */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-red-300">Health</span>
              <span className="text-white">{unit.hp}/{unitStats.definition.baseStats.hp}</span>
            </div>
            <Progress 
              value={unitStats.hpPercentage} 
              className="h-2"
            />
          </div>
          
          {/* Unit Stats */}
          <div className="grid grid-cols-2 gap-2 text-sm">
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
          <div className="text-xs text-gray-400">
            Position: ({unit.coordinate.q}, {unit.coordinate.r})
          </div>
        </CardContent>
      </Card>
    </div>
  );
}