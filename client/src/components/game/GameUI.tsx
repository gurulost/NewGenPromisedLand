import { useEffect } from "react";
import { useKeyboardControls } from "@react-three/drei";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { useGameState } from "../../lib/stores/useGameState";
import { getFaction } from "@shared/data/factions";
import { getUnitDefinition } from "@shared/data/units";

export default function GameUI() {
  const { gameState, endTurn, useAbility } = useLocalGame();
  const { selectedUnit, hoveredTile, setSelectedUnit } = useGameState();
  const [subscribeKeys, getKeys] = useKeyboardControls();

  if (!gameState) return null;

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const faction = getFaction(currentPlayer.factionId as any);

  // Keyboard controls
  useEffect(() => {
    const unsubscribe = subscribeKeys(
      (state) => state.endTurn,
      (pressed) => {
        if (pressed) {
          handleEndTurn();
        }
      }
    );
    return unsubscribe;
  }, [subscribeKeys]);

  // Deselect unit with escape
  useEffect(() => {
    const unsubscribe = subscribeKeys(
      (state) => state.cancel,
      (pressed) => {
        if (pressed && selectedUnit) {
          setSelectedUnit(null);
        }
      }
    );
    return unsubscribe;
  }, [subscribeKeys, selectedUnit, setSelectedUnit]);

  const handleEndTurn = () => {
    endTurn(currentPlayer.id);
  };

  const handleUseAbility = (abilityId: string) => {
    useAbility(currentPlayer.id, abilityId);
  };

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Top HUD - Player Info - Mobile Responsive */}
      <div className="absolute top-2 left-2 right-2 md:top-4 md:left-4 md:right-4 flex justify-between items-start pointer-events-auto">
        <Card className="bg-black/80 border-gray-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded-full" 
                style={{ backgroundColor: faction.color }}
              />
              {currentPlayer.name} ({faction.name})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">Faith:</span>
              <Progress 
                value={currentPlayer.stats.faith} 
                className="flex-1 h-2"
                style={{ 
                  background: `linear-gradient(90deg, var(--faith-color) ${currentPlayer.stats.faith}%, #374151 ${currentPlayer.stats.faith}%)`
                }}
              />
              <span className="text-xs w-8">{currentPlayer.stats.faith}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Pride:</span>
              <Progress 
                value={currentPlayer.stats.pride} 
                className="flex-1 h-2"
                style={{ 
                  background: `linear-gradient(90deg, var(--pride-color) ${currentPlayer.stats.pride}%, #374151 ${currentPlayer.stats.pride}%)`
                }}
              />
              <span className="text-xs w-8">{currentPlayer.stats.pride}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Dissent:</span>
              <Progress 
                value={currentPlayer.stats.internalDissent} 
                className="flex-1 h-2"
                style={{ 
                  background: `linear-gradient(90deg, var(--dissent-color) ${currentPlayer.stats.internalDissent}%, #374151 ${currentPlayer.stats.internalDissent}%)`
                }}
              />
              <span className="text-xs w-8">{currentPlayer.stats.internalDissent}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/80 border-gray-600 text-white">
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-sm text-gray-300">Turn</div>
              <div className="text-xl font-bold">{gameState.turn}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Panel - Faction Abilities */}
      <div className="absolute top-4 right-4 pointer-events-auto">
        <Card className="bg-black/80 border-gray-600 text-white w-64">
          <CardHeader>
            <CardTitle className="text-base">Faction Abilities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {faction.abilities.map(ability => (
              <Button
                key={ability.id}
                variant="outline"
                size="sm"
                className="w-full text-left justify-start"
                onClick={() => handleUseAbility(ability.id)}
                disabled={
                  !!(ability.requirements?.faith && currentPlayer.stats.faith < ability.requirements.faith) ||
                  !!(ability.requirements?.pride && currentPlayer.stats.pride < ability.requirements.pride)
                }
              >
                <div>
                  <div className="font-medium">{ability.name}</div>
                  <div className="text-xs text-gray-400">{ability.description}</div>
                  {ability.cost > 0 && (
                    <div className="text-xs text-blue-400">Cost: {ability.cost}</div>
                  )}
                </div>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Left - Unit Info */}
      {selectedUnit && (
        <div className="absolute bottom-4 left-4 pointer-events-auto">
          <Card className="bg-black/80 border-gray-600 text-white w-80">
            <CardHeader>
              <CardTitle className="text-base">
                {getUnitDefinition(selectedUnit.type).name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">HP:</span> {selectedUnit.hp}/{selectedUnit.maxHp}
                </div>
                <div>
                  <span className="text-gray-400">Attack:</span> {selectedUnit.attack}
                </div>
                <div>
                  <span className="text-gray-400">Defense:</span> {selectedUnit.defense}
                </div>
                <div>
                  <span className="text-gray-400">Movement:</span> {selectedUnit.remainingMovement}/{selectedUnit.movement}
                </div>
              </div>
              <div className="text-xs text-gray-300">
                {getUnitDefinition(selectedUnit.type).description}
              </div>
              <div className="text-xs">
                <span className="text-gray-400">Status:</span> {selectedUnit.status}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bottom Center - Actions - Mobile Responsive */}
      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 md:bottom-4 pointer-events-auto">
        <div className="flex gap-2">
          <Button
            onClick={handleEndTurn}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 md:px-6 text-sm md:text-base"
          >
            End Turn (T)
          </Button>
        </div>
      </div>

      {/* Help Panel - Bottom Left - Mobile Responsive */}
      <div className="absolute bottom-2 left-2 md:bottom-4 md:left-4 pointer-events-auto">
        <Card className="bg-black/80 border-gray-600 text-white w-52 md:w-64">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs md:text-sm">Controls</CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            <div>• Tap your units to select them (bright units)</div>
            <div>• Tap blue tiles to move selected unit</div>
            <div>• Units can move multiple times per turn</div>
            <div>• Press T to end turn and switch players</div>
            <div>• Press Escape to deselect unit</div>
            <div>• Pinch/drag to pan and zoom camera</div>
          </CardContent>
        </Card>
      </div>

      {/* Tile info (if hovering) */}
      {hoveredTile && (
        <div className="absolute bottom-20 right-4 pointer-events-none">
          <Card className="bg-black/90 border-gray-600 text-white">
            <CardContent className="p-3">
              <div className="text-sm">
                <div>
                  <span className="text-gray-400">Terrain:</span> {hoveredTile.tile.terrain}
                </div>
                <div>
                  <span className="text-gray-400">Coordinate:</span> ({hoveredTile.tile.coordinate.q}, {hoveredTile.tile.coordinate.r})
                </div>
                {hoveredTile.tile.hasCity && (
                  <div>
                    <span className="text-gray-400">City Owner:</span> {hoveredTile.tile.cityOwner || 'None'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
