import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Button } from "./button";
import { Badge } from "./badge";
import { Separator } from "./separator";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { 
  Hammer, Shield, Eye, Zap, Heart, 
  Target, Users, Anchor, Bomb, BookOpen,
  Sparkles, Crown, Move
} from "lucide-react";
import { Unit, UnitType } from "@shared/types/unit";
import { HexCoordinate } from "@shared/types/coordinates";
import { getUnitDefinition } from "@shared/data/units";
import { ABILITIES } from "@shared/data/abilities";

interface UnitActionsPanelProps {
  unit: Unit | null;
  onClose: () => void;
}

interface UnitAction {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  category: 'movement' | 'combat' | 'utility' | 'special';
  requirements?: {
    faith?: number;
    pride?: number;
    stars?: number;
  };
  available: boolean;
}

export default function UnitActionsPanel({ unit, onClose }: UnitActionsPanelProps) {
  const { gameState, dispatch } = useLocalGame();
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [targetMode, setTargetMode] = useState<'unit' | 'tile' | 'area' | null>(null);

  if (!unit || !gameState) {
    return null;
  }

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const unitDef = getUnitDefinition(unit.type);

  // Define available actions based on unit type and abilities
  const getAvailableActions = (unitType: UnitType): UnitAction[] => {
    const actions: UnitAction[] = [];

    switch (unitType) {
      case 'worker':
        if (unitDef.abilities.includes('BUILD')) {
          actions.push({
            id: 'build_improvement',
            name: 'Build Improvement',
            description: 'Construct farms, mines, and other terrain improvements',
            icon: Hammer,
            category: 'utility',
            available: true
          });
        }
        break;

      case 'scout':
        if (unitDef.abilities.includes('STEALTH')) {
          actions.push({
            id: 'toggle_stealth',
            name: 'Toggle Stealth',
            description: 'Become invisible to enemies unless adjacent',
            icon: Eye,
            category: 'special',
            available: true
          });
        }
        if (unitDef.abilities.includes('EXTENDED_VISION')) {
          actions.push({
            id: 'reveal_area',
            name: 'Reveal Area',
            description: 'Reveal large area around scout position',
            icon: Sparkles,
            category: 'utility',
            available: true
          });
        }
        break;

      case 'spearman':
        if (unitDef.abilities.includes('FORMATION_FIGHTING')) {
          actions.push({
            id: 'formation',
            name: 'Formation Fighting',
            description: 'Gain defense bonus when adjacent to other spearmen',
            icon: Shield,
            category: 'combat',
            available: true
          });
        }
        if (unitDef.abilities.includes('ANTI_CAVALRY')) {
          actions.push({
            id: 'anti_cavalry',
            name: 'Anti-Cavalry Stance',
            description: 'Prepare to counter fast-moving units',
            icon: Target,
            category: 'combat',
            available: true
          });
        }
        break;

      case 'boat':
        if (unitDef.abilities.includes('NAVAL_TRANSPORT')) {
          actions.push({
            id: 'transport',
            name: 'Transport Units',
            description: 'Carry up to 2 land units across water',
            icon: Anchor,
            category: 'utility',
            available: true
          });
        }
        if (unitDef.abilities.includes('COASTAL_EXPLORATION')) {
          actions.push({
            id: 'coastal_explore',
            name: 'Coastal Exploration',
            description: 'Explore coastlines and find hidden resources',
            icon: Eye,
            category: 'utility',
            available: true
          });
        }
        break;

      case 'catapult':
        if (unitDef.abilities.includes('SIEGE_WEAPON')) {
          actions.push({
            id: 'siege_setup',
            name: 'Setup for Siege',
            description: 'Prepare catapult for bombardment (cannot move)',
            icon: Bomb,
            category: 'combat',
            available: unit.status !== 'defending'
          });
        }
        if (unitDef.abilities.includes('LONG_RANGE_BOMBARDMENT')) {
          actions.push({
            id: 'bombardment',
            name: 'Area Bombardment',
            description: 'Attack multiple tiles in an area',
            icon: Zap,
            category: 'combat',
            available: unit.status === 'defending'
          });
        }
        break;

      case 'missionary':
        if (unitDef.abilities.includes('CONVERT')) {
          actions.push({
            id: 'convert_unit',
            name: 'Convert Enemy',
            description: 'Turn enemy unit to your side through faith',
            icon: Heart,
            category: 'special',
            requirements: { faith: 50 },
            available: currentPlayer.stats.faith >= 50
          });
        }
        if (unitDef.abilities.includes('HEAL')) {
          actions.push({
            id: 'heal_allies',
            name: 'Heal Allies',
            description: 'Restore health to nearby friendly units',
            icon: Heart,
            category: 'utility',
            requirements: { faith: 20 },
            available: currentPlayer.stats.faith >= 20
          });
        }
        break;

      case 'commander':
        if (unitDef.abilities.includes('LEADERSHIP')) {
          actions.push({
            id: 'rally_troops',
            name: 'Rally Troops',
            description: 'Restore movement to nearby exhausted units',
            icon: Crown,
            category: 'special',
            requirements: { pride: 30 },
            available: currentPlayer.stats.pride >= 30
          });
        }
        if (unitDef.abilities.includes('TACTICAL_COMMAND')) {
          actions.push({
            id: 'tactical_command',
            name: 'Tactical Command',
            description: 'Allow coordinated attacks from nearby units',
            icon: Users,
            category: 'special',
            requirements: { pride: 40 },
            available: currentPlayer.stats.pride >= 40
          });
        }
        break;
    }

    // Add technology-unlocked abilities
    if (currentPlayer.researchedTechs.includes('spirituality')) {
      actions.push({
        id: 'blessing',
        name: 'Divine Blessing',
        description: 'Heal and protect units in target area',
        icon: Sparkles,
        category: 'special',
        requirements: { faith: 30 },
        available: currentPlayer.stats.faith >= 30
      });
    }

    if (currentPlayer.researchedTechs.includes('priesthood')) {
      actions.push({
        id: 'divine_protection',
        name: 'Divine Protection',
        description: 'Grant temporary immunity to damage',
        icon: Shield,
        category: 'special',
        requirements: { faith: 60 },
        available: currentPlayer.stats.faith >= 60
      });
    }

    return actions;
  };

  const availableActions = getAvailableActions(unit.type);

  const handleActionSelect = (actionId: string) => {
    const action = availableActions.find(a => a.id === actionId);
    if (!action?.available) return;

    setSelectedAction(actionId);

    // Determine targeting mode
    switch (actionId) {
      case 'convert_unit':
        setTargetMode('unit');
        break;
      case 'blessing':
      case 'divine_protection':
      case 'bombardment':
        setTargetMode('area');
        break;
      case 'build_improvement':
        setTargetMode('tile');
        break;
      default:
        // Execute immediately for non-targeting actions
        executeAction(actionId);
        break;
    }
  };

  const executeAction = (actionId: string, target?: HexCoordinate | string) => {
    if (!unit) return;

    // This would integrate with the unit action system
    dispatch({
      type: 'UNIT_ACTION',
      payload: {
        unitId: unit.id,
        actionType: actionId,
        target
      }
    });

    setSelectedAction(null);
    setTargetMode(null);
  };

  const getCategoryIcon = (category: UnitAction['category']) => {
    switch (category) {
      case 'movement': return Move;
      case 'combat': return Target;
      case 'utility': return Hammer;
      case 'special': return Sparkles;
    }
  };

  const getCategoryColor = (category: UnitAction['category']) => {
    switch (category) {
      case 'movement': return 'text-blue-400 border-blue-500/50';
      case 'combat': return 'text-red-400 border-red-500/50';
      case 'utility': return 'text-green-400 border-green-500/50';
      case 'special': return 'text-purple-400 border-purple-500/50';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto">
      <Card className="w-[600px] max-h-[80vh] overflow-y-auto bg-slate-900 border-slate-600">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-white font-cinzel">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{unitDef.name} Actions</h3>
              <p className="text-sm text-slate-400 font-body">{unitDef.description}</p>
            </div>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Unit Status */}
          <div className="flex items-center gap-4 p-3 bg-slate-800 rounded-lg">
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Health:</span>
                <span className="text-white">{unit.hp}/{unit.maxHp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Movement:</span>
                <span className="text-white">{unit.remainingMovement}/{unit.movement}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <Badge variant="outline" className="text-xs">
                  {unit.status}
                </Badge>
              </div>
            </div>
          </div>

          <Separator className="bg-slate-700" />

          {/* Available Actions */}
          <div>
            <h4 className="font-semibold text-white mb-3 font-cinzel">Available Actions</h4>
            
            {availableActions.length === 0 ? (
              <p className="text-slate-400 text-center py-4">No special actions available</p>
            ) : (
              <div className="grid gap-2">
                {availableActions.map((action) => {
                  const IconComponent = action.icon;
                  const categoryColor = getCategoryColor(action.category);
                  
                  return (
                    <Button
                      key={action.id}
                      variant="outline"
                      className={`h-auto p-4 justify-start ${
                        action.available 
                          ? 'bg-slate-800 border-slate-600 hover:bg-slate-700' 
                          : 'bg-slate-900 border-slate-700 opacity-50 cursor-not-allowed'
                      }`}
                      onClick={() => action.available && handleActionSelect(action.id)}
                      disabled={!action.available}
                    >
                      <div className="flex items-start gap-3 w-full">
                        <IconComponent className={`w-5 h-5 mt-0.5 ${
                          action.available ? 'text-blue-400' : 'text-slate-600'
                        }`} />
                        
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`font-medium ${
                              action.available ? 'text-white' : 'text-slate-500'
                            }`}>
                              {action.name}
                            </span>
                            <Badge variant="outline" className={`text-xs ${categoryColor}`}>
                              {action.category}
                            </Badge>
                          </div>
                          
                          <p className={`text-xs ${
                            action.available ? 'text-slate-400' : 'text-slate-600'
                          }`}>
                            {action.description}
                          </p>
                          
                          {action.requirements && (
                            <div className="flex gap-2 mt-2">
                              {action.requirements.faith && (
                                <Badge variant="outline" className="text-xs text-blue-300 border-blue-500/50">
                                  Faith: {action.requirements.faith}
                                </Badge>
                              )}
                              {action.requirements.pride && (
                                <Badge variant="outline" className="text-xs text-purple-300 border-purple-500/50">
                                  Pride: {action.requirements.pride}
                                </Badge>
                              )}
                              {action.requirements.stars && (
                                <Badge variant="outline" className="text-xs text-yellow-300 border-yellow-500/50">
                                  Stars: {action.requirements.stars}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </Button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Targeting Instructions */}
          {targetMode && (
            <div className="p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-300 text-sm">
                {targetMode === 'unit' && 'Click on an enemy unit to target'}
                {targetMode === 'tile' && 'Click on a tile to select location'}
                {targetMode === 'area' && 'Click on an area to target'}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="flex-1 bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
            >
              Close
            </Button>
            
            {targetMode && (
              <Button 
                variant="outline" 
                onClick={() => {
                  setSelectedAction(null);
                  setTargetMode(null);
                }}
                className="bg-red-600/20 border-red-500 text-red-300 hover:bg-red-600/40"
              >
                Cancel Action
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}