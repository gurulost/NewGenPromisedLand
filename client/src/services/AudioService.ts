import { useAudio } from '../lib/stores/useAudio';

/**
 * Pure AudioService class for use in non-React contexts like Zustand stores
 * Uses store.getState() instead of hooks to avoid violating Rules of Hooks
 */
export class AudioService {
  private static instance: AudioService;

  private constructor() {}

  public static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }

  /**
   * Get current audio store state without hooks
   */
  private getAudioState() {
    return useAudio.getState();
  }

  /**
   * Play sound with error handling
   */
  private safePlay(soundMethod: () => void, soundName: string) {
    try {
      const state = this.getAudioState();
      if (!state.isMuted && state.isInitialized) {
        soundMethod();
      }
    } catch (error) {
      console.debug(`Audio playback failed for ${soundName}:`, error);
    }
  }

  // Unit actions
  onUnitSelect() {
    this.safePlay(() => {
      // Simple notification sound for unit selection
      this.getAudioState().playNotification();
    }, 'unit-select');
  }

  onUnitMove() {
    this.safePlay(() => {
      this.getAudioState().playUnitMove();
    }, 'unit-move');
  }

  onUnitAttack() {
    this.safePlay(() => {
      this.getAudioState().playHit();
    }, 'unit-attack');
  }

  onUnitBuilt() {
    this.safePlay(() => {
      this.getAudioState().playConstruction();
    }, 'unit-built');
  }

  // Building actions
  onBuildingBuilt() {
    this.safePlay(() => {
      this.getAudioState().playConstruction();
    }, 'building-built');
  }

  onCityCapture() {
    this.safePlay(() => {
      this.getAudioState().playSuccess();
    }, 'city-capture');
  }

  onVillageCapture() {
    this.safePlay(() => {
      this.getAudioState().playSuccess();
    }, 'village-capture');
  }

  // Strategic events
  onTechResearch() {
    this.safePlay(() => {
      this.getAudioState().playSuccess();
    }, 'tech-research');
  }

  onTurnStart() {
    this.safePlay(() => {
      this.getAudioState().playNotification();
    }, 'turn-start');
  }

  onTurnEnd() {
    this.safePlay(() => {
      this.getAudioState().playNotification();
    }, 'turn-end');
  }

  // Resource actions
  onResourceCollect() {
    this.safePlay(() => {
      this.getAudioState().playSuccess();
    }, 'resource-collect');
  }

  // Feedback sounds
  onNotification() {
    this.safePlay(() => {
      this.getAudioState().playNotification();
    }, 'notification');
  }

  onWarning() {
    this.safePlay(() => {
      this.getAudioState().playHit();
    }, 'warning');
  }

  onAchievement() {
    this.safePlay(() => {
      this.getAudioState().playSuccess();
    }, 'achievement');
  }

  onError() {
    this.safePlay(() => {
      this.getAudioState().playHit();
    }, 'error');
  }

  // Combat context
  onCombatStart() {
    this.safePlay(() => {
      this.getAudioState().playHit();
    }, 'combat-start');
  }

  onVictory() {
    this.safePlay(() => {
      this.getAudioState().playSuccess();
    }, 'victory');
  }

  // UI interactions
  onButtonClick() {
    this.safePlay(() => {
      this.getAudioState().playNotification();
    }, 'button-click');
  }

  onButtonHover() {
    // Subtle hover sound - could be skipped to avoid audio spam
  }

  onPanelOpen() {
    this.safePlay(() => {
      this.getAudioState().playNotification();
    }, 'panel-open');
  }

  onPanelClose() {
    this.safePlay(() => {
      this.getAudioState().playNotification();
    }, 'panel-close');
  }
}

// Export singleton instance
export const audioService = AudioService.getInstance();