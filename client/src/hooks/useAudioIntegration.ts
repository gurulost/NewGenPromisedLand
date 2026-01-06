import { useCallback, useEffect } from 'react';
import { useAudio } from '../lib/stores/useAudio';
import { useUserPreferences } from './useUserPreferences';

/**
 * Comprehensive audio integration hook for UI components
 * Combines HTML audio elements with Howler-driven SFX
 */
export function useAudioIntegration() {
  const {
    initializeAudio,
    isInitialized,
    startBackgroundMusic,
    pauseBackgroundMusic,
    resumeBackgroundMusic,
    isMuted,
    isMusicPlaying,
    playSfx,
  } = useAudio();
  
  // Initialize audio system on first user interaction
  useEffect(() => {
    const handleFirstInteraction = async () => {
      if (!isInitialized) {
        await initializeAudio();
        startBackgroundMusic();
        document.removeEventListener('click', handleFirstInteraction);
        document.removeEventListener('keydown', handleFirstInteraction);
      }
    };
    
    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('keydown', handleFirstInteraction);
    
    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [initializeAudio, isInitialized, startBackgroundMusic]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (isMusicPlaying && !isMuted) {
          pauseBackgroundMusic(true);
        }
        return;
      }

      if (document.visibilityState === 'visible' && isInitialized && !isMuted) {
        resumeBackgroundMusic();
      }
    };

    const handleWindowBlur = () => {
      if (isMusicPlaying && !isMuted) {
        pauseBackgroundMusic(true);
      }
    };

    const handleWindowFocus = () => {
      if (document.visibilityState === 'visible' && isInitialized && !isMuted) {
        resumeBackgroundMusic();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [isInitialized, isMuted, isMusicPlaying, pauseBackgroundMusic, resumeBackgroundMusic]);
  
  return { playSfx };
}

/**
 * Enhanced game action audio feedback
 */
export function useGameAudio() {
  const audio = useAudio();
  
  return {
    // Unit actions
    onUnitSelect: () => {
      audio.playSfx('unit-select');
    },
    
    onUnitMove: () => {
      audio.playUnitMove();
    },
    
    onUnitAttack: () => {
      audio.playSfx('unit-attack');
    },
    
    onUnitBuilt: () => {
      audio.playSfx('unit-built');
    },
    
    // Building actions
    onBuildingBuilt: () => {
      audio.playSfx('building-built');
    },
    
    onCityCapture: () => {
      audio.playSfx('city-capture');
    },
    
    onVillageCapture: () => {
      audio.playSfx('village-capture');
    },
    
    // Strategic events
    onTechResearch: () => {
      audio.playSfx('tech-research');
    },
    
    onTurnStart: () => {
      audio.playSfx('turn-start');
    },
    
    onTurnEnd: () => {
      audio.playSfx('turn-end');
    },
    
    // Resource actions
    onResourceCollect: () => {
      audio.playSfx('resource-collect');
    },
    
    // Feedback sounds
    onNotification: () => {
      audio.playNotification();
    },
    
    onWarning: () => {
      audio.playSfx('warning');
    },
    
    onAchievement: () => {
      audio.playSfx('achievement');
    },
    
    onError: () => {
      audio.playSfx('error');
    },
    
    // Context-aware ambient
    onCombatStart: () => {
    },
    
    onVictory: () => {
    },
    
    // UI interactions
    onButtonClick: () => {
      audio.playSfx('cta-click');
    },
    
    onButtonHover: () => {
      audio.playSfx('hover');
    },
    
    onPanelOpen: () => {
      audio.playSfx('panel-open');
    },
    
    onPanelClose: () => {
      audio.playSfx('panel-close');
    }
  };
}

/**
 * Audio controls for settings and user preferences
 */
export function useAudioControls() {
  const audio = useAudio();
  const { updateAudio } = useUserPreferences();

  const persistAudio = useCallback((updates: Parameters<typeof updateAudio>[0]) => {
    void updateAudio(updates).catch(() => {});
  }, [updateAudio]);

  const persistSnapshot = useCallback((overrides: Parameters<typeof updateAudio>[0] = {}) => {
    persistAudio({
      masterVolume: overrides.masterVolume ?? audio.masterVolume,
      musicVolume: overrides.musicVolume ?? audio.musicVolume,
      sfxVolume: overrides.sfxVolume ?? audio.sfxVolume,
      isMuted: overrides.isMuted ?? audio.isMuted,
    });
  }, [audio.masterVolume, audio.musicVolume, audio.sfxVolume, audio.isMuted, persistAudio]);

  const toggleMute = useCallback(() => {
    const nextMuted = !audio.isMuted;
    audio.setMuted(nextMuted);
    persistSnapshot({ isMuted: nextMuted });
  }, [audio, persistSnapshot]);

  const setMasterVolume = useCallback((volume: number) => {
    audio.setMasterVolume(volume);
    persistSnapshot({ masterVolume: volume });
  }, [audio, persistSnapshot]);

  const setMusicVolume = useCallback((volume: number) => {
    audio.setMusicVolume(volume);
    persistSnapshot({ musicVolume: volume });
  }, [audio, persistSnapshot]);

  const setSfxVolume = useCallback((volume: number) => {
    audio.setSfxVolume(volume);
    persistSnapshot({ sfxVolume: volume });
  }, [audio, persistSnapshot]);
  
  return {
    isMuted: audio.isMuted,
    masterVolume: audio.masterVolume,
    musicVolume: audio.musicVolume,
    sfxVolume: audio.sfxVolume,
    musicTracks: audio.musicTracks,
    currentTrackIndex: audio.currentTrackIndex,
    isMusicPlaying: audio.isMusicPlaying,
    
    toggleMute,
    setMasterVolume,
    setMusicVolume,
    setSfxVolume,
    setMusicTracks: audio.setMusicTracks,
    startBackgroundMusic: audio.startBackgroundMusic,
    stopBackgroundMusic: audio.stopBackgroundMusic,
    playNextTrack: audio.playNextTrack,
    shuffleTracks: audio.shuffleTracks,
    
    muteAll: () => {
      if (!audio.isMuted) toggleMute();
    },
    
    unmuteAll: () => {
      if (audio.isMuted) toggleMute();
    }
  };
}
