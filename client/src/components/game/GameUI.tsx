import { useEffect, useState } from "react";
import { useKeyboardControls } from "@react-three/drei";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { useGameState } from "../../lib/stores/useGameState";
import { getFaction } from "@shared/data/factions";
import PlayerHUD from "../ui/PlayerHUD";
import SelectedUnitPanel from "../ui/SelectedUnitPanel";
import CombatPanel from "../ui/CombatPanel";
import AbilitiesPanel from "../ui/AbilitiesPanel";
import TechPanel from "../ui/TechPanel";
import CityPanel from "../ui/CityPanel";
import VictoryScreen from "../ui/VictoryScreen";
import SaveLoadMenu from "../ui/SaveLoadMenu";
import { TurnTransition, useTurnTransition } from "../ui/TurnTransition";
import { SaveSystem } from "../ui/SaveSystem";
import { UnitSelectionUI } from "../effects/UnitSelection";
import { Tooltip, ActionTooltip } from "../ui/TooltipSystem";

export default function GameUI() {
  const { gameState, endTurn, useAbility, attackUnit, setGamePhase, resetGame, loadGameState } = useLocalGame();
  const { selectedUnit, setSelectedUnit } = useGameState();
  const [subscribeKeys] = useKeyboardControls();
  const [showTechPanel, setShowTechPanel] = useState(false);
  const [showCityPanel, setShowCityPanel] = useState(false);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [showSaveLoadMenu, setShowSaveLoadMenu] = useState(false);
  const [showAdvancedSaveSystem, setShowAdvancedSaveSystem] = useState(false);

  // Turn transition system
  const { isTransitioning, pendingPlayer, startTransition, completeTransition } = useTurnTransition();
  
  // Enhanced end turn with transition
  const handleEndTurn = () => {
    const nextPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    const nextPlayer = gameState.players[nextPlayerIndex];
    
    // Start turn transition animation
    startTransition(nextPlayer);
    
    // Complete turn after transition
    setTimeout(() => {
      endTurn();
      completeTransition();
    }, 1000);
  };

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

  const handleAttackUnit = (attackerId: string, targetId: string) => {
    attackUnit(attackerId, targetId);
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

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Player HUD */}
      <PlayerHUD
        player={currentPlayer}
        faction={faction}
        onShowTechPanel={() => setShowTechPanel(true)}
        onShowCityPanel={handleShowCityPanel}
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
        />
      )}

      {/* Faction Abilities Panel */}
      <AbilitiesPanel
        player={currentPlayer}
        faction={faction}
        onUseAbility={handleUseAbility}
      />

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
        onUnitAction={(action) => {
          console.log(`Unit action: ${action}`);
          // Handle unit actions (move, attack, ability)
        }}
      />

      {/* Tooltips for UI Elements */}
      <div className="pointer-events-auto">
        <Tooltip
          content={
            <ActionTooltip
              title="Advanced Save System"
              description="Access multiple save slots, auto-save, and import/export functionality"
              hotkey="Ctrl+S"
            />
          }
        >
          <button
            className="fixed top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-600 transition-all"
            onClick={() => setShowAdvancedSaveSystem(true)}
          >
            💾 Advanced Save
          </button>
        </Tooltip>
      </div>
    </div>
  );
}