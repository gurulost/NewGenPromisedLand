import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Button } from "./button";
import { Input } from "./input";
import { Badge } from "./badge";
import { Separator } from "./separator";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { 
  Save, FolderOpen, Trash2, Calendar, 
  Users, Clock, X, Download, Upload 
} from "lucide-react";
import { compress, decompress } from "lz-string";

interface SaveLoadMenuProps {
  onClose: () => void;
}

interface SavedGame {
  id: string;
  name: string;
  timestamp: number;
  gameState: any;
  metadata: {
    currentPlayer: string;
    turn: number;
    playerCount: number;
    mapSize: string;
  };
}

export default function SaveLoadMenu({ onClose }: SaveLoadMenuProps) {
  const { gameState, setGameState } = useLocalGame();
  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
  const [saveName, setSaveName] = useState("");
  const [selectedSave, setSelectedSave] = useState<string | null>(null);

  useEffect(() => {
    loadSavedGamesList();
  }, []);

  const loadSavedGamesList = () => {
    try {
      const saves: SavedGame[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('chronicles_save_')) {
          const compressed = localStorage.getItem(key);
          if (compressed) {
            try {
              const decompressed = decompress(compressed);
              if (decompressed) {
                const saveData = JSON.parse(decompressed);
                saves.push(saveData);
              }
            } catch (e) {
              console.warn('Failed to load save:', key, e);
            }
          }
        }
      }
      saves.sort((a, b) => b.timestamp - a.timestamp);
      setSavedGames(saves);
    } catch (error) {
      console.error('Error loading saves:', error);
    }
  };

  const saveGame = () => {
    if (!gameState || !saveName.trim()) return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const save: SavedGame = {
      id: `save_${Date.now()}`,
      name: saveName.trim(),
      timestamp: Date.now(),
      gameState: gameState,
      metadata: {
        currentPlayer: currentPlayer.name,
        turn: gameState.currentTurn || 1,
        playerCount: gameState.players.length,
        mapSize: `${gameState.map.width}x${gameState.map.height}`
      }
    };

    try {
      const compressed = compress(JSON.stringify(save));
      localStorage.setItem(`chronicles_save_${save.id}`, compressed);
      setSaveName("");
      loadSavedGamesList();
      
      console.log('Game saved successfully:', save.name);
    } catch (error) {
      console.error('Failed to save game:', error);
    }
  };

  const loadGame = (saveId: string) => {
    const save = savedGames.find(s => s.id === saveId);
    if (!save) return;

    try {
      setGameState(save.gameState);
      onClose();
      console.log('Game loaded successfully:', save.name);
    } catch (error) {
      console.error('Failed to load game:', error);
    }
  };

  const deleteSave = (saveId: string) => {
    try {
      localStorage.removeItem(`chronicles_save_${saveId}`);
      loadSavedGamesList();
      if (selectedSave === saveId) {
        setSelectedSave(null);
      }
    } catch (error) {
      console.error('Failed to delete save:', error);
    }
  };

  const exportSave = (saveId: string) => {
    const save = savedGames.find(s => s.id === saveId);
    if (!save) return;

    try {
      const dataStr = JSON.stringify(save, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `chronicles_${save.name.replace(/[^a-z0-9]/gi, '_')}.json`;
      link.click();
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export save:', error);
    }
  };

  const importSave = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (imported && imported.gameState && imported.metadata) {
          imported.id = `save_${Date.now()}`;
          imported.timestamp = Date.now();
          
          const compressed = compress(JSON.stringify(imported));
          localStorage.setItem(`chronicles_save_${imported.id}`, compressed);
          loadSavedGamesList();
          console.log('Save imported successfully:', imported.name);
        }
      } catch (error) {
        console.error('Failed to import save:', error);
      }
    };
    reader.readAsText(file);
    
    // Reset input
    event.target.value = '';
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto">
      <Card className="w-[700px] max-h-[80vh] overflow-hidden bg-slate-900 border-slate-600">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-white font-cinzel">
              <Save className="w-6 h-6 text-blue-400" />
              Save & Load Game
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
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Save Current Game */}
          {gameState && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3 font-cinzel">Save Current Game</h3>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter save name..."
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  className="flex-1 bg-slate-800 border-slate-600 text-white"
                  onKeyPress={(e) => e.key === 'Enter' && saveName.trim() && saveGame()}
                />
                <Button
                  onClick={saveGame}
                  disabled={!saveName.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </div>
            </div>
          )}

          <Separator className="bg-slate-700" />

          {/* Import/Export */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3 font-cinzel">Import/Export</h3>
            <div className="flex gap-2">
              <input
                type="file"
                accept=".json"
                onChange={importSave}
                className="hidden"
                id="import-save"
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById('import-save')?.click()}
                className="border-slate-600 text-slate-300"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import Save
              </Button>
              
              {selectedSave && (
                <Button
                  variant="outline"
                  onClick={() => exportSave(selectedSave)}
                  className="border-slate-600 text-slate-300"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Selected
                </Button>
              )}
            </div>
          </div>

          <Separator className="bg-slate-700" />

          {/* Saved Games List */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3 font-cinzel">Saved Games</h3>
            
            {savedGames.length === 0 ? (
              <div className="text-center py-8">
                <FolderOpen className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400">No saved games found</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {savedGames.map((save) => (
                  <div
                    key={save.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedSave === save.id
                        ? 'bg-blue-600/20 border-blue-500/50'
                        : 'bg-slate-800/50 border-slate-600 hover:bg-slate-800'
                    }`}
                    onClick={() => setSelectedSave(save.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-white text-lg">{save.name}</h4>
                        
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(save.timestamp)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {save.metadata.playerCount} players
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Turn {save.metadata.turn}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs text-slate-300 border-slate-500">
                            {save.metadata.mapSize}
                          </Badge>
                          <Badge variant="outline" className="text-xs text-green-300 border-green-500/50">
                            {save.metadata.currentPlayer}'s turn
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex gap-1 ml-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            loadGame(save.id);
                          }}
                          className="border-green-600 text-green-300 hover:bg-green-600/20"
                        >
                          <FolderOpen className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSave(save.id);
                          }}
                          className="border-red-600 text-red-300 hover:bg-red-600/20"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Load Button */}
          {selectedSave && (
            <div className="flex justify-center">
              <Button
                onClick={() => loadGame(selectedSave)}
                className="bg-green-600 hover:bg-green-700 px-8"
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                Load Selected Game
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}