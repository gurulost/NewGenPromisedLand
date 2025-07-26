import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Button } from "./button";
import { Badge } from "./badge";
import { Separator } from "./separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
import { Alert, AlertDescription } from "./alert";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { getUnitDefinition } from "@shared/data/units";
import { Unit } from "@shared/types/unit";
import { hexDistance, hexNeighbors } from "@shared/utils/hex";
import { 
  X, Hammer, Eye, Heart, Bomb, Crown, 
  Shield, Swords, Move, Target, Zap, Star,
  AlertTriangle, Coins, Sparkles
} from "lucide-react";

interface UnitActionsPanelProps {
  unit: Unit;
  onClose: () => void;
}

interface ActionDefinition {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  cost: string;
  starCost?: number;
  faithCost?: number;
  prideCost?: number;
  available: boolean;
  irreversible?: boolean;
  rangeType?: 'movement' | 'attack' | 'ability';
  range?: number;
  consequences?: string[];
}

export default function UnitActionsPanel({ unit, onClose }: UnitActionsPanelProps) {
  const { gameState, dispatch } = useLocalGame();
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [actionToConfirm, setActionToConfirm] = useState<ActionDefinition | null>(null);
  const [rangePreview, setRangePreview] = useState<string[]>([]);

  if (!gameState) return null;

  const unitDef = getUnitDefinition(unit.type);
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  // Helper function to calculate range preview tiles
  const calculateRangePreview = (action: ActionDefinition): string[] => {
    if (!action.rangeType || !action.range) return [];
    
    const tiles: string[] = [];
    const centerQ = unit.coordinate.q;
    const centerR = unit.coordinate.r;
    
    for (let q = centerQ - action.range; q <= centerQ + action.range; q++) {
      for (let r = centerR - action.range; r <= centerR + action.range; r++) {
        const s = -q - r;
        const distance = hexDistance(
          { q: centerQ, r: centerR, s: -centerQ - centerR },
          { q, r, s }
        );
        
        if (distance <= action.range && distance > 0) {
          tiles.push(`${q},${r}`);
        }
      }
    }
    
    return tiles;
  };

  // Helper function to check if action needs confirmation
  const needsConfirmation = (action: ActionDefinition): boolean => {
    return action.irreversible || (action.starCost && action.starCost > 0) || 
           (action.faithCost && action.faithCost > 0) || (action.prideCost && action.prideCost > 0);
  };

  // Handle action selection with range preview
  const handleActionSelect = (action: ActionDefinition) => {
    if (!action.available) return;
    
    setSelectedAction(action.id);
    
    // Show range preview if action has range
    if (action.rangeType && action.range) {
      const tiles = calculateRangePreview(action);
      setRangePreview(tiles);
    } else {
      setRangePreview([]);
    }
  };

  // Handle action execution
  const handleActionExecute = (action: ActionDefinition) => {
    if (needsConfirmation(action)) {
      setActionToConfirm(action);
      setShowConfirmDialog(true);
    } else {
      executeAction(action.id);
    }
  };

  // Confirm and execute action
  const confirmAndExecute = () => {
    if (actionToConfirm) {
      executeAction(actionToConfirm.id);
    }
    setShowConfirmDialog(false);
    setActionToConfirm(null);
  };

  const getUnitActions = (): ActionDefinition[] => {
    const actions: ActionDefinition[] = [];
    const isPlayerTurn = unit.playerId === currentPlayer.id;

    // Helper to check valid attack targets
    const hasValidAttackTargets = () => {
      return gameState.units.some(target => 
        target.playerId !== unit.playerId && 
        hexDistance(unit.coordinate, target.coordinate) <= (unit.attackRange || 1)
      );
    };

    // Helper to check valid movement tiles
    const hasValidMovementTiles = () => {
      if (unit.remainingMovement <= 0) return false;
      // Check if any adjacent tiles are passable
      const neighbors = hexNeighbors(unit.coordinate);
      return neighbors.some(coord => 
        gameState.map.tiles.some(tile => 
          tile.coordinate.q === coord.q && 
          tile.coordinate.r === coord.r &&
          tile.terrain !== 'water' // Basic passability
        )
      );
    };

    // Helper to check current tile resources for workers
    const hasHarvestableTileResources = () => {
      const currentTile = gameState.map.tiles.find(tile =>
        tile.coordinate.q === unit.coordinate.q &&
        tile.coordinate.r === unit.coordinate.r
      );
      return currentTile && currentTile.resources.length > 0;
    };

    // Basic actions available to all units
    const canMove = isPlayerTurn && unit.remainingMovement > 0;
    const hasMoveTiles = hasValidMovementTiles();
    if (canMove || !isPlayerTurn) {
      actions.push({
        id: 'move',
        name: 'Move',
        description: isPlayerTurn ? 'Move to adjacent tiles' : 'Not your turn',
        icon: <Move className="w-4 h-4" />,
        cost: 'Movement',
        available: canMove && hasMoveTiles,
        rangeType: 'movement',
        range: unit.remainingMovement
      });
    }

    const canAttack = isPlayerTurn && !unit.hasAttacked && unit.attack > 0;
    const hasAttackTargets = hasValidAttackTargets();
    if (canAttack || !isPlayerTurn || unit.hasAttacked) {
      actions.push({
        id: 'attack',
        name: 'Attack',
        description: !isPlayerTurn ? 'Not your turn' : 
                    unit.hasAttacked ? 'Already attacked this turn' : 
                    'Attack adjacent enemy units',
        icon: <Swords className="w-4 h-4" />,
        cost: 'Turn',
        available: canAttack && hasAttackTargets,
        rangeType: 'attack',
        range: unit.attackRange || 1
      });
    }

    // Check for village capture opportunity
    const currentTile = gameState.map.tiles.find(tile =>
      tile.coordinate.q === unit.coordinate.q &&
      tile.coordinate.r === unit.coordinate.r
    );
    
    if (currentTile?.feature === 'village' && 
        currentTile.cityOwner !== currentPlayer.id && 
        !unit.hasAttacked) {
      actions.push({
        id: 'capture_village',
        name: 'Capture Village',
        description: 'Capture this neutral village for rewards (+5 stars, +1 research)',
        icon: <Crown className="w-4 h-4" />,
        cost: 'Turn',
        available: true
      });
    }

    // Unit-specific abilities
    switch (unit.type) {
      case 'worker':
        // Check if on valid tile for improvements
        const currentTile = gameState.map.tiles.find(tile =>
          tile.coordinate.q === unit.coordinate.q &&
          tile.coordinate.r === unit.coordinate.r
        );
        const canBuildOnTile = currentTile && !currentTile.hasCity;
        
        // Build regular improvements
        actions.push({
          id: 'build_improvement',
          name: 'Build Improvement',
          description: !isPlayerTurn ? 'Not your turn' :
                      !canBuildOnTile ? 'Cannot build on this tile' :
                      'Construct terrain improvements (farms, mines, etc.)',
          icon: <Hammer className="w-4 h-4" />,
          cost: 'Turn',
          available: isPlayerTurn && canBuildOnTile
        });

        // Harvest resources if available on current tile
        if (hasHarvestableTileResources()) {
          actions.push({
            id: 'harvest_resource',
            name: 'Harvest Resource',
            description: isPlayerTurn ? 'Gather resources from this tile' : 'Not your turn',
            icon: <Coins className="w-4 h-4" />,
            cost: 'Turn',
            available: isPlayerTurn && !unit.hasAttacked
          });
        }
        
        // Build Road - Polytopia-style infrastructure
        if (unitDef.abilities.includes('BUILD_ROAD')) {
          const canAfford = currentPlayer.stars >= 3;
          const hasMovement = unit.remainingMovement > 0;
          actions.push({
            id: 'build_road',
            name: 'Build Road',
            description: !isPlayerTurn ? 'Not your turn' :
                        !canAfford ? 'Requires 3 stars' :
                        !hasMovement ? 'No movement remaining' :
                        'Create roads that reduce movement cost for friendly units',
            icon: <Move className="w-4 h-4" />,
            cost: '3 Stars',
            starCost: 3,
            available: isPlayerTurn && canAfford && hasMovement
          });
        }
        
        // Clear Forest - Polytopia-style terraforming
        if (unitDef.abilities.includes('CLEAR_FOREST')) {
          const canAfford = currentPlayer.stars >= 5;
          const hasMovement = unit.remainingMovement > 0;
          const onForest = currentTile?.terrain === 'forest';
          actions.push({
            id: 'clear_forest',
            name: 'Clear Forest',
            description: !isPlayerTurn ? 'Not your turn' :
                        !canAfford ? 'Requires 5 stars' :
                        !hasMovement ? 'No movement remaining' :
                        !onForest ? 'Must be on forest tile' :
                        'Remove forest and convert to plains terrain',
            icon: <Zap className="w-4 h-4" />,
            cost: '5 Stars',
            starCost: 5,
            available: isPlayerTurn && canAfford && hasMovement && onForest,
            irreversible: true,
            consequences: [
              'Permanently destroys forest terrain',
              'Converts tile to plains',
              'Cannot be undone'
            ]
          });
        }
        
        // Harvest Resource - Polytopia-style resource management
        if (unitDef.abilities.includes('HARVEST')) {
          actions.push({
            id: 'harvest_resource',
            name: 'Harvest Resource',
            description: 'Harvest world elements for immediate rewards',
            icon: <Star className="w-4 h-4" />,
            cost: 'Movement',
            available: unit.remainingMovement > 0
          });
        }
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
          // Check if player has required technology for healing abilities
          const hasHealingTech = currentPlayer.researchedTechs.includes('spirituality');
          actions.push({
            id: 'heal',
            name: 'Heal Nearby Units',
            description: hasHealingTech ? 'Restore health to friendly units' : 'Requires Spirituality technology',
            icon: <Heart className="w-4 h-4" />,
            cost: '5 Faith',
            faithCost: 5,
            available: hasHealingTech && currentPlayer.stats.faith >= 5 && !unit.hasAttacked,
            rangeType: 'ability',
            range: 2
          });
        }
        if (unitDef.abilities.includes('convert')) {
          actions.push({
            id: 'convert',
            name: 'Convert Enemy',
            description: 'Convert enemy unit to your side',
            icon: <Star className="w-4 h-4" />,
            cost: '10 Faith',
            faithCost: 10,
            available: currentPlayer.stats.faith >= 10,
            rangeType: 'attack',
            range: 1
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
            available: true,
            irreversible: true,
            consequences: [
              'Permanently consumes resource',
              'May increase Pride and Dissent',
              'Provides immediate population/star boost'
            ]
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
            prideCost: 5,
            available: currentPlayer.stats.pride >= 5 && !unit.hasAttacked,
            rangeType: 'ability',
            range: 2
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
      case 'capture_village':
        dispatch({
          type: 'CAPTURE_VILLAGE',
          payload: {
            unitId: unit.id,
            playerId: currentPlayer.id
          }
        });
        onClose(); // Close the panel after capturing
        break;
      
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
      
      case 'build_road':
        // This would open a map interface to select where to build road
        console.log('Opening build road interface');
        setSelectedAction('build_road');
        break;
        
      case 'clear_forest':
        // This would open a map interface to select forest tiles to clear
        console.log('Opening clear forest interface');
        setSelectedAction('clear_forest');
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto p-4">
      <Card className="w-full max-w-[500px] max-h-[85vh] overflow-y-auto bg-slate-900 border-slate-600">
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
                  className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 min-h-[64px] touch-manipulation ${
                    selectedAction === action.id
                      ? 'bg-purple-600/20 border-purple-500/50 ring-2 ring-purple-500/30'
                      : action.available
                      ? 'bg-slate-800/50 border-slate-600 md:hover:bg-slate-800 active:bg-slate-700 md:hover:border-slate-500 active:scale-[0.98]'
                      : 'bg-slate-800/20 border-slate-700 opacity-50 cursor-not-allowed'
                  }`}
                  onClick={() => action.available && handleActionSelect(action)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1 text-purple-400">
                        {action.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-white">{action.name}</h4>
                          {action.irreversible && (
                            <AlertTriangle className="w-4 h-4 text-orange-400" />
                          )}
                        </div>
                        <p className="text-sm text-slate-400 mt-1">{action.description}</p>
                        
                        {/* Enhanced Cost Display */}
                        <div className="flex items-center gap-2 mt-2">
                          {/* Base cost badge */}
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              action.available 
                                ? 'text-green-300 border-green-500/50' 
                                : 'text-red-300 border-red-500/50'
                            }`}
                          >
                            {action.cost}
                          </Badge>
                          
                          {/* Detailed cost breakdown */}
                          {action.starCost && (
                            <Badge variant="outline" className="text-xs text-yellow-300 border-yellow-500/50 flex items-center gap-1">
                              <Coins className="w-3 h-3" />
                              {action.starCost}
                            </Badge>
                          )}
                          
                          {action.faithCost && (
                            <Badge variant="outline" className="text-xs text-blue-300 border-blue-500/50 flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              {action.faithCost}
                            </Badge>
                          )}
                          
                          {action.prideCost && (
                            <Badge variant="outline" className="text-xs text-red-300 border-red-500/50 flex items-center gap-1">
                              <Crown className="w-3 h-3" />
                              {action.prideCost}
                            </Badge>
                          )}
                          
                          {/* Range indicator */}
                          {action.rangeType && action.range && (
                            <Badge variant="outline" className="text-xs text-purple-300 border-purple-500/50">
                              Range: {action.range}
                            </Badge>
                          )}
                          
                          {!action.available && (
                            <Badge variant="outline" className="text-xs text-red-300 border-red-500/50">
                              Unavailable
                            </Badge>
                          )}
                        </div>
                        
                        {/* Consequences warning for irreversible actions */}
                        {action.consequences && selectedAction === action.id && (
                          <Alert className="mt-2 border-orange-500/50 bg-orange-900/20">
                            <AlertTriangle className="w-4 h-4" />
                            <AlertDescription className="text-xs">
                              <strong>Warning:</strong> This action is irreversible
                              <ul className="mt-1 ml-2 text-orange-300">
                                {action.consequences.map((consequence, idx) => (
                                  <li key={idx} className="text-xs">• {consequence}</li>
                                ))}
                              </ul>
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Execute Button for Selected Action */}
                  {selectedAction === action.id && action.available && (
                    <div className="mt-3 pt-3 border-t border-slate-600">
                      <Button
                        onClick={() => handleActionExecute(action)}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                        size="sm"
                      >
                        {needsConfirmation(action) ? 'Confirm Action' : 'Execute Action'}
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

        </CardContent>
      </Card>
      
      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="bg-slate-900 border-slate-600 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-400">
              <AlertTriangle className="w-5 h-5" />
              Confirm Action
            </DialogTitle>
            <DialogDescription className="text-slate-300">
              {actionToConfirm?.name} - Are you sure you want to proceed?
            </DialogDescription>
          </DialogHeader>
          
          {actionToConfirm && (
            <div className="space-y-3">
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-sm text-slate-300 mb-2">{actionToConfirm.description}</p>
                
                {/* Cost Summary */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {actionToConfirm.starCost && (
                    <Badge className="bg-yellow-900/50 text-yellow-300 border-yellow-500/50">
                      -{actionToConfirm.starCost} Stars
                    </Badge>
                  )}
                  {actionToConfirm.faithCost && (
                    <Badge className="bg-blue-900/50 text-blue-300 border-blue-500/50">
                      -{actionToConfirm.faithCost} Faith
                    </Badge>
                  )}
                  {actionToConfirm.prideCost && (
                    <Badge className="bg-red-900/50 text-red-300 border-red-500/50">
                      -{actionToConfirm.prideCost} Pride
                    </Badge>
                  )}
                </div>
                
                {/* Player Resources Check */}
                <div className="text-xs text-slate-400">
                  Current Resources: {currentPlayer.stars} Stars, {currentPlayer.stats.faith} Faith, {currentPlayer.stats.pride} Pride
                </div>
              </div>
              
              {/* Consequences */}
              {actionToConfirm.consequences && (
                <Alert className="border-orange-500/50 bg-orange-900/20">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    <strong className="text-orange-300">Consequences:</strong>
                    <ul className="mt-1 text-orange-200">
                      {actionToConfirm.consequences.map((consequence, idx) => (
                        <li key={idx} className="text-xs">• {consequence}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmAndExecute}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}