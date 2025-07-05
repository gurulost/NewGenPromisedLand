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

export default function GameUI() {
  const { gameState, endTurn, useAbility, attackUnit, setGamePhase, resetGame } = useLocalGame();
  const { selectedUnit, setSelectedUnit } = useGameState();
  const [subscribeKeys] = useKeyboardControls();
  const [showTechPanel, setShowTechPanel] = useState(false);
  const [showCityPanel, setShowCityPanel] = useState(false);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [showSaveLoadMenu, setShowSaveLoadMenu] = useState(false);

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

  const handleEndTurn = () => {
    endTurn(currentPlayer.id);
  };

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
    </div>
  );
}