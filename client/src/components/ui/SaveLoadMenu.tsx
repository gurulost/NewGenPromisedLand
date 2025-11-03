import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Input } from "./input";
import { Badge } from "./badge";
import { Separator } from "./separator";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { 
  Save, FolderOpen, Trash2, Calendar, 
  Users, Clock, X, Download, Upload, Loader2, CheckCircle 
} from "lucide-react";
import { compress, decompress } from "lz-string";
import { PanelShell } from "../primitives/PanelShell";
import { PanelHeader } from "../primitives/PanelHeader";
import { GlowingButton } from "../primitives/GlowingButton";
import { useHotkeys } from "../../hooks/useHotkeys";
import { useToastContext } from "./ToastProvider";
import { EnhancedButton } from "./EnhancedButton";

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
  const toast = useToastContext();
  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
  const [saveName, setSaveName] = useState("");
  const [selectedSave, setSelectedSave] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Note: Hotkeys are handled by PanelShell, no need to duplicate here

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

  const saveGame = async () => {
    if (!gameState || !saveName.trim()) {
      toast?.warning('Invalid Save', 'Please enter a save name');
      return;
    }

    setIsSaving(true);
    toast?.info('Saving Game', 'Compressing and storing game data...');

    try {
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      const save: SavedGame = {
        id: `save_${Date.now()}`,
        name: saveName.trim(),
        timestamp: Date.now(),
        gameState: gameState,
        metadata: {
          currentPlayer: currentPlayer.name,
          turn: gameState.turn || 1,
          playerCount: gameState.players.length,
          mapSize: `${gameState.map.width}x${gameState.map.height}`
        }
      };

      // Add small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const compressed = compress(JSON.stringify(save));
      localStorage.setItem(`chronicles_save_${save.id}`, compressed);
      setSaveName("");
      loadSavedGamesList();
      
      setSaveSuccess(true);
      toast?.success('Game Saved!', `Successfully saved "${save.name}"`);
      
      // Reset success state after a delay
      setTimeout(() => {
        setSaveSuccess(false);
      }, 2000);
    } catch (error) {
      toast?.error('Save Failed', 'Could not save the game. Please try again.');
      console.error('Failed to save game:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const loadGame = async (saveId: string) => {
    const save = savedGames.find(s => s.id === saveId);
    if (!save) {
      toast?.error('Load Failed', 'Save file not found');
      return;
    }

    setIsLoading(true);
    toast?.info('Loading Game', `Loading "${save.name}"...`);

    try {
      // Add small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 600));
      
      setGameState(save.gameState);
      toast?.success('Game Loaded!', `Successfully loaded "${save.name}"`);
      
      // Close the menu after a brief delay
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      toast?.error('Load Failed', 'Could not load the game. The save file may be corrupted.');
      console.error('Failed to load game:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSave = (saveId: string) => {
    const save = savedGames.find(s => s.id === saveId);
    const saveName = save?.name || 'Unknown Save';
    
    try {
      localStorage.removeItem(`chronicles_save_${saveId}`);
      loadSavedGamesList();
      if (selectedSave === saveId) {
        setSelectedSave(null);
      }
      toast?.success('Save Deleted', `"${saveName}" has been deleted`);
    } catch (error) {
      toast?.error('Delete Failed', 'Could not delete the save file');
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
    <PanelShell isOpen={true} onClose={onClose} size="full">
      <div className="p-6 space-y-6">
        <PanelHeader
          icon={<Save />}
          title="Save & Load Game"
          description="Manage your game saves and continue your chronicles"
          onClose={onClose}
        />
        
        <div className="max-h-[calc(90vh-200px)] overflow-y-auto space-y-6">
          {/* Save Current Game */}
          {gameState && (
            <div>
              <h3 className="text-lg font-semibold text-amber-100 mb-3 font-cinzel">Save Current Game</h3>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter save name..."
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  className="flex-1 bg-slate-800 border-slate-600 text-white"
                  onKeyPress={(e) => e.key === 'Enter' && saveName.trim() && saveGame()}
                />
                <EnhancedButton
                  onClick={saveGame}
                  disabled={!saveName.trim() || isSaving}
                  loading={isSaving}
                  variant={saveSuccess ? "success" : "primary"}
                  icon={saveSuccess ? CheckCircle : (isSaving ? Loader2 : Save)}
                  glow
                >
                  {isSaving ? "Saving..." : saveSuccess ? "Saved!" : "Save"}
                </EnhancedButton>
              </div>
            </div>
          )}

          <Separator className="bg-slate-700" />

          {/* Import/Export */}
          <div>
            <h3 className="text-lg font-semibold text-amber-100 mb-3 font-cinzel">Import/Export</h3>
            <div className="flex gap-2">
              <input
                type="file"
                accept=".json"
                onChange={importSave}
                className="hidden"
                id="import-save"
              />
              <GlowingButton
                variant="secondary"
                onClick={() => document.getElementById('import-save')?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Import Save
              </GlowingButton>
              
              {selectedSave && (
                <GlowingButton
                  variant="secondary"
                  onClick={() => exportSave(selectedSave)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Selected
                </GlowingButton>
              )}
            </div>
          </div>

          <Separator className="bg-slate-700" />

          {/* Saved Games List */}
          <div>
            <h3 className="text-lg font-semibold text-amber-100 mb-3 font-cinzel">Saved Games</h3>
            
            {savedGames.length === 0 ? (
              <div className="text-center py-8">
                <FolderOpen className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400">No saved games found</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {savedGames.map((save, index) => (
                  <motion.div
                    key={save.id}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
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
                        <GlowingButton
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            loadGame(save.id);
                          }}
                        >
                          <FolderOpen className="w-4 h-4" />
                        </GlowingButton>
                        <GlowingButton
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            deleteSave(save.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </GlowingButton>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Load Button */}
          {selectedSave && (
            <div className="flex justify-center pt-4">
              <GlowingButton
                onClick={() => loadGame(selectedSave)}
                size="lg"
              >
                <FolderOpen className="w-5 h-5 mr-2" />
                Load Selected Game
              </GlowingButton>
            </div>
          )}
        </div>
      </div>
    </PanelShell>
  );
}