import { create } from "zustand";
import { Howl } from "howler";

const SFX_ENABLED = (import.meta as any).env?.VITE_ENABLE_SFX === 'true';

type SoundKey =
  | 'hit'
  | 'success'
  | 'unit-move'
  | 'construction'
  | 'notification'
  | 'ambient';

interface AudioState {
  backgroundMusic: HTMLAudioElement | null;
  musicTracks: string[];
  currentTrackIndex: number;
  hitSound: Howl | null;
  successSound: Howl | null;
  isMuted: boolean;
  isInitialized: boolean;
  musicVolume: number;
  sfxVolume: number;
  isMusicPlaying: boolean;
  
  setBackgroundMusic: (music: HTMLAudioElement) => void;
  setMusicTracks: (tracks: string[]) => void;
  setHitSound: (sound: Howl) => void;
  setSuccessSound: (sound: Howl) => void;
  setMusicVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
  
  toggleMute: () => void;
  initializeAudio: () => Promise<void>;
  startBackgroundMusic: () => void;
  stopBackgroundMusic: () => void;
  playNextTrack: () => void;
  shuffleTracks: () => void;
  playHit: () => void;
  playSuccess: () => void;
  playUnitMove: () => void;
  playConstruction: () => void;
  playNotification: () => void;
  playAmbientSound: (type?: string) => void;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function createAudioElement(src: string, volume: number, onEnded: () => void): HTMLAudioElement {
  const audio = new Audio(src);
  audio.volume = volume;
  audio.loop = false;
  audio.addEventListener('ended', onEnded);
  return audio;
}

export const useAudio = create<AudioState>((set, get) => ({
  backgroundMusic: null,
  musicTracks: [
    '/sounds/jungle_whispers.mp3',
    '/sounds/temple_shadows.mp3',
    '/sounds/jungle_spirits_awaken.mp3',
    '/sounds/echoes_of_jaguar.mp3',
    '/sounds/jungle_warcry.mp3',
    '/sounds/jungle_echoes.mp3',
  ],
  currentTrackIndex: 0,
  hitSound: null,
  successSound: null,
  isMuted: true,
  isInitialized: false,
  musicVolume: 0.5,
  sfxVolume: 0.6,
  isMusicPlaying: false,
  
  setBackgroundMusic: (music) => set({ backgroundMusic: music }),
  
  setMusicTracks: (tracks) => {
    const { backgroundMusic, musicVolume, isMusicPlaying, isMuted } = get();
    
    if (backgroundMusic) {
      backgroundMusic.pause();
      backgroundMusic.removeEventListener('ended', get().playNextTrack);
    }
    
    if (tracks.length === 0) {
      set({ musicTracks: [], currentTrackIndex: 0, backgroundMusic: null, isMusicPlaying: false });
      return;
    }
    
    const newAudio = createAudioElement(tracks[0], musicVolume, () => get().playNextTrack());
    set({ musicTracks: tracks, currentTrackIndex: 0, backgroundMusic: newAudio });
    
    if (isMusicPlaying && !isMuted) {
      newAudio.play().catch(() => {});
    }
  },
  
  setHitSound: (sound) => set({ hitSound: sound }),
  setSuccessSound: (sound) => set({ successSound: sound }),
  
  setMusicVolume: (volume) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    const { backgroundMusic } = get();
    if (backgroundMusic) {
      backgroundMusic.volume = clampedVolume;
    }
    set({ musicVolume: clampedVolume });
  },
  
  setSfxVolume: (volume) => set({ sfxVolume: Math.max(0, Math.min(1, volume)) }),
  
  toggleMute: () => {
    const { isMuted, backgroundMusic, musicVolume, isMusicPlaying } = get();
    const newMutedState = !isMuted;
    
    if (backgroundMusic) {
      if (newMutedState) {
        backgroundMusic.pause();
      } else if (isMusicPlaying) {
        backgroundMusic.volume = musicVolume;
        backgroundMusic.play().catch(() => {});
      }
    }
    
    set({ isMuted: newMutedState });
    console.log(`Sound ${newMutedState ? 'muted' : 'unmuted'}`);
  },

  initializeAudio: async () => {
    const { musicTracks, musicVolume } = get();
    
    if (musicTracks.length > 0) {
      const audio = createAudioElement(musicTracks[0], musicVolume, () => get().playNextTrack());
      set({ backgroundMusic: audio });
    }
    
    if (SFX_ENABLED) {
      const loadBeep = (dataUri: string) => new Howl({ src: [dataUri], volume: 0.6 });
      const clickBeep = 'data:audio/wav;base64,UklGRhYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQwAAAAA//8AAP//AAD//wAA//8AAP//AAD//wAA';
      const successBeep = 'data:audio/wav;base64,UklGRhYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQwAAAAA////AP///wD///8A////AP///wD///8A////AP///wD///8A';

      set({
        isInitialized: true,
        hitSound: loadBeep(clickBeep),
        successSound: loadBeep(successBeep),
      });
    } else {
      set({
        isInitialized: true,
        hitSound: null,
        successSound: null,
      });
    }
  },

  shuffleTracks: () => {
    const { musicTracks, backgroundMusic, musicVolume, isMusicPlaying, isMuted } = get();
    if (musicTracks.length <= 1) return;
    
    const shuffled = shuffleArray(musicTracks);
    
    if (backgroundMusic) {
      backgroundMusic.pause();
      backgroundMusic.src = shuffled[0];
      backgroundMusic.volume = musicVolume;
    }
    
    set({ musicTracks: shuffled, currentTrackIndex: 0 });
    
    if (isMusicPlaying && !isMuted && backgroundMusic) {
      backgroundMusic.play().catch(() => {});
    }
  },

  playNextTrack: () => {
    const { musicTracks, currentTrackIndex, isMuted, musicVolume, backgroundMusic } = get();
    
    if (musicTracks.length === 0 || !backgroundMusic) return;
    
    let nextIndex = (currentTrackIndex + 1) % musicTracks.length;
    
    if (nextIndex === 0 && musicTracks.length > 1) {
      const shuffled = shuffleArray(musicTracks);
      set({ musicTracks: shuffled });
      nextIndex = 0;
    }
    
    const { musicTracks: currentTracks } = get();
    backgroundMusic.src = currentTracks[nextIndex];
    backgroundMusic.volume = musicVolume;
    set({ currentTrackIndex: nextIndex });
    
    if (!isMuted) {
      backgroundMusic.play().catch(() => {});
    }
  },

  startBackgroundMusic: () => {
    const { backgroundMusic, isMuted, musicVolume, musicTracks } = get();
    
    if (!backgroundMusic || musicTracks.length === 0) return;
    
    if (musicTracks.length > 1) {
      const shuffled = shuffleArray(musicTracks);
      backgroundMusic.src = shuffled[0];
      set({ musicTracks: shuffled, currentTrackIndex: 0 });
    }
    
    if (!isMuted) {
      backgroundMusic.volume = musicVolume;
      backgroundMusic.play().catch(() => {});
      set({ isMusicPlaying: true });
    }
  },

  stopBackgroundMusic: () => {
    const { backgroundMusic } = get();
    if (backgroundMusic) {
      backgroundMusic.pause();
      set({ isMusicPlaying: false });
    }
  },
  
  playHit: () => {
    const { hitSound, isMuted, sfxVolume } = get();
    if (SFX_ENABLED && hitSound && !isMuted) {
      hitSound.volume(sfxVolume);
      hitSound.play();
    }
  },
  
  playSuccess: () => {
    const { successSound, isMuted, sfxVolume } = get();
    if (SFX_ENABLED && successSound && !isMuted) {
      successSound.volume(sfxVolume);
      successSound.play();
    }
  },

  playUnitMove: () => {
    const { hitSound, isMuted, sfxVolume } = get();
    if (SFX_ENABLED && hitSound && !isMuted) {
      hitSound.volume(sfxVolume * 0.6);
      hitSound.play();
    }
  },

  playConstruction: () => {
    const { successSound, isMuted, sfxVolume } = get();
    if (SFX_ENABLED && successSound && !isMuted) {
      successSound.volume(sfxVolume * 0.7);
      successSound.play();
    }
  },

  playNotification: () => {
    const { successSound, isMuted, sfxVolume } = get();
    if (SFX_ENABLED && successSound && !isMuted) {
      successSound.volume(sfxVolume * 0.5);
      successSound.play();
    }
  },

  playAmbientSound: () => {
  }
}));
