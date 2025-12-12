import { create } from "zustand";

interface AudioState {
  backgroundMusic: HTMLAudioElement | null;
  hitSound: HTMLAudioElement | null;
  successSound: HTMLAudioElement | null;
  isMuted: boolean;
  isInitialized: boolean;
  musicVolume: number;
  sfxVolume: number;
  
  // Setter functions
  setBackgroundMusic: (music: HTMLAudioElement) => void;
  setHitSound: (sound: HTMLAudioElement) => void;
  setSuccessSound: (sound: HTMLAudioElement) => void;
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
    set({ isInitialized: true });
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
      const soundClone = hitSound.cloneNode() as HTMLAudioElement;
      soundClone.volume = sfxVolume;
      soundClone.play().catch(error => {
        console.log("Hit sound play prevented:", error);
      });
    }
  },
  
  playSuccess: () => {
    const { successSound, isMuted, sfxVolume } = get();
    if (successSound && !isMuted) {
      successSound.currentTime = 0;
      successSound.volume = sfxVolume;
      successSound.play().catch(error => {
        console.log("Success sound play prevented:", error);
      });
    }
  },

  playUnitMove: () => {
    const { hitSound, isMuted, sfxVolume } = get();
    if (hitSound && !isMuted) {
      const soundClone = hitSound.cloneNode() as HTMLAudioElement;
      soundClone.volume = sfxVolume * 0.6;
      soundClone.play().catch(() => {});
    }
  },

  playConstruction: () => {
    const { successSound, isMuted, sfxVolume } = get();
    if (successSound && !isMuted) {
      const soundClone = successSound.cloneNode() as HTMLAudioElement;
      soundClone.volume = sfxVolume * 0.7;
      soundClone.play().catch(() => {});
    }
  },

  playNotification: () => {
    const { successSound, isMuted, sfxVolume } = get();
    if (successSound && !isMuted) {
      const soundClone = successSound.cloneNode() as HTMLAudioElement;
      soundClone.volume = sfxVolume * 0.5;
      soundClone.play().catch(() => {});
    }
  },

  playAmbientSound: () => {
    // Placeholder for richer ambient system
  }
}));
