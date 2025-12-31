import { useCallback, useMemo } from 'react';

export type SfxType = string;

// SFX disabled by default - set to true to enable UI sounds
const SFX_ENABLED = (import.meta as any).env?.VITE_ENABLE_SFX === 'true';

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
    'unit-select': { frequency: 540, duration: 0.08, type: 'triangle' as OscillatorType },
    'unit-move': { frequency: 360, duration: 0.12, type: 'square' as OscillatorType },
    'unit-attack': { frequency: 260, duration: 0.12, type: 'sawtooth' as OscillatorType },
    'unit-built': { frequency: 520, duration: 0.12, type: 'triangle' as OscillatorType },
    'building-built': { frequency: 300, duration: 0.12, type: 'square' as OscillatorType },
    'city-capture': { frequency: 480, duration: 0.16, type: 'triangle' as OscillatorType },
    'village-capture': { frequency: 520, duration: 0.14, type: 'triangle' as OscillatorType },
    'tech-research': { frequency: 600, duration: 0.14, type: 'sine' as OscillatorType },
    'turn-start': { frequency: 420, duration: 0.1, type: 'triangle' as OscillatorType },
    'turn-end': { frequency: 380, duration: 0.1, type: 'triangle' as OscillatorType },
    'resource-collect': { frequency: 500, duration: 0.08, type: 'triangle' as OscillatorType },
    'notification': { frequency: 560, duration: 0.08, type: 'triangle' as OscillatorType },
    'warning': { frequency: 200, duration: 0.18, type: 'sawtooth' as OscillatorType },
    'achievement': { frequency: 700, duration: 0.14, type: 'sine' as OscillatorType },
    'ruins-common': { frequency: 520, duration: 0.12, type: 'triangle' as OscillatorType },
    'ruins-uncommon': { frequency: 600, duration: 0.14, type: 'triangle' as OscillatorType },
    'ruins-rare': { frequency: 720, duration: 0.18, type: 'sine' as OscillatorType },
    'ruins-legendary': { frequency: 880, duration: 0.24, type: 'sine' as OscillatorType },
    'ruins-curse': { frequency: 180, duration: 0.22, type: 'sawtooth' as OscillatorType },
  }), []);

  const playSound = useCallback((type: SfxType) => {
    // SFX disabled by default
    if (!SFX_ENABLED) return;
    
    // Check if user has disabled sounds or if we're throttling
    if (!window.AudioContext) return;
    
    const now = Date.now();
    const lastPlayed = throttleMap.get(type) || 0;
    
    if (now - lastPlayed < THROTTLE_DURATION) return;
    throttleMap.set(type, now);
    
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const config = (soundConfig as Record<string, { frequency: number; duration: number; type: OscillatorType }>)[type] 
        || soundConfig['cta-click'];
      if (!config) return;
      
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
