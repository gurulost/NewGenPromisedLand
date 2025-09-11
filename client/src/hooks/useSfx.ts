import { useCallback, useMemo } from 'react';
import { useAudio } from '../lib/stores/useAudio';

export type SfxType = 
  | 'panel-open' | 'panel-close' | 'cta-click' | 'error' | 'hover' | 'success'
  | 'unit-select' | 'unit-move' | 'unit-attack' | 'unit-built' | 'building-built'
  | 'tech-research' | 'turn-start' | 'turn-end' | 'city-capture' | 'village-capture'
  | 'resource-collect' | 'notification' | 'warning' | 'achievement';

// Throttle map to prevent sound spam
const throttleMap = new Map<SfxType, number>();
const THROTTLE_DURATION = 150; // ms

export function useSfxEngine() {
  const { isMuted, sfxVolume } = useAudio();
  // Sound effect configurations
  const soundConfig = useMemo(() => ({
    // UI Interactions
    'panel-open': { frequency: 440, duration: 0.1, type: 'sine' as OscillatorType },
    'panel-close': { frequency: 330, duration: 0.08, type: 'sine' as OscillatorType },
    'cta-click': { frequency: 660, duration: 0.06, type: 'square' as OscillatorType },
    'error': { frequency: 220, duration: 0.2, type: 'sawtooth' as OscillatorType },
    'hover': { frequency: 880, duration: 0.04, type: 'sine' as OscillatorType },
    'success': { frequency: 523, duration: 0.15, type: 'triangle' as OscillatorType },
    
    // Game Actions
    'unit-select': { frequency: 600, duration: 0.08, type: 'sine' as OscillatorType },
    'unit-move': { frequency: 400, duration: 0.12, type: 'triangle' as OscillatorType },
    'unit-attack': { frequency: 300, duration: 0.18, type: 'square' as OscillatorType },
    'unit-built': { frequency: 700, duration: 0.25, type: 'sine' as OscillatorType },
    'building-built': { frequency: 500, duration: 0.3, type: 'triangle' as OscillatorType },
    
    // Strategic Events
    'tech-research': { frequency: 800, duration: 0.2, type: 'sine' as OscillatorType },
    'turn-start': { frequency: 450, duration: 0.15, type: 'triangle' as OscillatorType },
    'turn-end': { frequency: 350, duration: 0.15, type: 'triangle' as OscillatorType },
    'city-capture': { frequency: 600, duration: 0.4, type: 'square' as OscillatorType },
    'village-capture': { frequency: 550, duration: 0.25, type: 'sine' as OscillatorType },
    
    // Feedback Sounds
    'resource-collect': { frequency: 750, duration: 0.1, type: 'triangle' as OscillatorType },
    'notification': { frequency: 650, duration: 0.12, type: 'sine' as OscillatorType },
    'warning': { frequency: 250, duration: 0.3, type: 'sawtooth' as OscillatorType },
    'achievement': { frequency: 800, duration: 0.35, type: 'triangle' as OscillatorType },
  }), []);

  const playSound = useCallback((type: SfxType) => {
    // Respect global mute state and check for audio context availability
    if (!window.AudioContext || isMuted) {
      console.debug(`SFX ${type} skipped - ${!window.AudioContext ? 'no audio context' : 'muted'}`);
      return;
    }
    
    const now = Date.now();
    const lastPlayed = throttleMap.get(type) || 0;
    
    if (now - lastPlayed < THROTTLE_DURATION) return;
    throttleMap.set(type, now);
    
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const config = soundConfig[type];
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(config.frequency, audioContext.currentTime);
      oscillator.type = config.type;
      
      // Apply global SFX volume (default 0.1 * sfxVolume)
      const finalVolume = 0.1 * sfxVolume;
      gainNode.gain.setValueAtTime(finalVolume, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(finalVolume * 0.1, audioContext.currentTime + config.duration);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + config.duration);
      
      // Clean up
      setTimeout(() => {
        try {
          audioContext.close();
        } catch (e) {
          // Ignore cleanup errors
        }
      }, config.duration * 1000 + 100);
      
    } catch (error) {
      // Silently fail if audio context creation fails
      console.debug('Audio context not available:', error);
    }
  }, [soundConfig, isMuted, sfxVolume]);

  return playSound;
}

// Hook for individual sound effects
export function useSfx(type: SfxType, condition = true) {
  const playSound = useSfxEngine();
  
  const triggerSound = useCallback(() => {
    if (condition) {
      playSound(type);
    }
  }, [playSound, type, condition]);
  
  return triggerSound;
}