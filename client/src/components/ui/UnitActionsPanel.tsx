import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Button } from "./button";
import { Badge } from "./badge";
import { Separator } from "./separator";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { getUnitDefinition } from "@shared/data/units";
import { Unit } from "@shared/types/unit";
import { 
  X, Hammer, Eye, Heart, Bomb, Crown, 
  Shield, Swords, Move, Target, Zap, Star 
} from "lucide-react";

interface UnitActionsPanelProps {
  unit: Unit;
  onClose: () => void;
}

export default function UnitActionsPanel({ unit, onClose }: UnitActionsPanelProps) {
  const { gameState, dispatch } = useLocalGame();
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  if (!gameState) return null;

  const unitDef = getUnitDefinition(unit.type);
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  const getUnitActions = () => {
    const actions = [];

    // Basic actions available to all units
    if (unit.remainingMovement > 0) {
      actions.push({
        id: 'move',
        name: 'Move',
        description: 'Move to adjacent tiles',
        icon: <Move className="w-4 h-4" />,
        cost: 'Movement',
        available: true
      });
    }

    if (!unit.hasAttacked && unit.attack > 0) {
      actions.push({
        id: 'attack',
        name: 'Attack',
        description: 'Attack adjacent enemy units',
        icon: <Swords className="w-4 h-4" />,
        cost: 'Turn',
        available: true
      });
    }

    // Unit-specific abilities
    switch (unit.type) {
      case 'worker':
        actions.push({
          id: 'build_improvement',
          name: 'Build Improvement',
          description: 'Construct terrain improvements',
          icon: <Hammer className="w-4 h-4" />,
          cost: 'Turn',
          available: true
        });
        
        // Harvest action for Polytopia-style resource management
        actions.push({
          id: 'harvest_resource',
          name: 'Harvest Resource',
          description: 'Harvest forest, mountain, or animals to grow nearby city',
          icon: <Star className="w-4 h-4" />,
          cost: 'Movement',
          available: unit.remainingMovement > 0
        });
        break;

      case 'scout':
        if (unitDef.abilities.includes('stealth')) {
          actions.push({
            id: 'stealth',
            name: 'Stealth Mode',
            description: 'Become invisible to enemies',
            icon: <Eye className="w-4 h-4" />,
            cost: 'Turn',
            available: !unit.hasAttacked && unit.status !== 'stealthed'
          });
        }
        if (unitDef.abilities.includes('reconnaissance')) {
          actions.push({
            id: 'reconnaissance',
            name: 'Reconnaissance',
            description: 'Reveal large area around unit',
            icon: <Target className="w-4 h-4" />,
            cost: 'Turn',
            available: !unit.hasAttacked
          });
        }
        break;

      case 'spearman':
        if (unitDef.abilities.includes('formation_fighting')) {
          actions.push({
            id: 'formation_fighting',
            name: 'Formation Fighting',
            description: 'Gain bonus when adjacent to allies',
            icon: <Shield className="w-4 h-4" />,
            cost: 'Passive',
            available: true
          });
        }
        break;

      case 'missionary':
        if (unitDef.abilities.includes('heal')) {
          actions.push({
            id: 'heal',
            name: 'Heal Nearby Units',
            description: 'Restore health to friendly units',
            icon: <Heart className="w-4 h-4" />,
            cost: '5 Faith',
            available: currentPlayer.stats.faith >= 5 && !unit.hasAttacked
          });
        }
        if (unitDef.abilities.includes('convert')) {
          actions.push({
            id: 'convert',
            name: 'Convert Enemy',
            description: 'Convert enemy unit to your side',
            icon: <Star className="w-4 h-4" />,
            cost: '10 Faith',
            available: currentPlayer.stats.faith >= 10
          });
        }
        break;

      case 'catapult':
        if (unitDef.abilities.includes('siege')) {
          actions.push({
            id: 'siege_mode',
            name: 'Siege Mode',
            description: 'Setup for long-range bombardment',
            icon: <Bomb className="w-4 h-4" />,
            cost: 'Turn',
            available: true
          });
        }
        if (unitDef.abilities.includes('bombardment')) {
          actions.push({
            id: 'bombardment',
            name: 'Area Bombardment',
            description: 'Attack multiple targets in range',
            icon: <Zap className="w-4 h-4" />,
            cost: 'Turn',
            available: unit.remainingMovement === 0 // Must be stationary
          });
        }
        break;

      case 'commander':
        if (unitDef.abilities.includes('rally')) {
          actions.push({
            id: 'rally',
            name: 'Rally Troops',
            description: 'Boost nearby units\' attack and morale',
            icon: <Crown className="w-4 h-4" />,
            cost: '5 Pride',
            available: currentPlayer.stats.pride >= 5 && !unit.hasAttacked
          });
        }
        break;
    }

    return actions;
  };

  const executeAction = (actionId: string) => {
    console.log(`Executing action ${actionId} for unit ${unit.id}`);
    
    // This would dispatch the appropriate game action
    switch (actionId) {

      
      case 'heal':
        dispatch({
          type: 'HEAL_UNIT',
          payload: {
            unitId: unit.id,
            playerId: currentPlayer.id
          }
        });
        break;
        
      case 'stealth':
        dispatch({
          type: 'APPLY_STEALTH',
          payload: {
            unitId: unit.id,
            playerId: currentPlayer.id
          }
        });
        break;
        
      case 'reconnaissance':
        dispatch({
          type: 'RECONNAISSANCE',
          payload: {
            unitId: unit.id,
            playerId: currentPlayer.id
          }
        });
        break;
        
      case 'formation_fighting':
        dispatch({
          type: 'FORMATION_FIGHTING',
          payload: {
            unitId: unit.id,
            playerId: currentPlayer.id
          }
        });
        break;
        
      case 'siege_mode':
        dispatch({
          type: 'SIEGE_MODE',
          payload: {
            unitId: unit.id,
            playerId: currentPlayer.id
          }
        });
        break;
        
      case 'rally':
        dispatch({
          type: 'RALLY_TROOPS',
          payload: {
            unitId: unit.id,
            playerId: currentPlayer.id
          }
        });
        break;
        
      case 'harvest_resource':
        // This would open a map interface to select resource tiles
        console.log('Opening harvest resource interface');
        setSelectedAction('harvest_resource');
        break;
      
      case 'build_improvement':
        // Would open improvement selection
        console.log('Opening improvement selection...');
        break;
      
      default:
        console.log('Action not implemented yet:', actionId);
    }
    
    onClose();
  };

  const actions = getUnitActions();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto">
      <Card className="w-[500px] max-h-[80vh] overflow-y-auto bg-slate-900 border-slate-600">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-white font-cinzel">
              <Crown className="w-6 h-6 text-purple-400" />
              {unitDef.name} Actions
            </CardTitle>
            <Button
              variant="outline"
              size="icon"
              onClick={onClose}
              className="border-slate-600 text-slate-400 hover:bg-slate-700"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="text-sm text-slate-400 font-body">
            Select an action for this unit to perform
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Unit Status */}
          <div className="grid grid-cols-2 gap-4 p-3 bg-slate-800/50 rounded-lg">
            <div className="text-center">
              <div className="text-lg font-semibold text-green-400">{unit.hp}/{unitDef.baseStats.hp}</div>
              <div className="text-xs text-slate-400">Health</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-400">{unit.remainingMovement}/{unit.movement}</div>
              <div className="text-xs text-slate-400">Movement</div>
            </div>
          </div>

          <Separator className="bg-slate-700" />

          {/* Available Actions */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-white font-cinzel">Available Actions</h3>
            
            {actions.length === 0 ? (
              <div className="text-center py-6">
                <div className="text-slate-400 mb-2">No actions available</div>
                <div className="text-sm text-slate-500">
                  This unit has exhausted all available actions this turn.
                </div>
              </div>
            ) : (
              actions.map((action) => (
                <div
                  key={action.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedAction === action.id
                      ? 'bg-purple-600/20 border-purple-500/50'
                      : action.available
                      ? 'bg-slate-800/50 border-slate-600 hover:bg-slate-800'
                      : 'bg-slate-800/20 border-slate-700 opacity-50 cursor-not-allowed'
                  }`}
                  onClick={() => action.available && setSelectedAction(action.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 text-purple-400">
                        {action.icon}
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">{action.name}</h4>
                        <p className="text-sm text-slate-400 mt-1">{action.description}</p>
                        
                        <div className="flex items-center gap-2 mt-2">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              action.available 
                                ? 'text-green-300 border-green-500/50' 
                                : 'text-red-300 border-red-500/50'
                            }`}
                          >
                            Cost: {action.cost}
                          </Badge>
                          
                          {!action.available && (
                            <Badge variant="outline" className="text-xs text-red-300 border-red-500/50">
                              Unavailable
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Execute Action Button */}
          {selectedAction && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={() => executeAction(selectedAction)}
                className="bg-purple-600 hover:bg-purple-700 px-8"
              >
                Execute Action
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}