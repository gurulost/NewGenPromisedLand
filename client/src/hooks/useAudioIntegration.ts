import { useEffect } from 'react';
import { useAudio } from '../lib/stores/useAudio';
import { useSfxEngine, type SfxType } from './useSfx';

/**
 * Comprehensive audio integration hook for UI components
 * Combines HTML audio elements with procedural Web Audio API sounds
 */
export function useAudioIntegration() {
  const { initializeAudio, isInitialized, startBackgroundMusic } = useAudio();
  const playSfx = useSfxEngine();
  
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
  
  return { playSfx };
}

/**
 * Enhanced game action audio feedback
 */
export function useGameAudio() {
  const audio = useAudio();
  const playSfx = useSfxEngine();
  
  return {
    // Unit actions
    onUnitSelect: () => {
      playSfx('unit-select');
    },
    
    onUnitMove: () => {
      audio.playUnitMove();
      playSfx('unit-move');
    },
    
    onUnitAttack: () => {
      audio.playHit();
      playSfx('unit-attack');
    },
    
    onUnitBuilt: () => {
      audio.playConstruction();
      playSfx('unit-built');
    },
    
    // Building actions
    onBuildingBuilt: () => {
      audio.playConstruction();
      playSfx('building-built');
    },
    
    onCityCapture: () => {
      audio.playSuccess();
      playSfx('city-capture');
    },
    
    onVillageCapture: () => {
      audio.playSuccess();
      playSfx('village-capture');
    },
    
    // Strategic events
    onTechResearch: () => {
      audio.playSuccess();
      playSfx('tech-research');
    },
    
    onTurnStart: () => {
      playSfx('turn-start');
      audio.playAmbientSound('peaceful');
    },
    
    onTurnEnd: () => {
      playSfx('turn-end');
    },
    
    // Resource actions
    onResourceCollect: () => {
      playSfx('resource-collect');
    },
    
    // Feedback sounds
    onNotification: () => {
      audio.playNotification();
      playSfx('notification');
    },
    
    onWarning: () => {
      playSfx('warning');
    },
    
    onAchievement: () => {
      audio.playSuccess();
      playSfx('achievement');
    },
    
    onError: () => {
      playSfx('error');
    },
    
    // Context-aware ambient
    onCombatStart: () => {
      audio.playAmbientSound('combat');
    },
    
    onVictory: () => {
      audio.playAmbientSound('victory');
    },
    
    // UI interactions
    onButtonClick: () => {
      playSfx('cta-click');
    },
    
    onButtonHover: () => {
      playSfx('hover');
    },
    
    onPanelOpen: () => {
      playSfx('panel-open');
    },
    
    onPanelClose: () => {
      playSfx('panel-close');
    }
  };
}

/**
 * Audio controls for settings and user preferences
 */
export function useAudioControls() {
  const { 
    isMuted, 
    musicVolume, 
    sfxVolume, 
    musicTracks,
    currentTrackIndex,
    isMusicPlaying,
    toggleMute, 
    setMusicVolume, 
    setSfxVolume,
    setMusicTracks,
    startBackgroundMusic,
    stopBackgroundMusic,
    playNextTrack,
    shuffleTracks
  } = useAudio();
  
  return {
    isMuted,
    musicVolume,
    sfxVolume,
    musicTracks,
    currentTrackIndex,
    isMusicPlaying,
    
    toggleMute,
    setMusicVolume,
    setSfxVolume,
    setMusicTracks,
    startBackgroundMusic,
    stopBackgroundMusic,
    playNextTrack,
    shuffleTracks,
    
    muteAll: () => {
      if (!isMuted) toggleMute();
    },
    
    unmuteAll: () => {
      if (isMuted) toggleMute();
    }
  };
}