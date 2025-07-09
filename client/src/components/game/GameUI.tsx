import { useEffect, useState } from "react";
import { useKeyboardControls } from "@react-three/drei";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { useGameState } from "../../lib/stores/useGameState";
import { getFaction } from "@shared/data/factions";
import PlayerHUD from "../ui/PlayerHUD";
import SelectedUnitPanel from "../ui/SelectedUnitPanel";
import CombatPanel from "../ui/CombatPanel";
import { AbilitiesPanel } from "../ui/AbilitiesPanel";
import TechPanel from "../ui/TechPanel";
import CityPanel from "../ui/CityPanel";
import { BuildingMenu } from "../ui/BuildingMenu";
import VictoryScreen from "../ui/VictoryScreen";
import SaveLoadMenu from "../ui/SaveLoadMenu";
import { TurnTransition, useTurnTransition } from "../ui/TurnTransition";
import { SaveSystem } from "../ui/SaveSystem";
import { UnitSelectionUI } from "../effects/UnitSelection";
import { ActionTooltip } from "../ui/TooltipSystem";
import { WorldElementPanel } from "../ui/WorldElementPanel";
import { STRUCTURE_DEFINITIONS, IMPROVEMENT_DEFINITIONS } from "@shared/types/city";
import { UNIT_DEFINITIONS } from "@shared/data/units";
import { getWorldElement, WORLD_ELEMENTS } from "../../../../shared/data/worldElements";
import type { Unit } from "@shared/types/unit";

