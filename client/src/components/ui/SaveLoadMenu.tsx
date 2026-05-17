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
import { useMobileUI } from "../../hooks/useMobileUI";
import { 
  listSaves, createSave, deleteSave as apiDeleteSave,
  createLocalSave,
  deleteLocalSave,
  getLocalSavesSnapshot,
  listLocalSaves,
  isExpectedCloudSaveUnavailable,
  SaveApiError,
  type ServerSave, type SaveMetadata 
} from "../../lib/saveApi";
import { loadAutosave, type AutosavePayload } from "../../lib/autosaveStorage";
import {
  trackGameSaved,
  trackMenuSelection,
} from "../../utils/telemetry/gameplayAnalytics";

const DEBUG_SAVE_LOAD = import.meta.env.DEV && import.meta.env.VITE_GAMEPLAY_DEBUG === 'true';
const debugSaveLoadLog = (...args: unknown[]) => {
  if (DEBUG_SAVE_LOAD) {
    console.debug(...args);
  }
};

interface SaveLoadMenuProps {
  onClose: () => void;
  onLoadFromMenu?: boolean;
}

export default function SaveLoadMenu({ onClose, onLoadFromMenu }: SaveLoadMenuProps) {
  const { gameState, loadGameState } = useLocalGame();
  const { isMobileUI } = useMobileUI();
  const initialSaves = getLocalSavesSnapshot();
  const [cloudSaves, setCloudSaves] = useState<ServerSave[]>([]);
  const [localSaves, setLocalSaves] = useState<ServerSave[]>(initialSaves);
  const [autosaveData, setAutosaveData] = useState<AutosavePayload | null>(null);
  const [saveName, setSaveName] = useState("");
  const [selectedSave, setSelectedSave] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cloudStatus, setCloudStatus] = useState<string | null>(null);

  const savedGames = [...cloudSaves, ...localSaves].sort((a, b) =>
    a.updatedAt < b.updatedAt ? 1 : -1
  );
  const primarySaveStorage: ServerSave["storage"] = cloudStatus ? "local" : "server";

  const getSaveSelectionKey = (save: ServerSave) => `${save.storage}:${save.id}`;

  useHotkeys('Escape', onClose);
  useHotkeys('KeyB', onClose);

  useEffect(() => {
    loadSavedGamesList();
    loadAutosaveData();
  }, []);

  const loadAutosaveData = async () => {
    try {
      const autosave = await loadAutosave();
      if (autosave) {
        setAutosaveData(autosave);
      }
    } catch (err) {
      console.error('Error loading autosave:', err);
    }
  };

  const loadSavedGamesList = async () => {
    setIsLoading(true);
    setError(null);
    setLocalSaves(listLocalSaves());
    try {
      const saves = await listSaves();
      setCloudSaves(saves);
      setCloudStatus(null);
    } catch (err) {
      if (!isExpectedCloudSaveUnavailable(err)) {
        console.error('Error loading saves:', err);
      }
      setCloudSaves([]);
      setCloudStatus(
        err instanceof SaveApiError
          ? err.message
          : 'Cloud saves are unavailable right now',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const saveGame = async (storage: ServerSave["storage"]) => {
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

      const saved = storage === "server"
        ? await createSave(saveName.trim(), gameState, metadata)
        : createLocalSave(saveName.trim(), gameState, metadata);
      trackGameSaved({
        gameState,
        source: storage === "server" ? 'manual_save_menu' : 'local_offline',
        saveId: saved.id,
        saveName: saved.name,
      });
      setSaveName("");
      await loadSavedGamesList();
      debugSaveLoadLog(`Game saved successfully (${storage}):`, saveName);
    } catch (err) {
      console.error('Failed to save game:', err);
      setError(
        err instanceof SaveApiError
          ? err.message
          : storage === "server"
            ? 'Failed to save to cloud'
            : 'Failed to save on this device',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const loadGame = (saveId: string) => {
    // Handle autosave
    if (saveId === 'autosave' && autosaveData?.gameState) {
      try {
        trackMenuSelection({ selection: 'load_autosave', location: onLoadFromMenu ? 'main_menu_load_menu' : 'in_game_load_menu' });
        loadGameState(autosaveData.gameState, { source: 'save_load_menu_autosave', saveId: 'autosave' });
        onClose();
        debugSaveLoadLog('Autosave loaded successfully');
      } catch (err) {
        console.error('Failed to load autosave:', err);
        setError('Failed to load autosave');
      }
      return;
    }

    // Handle regular saves
    const save = savedGames.find(s => getSaveSelectionKey(s) === saveId);
    if (!save) return;

    try {
      trackMenuSelection({ selection: 'load_saved_game', location: onLoadFromMenu ? 'main_menu_load_menu' : 'in_game_load_menu' });
      loadGameState(save.gameState, { source: 'save_load_menu', saveId: save.id });
      onClose();
      debugSaveLoadLog('Game loaded successfully:', save.name);
    } catch (err) {
      console.error('Failed to load game:', err);
      setError('Failed to load game');
    }
  };

  const deleteSave = async (save: ServerSave) => {
    try {
      if (save.storage === "server") {
        await apiDeleteSave(save.id);
      } else {
        deleteLocalSave(save.id);
      }
      await loadSavedGamesList();
      if (selectedSave === getSaveSelectionKey(save)) {
        setSelectedSave(null);
      }
    } catch (err) {
      console.error('Failed to delete save:', err);
      setError(
        err instanceof SaveApiError
          ? err.message
          : `Failed to delete ${save.storage === "server" ? "cloud" : "local"} save`,
      );
    }
  };

  const exportSave = (saveId: string) => {
    const save = savedGames.find(s => getSaveSelectionKey(s) === saveId);
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
          createLocalSave(
            imported.name || `Imported ${new Date().toLocaleDateString()}`,
            imported.gameState,
            imported.metadata
          );
          await loadSavedGamesList();
          debugSaveLoadLog('Save imported successfully:', imported.name);
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
    <PanelShell isOpen={true} onClose={onClose} size="full" fullScreen={isMobileUI}>
      <div
        data-testid="save-load-menu"
        className={`space-y-6 ${isMobileUI ? 'p-4 mobile-safe-top mobile-safe-bottom' : 'p-6'}`}
      >
        <PanelHeader
          icon={<Save />}
          title="Save & Load Game"
          description="Manage your game saves and continue your chronicles"
          onClose={onClose}
        />
        
        <div className={`overflow-y-auto space-y-6 touch-scroll ${isMobileUI ? 'max-h-[calc(100vh-200px)]' : 'max-h-[calc(90vh-200px)]'}`}>
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-500/50 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          {cloudStatus && (
            <div className="p-3 bg-amber-900/40 border border-amber-500/40 rounded-lg text-amber-100 text-sm">
              Cloud saves unavailable: {cloudStatus}. Device-local saves are still available below and must be created explicitly.
            </div>
          )}

          {/* Save Current Game */}
          {gameState && !onLoadFromMenu && (
            <div>
              <h3 className="text-lg font-semibold text-amber-100 mb-3 font-cinzel">Save Current Game</h3>
              <div className={`${isMobileUI ? 'flex flex-col gap-2' : 'flex gap-2'}`}>
                <Input
                  data-testid="save-load-save-name-input"
                  placeholder="Enter save name..."
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  className="flex-1 bg-slate-800 border-slate-600 text-white"
                  onKeyPress={(e) => e.key === 'Enter' && saveName.trim() && saveGame(primarySaveStorage)}
                  disabled={isSaving}
                />
                <GlowingButton
                  data-testid="save-load-save-button"
                  onClick={() => saveGame(primarySaveStorage)}
                  disabled={!saveName.trim() || isSaving}
                  aria-label="Save"
                >
                  <span className="flex items-center justify-center gap-2">
                    {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                    {isSaving ? "Saving..." : primarySaveStorage === "server" ? "Save to Cloud" : "Save on This Device"}
                  </span>
                </GlowingButton>
                {!cloudStatus && (
                  <GlowingButton
                    variant="secondary"
                    onClick={() => saveGame("local")}
                    disabled={!saveName.trim() || isSaving}
                    aria-label="Save on this device"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Save />
                      Save on This Device
                    </span>
                  </GlowingButton>
                )}
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
              
                {selectedSave !== null && (
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
            ) : savedGames.length === 0 && !autosaveData ? (
              <div className="text-center py-8">
                <FolderOpen className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400">No saved games found</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {/* Autosave Entry */}
                {autosaveData && (
                  <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    data-testid="save-entry-autosave"
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedSave === 'autosave'
                        ? 'bg-blue-600/20 border-blue-500/50'
                        : 'bg-amber-900/30 border-amber-600/50 hover:bg-amber-900/50'
                    }`}
                    onClick={() => setSelectedSave('autosave')}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-white text-lg">Last Session</h4>
                          <Badge className="bg-amber-600 text-white text-xs">Auto</Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(autosaveData.timestamp).toLocaleString()}
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {autosaveData.gameState.players.length} players
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Turn {autosaveData.gameState.turn || 1}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs text-slate-300 border-slate-500">
                            {autosaveData.gameState.map.width}x{autosaveData.gameState.map.height}
                          </Badge>
                          <Badge variant="outline" className="text-xs text-green-300 border-green-500/50">
                            {autosaveData.gameState.players[autosaveData.gameState.currentPlayerIndex]?.name}'s turn
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex gap-1 ml-2">
                        <GlowingButton
                          variant="secondary"
                          size="sm"
                          data-testid="save-entry-load-autosave"
                          aria-label="Load"
                          onClick={(e) => {
                            e?.stopPropagation();
                            loadGame('autosave');
                          }}
                        >
                          <FolderOpen className="w-4 h-4" />
                        </GlowingButton>
                      </div>
                    </div>
                  </motion.div>
                )}
                
                {/* Regular Saves */}
                {savedGames.map((save, index) => (
                  <motion.div
                    key={save.id}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    data-testid={`save-entry-${save.storage}-${save.id}`}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedSave === getSaveSelectionKey(save)
                        ? 'bg-blue-600/20 border-blue-500/50'
                        : 'bg-slate-800/50 border-slate-600 hover:bg-slate-800'
                    }`}
                    onClick={() => setSelectedSave(getSaveSelectionKey(save))}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-white text-lg">{save.name}</h4>
                          <Badge
                            variant="outline"
                            className={save.storage === "server"
                              ? "text-sky-200 border-sky-400/50"
                              : "text-amber-200 border-amber-400/50"}
                          >
                            {save.storage === "server" ? "Cloud" : "This Device"}
                          </Badge>
                        </div>
                        
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
                          data-testid={`save-entry-load-${save.id}`}
                          aria-label="Load"
                          onClick={(e) => {
                            e?.stopPropagation();
                            loadGame(getSaveSelectionKey(save));
                          }}
                        >
                          <FolderOpen className="w-4 h-4" />
                        </GlowingButton>
                        <GlowingButton
                          variant="destructive"
                          size="sm"
                          aria-label="Delete"
                          onClick={(e) => {
                            e?.stopPropagation();
                            deleteSave(save);
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
              {selectedSave !== null && (
                <div className="flex justify-center pt-4">
                  <GlowingButton
                    onClick={() => loadGame(selectedSave)}
                    size="lg"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <FolderOpen />
                      {selectedSave === 'autosave' ? 'Load Autosave' : 'Load Selected Game'}
                    </span>
                  </GlowingButton>
                </div>
              )}
        </div>
      </div>
    </PanelShell>
  );
}
