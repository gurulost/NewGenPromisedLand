import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Trash2, Download, Upload, Calendar, Clock, Users } from 'lucide-react';
import { GameState } from '../../../shared/types/game';
import { compress, decompress } from 'lz-string';

interface SaveSlot {
  id: string;
  name: string;
  gameState: GameState;
  timestamp: number;
  thumbnail?: string;
  playerCount: number;
  turn: number;
  currentPlayer: string;
  autoSave?: boolean;
}

interface SaveSystemProps {
  currentGameState: GameState;
  onLoadGame: (gameState: GameState) => void;
  onClose: () => void;
}

export function SaveSystem({ currentGameState, onLoadGame, onClose }: SaveSystemProps) {
  const [saves, setSaves] = useState<SaveSlot[]>([]);
  const [saveName, setSaveName] = useState('');
  const [selectedSave, setSelectedSave] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadSaveSlots();
  }, []);

  // Auto-save every 5 minutes during gameplay
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (currentGameState.phase === 'playing') {
        createAutoSave();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(autoSaveInterval);
  }, [currentGameState]);

  const loadSaveSlots = () => {
    try {
      const saveIndices = JSON.parse(localStorage.getItem('game_save_indices') || '[]');
      const loadedSaves: SaveSlot[] = [];

      for (const saveId of saveIndices) {
        const saveData = localStorage.getItem(`game_save_${saveId}`);
        if (saveData) {
          try {
            const decompressed = decompress(saveData);
            if (decompressed) {
              const save = JSON.parse(decompressed);
              loadedSaves.push(save);
            }
          } catch (error) {
            console.warn(`Failed to load save ${saveId}:`, error);
          }
        }
      }

      setSaves(loadedSaves.sort((a, b) => b.timestamp - a.timestamp));
    } catch (error) {
      console.error('Failed to load save slots:', error);
    }
  };

  const createSave = (name: string, isAutoSave = false) => {
    if (!name.trim() && !isAutoSave) return;

    const saveId = `save_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const displayName = isAutoSave ? `Auto-save ${new Date().toLocaleTimeString()}` : name.trim();
    
    const save: SaveSlot = {
      id: saveId,
      name: displayName,
      gameState: currentGameState,
      timestamp: Date.now(),
      thumbnail: generateThumbnail(currentGameState),
      playerCount: currentGameState.players.length,
      turn: currentGameState.turn,
      currentPlayer: currentGameState.players[currentGameState.currentPlayerIndex]?.name || 'Unknown',
      autoSave: isAutoSave
    };

    try {
      const compressed = compress(JSON.stringify(save));
      localStorage.setItem(`game_save_${saveId}`, compressed);

      const saveIndices = JSON.parse(localStorage.getItem('game_save_indices') || '[]');
      saveIndices.push(saveId);
      
      // Keep only the last 20 saves to prevent storage overflow
      if (saveIndices.length > 20) {
        const oldSaveId = saveIndices.shift();
        localStorage.removeItem(`game_save_${oldSaveId}`);
      }
      
      localStorage.setItem('game_save_indices', JSON.stringify(saveIndices));
      
      loadSaveSlots();
      setSaveName('');
    } catch (error) {
      console.error('Failed to save game:', error);
      alert('Failed to save game. Storage might be full.');
    }
  };

  const createAutoSave = () => {
    // Remove old auto-saves (keep only 3)
    const autoSaves = saves.filter(save => save.autoSave);
    if (autoSaves.length >= 3) {
      deleteSave(autoSaves[autoSaves.length - 1].id);
    }
    
    createSave('', true);
  };

  const deleteSave = (saveId: string) => {
    try {
      localStorage.removeItem(`game_save_${saveId}`);
      
      const saveIndices = JSON.parse(localStorage.getItem('game_save_indices') || '[]');
      const updatedIndices = saveIndices.filter((id: string) => id !== saveId);
      localStorage.setItem('game_save_indices', JSON.stringify(updatedIndices));
      
      loadSaveSlots();
      setSelectedSave(null);
    } catch (error) {
      console.error('Failed to delete save:', error);
    }
  };

  const loadSave = (save: SaveSlot) => {
    onLoadGame(save.gameState);
    onClose();
  };

  const exportSave = (save: SaveSlot) => {
    setIsExporting(true);
    try {
      const dataStr = JSON.stringify(save, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `${save.name.replace(/[^a-z0-9]/gi, '_')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export save:', error);
      alert('Failed to export save file.');
    } finally {
      setIsExporting(false);
    }
  };

  const importSave = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const saveData = JSON.parse(e.target?.result as string);
        
        // Validate save data structure
        if (!saveData.gameState || !saveData.name) {
          throw new Error('Invalid save file format');
        }

        // Create new save with imported data
        const newSaveId = `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const importedSave: SaveSlot = {
          ...saveData,
          id: newSaveId,
          timestamp: Date.now()
        };

        const compressed = compress(JSON.stringify(importedSave));
        localStorage.setItem(`game_save_${newSaveId}`, compressed);

        const saveIndices = JSON.parse(localStorage.getItem('game_save_indices') || '[]');
        saveIndices.push(newSaveId);
        localStorage.setItem('game_save_indices', JSON.stringify(saveIndices));

        loadSaveSlots();
        alert('Save file imported successfully!');
      } catch (error) {
        console.error('Failed to import save:', error);
        alert('Failed to import save file. Please check the file format.');
      }
    };
    
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  const generateThumbnail = (gameState: GameState): string => {
    // Generate a simple visual representation of the game state
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Background gradient
      const gradient = ctx.createLinearGradient(0, 0, 120, 80);
      gradient.addColorStop(0, '#1e293b');
      gradient.addColorStop(1, '#0f172a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 120, 80);
      
      // Simple visualization of player positions
      const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
      gameState.players.forEach((player, index) => {
        ctx.fillStyle = colors[index % colors.length];
        const x = 20 + (index % 3) * 30;
        const y = 20 + Math.floor(index / 3) * 30;
        ctx.fillRect(x, y, 20, 20);
      });
      
      // Turn indicator
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px Arial';
      ctx.fillText(`Turn ${gameState.turn}`, 10, 70);
    }
    
    return canvas.toDataURL();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <motion.div
        className="bg-slate-900 rounded-xl border border-slate-600 w-[800px] max-h-[80vh] overflow-hidden shadow-2xl"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
      >
        {/* Header */}
        <div className="bg-slate-800 px-6 py-4 border-b border-slate-600">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white font-cinzel">Save & Load Game</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[calc(80vh-80px)] overflow-y-auto">
          {/* Quick Save */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white font-cinzel">Quick Save</h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Enter save name..."
                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                onKeyPress={(e) => e.key === 'Enter' && createSave(saveName)}
              />
              <button
                onClick={() => createSave(saveName)}
                disabled={!saveName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-400 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>

          {/* Import/Export */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white font-cinzel">Import/Export</h3>
            <div className="flex gap-3">
              <label className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors cursor-pointer flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Import Save
                <input
                  type="file"
                  accept=".json"
                  onChange={importSave}
                  className="hidden"
                />
              </label>
              
              {selectedSave && (
                <button
                  onClick={() => {
                    const save = saves.find(s => s.id === selectedSave);
                    if (save) exportSave(save);
                  }}
                  disabled={isExporting}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {isExporting ? 'Exporting...' : 'Export Selected'}
                </button>
              )}
            </div>
          </div>

          {/* Save Slots */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white font-cinzel">Saved Games</h3>
            
            {saves.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                No saved games found
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
                <AnimatePresence>
                  {saves.map((save) => (
                    <SaveSlotCard
                      key={save.id}
                      save={save}
                      isSelected={selectedSave === save.id}
                      onSelect={() => setSelectedSave(save.id)}
                      onLoad={() => loadSave(save)}
                      onDelete={() => deleteSave(save.id)}
                      onExport={() => exportSave(save)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function SaveSlotCard({
  save,
  isSelected,
  onSelect,
  onLoad,
  onDelete,
  onExport
}: {
  save: SaveSlot;
  isSelected: boolean;
  onSelect: () => void;
  onLoad: () => void;
  onDelete: () => void;
  onExport: () => void;
}) {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <motion.div
      className={`
        p-4 rounded-lg border cursor-pointer transition-all
        ${isSelected 
          ? 'border-blue-500 bg-blue-500/10' 
          : 'border-slate-600 bg-slate-800 hover:border-slate-500'
        }
      `}
      onClick={onSelect}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      layout
    >
      <div className="flex items-center gap-4">
        {/* Thumbnail */}
        {save.thumbnail && (
          <div className="w-16 h-12 rounded border border-slate-600 overflow-hidden flex-shrink-0">
            <img 
              src={save.thumbnail} 
              alt="Save thumbnail"
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Save Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-white truncate">{save.name}</h4>
            {save.autoSave && (
              <span className="text-xs bg-slate-600 px-2 py-0.5 rounded text-slate-300">
                Auto
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(save.timestamp)}
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {save.playerCount} players
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Turn {save.turn}
            </div>
          </div>
          
          <div className="text-xs text-slate-500 mt-1">
            Current: {save.currentPlayer}
          </div>
        </div>

        {/* Actions */}
        {isSelected && (
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onLoad();
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
            >
              Load
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExport();
              }}
              className="px-2 py-1.5 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="px-2 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}