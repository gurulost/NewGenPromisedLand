import { useState } from "react";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Input } from "./input";
import { Label } from "./label";
import { X, Plus } from "lucide-react";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { getAllFactions } from "@shared/data/factions";
import { FactionId } from "@shared/types/faction";
import { MAP_SIZE_CONFIGS, MapSize } from "@shared/utils/mapGenerator";

interface PlayerSetupData {
  id: string;
  name: string;
  factionId: FactionId | null;
}

export default function PlayerSetup() {
  const { setGamePhase, startLocalGame } = useLocalGame();
  const [players, setPlayers] = useState<PlayerSetupData[]>([
    { id: '1', name: 'Player 1', factionId: null },
    { id: '2', name: 'Player 2', factionId: null },
  ]);
  const [selectedMapSize, setSelectedMapSize] = useState<MapSize>('normal');

  const factions = getAllFactions();
  const usedFactions = players.map(p => p.factionId).filter(Boolean);

  // Helper function to get recommended player count for each map size
  const getRecommendedPlayers = (mapSize: MapSize): string => {
    switch (mapSize) {
      case 'tiny': return '2 players';
      case 'small': return '2-3 players';
      case 'normal': return '3-4 players';
      case 'large': return '4-6 players';
      case 'huge': return '6-8 players';
      default: return '2-4 players';
    }
  };

  const addPlayer = () => {
    if (players.length < 6) {
      setPlayers([...players, {
        id: (players.length + 1).toString(),
        name: `Player ${players.length + 1}`,
        factionId: null
      }]);
    }
  };

  const removePlayer = (id: string) => {
    if (players.length > 2) {
      setPlayers(players.filter(p => p.id !== id));
    }
  };

  const updatePlayer = (id: string, field: keyof PlayerSetupData, value: string) => {
    setPlayers(players.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const canStart = players.length >= 2 && 
                   players.every(p => p.name.trim() && p.factionId) &&
                   new Set(players.map(p => p.factionId)).size === players.length;

  const handleStartGame = () => {
    if (canStart) {
      startLocalGame(players.map((p, index) => ({
        id: p.id,
        name: p.name,
        factionId: p.factionId!,
        turnOrder: index
      })), selectedMapSize);
    }
  };

  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <Card className="w-full max-w-2xl bg-black/80 border-amber-600/50 text-white">
        <CardHeader>
          <CardTitle className="text-2xl text-amber-400 text-center">
            Local Game Setup
          </CardTitle>
          <p className="text-gray-300 text-center text-sm">
            Configure players for pass-and-play mode
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {players.map((player, index) => (
              <Card key={player.id} className="bg-gray-800/50 border-gray-600">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor={`name-${player.id}`}>Player Name</Label>
                      <Input
                        id={`name-${player.id}`}
                        value={player.name}
                        onChange={(e) => updatePlayer(player.id, 'name', e.target.value)}
                        className="bg-gray-700 border-gray-600 text-white"
                        placeholder="Enter player name"
                      />
                    </div>
                    
                    <div className="flex-1 space-y-2">
                      <Label htmlFor={`faction-${player.id}`}>Faction</Label>
                      <Select
                        value={player.factionId || ""}
                        onValueChange={(value) => updatePlayer(player.id, 'factionId', value)}
                      >
                        <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                          <SelectValue placeholder="Choose faction" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-600">
                          {factions.map(faction => (
                            <SelectItem 
                              key={faction.id} 
                              value={faction.id}
                              disabled={usedFactions.includes(faction.id) && player.factionId !== faction.id}
                              className="text-white hover:bg-gray-700"
                            >
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: faction.color }}
                                />
                                {faction.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {players.length > 2 && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => removePlayer(player.id)}
                        className="border-red-600 text-red-400 hover:bg-red-600/20"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {players.length < 6 && (
            <Button
              variant="outline"
              onClick={addPlayer}
              className="w-full border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Player (Max 6)
            </Button>
          )}

          {/* Map Size Selection */}
          <Card className="bg-gray-800/50 border-gray-600">
            <CardContent className="p-4">
              <div className="space-y-3">
                <Label htmlFor="map-size">Map Size</Label>
                <Select value={selectedMapSize} onValueChange={(value: MapSize) => setSelectedMapSize(value)}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    {Object.entries(MAP_SIZE_CONFIGS).map(([size, config]) => (
                      <SelectItem 
                        key={size} 
                        value={size}
                        className="text-white hover:bg-gray-700"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{config.name}</span>
                          <span className="text-xs text-gray-400">
                            {config.tiles} tiles • Recommended for {getRecommendedPlayers(size as MapSize)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-400">
                  Selected: {MAP_SIZE_CONFIGS[selectedMapSize].name} map with {MAP_SIZE_CONFIGS[selectedMapSize].tiles} tiles
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4 pt-4">
            <Button
              variant="outline"
              onClick={() => setGamePhase('menu')}
              className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Back to Menu
            </Button>
            
            <Button
              onClick={handleStartGame}
              disabled={!canStart}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-600 disabled:text-gray-400"
            >
              Start Game
            </Button>
          </div>

          {!canStart && (
            <div className="text-center">
              <p className="text-sm text-red-400">
                {players.some(p => !p.name.trim()) && "All players need names. "}
                {players.some(p => !p.factionId) && "All players need factions. "}
                {new Set(players.map(p => p.factionId)).size !== players.length && "Each player needs a unique faction."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
