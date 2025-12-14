import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Input } from "./input";
import { Badge } from "./badge";
import { Separator } from "./separator";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { 
  Save, FolderOpen, Trash2, Calendar, 
  Users, Clock, X, Download, Upload, Loader2 
} from "lucide-react";
import { PanelShell } from "../primitives/PanelShell";
import { PanelHeader } from "../primitives/PanelHeader";
import { GlowingButton } from "../primitives/GlowingButton";
import { useHotkeys } from "../../hooks/useHotkeys";
import { 
  listSaves, createSave, deleteSave as apiDeleteSave,
  type ServerSave, type SaveMetadata 
} from "../../lib/saveApi";

interface SaveLoadMenuProps {
  onClose: () => void;
  onLoadFromMenu?: boolean;
}

export default function SaveLoadMenu({ onClose, onLoadFromMenu }: SaveLoadMenuProps) {
  const { gameState, setGameState, setGamePhase } = useLocalGame();
  const [savedGames, setSavedGames] = useState<ServerSave[]>([]);
  const [saveName, setSaveName] = useState("");
  const [selectedSave, setSelectedSave] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useHotkeys('Escape', onClose);
  useHotkeys('KeyB', onClose);

  useEffect(() => {
    loadSavedGamesList();
  }, []);

  const loadSavedGamesList = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const saves = await listSaves();
      setSavedGames(saves);
    } catch (err) {
      console.error('Error loading saves:', err);
      setError('Failed to load saved games');
    } finally {
      setIsLoading(false);
    }
  };

  const saveGame = async () => {
    if (!gameState || !saveName.trim()) return;

    setIsSaving(true);
    setError(null);
    try {
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      const metadata: SaveMetadata = {
        currentPlayer: currentPlayer.name,
        turn: gameState.turn || 1,
        playerCount: gameState.players.length,
        mapSize: `${gameState.map.width}x${gameState.map.height}`,
        factions: gameState.players.map(p => p.factionId)
      };

      await createSave(saveName.trim(), gameState, metadata);
      setSaveName("");
      await loadSavedGamesList();
      console.log('Game saved successfully:', saveName);
    } catch (err) {
      console.error('Failed to save game:', err);
      setError('Failed to save game');
    } finally {
      setIsSaving(false);
    }
  };

  const loadGame = (saveId: number) => {
    const save = savedGames.find(s => s.id === saveId);
    if (!save) return;

    try {
      setGameState(save.gameState);
      if (onLoadFromMenu) {
        setGamePhase('playing');
      }
      onClose();
      console.log('Game loaded successfully:', save.name);
    } catch (err) {
      console.error('Failed to load game:', err);
      setError('Failed to load game');
    }
  };

  const deleteSave = async (saveId: number) => {
    try {
      await apiDeleteSave(saveId);
      await loadSavedGamesList();
      if (selectedSave === saveId) {
        setSelectedSave(null);
      }
    } catch (err) {
      console.error('Failed to delete save:', err);
      setError('Failed to delete save');
    }
  };

  const exportSave = (saveId: number) => {
    const save = savedGames.find(s => s.id === saveId);
    if (!save) return;

    try {
      const exportData = {
        name: save.name,
        gameState: save.gameState,
        metadata: save.metadata,
        exportedAt: new Date().toISOString()
      };
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `chronicles_${save.name.replace(/[^a-z0-9]/gi, '_')}.json`;
      link.click();
      
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export save:', err);
    }
  };

  const importSave = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (imported && imported.gameState && imported.metadata) {
          await createSave(
            imported.name || `Imported ${new Date().toLocaleDateString()}`,
            imported.gameState,
            imported.metadata
          );
          await loadSavedGamesList();
          console.log('Save imported successfully:', imported.name);
        }
      } catch (err) {
        console.error('Failed to import save:', err);
        setError('Failed to import save file');
      }
    };
    reader.readAsText(file);
    
    event.target.value = '';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
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
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-500/50 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          {/* Save Current Game */}
          {gameState && !onLoadFromMenu && (
            <div>
              <h3 className="text-lg font-semibold text-amber-100 mb-3 font-cinzel">Save Current Game</h3>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter save name..."
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  className="flex-1 bg-slate-800 border-slate-600 text-white"
                  onKeyPress={(e) => e.key === 'Enter' && saveName.trim() && saveGame()}
                  disabled={isSaving}
                />
                <GlowingButton
                  onClick={saveGame}
                  disabled={!saveName.trim() || isSaving}
                >
                  <span className="flex items-center justify-center gap-2">
                    {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                    {isSaving ? "Saving..." : "Save"}
                  </span>
                </GlowingButton>
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
                  <span className="flex items-center justify-center gap-2">
                    <Upload />
                    Import Save
                  </span>
                </GlowingButton>
              
                {selectedSave && (
                  <GlowingButton
                    variant="secondary"
                    onClick={() => exportSave(selectedSave)}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Download />
                      Export Selected
                    </span>
                  </GlowingButton>
                )}
            </div>
          </div>

          <Separator className="bg-slate-700" />

          {/* Saved Games List */}
          <div>
            <h3 className="text-lg font-semibold text-amber-100 mb-3 font-cinzel">Saved Games</h3>
            
            {isLoading ? (
              <div className="text-center py-8">
                <Loader2 className="w-12 h-12 text-amber-500 mx-auto mb-2 animate-spin" />
                <p className="text-slate-400">Loading saved games...</p>
              </div>
            ) : savedGames.length === 0 ? (
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
                            {formatDate(save.updatedAt)}
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
                          onClick={(e) => {
                            e?.stopPropagation();
                            loadGame(save.id);
                          }}
                        >
                          <FolderOpen className="w-4 h-4" />
                        </GlowingButton>
                        <GlowingButton
                          variant="destructive"
                          size="sm"
                          onClick={(e) => {
                            e?.stopPropagation();
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
                    <span className="flex items-center justify-center gap-2">
                      <FolderOpen />
                      Load Selected Game
                    </span>
                  </GlowingButton>
                </div>
              )}
        </div>
      </div>
    </PanelShell>
  );
}
