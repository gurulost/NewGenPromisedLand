import { create } from "zustand";
import { Howl } from "howler";

type SoundKey =
  | 'hit'
  | 'success'
  | 'unit-move'
  | 'construction'
  | 'notification'
  | 'ambient';

interface AudioState {
  backgroundMusic: HTMLAudioElement | null;
  hitSound: Howl | null;
  successSound: Howl | null;
  isMuted: boolean;
  isInitialized: boolean;
  musicVolume: number;
  sfxVolume: number;
  
  // Setter functions
  setBackgroundMusic: (music: HTMLAudioElement) => void;
  setHitSound: (sound: Howl) => void;
  setSuccessSound: (sound: Howl) => void;
  setMusicVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
  
  // Control functions
  toggleMute: () => void;
  initializeAudio: () => Promise<void>;
  startBackgroundMusic: () => void;
  stopBackgroundMusic: () => void;
  playHit: () => void;
  playSuccess: () => void;
  playUnitMove: () => void;
  playConstruction: () => void;
  playNotification: () => void;
  playAmbientSound: (type?: string) => void;
}

export const useAudio = create<AudioState>((set, get) => ({
  backgroundMusic: null,
  hitSound: null,
  successSound: null,
  isMuted: true, // Start muted by default
  isInitialized: false,
  musicVolume: 0.5,
  sfxVolume: 0.6,
  
  setBackgroundMusic: (music) => set({ backgroundMusic: music }),
  setHitSound: (sound) => set({ hitSound: sound }),
  setSuccessSound: (sound) => set({ successSound: sound }),
  setMusicVolume: (volume) => set({ musicVolume: Math.max(0, Math.min(1, volume)) }),
  setSfxVolume: (volume) => set({ sfxVolume: Math.max(0, Math.min(1, volume)) }),
  
  toggleMute: () => {
    const { isMuted } = get();
    const newMutedState = !isMuted;
    
    set({ isMuted: newMutedState });
    console.log(`Sound ${newMutedState ? 'muted' : 'unmuted'}`);
  },

  initializeAudio: async () => {
    // Preload tiny procedural sounds as fallback using base64-encoded beeps
    const loadBeep = (dataUri: string) => new Howl({ src: [dataUri], volume: 0.6 });
    const clickBeep = 'data:audio/wav;base64,UklGRhYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQwAAAAA//8AAP//AAD//wAA//8AAP//AAD//wAA';
    const successBeep = 'data:audio/wav;base64,UklGRhYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQwAAAAA////AP///wD///8A////AP///wD///8A////AP///wD///8A';

    set({
      isInitialized: true,
      hitSound: loadBeep(clickBeep),
      successSound: loadBeep(successBeep),
    });
  },

  startBackgroundMusic: () => {
    const { backgroundMusic, isMuted, musicVolume } = get();
    if (backgroundMusic && !isMuted) {
      backgroundMusic.volume = musicVolume;
      backgroundMusic.loop = true;
      backgroundMusic.play().catch(() => {});
    }
  },

  stopBackgroundMusic: () => {
    const { backgroundMusic } = get();
    backgroundMusic?.pause();
  },
  
  playHit: () => {
    const { hitSound, isMuted, sfxVolume } = get();
    if (hitSound && !isMuted) {
      hitSound.volume(sfxVolume);
      hitSound.play();
    }
  },
  
  playSuccess: () => {
    const { successSound, isMuted, sfxVolume } = get();
    if (successSound && !isMuted) {
      successSound.volume(sfxVolume);
      successSound.play();
    }
  },

  playUnitMove: () => {
    const { hitSound, isMuted, sfxVolume } = get();
    if (hitSound && !isMuted) {
      hitSound.volume(sfxVolume * 0.6);
      hitSound.play();
    }
  },

  playConstruction: () => {
    const { successSound, isMuted, sfxVolume } = get();
    if (successSound && !isMuted) {
      successSound.volume(sfxVolume * 0.7);
      successSound.play();
    }
  },

  playNotification: () => {
    const { successSound, isMuted, sfxVolume } = get();
    if (successSound && !isMuted) {
      successSound.volume(sfxVolume * 0.5);
      successSound.play();
    }
  },

  playAmbientSound: () => {
    // Placeholder for richer ambient system
  }
}));
