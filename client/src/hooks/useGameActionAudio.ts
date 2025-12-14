import { useGameAudio } from './useAudioIntegration';
import { GameAction } from '../../../shared/types/game';

/**
 * Hook that provides audio feedback for game actions
 * Integrates with the game state context to play sounds on actions
 */
export function useGameActionAudio() {
  const gameAudio = useGameAudio();

  const playActionAudio = (action: GameAction) => {
    switch (action.type) {
      // Unit Actions
      case 'MOVE_UNIT':
        gameAudio.onUnitMove();
        break;

      case 'ATTACK_UNIT':
        gameAudio.onUnitAttack();
        break;

      case 'USE_ABILITY':
        gameAudio.onUnitSelect(); // Ability activation
        break;

      case 'BUILD_UNIT':
        gameAudio.onUnitBuilt();
        break;

      case 'HEAL_UNIT':
        gameAudio.onNotification();
        break;

      // Construction Actions
      case 'START_CONSTRUCTION':
      case 'BUILD_STRUCTURE':
        gameAudio.onBuildingBuilt();
        break;

      case 'BUILD_IMPROVEMENT':
        gameAudio.onBuildingBuilt();
        break;

      // Strategic Actions  
      case 'RESEARCH_TECH':
      case 'RESEARCH_TECHNOLOGY':
        gameAudio.onTechResearch();
        break;

      case 'END_TURN':
        gameAudio.onTurnEnd();
        break;

      // Conquest Actions
      case 'CAPTURE_CITY':
        gameAudio.onCityCapture();
        break;

      case 'EXPLORE_RUINS':
        gameAudio.onTechResearch();
        break;

      case 'CONQUER_VILLAGE':
        gameAudio.onVillageCapture();
        break;

      case 'CONVERT_VILLAGE':
        gameAudio.onVillageCapture(); // Same sound for both types
        break;

      case 'CONVERT_CITY':
        gameAudio.onCityCapture(); // City conversion
        break;

      case 'UPGRADE_UNIT':
        gameAudio.onUnitBuilt(); // Unit enhancement
        break;

      // Resource Actions
      case 'HARVEST_RESOURCE':
      case 'WORLD_ELEMENT_HARVEST':
        gameAudio.onResourceCollect();
        break;

      // Diplomacy Actions
      case 'DECLARE_WAR':
        gameAudio.onCombatStart();
        break;

      case 'FORM_ALLIANCE':
        gameAudio.onAchievement();
        break;

      // Faction Actions
      case 'ACTIVATE_FACTION_ABILITY':
        gameAudio.onAchievement();
        break;

      // Error/Warning Actions
      default:
        // For unhandled actions, play a subtle notification
        if (action.type.includes('ERROR') || action.type.includes('FAIL')) {
          gameAudio.onError();
        } else {
          gameAudio.onNotification();
        }
        break;
    }
  };

  // Audio feedback for turn transitions
  const playTurnTransitionAudio = (playerName: string, isCurrentPlayer: boolean) => {
    if (isCurrentPlayer) {
      gameAudio.onTurnStart();
    } else {
      gameAudio.onTurnEnd();
    }
  };

  // Audio feedback for combat outcomes
  const playCombatAudio = (outcome: 'victory' | 'defeat' | 'damage') => {
    switch (outcome) {
      case 'victory':
        gameAudio.onVictory();
        break;
      case 'defeat':
        gameAudio.onWarning();
        break;
      case 'damage':
        gameAudio.onUnitAttack();
        break;
    }
  };

  // Audio feedback for notifications
  const playNotificationAudio = (type: 'success' | 'warning' | 'error' | 'info') => {
    switch (type) {
      case 'success':
        gameAudio.onAchievement();
        break;
      case 'warning':
        gameAudio.onWarning();
        break;
      case 'error':
        gameAudio.onError();
        break;
      case 'info':
      default:
        gameAudio.onNotification();
        break;
    }
  };

  return {
    playActionAudio,
    playTurnTransitionAudio,
    playCombatAudio,
    playNotificationAudio,

    // Direct access to game audio functions
    gameAudio
  };
}