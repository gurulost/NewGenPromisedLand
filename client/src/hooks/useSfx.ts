import { useCallback, useMemo } from 'react';

type SfxType = 'panel-open' | 'panel-close' | 'cta-click' | 'error' | 'hover' | 'success';

// Throttle map to prevent sound spam
const throttleMap = new Map<SfxType, number>();
const THROTTLE_DURATION = 150; // ms

export function useSfxEngine() {
  // Sound effect configurations
  const soundConfig = useMemo(() => ({
    'panel-open': { frequency: 440, duration: 0.1, type: 'sine' as OscillatorType },
    'panel-close': { frequency: 330, duration: 0.08, type: 'sine' as OscillatorType },
    'cta-click': { frequency: 660, duration: 0.06, type: 'square' as OscillatorType },
    'error': { frequency: 220, duration: 0.2, type: 'sawtooth' as OscillatorType },
    'hover': { frequency: 880, duration: 0.04, type: 'sine' as OscillatorType },
    'success': { frequency: 523, duration: 0.15, type: 'triangle' as OscillatorType },
  }), []);

  const playSound = useCallback((type: SfxType) => {
    // Check if user has disabled sounds or if we're throttling
    if (!window.AudioContext) return;
    
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
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + config.duration);
      
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
  }, [soundConfig]);

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