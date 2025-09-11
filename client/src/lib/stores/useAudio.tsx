import { create } from "zustand";

interface AudioState {
  // Audio Elements
  backgroundMusic: HTMLAudioElement | null;
  hitSound: HTMLAudioElement | null;
  successSound: HTMLAudioElement | null;
  
  // Enhanced Game Sounds
  unitMoveSound: HTMLAudioElement | null;
  constructionSound: HTMLAudioElement | null;
  notificationSound: HTMLAudioElement | null;
  
  // Audio State
  isMuted: boolean;
  isInitialized: boolean;
  musicVolume: number;
  sfxVolume: number;
  
  // Initialization
  initializeAudio: () => Promise<void>;
  
  // Setter functions
  setBackgroundMusic: (music: HTMLAudioElement) => void;
  setHitSound: (sound: HTMLAudioElement) => void;
  setSuccessSound: (sound: HTMLAudioElement) => void;
  
  // Volume controls
  setMusicVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
  
  // Control functions
  toggleMute: () => void;
  startBackgroundMusic: () => void;
  stopBackgroundMusic: () => void;
  
  // Enhanced sound playback
  playHit: () => void;
  playSuccess: () => void;
  playUnitMove: () => void;
  playConstruction: () => void;
  playNotification: () => void;
  playAmbientSound: (soundType: 'combat' | 'peaceful' | 'victory') => void;
}