export default function GameUI() {
  const { gameState, endTurn, useAbility, attackUnit, setGamePhase, resetGame, loadGameState } = useLocalGame();
  const { selectedUnit, setSelectedUnit, constructionMode, cancelConstruction, isMovementMode, isAttackMode, setMovementMode, setAttackMode } = useGameState();
  const [subscribeKeys] = useKeyboardControls();
  const [showTechPanel, setShowTechPanel] = useState(false);
  const [showCityPanel, setShowCityPanel] = useState(false);
  const [showConstructionHall, setShowConstructionHall] = useState(false);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [showSaveLoadMenu, setShowSaveLoadMenu] = useState(false);
  const [showAdvancedSaveSystem, setShowAdvancedSaveSystem] = useState(false);
  const [hoveredEnemy, setHoveredEnemy] = useState<Unit | null>(null);
  const [selectedWorldElement, setSelectedWorldElement] = useState<{
    elementId: string;
    coordinate: { q: number; r: number; s: number };
  } | null>(null);

  // Turn transition system
  const { isTransitioning, pendingPlayer, startTransition, completeTransition } = useTurnTransition();
  
  if (!gameState) return null;

  // Enhanced end turn with transition  
  const handleEndTurn = () => {
    if (!gameState) return;
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const nextPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    const nextPlayer = gameState.players[nextPlayerIndex];
    
    // Start turn transition animation
    startTransition(nextPlayer);
    
    // Complete turn after transition
    setTimeout(() => {
      endTurn(currentPlayer.id); // Pass the current player's ID
      completeTransition();
    }, 1000);
  };

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

  // Save/Load keyboard shortcut
  useEffect(() => {
    const unsubscribe = subscribeKeys(
      (state) => state.save,
      (pressed) => {
        if (pressed) {
          setShowSaveLoadMenu(true);
        }
      }
    );
    return unsubscribe;
  }, [subscribeKeys]);

  // Handle world element actions
  const handleWorldElementAction = (actionType: 'harvest' | 'build') => {
    if (!selectedWorldElement) return;
    
    const action = {
      type: actionType === 'harvest' ? 'WORLD_ELEMENT_HARVEST' : 'WORLD_ELEMENT_BUILD',
      payload: {
        playerId: currentPlayer.id,
        elementId: selectedWorldElement.elementId,
        coordinate: selectedWorldElement.coordinate
      }
    } as any;
    
    // Dispatch the action through the game reducer
    useLocalGame.getState().dispatch(action);
    setSelectedWorldElement(null);
  };

  // Detect clicks on world element tiles
  useEffect(() => {
    const handleTileClick = (event: any) => {
      if (event.detail?.coordinate && event.detail?.resources) {
        const { coordinate, resources } = event.detail;
        
        // Check if any resource is a world element
        for (const resource of resources) {
          if (WORLD_ELEMENTS[resource]) {
            setSelectedWorldElement({
              elementId: resource,
              coordinate
            });
            return;
          }
        }
      }
    };

    window.addEventListener('tileClick', handleTileClick);
    return () => window.removeEventListener('tileClick', handleTileClick);
  }, []);

  // Check for victory conditions
  useEffect(() => {
    if (gameState?.winner) {
      // Victory screen will be shown
      return;
    }
    
    // Check faith victory
    const faithWinner = gameState?.players.find(p => p.stats.faith >= 100);
    if (faithWinner) {
      // Set winner and trigger victory screen
      const updatedState = { ...gameState, winner: faithWinner.id };
      // This would ideally be handled by the game reducer
      return;
    }
    
    // Check elimination victory
    const activePlayers = gameState?.players.filter(p => !p.isEliminated);
    if (activePlayers && activePlayers.length === 1) {
      // Set winner and trigger victory screen
      const updatedState = { ...gameState, winner: activePlayers[0].id };
      // This would ideally be handled by the game reducer
      return;
    }
  }, [gameState]);

  // Remove duplicate - using enhanced version above

  const handleUseAbility = (abilityId: string) => {
    useAbility(currentPlayer.id, abilityId);
  };

  const handleActivateAbility = (abilityId: string, targetId?: string) => {
    // Dispatch the faction ability action through the game store
    const action = {
      type: 'ACTIVATE_FACTION_ABILITY' as const,
      payload: {
        playerId: currentPlayer.id,
        abilityId,
        targetId
      }
    };
    
    // Get dispatch from useLocalGame store
    const { dispatch } = useLocalGame.getState();
    dispatch(action);
  };

  const handleAttackUnit = (attackerId: string, targetId: string) => {
    attackUnit(attackerId, targetId);
  };

  const handleUnitAction = (action: string) => {
    if (!selectedUnit) return;
    
    switch (action) {
      case 'attack':
        // Enter attack mode - show attack indicators
        console.log('Attack mode activated');
        setAttackMode(true);
        break;
      case 'move':
        // Enter move mode - show movement indicators  
        console.log('Move mode activated');
        setMovementMode(true);
        break;
      case 'ability':
        // Use unit ability
        console.log('Using unit ability');
        break;
    }
  };

  const handleShowCityPanel = () => {
    const playerCity = gameState.cities?.find(city => 
      currentPlayer.citiesOwned.includes(city.id)
    );
    if (playerCity) {
      setSelectedCityId(playerCity.id);
      setShowCityPanel(true);
    }
  };

  const handleShowConstructionHall = () => {
    const playerCity = gameState.cities?.find(city => 
      currentPlayer.citiesOwned.includes(city.id)
    );
    if (playerCity) {
      setSelectedCityId(playerCity.id);
      setShowConstructionHall(true);
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Construction Mode Indicator - Positioned in top-right corner */}
      {constructionMode.isActive && (
        <div className="absolute top-4 right-4 pointer-events-auto z-50">
          <div className="bg-black/90 text-white px-4 py-3 rounded-lg border-2 border-yellow-400 shadow-lg backdrop-blur-sm max-w-xs">
            <div className="text-center">
              <h3 className="text-sm font-bold mb-1">Construction Mode</h3>
              <p className="text-xs mb-2">Select a tile to build: <span className="font-semibold text-yellow-300">{constructionMode.buildingType}</span></p>
              <button 
                onClick={cancelConstruction}
                className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-xs text-white font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Player HUD */}
      <PlayerHUD
        player={currentPlayer}
        faction={faction}
        onShowTechPanel={() => setShowTechPanel(true)}
        onShowConstructionHall={handleShowConstructionHall}
        onEndTurn={handleEndTurn}
      />

      {/* Selected Unit Panel */}
      {selectedUnit && (
        <SelectedUnitPanel unit={selectedUnit} />
      )}

      {/* Combat Panel */}
      {selectedUnit && (
        <CombatPanel
          selectedUnit={selectedUnit}
          gameState={gameState}
          onAttackUnit={handleAttackUnit}
          hoveredEnemy={hoveredEnemy}
        />
      )}

      {/* Faction Abilities Panel */}
      <div className="absolute top-4 left-80 pointer-events-auto">
        <AbilitiesPanel
          currentPlayer={currentPlayer}
          gameState={gameState}
          onActivateAbility={handleActivateAbility}
        />
      </div>

      {/* Tech Panel Modal */}
      <TechPanel
        open={showTechPanel}
        onClose={() => setShowTechPanel(false)}
      />

      {/* City Panel Modal */}
      {selectedCityId && (
        <CityPanel
          open={showCityPanel}
          onClose={() => setShowCityPanel(false)}
          cityId={selectedCityId as string}
        />
      )}

      {/* Construction Hall */}
      {showConstructionHall && selectedCityId && (
        <BuildingMenu
          city={gameState.cities?.find(c => c.id === selectedCityId)!}
          player={currentPlayer}
          gameState={gameState}
          onBuild={(optionId) => {
            // Handle construction logic
            console.log('Starting construction:', optionId);
            // Determine building category
            let category: 'improvements' | 'structures' | 'units';
            
            if (Object.values(STRUCTURE_DEFINITIONS).some(s => s.id === optionId)) {
              category = 'structures';
            } else if (Object.values(UNIT_DEFINITIONS).some(u => u.type === optionId)) {
              category = 'units';
            } else {
              category = 'improvements';
            }
            
            // Use the game state construction system
            const { startConstruction } = useGameState.getState();
            startConstruction(optionId, category, selectedCityId, currentPlayer.id);
            setShowConstructionHall(false);
          }}
          onClose={() => setShowConstructionHall(false)}
          onShowCities={() => {
            setShowConstructionHall(false);
            setShowCityPanel(true);
          }}
        />
      )}

      {/* Victory Screen */}
      {gameState?.winner && (
        <VictoryScreen
          winnerId={gameState.winner}
          victoryType="faith" // This would be determined by victory conditions
          onPlayAgain={() => {
            resetGame();
            setGamePhase('menu');
          }}
          onMainMenu={() => {
            resetGame();
            setGamePhase('menu');
          }}
        />
      )}

      {/* Save/Load Menu */}
      {showSaveLoadMenu && (
        <SaveLoadMenu
          onClose={() => setShowSaveLoadMenu(false)}
        />
      )}

      {/* World Element Panel */}
      {selectedWorldElement && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <WorldElementPanel
            gameState={gameState}
            playerId={currentPlayer.id}
            elementId={selectedWorldElement.elementId}
            coordinate={selectedWorldElement.coordinate}
            onAction={handleWorldElementAction}
            onClose={() => setSelectedWorldElement(null)}
          />
        </div>
      )}

      {/* Advanced Save System */}
      {showAdvancedSaveSystem && (
        <SaveSystem
          currentGameState={gameState}
          onLoadGame={(loadedState) => {
            loadGameState(loadedState);
            setShowAdvancedSaveSystem(false);
          }}
          onClose={() => setShowAdvancedSaveSystem(false)}
        />
      )}

      {/* Turn Transition Animation */}
      <TurnTransition
        isVisible={isTransitioning}
        currentPlayer={pendingPlayer || currentPlayer}
        onComplete={completeTransition}
      />

      {/* Enhanced Unit Selection UI */}
      <UnitSelectionUI
        selectedUnit={selectedUnit}
        onUnitAction={handleUnitAction}
      />

      {/* Save System Button - Bottom Right */}
      <div className="pointer-events-auto">
        <button
          className="fixed bottom-6 right-6 p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-600 transition-all shadow-lg"
          onClick={() => setShowAdvancedSaveSystem(true)}
          title="Advanced Save System"
        >
          💾 Advanced Save
        </button>
      </div>
    </div>
  );
}