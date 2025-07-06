import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Button } from "./button";
import { Progress } from "./progress";
import { Sword, Shield, AlertTriangle, CheckCircle, XCircle, Info } from "lucide-react";
import { getUnitDefinition } from "@shared/data/units";
import { getValidAttackTargets, canUnitAttackTarget } from "@shared/logic/unitLogic";
import { hexDistance } from "@shared/utils/hex";
import { getCombatPreview, CombatPreview } from "@shared/logic/combatPreview";
import type { Unit } from "@shared/types/unit";
import type { GameState } from "@shared/types/game";
import { Tooltip, CombatTooltip } from "./TooltipSystem";

interface CombatPanelProps {
  selectedUnit: Unit;
  gameState: GameState;
  onAttackUnit: (attackerId: string, targetId: string) => void;
  hoveredEnemy?: Unit | null;
}

export default function CombatPanel({ selectedUnit, gameState, onAttackUnit, hoveredEnemy }: CombatPanelProps) {
  const selectedUnitDef = getUnitDefinition(selectedUnit.type);

  // Memoize expensive combat calculations using centralized logic
  const combatData = useMemo(() => {
    if (!selectedUnit) return [];
    
    const attackableEnemies = getValidAttackTargets(selectedUnit, gameState);
    
    // Pre-calculate all expensive operations for each enemy
    return attackableEnemies.map(enemy => ({
      unit: enemy,
      definition: getUnitDefinition(enemy.type),
      distance: hexDistance(selectedUnit.coordinate, enemy.coordinate),
      hpPercentage: (enemy.currentHp / getUnitDefinition(enemy.type).baseStats.hp) * 100,
      preview: getCombatPreview(selectedUnit, enemy, gameState)
    }));
  }, [selectedUnit, gameState]);

  // Get preview for hovered enemy
  const hoveredPreview = useMemo(() => {
    if (!hoveredEnemy || !selectedUnit) return null;
    return getCombatPreview(selectedUnit, hoveredEnemy, gameState);
  }, [selectedUnit, hoveredEnemy, gameState]);

  const getOddsColor = (odds: CombatPreview['odds']) => {
    switch (odds) {
      case 'Overwhelming': return 'text-green-400';
      case 'Favorable': return 'text-green-300';
      case 'Even': return 'text-yellow-400';
      case 'Unfavorable': return 'text-orange-400';
      case 'Desperate': return 'text-red-400';
      default: return 'text-white';
    }
  };

  const getOddsIcon = (odds: CombatPreview['odds']) => {
    switch (odds) {
      case 'Overwhelming': 
      case 'Favorable': 
        return <CheckCircle className="w-3 h-3" />;
      case 'Even': 
        return <AlertTriangle className="w-3 h-3" />;
      case 'Unfavorable': 
      case 'Desperate': 
        return <XCircle className="w-3 h-3" />;
    }
  };

  // Don't show combat panel if no enemies in range
  if (combatData.length === 0) return null;

  return (
    <div className="absolute bottom-4 right-4 pointer-events-auto">
      <Card className="w-80 bg-black/80 border-white/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-white font-cinzel font-semibold tracking-wide flex items-center gap-2">
            <Sword className="w-4 h-4" />
            Combat Options
            <Tooltip content={<CombatTooltip />}>
              <Info className="w-3 h-3 text-gray-400 opacity-60 cursor-help" />
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Combat Preview for Hovered Enemy */}
          {hoveredEnemy && hoveredPreview && (
            <div className="p-3 bg-red-950/50 border border-red-800 rounded space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-white font-medium text-sm">Combat Preview</h4>
                <div className={`flex items-center gap-1 ${getOddsColor(hoveredPreview.odds)}`}>
                  {getOddsIcon(hoveredPreview.odds)}
                  <span className="text-xs font-medium">{hoveredPreview.odds}</span>
                </div>
              </div>
              
              {!hoveredPreview.canAttack && (
                <div className="text-red-300 text-xs">{hoveredPreview.reason}</div>
              )}
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-center">
                  <div className="text-blue-300">Your Damage</div>
                  <div className="text-white font-semibold">{hoveredPreview.attackerDamage}</div>
                  <div className="text-blue-200">HP After: {hoveredPreview.attackerHealthAfter}</div>
                </div>
                <div className="text-center">
                  <div className="text-red-300">Enemy Damage</div>
                  <div className="text-white font-semibold">{hoveredPreview.defenderDamage}</div>
                  <div className="text-red-200">HP After: {hoveredPreview.defenderHealthAfter}</div>
                </div>
              </div>
            </div>
          )}

          <div className="text-sm text-gray-300 font-body">
            Enemies in range: {combatData.length}
          </div>
          
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {combatData.map(({ unit: enemy, definition: enemyDef, distance, preview }) => {
              return (
                <Button
                  key={enemy.id}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start bg-red-600/20 border-red-400 text-red-100 hover:bg-red-600/40 font-body p-2"
                  onClick={() => onAttackUnit(selectedUnit.id, enemy.id)}
                  disabled={!preview?.canAttack}
                >
                  <div className="flex flex-col w-full gap-1">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{enemyDef.name}</span>
                      <div className="flex items-center gap-1">
                        {preview && getOddsIcon(preview.odds)}
                        <span className="text-xs">
                          {enemy.currentHp}/{enemyDef.baseStats.hp} HP
                        </span>
                      </div>
                    </div>
                    
                    {preview && (
                      <div className="flex justify-between text-xs opacity-75">
                        <span>Deal: {preview.attackerDamage} dmg</span>
                        <span>Take: {preview.defenderDamage} dmg</span>
                      </div>
                    )}
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