export const useAudio = create<AudioState>((set, get) => ({
  // Audio elements
  backgroundMusic: null,
  hitSound: null,
  successSound: null,
  unitMoveSound: null,
  constructionSound: null,
  notificationSound: null,
  
  // Audio state
  isMuted: true, // Start muted by default for better UX
  isInitialized: false,
  musicVolume: 0.6,
  sfxVolume: 0.8,
  
  // Initialize all audio elements
  initializeAudio: async () => {
    try {
      // Validate and load background music with fallback
      const backgroundMusic = new Audio('/sounds/background.mp3');
      backgroundMusic.loop = true;
      backgroundMusic.volume = get().musicVolume;
      backgroundMusic.onerror = () => {
        console.warn('Background music failed to load: /sounds/background.mp3');
      };
      
      // Validate and load hit sound with fallback
      const hitSound = new Audio('/sounds/hit.mp3');
      hitSound.volume = get().sfxVolume;
      hitSound.onerror = () => {
        console.warn('Hit sound failed to load: /sounds/hit.mp3');
      };
      
      // Validate and load success sound with fallback
      const successSound = new Audio('/sounds/success.mp3');
      successSound.volume = get().sfxVolume;
      successSound.onerror = () => {
        console.warn('Success sound failed to load: /sounds/success.mp3');
      };
      
      // Load additional game sounds using the same hit/success files with different settings
      const unitMoveSound = new Audio('/sounds/success.mp3');
      unitMoveSound.volume = get().sfxVolume * 0.6; // Softer for frequent moves
      
      const constructionSound = new Audio('/sounds/success.mp3');
      constructionSound.volume = get().sfxVolume * 0.8;
      
      const notificationSound = new Audio('/sounds/hit.mp3');
      notificationSound.volume = get().sfxVolume * 0.5; // Softer notifications
      
      set({ 
        backgroundMusic, 
        hitSound, 
        successSound,
        unitMoveSound,
        constructionSound,
        notificationSound,
        isInitialized: true 
      });
      
      console.log('🎵 Audio system initialized successfully');
    } catch (error) {
      console.warn('Audio initialization failed:', error);
    }
  },
  
  setBackgroundMusic: (music) => set({ backgroundMusic: music }),
  setHitSound: (sound) => set({ hitSound: sound }),
  setSuccessSound: (sound) => set({ successSound: sound }),
  
  // Volume controls
  setMusicVolume: (volume) => {
    const { backgroundMusic } = get();
    if (backgroundMusic) backgroundMusic.volume = volume;
    set({ musicVolume: volume });
  },
  
  setSfxVolume: (volume) => {
    const { hitSound, successSound, unitMoveSound, constructionSound, notificationSound } = get();
    [hitSound, successSound, unitMoveSound, constructionSound, notificationSound].forEach(sound => {
      if (sound) sound.volume = volume;
    });
    set({ sfxVolume: volume });
  },
  
  toggleMute: () => {
    const { isMuted, backgroundMusic } = get();
    const newMutedState = !isMuted;
    
    // Control background music based on mute state
    if (backgroundMusic) {
      if (newMutedState) {
        backgroundMusic.pause();
      } else {
        backgroundMusic.play().catch(() => {}); // Ignore autoplay restrictions
      }
    }
    
    set({ isMuted: newMutedState });
    console.log(`🔊 Sound ${newMutedState ? 'muted' : 'unmuted'}`);
  },
  
  // Background music controls
  startBackgroundMusic: () => {
    const { backgroundMusic, isMuted } = get();
    if (backgroundMusic && !isMuted) {
      backgroundMusic.play().catch(() => {
        console.log('Background music autoplay prevented by browser');
      });
    }
  },
  
  stopBackgroundMusic: () => {
    const { backgroundMusic } = get();
    if (backgroundMusic) {
      backgroundMusic.pause();
      backgroundMusic.currentTime = 0;
    }
  },
  
  playHit: () => {
    const { hitSound, isMuted } = get();
    if (hitSound) {
      // If sound is muted, don't play anything
      if (isMuted) {
        console.log("Hit sound skipped (muted)");
        return;
      }
      
      // Clone the sound to allow overlapping playback
      const soundClone = hitSound.cloneNode() as HTMLAudioElement;
      soundClone.volume = 0.3;
      soundClone.play().catch(error => {
        console.log("Hit sound play prevented:", error);
      });
    }
  },
  
  playSuccess: () => {
    const { successSound, isMuted } = get();
    if (successSound && !isMuted) {
      successSound.currentTime = 0;
      successSound.play().catch(error => {
        console.log("Success sound play prevented:", error);
      });
    }
  },
  
  // Enhanced game sound effects
  playUnitMove: () => {
    const { unitMoveSound, isMuted } = get();
    if (unitMoveSound && !isMuted) {
      const soundClone = unitMoveSound.cloneNode() as HTMLAudioElement;
      soundClone.volume = unitMoveSound.volume;
      soundClone.play().catch(() => {});
    }
  },
  
  playConstruction: () => {
    const { constructionSound, isMuted } = get();
    if (constructionSound && !isMuted) {
      constructionSound.currentTime = 0;
      constructionSound.play().catch(() => {});
    }
  },
  
  playNotification: () => {
    const { notificationSound, isMuted } = get();
    if (notificationSound && !isMuted) {
      const soundClone = notificationSound.cloneNode() as HTMLAudioElement;
      soundClone.volume = notificationSound.volume;
      soundClone.play().catch(() => {});
    }
  },
  
  // Context-aware ambient sounds
  playAmbientSound: (soundType: 'combat' | 'peaceful' | 'victory') => {
    const { hitSound, successSound, isMuted } = get();
    if (isMuted) return;
    
    switch (soundType) {
      case 'combat':
        if (hitSound) {
          const soundClone = hitSound.cloneNode() as HTMLAudioElement;
          soundClone.volume = 0.2; // Subtle ambient combat
          soundClone.play().catch(() => {});
        }
        break;
      case 'victory':
        if (successSound) {
          successSound.currentTime = 0;
          successSound.play().catch(() => {});
        }
        break;
      case 'peaceful':
        // Use soft success sound for peaceful ambience
        if (successSound) {
          const soundClone = successSound.cloneNode() as HTMLAudioElement;
          soundClone.volume = 0.1;
          soundClone.play().catch(() => {});
        }
        break;
    }
  }
}));
