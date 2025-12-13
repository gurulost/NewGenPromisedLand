import { useEffect, useState } from "react";
import { useKeyboardControls } from "@react-three/drei";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { useGameState } from "../../lib/stores/useGameState";
import { useAITurn } from "../../hooks/useAITurn";
import { getFaction } from "@shared/data/factions";
import { PlayerHUD } from "../hud/PlayerHUD";
import SelectedUnitPanel from "../ui/SelectedUnitPanel";
import UnitActionsPanel from "../ui/AbilitiesPanel";
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
import MovementControls from "../game/MovementControls";
import { STRUCTURE_DEFINITIONS, IMPROVEMENT_DEFINITIONS } from "@shared/types/city";
import { UNIT_DEFINITIONS } from "@shared/data/units";
import { getWorldElement, WORLD_ELEMENTS } from "@shared/data/worldElements";
import type { Unit } from "@shared/types/unit";

export default function GameUI() {
  const { gameState, endTurn, useAbility, attackUnit, setGamePhase, resetGame, loadGameState } = useLocalGame();
  const { selectedUnit, setSelectedUnit, constructionMode, cancelConstruction, isMovementMode, isAttackMode, setMovementMode, setAttackMode, reachableCoordinates } = useGameState();
  const [subscribeKeys] = useKeyboardControls();
  const [showTechPanel, setShowTechPanel] = useState(false);
  const [showCityPanel, setShowCityPanel] = useState(false);
  const [showConstructionHall, setShowConstructionHall] = useState(false);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [showSaveLoadMenu, setShowSaveLoadMenu] = useState(false);
  const [showAdvancedSaveSystem, setShowAdvancedSaveSystem] = useState(false);
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [showCitySelector, setShowCitySelector] = useState(false);
  const [citySelectorAction, setCitySelectorAction] = useState<'city_panel' | 'construction'>('city_panel');

  const [selectedWorldElement, setSelectedWorldElement] = useState<{
    elementId: string;
    coordinate: { q: number; r: number; s: number };
  } | null>(null);

  // Turn transition system
  const { isTransitioning, pendingPlayer, startTransition, completeTransition } = useTurnTransition();
  
  if (!gameState) return null;

  // Enable AI opponents
  useAITurn();

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  
  // Guard against undefined currentPlayer (can happen during turn transitions with 4+ players)
  if (!currentPlayer) {
    console.warn('GameUI: currentPlayer is undefined at index', gameState.currentPlayerIndex);
    return null;
  }

  const faction = getFaction(currentPlayer.factionId as any);

  // Enhanced end turn with transition  
  const handleEndTurn = () => {
    if (!gameState || !currentPlayer) return;
    
    const nextPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    const nextPlayer = gameState.players[nextPlayerIndex];
    
    // Guard against undefined next player
    if (!nextPlayer) {
      console.warn('GameUI: nextPlayer is undefined at index', nextPlayerIndex);
      return;
    }
    
    // Start turn transition animation
    startTransition(nextPlayer);
    
    // Complete turn after transition
    setTimeout(() => {
      endTurn(currentPlayer.id); // Pass the current player's ID
      completeTransition();
    }, 1000);
  };

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
    const handleWorldElementClick = (event: CustomEvent) => {
      if (event.detail?.coordinate && event.detail?.resources) {
        const { coordinate, resources } = event.detail;
        
        // Enhanced logging for debugging
        console.log('🌍 World element click detected:', { coordinate, resources, availableElements: Object.keys(WORLD_ELEMENTS) });
        
        // Check if any resource is a world element
        for (const resource of resources) {
          if (WORLD_ELEMENTS[resource]) {
            console.log('✅ Setting selected world element:', resource, coordinate);
            setSelectedWorldElement({
              elementId: resource,
              coordinate
            });
            return;
          } else {
            console.log('❌ Resource not in WORLD_ELEMENTS:', resource);
          }
        }
        console.log('⚠️ No world elements found in resources:', resources);
      } else {
        console.log('⚠️ Invalid world element click event:', event.detail);
      }
    };

    // Listen for world element clicks
    window.addEventListener('worldElementClick', handleWorldElementClick as EventListener);
    
    return () => {
      window.removeEventListener('worldElementClick', handleWorldElementClick as EventListener);
    };
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
    const playerCities = gameState.cities?.filter(city => 
      currentPlayer.citiesOwned.includes(city.id)
    ) || [];
    
    if (playerCities.length === 0) {
      console.log('No cities owned by player');
      return;
    }
    
    if (playerCities.length === 1) {
      setSelectedCityId(playerCities[0].id);
      setShowCityPanel(true);
    } else {
      setCitySelectorAction('city_panel');
      setShowCitySelector(true);
    }
  };

  const handleShowConstructionHall = () => {
    const playerCities = gameState.cities?.filter(city => 
      currentPlayer.citiesOwned.includes(city.id)
    ) || [];
    
    if (playerCities.length === 0) {
      console.log('No cities owned by player');
      return;
    }
    
    if (playerCities.length === 1) {
      setSelectedCityId(playerCities[0].id);
      setShowConstructionHall(true);
    } else {
      setCitySelectorAction('construction');
      setShowCitySelector(true);
    }
  };

  const handleSelectCity = (cityId: string) => {
    setSelectedCityId(cityId);
    setShowCitySelector(false);
    
    if (citySelectorAction === 'city_panel') {
      setShowCityPanel(true);
    } else {
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

      {/* Movement Mode Controls */}
      {isMovementMode && selectedUnit && (
        <MovementControls 
          selectedUnit={selectedUnit}
          reachableCount={reachableCoordinates.length}
        />
      )}

      {/* Player HUD */}
      <PlayerHUD
        player={currentPlayer}
        gameState={gameState}
        onShowTechPanel={() => setShowTechPanel(true)}
        onShowConstructionHall={handleShowConstructionHall}
        onEndTurn={handleEndTurn}
      />

      {/* Selected Unit Panel - Unified interface with all unit actions */}
      {selectedUnit && (
        <SelectedUnitPanel unit={selectedUnit} />
      )}

      {/* Combat Panel removed - all functionality consolidated into SelectedUnitPanel */}

      {/* NOTE: Faction Abilities Panel removed - consolidated into unit-specific UnitActionsPanel */}

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
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm pointer-events-auto"
          onClick={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) {
              setShowConstructionHall(false);
            }
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ pointerEvents: 'auto' }}
          >
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
          </div>
        </div>
      )}

      {/* City Selector Dialog */}
      {showCitySelector && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm pointer-events-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCitySelector(false);
            }
          }}
        >
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-amber-500/40 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-cinzel font-bold text-amber-100 mb-4 text-center">
              Select a City
            </h2>
            <p className="text-amber-200/70 text-sm text-center mb-4">
              {citySelectorAction === 'city_panel' ? 'Choose a city to view' : 'Choose a city for construction'}
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {gameState.cities?.filter(city => 
                currentPlayer.citiesOwned.includes(city.id)
              ).map(city => (
                <button
                  key={city.id}
                  onClick={() => handleSelectCity(city.id)}
                  className="w-full p-3 bg-amber-900/30 hover:bg-amber-700/40 border border-amber-500/30 hover:border-amber-500/60 rounded-lg transition-all text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-amber-100">{city.name}</div>
                      <div className="text-xs text-amber-300/70">
                        Population: {city.population} | Level: {city.level}
                      </div>
                    </div>
                    <div className="text-amber-400 text-sm">
                      +{city.starProduction} ⭐/turn
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCitySelector(false)}
              className="w-full mt-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
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
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm pointer-events-auto"
          onClick={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) {
              setSelectedWorldElement(null);
            }
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ pointerEvents: 'auto' }}
          >
            <WorldElementPanel
              gameState={gameState}
              playerId={currentPlayer.id}
              elementId={selectedWorldElement.elementId}
              coordinate={selectedWorldElement.coordinate}
              onAction={handleWorldElementAction}
              onClose={() => setSelectedWorldElement(null)}
            />
          </div>
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
