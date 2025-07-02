import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Button } from "./button";
import { getUnitDefinition } from "@shared/data/units";
import { getValidAttackTargets, canUnitAttackTarget } from "@shared/logic/unitLogic";
import { hexDistance } from "@shared/utils/hex";
import type { Unit } from "@shared/types/unit";
import type { GameState } from "@shared/types/game";

interface CombatPanelProps {
  selectedUnit: Unit;
  gameState: GameState;
  onAttackUnit: (attackerId: string, targetId: string) => void;
}

export default function CombatPanel({ selectedUnit, gameState, onAttackUnit }: CombatPanelProps) {
  const selectedUnitDef = getUnitDefinition(selectedUnit.type);

  // Memoize expensive combat calculations using centralized logic
  const attackableEnemies = useMemo(() => {
    if (!selectedUnit) return [];
    return getValidAttackTargets(selectedUnit, gameState);
  }, [selectedUnit, gameState]);

  // Don't show combat panel if no enemies in range
  if (attackableEnemies.length === 0) return null;

  return (
    <div className="absolute bottom-4 right-4 pointer-events-auto">
      <Card className="w-64 bg-black/80 border-white/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-white">Combat Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-sm text-gray-300 mb-3">
            Enemies in range: {attackableEnemies.length}
          </div>
          
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {attackableEnemies.map(enemy => {
              const enemyDef = getUnitDefinition(enemy.type);
              const distance = hexDistance(selectedUnit.coordinate, enemy.coordinate);
              
              return (
                <Button
                  key={enemy.id}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start bg-red-600/20 border-red-400 text-red-100 hover:bg-red-600/40"
                  onClick={() => onAttackUnit(selectedUnit.id, enemy.id)}
                >
                  <div className="flex justify-between w-full">
                    <span>{enemyDef.name}</span>
                    <span className="text-xs">
                      {enemy.hp}/{enemyDef.baseStats.hp} HP • {distance} tiles
                    </span>
                  </div>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}