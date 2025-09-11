import { useState } from "react";
import { motion } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Input } from "./input";
import { Label } from "./label";
import { X, Plus, Users, Map, ArrowLeft, Play } from "lucide-react";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { getAllFactions } from "@shared/data/factions";
import { FactionId } from "@shared/types/faction";
import { MAP_SIZE_CONFIGS, MapSize } from "@shared/utils/mapGenerator";
import { ContentShell } from "../primitives/ContentShell";
import { PanelHeader } from "../primitives/PanelHeader";
import { GlowingButton } from "../primitives/GlowingButton";
import { useHotkeys } from "../../hooks/useHotkeys";

interface PlayerSetupData {
  id: string;
  name: string;
  factionId: FactionId | null;
  isAI: boolean;
  aiDifficulty: 'easy' | 'normal' | 'hard';
}

export default function PlayerSetup() {
  const { setGamePhase, startLocalGame } = useLocalGame();
  const [players, setPlayers] = useState<PlayerSetupData[]>([
    { id: '1', name: 'Player 1', factionId: null, isAI: false, aiDifficulty: 'normal' },
    { id: '2', name: 'AI Player', factionId: null, isAI: true, aiDifficulty: 'normal' },
  ]);
  const [selectedMapSize, setSelectedMapSize] = useState<MapSize>('normal');

  const factions = getAllFactions();
  const usedFactions = players.map(p => p.factionId).filter(Boolean);

  useHotkeys('Escape', () => setGamePhase('menu'));

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
        factionId: null,
        isAI: false,
        aiDifficulty: 'normal'
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
        turnOrder: index,
        isAI: p.isAI,
        aiDifficulty: p.aiDifficulty
      })), selectedMapSize);
    }
  };

  return (
    <div 
      className="w-full h-full p-4 overflow-y-auto"
      style={{
        backgroundImage: 'url(/images/mesoamerican_background.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="min-h-full flex items-center justify-center py-8">
        <div className="w-full max-w-2xl">
          <ContentShell size="2xl">
            <div className="p-6 space-y-6">
              <PanelHeader
                icon={<Users />}
                title="Local Game Setup"
                description="Configure players for pass-and-play mode"
              />
              
              <div className="space-y-4">
                {players.map((player, index) => (
                  <motion.div
                    key={player.id}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-slate-800/50 border border-slate-600 rounded-lg p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-1 space-y-2">
                        <Label htmlFor={`name-${player.id}`} className="text-amber-100">Player Name</Label>
                        <Input
                          id={`name-${player.id}`}
                          value={player.name}
                          onChange={(e) => updatePlayer(player.id, 'name', e.target.value)}
                          className="bg-slate-700 border-slate-600 text-white"
                          placeholder="Enter player name"
                        />
                      </div>
                      
                      <div className="flex-1 space-y-2">
                        <Label htmlFor={`faction-${player.id}`} className="text-amber-100">Faction</Label>
                        <Select
                          value={player.factionId || ""}
                          onValueChange={(value) => updatePlayer(player.id, 'factionId', value)}
                        >
                          <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                            <SelectValue placeholder="Choose faction" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-600">
                            {factions.map(faction => (
                              <SelectItem 
                                key={faction.id} 
                                value={faction.id}
                                disabled={usedFactions.includes(faction.id) && player.factionId !== faction.id}
                                className="text-white hover:bg-slate-700"
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
                        <GlowingButton
                          variant="destructive"
                          size="sm"
                          onClick={() => removePlayer(player.id)}
                        />
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              {players.length < 6 && (
                <GlowingButton
                  variant="secondary"
                  onClick={addPlayer}
                  className="w-full"
                >
                  Add Player (Max 6)
                </GlowingButton>
              )}

              {/* Map Size Selection */}
              <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
                <div className="space-y-3">
                  <Label htmlFor="map-size" className="text-amber-100 flex items-center gap-2">
                    <Map className="w-4 h-4" />
                    Map Size
                  </Label>
                  <Select value={selectedMapSize} onValueChange={(value: MapSize) => setSelectedMapSize(value)}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      {Object.entries(MAP_SIZE_CONFIGS).map(([size, config]) => (
                        <SelectItem 
                          key={size} 
                          value={size}
                          className="text-white hover:bg-slate-700"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{config.name}</span>
                            <span className="text-xs text-slate-400">
                              {config.tiles} tiles • Recommended for {getRecommendedPlayers(size as MapSize)}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-400">
                    Selected: {MAP_SIZE_CONFIGS[selectedMapSize].name} map with {MAP_SIZE_CONFIGS[selectedMapSize].tiles} tiles
                  </p>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <GlowingButton
                  variant="secondary"
                  onClick={() => setGamePhase('menu')}
                  className="flex-1"
                >
                  Back to Menu
                </GlowingButton>
                
                <GlowingButton
                  onClick={handleStartGame}
                  disabled={!canStart}
                  className="flex-1"
                >
                  Start Game
                </GlowingButton>
              </div>

              {!canStart && (
                <div className="text-center p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-400">
                    {players.some(p => !p.name.trim()) && "All players need names. "}
                    {players.some(p => !p.factionId) && "All players need factions. "}
                    {new Set(players.map(p => p.factionId)).size !== players.length && "Each player needs a unique faction."}
                  </p>
                </div>
              )}
            </div>
          </ContentShell>
        </div>
      </div>
    </div>
  );
}
