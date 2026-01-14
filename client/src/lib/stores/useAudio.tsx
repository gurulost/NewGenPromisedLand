import { create } from "zustand";
import { Howl } from "howler";
import { SFX_MANIFEST } from "../audio/sfxManifest";

const SFX_ENABLED = (import.meta as any).env?.VITE_ENABLE_SFX === 'true';

interface AudioState {
  backgroundMusic: HTMLAudioElement | null;
  nextTrackAudio: HTMLAudioElement | null;
  musicTracks: string[];
  currentTrackIndex: number;
  sfxMap: Record<string, Howl>;
  isMuted: boolean;
  isInitialized: boolean;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  isMusicPlaying: boolean;
  isCrossfading: boolean;
  wasPlayingBeforeHidden: boolean;
  
  setBackgroundMusic: (music: HTMLAudioElement) => void;
  setMusicTracks: (tracks: string[]) => void;
  setMasterVolume: (volume: number) => void;
  setMusicVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  
  toggleMute: () => void;
  initializeAudio: () => Promise<void>;
  startBackgroundMusic: () => void;
  pauseBackgroundMusic: (rememberPlayback?: boolean) => void;
  resumeBackgroundMusic: () => void;
  stopBackgroundMusic: () => void;
  playNextTrack: () => void;
  startCrossfade: () => void;
  shuffleTracks: () => void;
  playSfx: (key: string, volumeScale?: number) => void;
  playHit: () => void;
  playSuccess: () => void;
  playUnitMove: () => void;
  playConstruction: () => void;
  playNotification: () => void;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function clampVolume(volume: number): number {
  return Math.max(0, Math.min(1, volume));
}

function getEffectiveMusicVolume(musicVolume: number, masterVolume: number): number {
  return clampVolume(musicVolume * masterVolume);
}

const CROSSFADE_DURATION_MS = 1800;

function createAudioElement(src: string, volume: number): HTMLAudioElement {
  const audio = new Audio(src);
  audio.volume = clampVolume(volume);
  audio.preload = 'auto';
  audio.loop = false;
  return audio;
}

function createPreloadedAudio(src: string): HTMLAudioElement {
  const audio = new Audio(src);
  audio.volume = 0;
  audio.preload = 'auto';
  audio.loop = false;
  audio.load();
  return audio;
}

const unloadHowl = (sound: Howl): void => {
  const maybeUnload = (sound as unknown as { unload?: () => void }).unload;
  if (typeof maybeUnload === 'function') {
    maybeUnload.call(sound);
  } else {
    const maybeStop = (sound as unknown as { stop?: () => void }).stop;
    if (typeof maybeStop === 'function') {
      maybeStop.call(sound);
    }
  }
};

function resolveNextTrack(tracks: string[], currentIndex: number): { tracks: string[]; nextIndex: number } {
  if (tracks.length === 0) {
    return { tracks, nextIndex: 0 };
  }
  let nextIndex = currentIndex + 1;
  let nextTracks = tracks;
  if (nextIndex >= tracks.length) {
    nextIndex = 0;
    if (tracks.length > 1) {
      nextTracks = shuffleArray(tracks);
    }
  }
  return { tracks: nextTracks, nextIndex };
}

function audioSourceMatches(audio: HTMLAudioElement | null, src: string): boolean {
  if (!audio) return false;
  return audio.src.endsWith(src);
}

const scheduleFrame =
  typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : (callback: FrameRequestCallback) => {
        const setTimeoutFn = typeof window !== 'undefined' ? window.setTimeout : globalThis.setTimeout;
        return setTimeoutFn(() => callback(Date.now()), 16);
      };

export const useAudio = create<AudioState>((set, get) => {
  const attachTrackHandlers = (audio: HTMLAudioElement) => {
    audio.onended = () => get().playNextTrack();
    audio.ontimeupdate = () => {
      const { isCrossfading } = get();
      if (isCrossfading) return;
      if (!audio.duration || !Number.isFinite(audio.duration)) return;
      const remaining = audio.duration - audio.currentTime;
      if (remaining <= CROSSFADE_DURATION_MS / 1000) {
        get().startCrossfade();
      }
    };
  };

  const prepareNextTrackAudio = (tracks: string[], currentIndex: number) => {
    if (tracks.length <= 1) return null;
    const nextIndex = (currentIndex + 1) % tracks.length;
    return createPreloadedAudio(tracks[nextIndex]);
  };

  return {
  backgroundMusic: null,
  nextTrackAudio: null,
  musicTracks: [
    '/sounds/jungle_whispers.mp3',
    '/sounds/temple_shadows.mp3',
    '/sounds/jungle_spirits_awaken.mp3',
    '/sounds/echoes_of_jaguar.mp3',
    '/sounds/jungle_warcry.mp3',
    '/sounds/jungle_echoes.mp3',
    '/sounds/temple_shadows_2.mp3',
    '/sounds/temple_shadows_3.mp3',
    '/sounds/temple_shadows_4.mp3',
    '/sounds/temple_shadows_5.mp3',
    '/sounds/temple_shadows_6.mp3',
    '/sounds/jungle_whispers_3.mp3',
    '/sounds/sacred_record_plates_prophecy.mp3',
    '/sounds/plates_and_prophecy.mp3',
    '/sounds/battle_rituals.mp3',
    '/sounds/jungle_gravitas.mp3',
    '/sounds/jungle_pad_2.mp3',
    '/sounds/jungle_pad_2_2.mp3',
    '/sounds/jungle_pad_2_3.mp3',
    '/sounds/meanderthal_3.mp3',
    '/sounds/wicked_spirits.mp3',
    '/sounds/untitled.mp3',
    '/sounds/love_in_the_rain.mp3',
    '/sounds/love_in_the_rain_2.mp3',
    '/sounds/ritualistic_minimalist_percussion.mp3',
    '/sounds/sound_the_bell.mp3',
    '/sounds/meanderthal.mp3',
    '/sounds/meanderthal_2.mp3',
    '/sounds/hurricane.mp3',
    '/sounds/drunken_sailor.mp3',
  ],
  currentTrackIndex: 0,
  sfxMap: {},
  isMuted: false,
  isInitialized: false,
  masterVolume: 0.7,
  musicVolume: 0.5,
  sfxVolume: 0.6,
  isMusicPlaying: false,
  isCrossfading: false,
  wasPlayingBeforeHidden: false,
  
  setBackgroundMusic: (music) => {
    if (music) {
      attachTrackHandlers(music);
    }
    set({ backgroundMusic: music });
  },
  
  setMusicTracks: (tracks) => {
    const { backgroundMusic, nextTrackAudio, musicVolume, masterVolume, isMusicPlaying, isMuted } = get();
    
    if (backgroundMusic) {
      backgroundMusic.pause();
      backgroundMusic.onended = null;
      backgroundMusic.ontimeupdate = null;
    }
    if (nextTrackAudio) {
      nextTrackAudio.pause();
    }
    
    if (tracks.length === 0) {
      set({
        musicTracks: [],
        currentTrackIndex: 0,
        backgroundMusic: null,
        nextTrackAudio: null,
        isMusicPlaying: false,
        isCrossfading: false,
      });
      return;
    }
    
    const newAudio = createAudioElement(
      tracks[0],
      getEffectiveMusicVolume(musicVolume, masterVolume)
    );
    attachTrackHandlers(newAudio);
    set({
      musicTracks: tracks,
      currentTrackIndex: 0,
      backgroundMusic: newAudio,
      nextTrackAudio: prepareNextTrackAudio(tracks, 0),
      isCrossfading: false,
    });
    
    if (isMusicPlaying && !isMuted) {
      newAudio.play().catch(() => {});
    }
  },
  
  setMasterVolume: (volume) => {
    const clampedVolume = clampVolume(volume);
    const { backgroundMusic, musicVolume } = get();
    if (backgroundMusic) {
      backgroundMusic.volume = getEffectiveMusicVolume(musicVolume, clampedVolume);
    }
    set({ masterVolume: clampedVolume });
  },

  setMusicVolume: (volume) => {
    const clampedVolume = clampVolume(volume);
    const { backgroundMusic, masterVolume } = get();
    if (backgroundMusic) {
      backgroundMusic.volume = getEffectiveMusicVolume(clampedVolume, masterVolume);
    }
    set({ musicVolume: clampedVolume });
  },
  
  setSfxVolume: (volume) => set({ sfxVolume: clampVolume(volume) }),

  setMuted: (muted) => {
    const { backgroundMusic, nextTrackAudio, isMusicPlaying, musicVolume, masterVolume } = get();
    if (backgroundMusic) {
      if (muted) {
        backgroundMusic.pause();
        backgroundMusic.ontimeupdate = null;
      } else if (isMusicPlaying) {
        backgroundMusic.volume = getEffectiveMusicVolume(musicVolume, masterVolume);
        backgroundMusic.play().catch(() => {});
        attachTrackHandlers(backgroundMusic);
      }
    }
    if (nextTrackAudio && muted) {
      nextTrackAudio.pause();
    }
    set({ isMuted: muted, isCrossfading: muted ? false : get().isCrossfading });
  },
  
  toggleMute: () => {
    const { isMuted } = get();
    get().setMuted(!isMuted);
  },

  initializeAudio: async () => {
    const { musicTracks, musicVolume, masterVolume, sfxVolume, sfxMap } = get();
    
    if (musicTracks.length > 0) {
      // Shuffle tracks immediately on initialization for variety
      const shuffled = musicTracks.length > 1 ? shuffleArray(musicTracks) : musicTracks;
      const audio = createAudioElement(
        shuffled[0],
        getEffectiveMusicVolume(musicVolume, masterVolume)
      );
      attachTrackHandlers(audio);
      set({
        backgroundMusic: audio,
        musicTracks: shuffled,
        currentTrackIndex: 0,
        nextTrackAudio: prepareNextTrackAudio(shuffled, 0),
        isCrossfading: false,
      });
    }
    
    let nextSfxMap: Record<string, Howl> = {};
    if (SFX_ENABLED) {
      Object.values(sfxMap).forEach((sound) => {
        try {
          unloadHowl(sound);
        } catch (error) {
          // Ignore unload errors for previously created sounds
        }
      });
      nextSfxMap = Object.entries(SFX_MANIFEST).reduce((acc, [key, src]) => {
        acc[key] = new Howl({ src: [src], volume: sfxVolume, preload: true });
        return acc;
      }, {} as Record<string, Howl>);
      set({
        isInitialized: true,
        sfxMap: nextSfxMap,
      });
    } else {
      set({
        isInitialized: true,
        sfxMap: {},
      });
    }
  },

  shuffleTracks: () => {
    const { musicTracks, backgroundMusic, musicVolume, masterVolume, isMusicPlaying, isMuted } = get();
    if (musicTracks.length <= 1) return;
    
    const shuffled = shuffleArray(musicTracks);
    
    if (backgroundMusic) {
      backgroundMusic.pause();
      backgroundMusic.src = shuffled[0];
      backgroundMusic.currentTime = 0;
      backgroundMusic.volume = getEffectiveMusicVolume(musicVolume, masterVolume);
    }
    
    set({
      musicTracks: shuffled,
      currentTrackIndex: 0,
      nextTrackAudio: prepareNextTrackAudio(shuffled, 0),
      isCrossfading: false,
    });
    
    if (isMusicPlaying && !isMuted && backgroundMusic) {
      backgroundMusic.play().catch(() => {});
    }
  },

  playNextTrack: () => {
    const {
      musicTracks,
      currentTrackIndex,
      isMuted,
      musicVolume,
      masterVolume,
      backgroundMusic,
      nextTrackAudio,
      isMusicPlaying,
      isCrossfading,
    } = get();
    
    if (musicTracks.length === 0 || !backgroundMusic || isCrossfading) return;
    
    const { tracks: nextTracks, nextIndex } = resolveNextTrack(musicTracks, currentTrackIndex);
    const nextSrc = nextTracks[nextIndex];
    const effectiveVolume = getEffectiveMusicVolume(musicVolume, masterVolume);
    const nextAudio = audioSourceMatches(nextTrackAudio, nextSrc) && nextTrackAudio
      ? nextTrackAudio
      : createPreloadedAudio(nextSrc);

    backgroundMusic.onended = null;
    backgroundMusic.ontimeupdate = null;
    backgroundMusic.pause();

    nextAudio.currentTime = 0;
    nextAudio.volume = effectiveVolume;
    attachTrackHandlers(nextAudio);

    set({
      musicTracks: nextTracks,
      currentTrackIndex: nextIndex,
      backgroundMusic: nextAudio,
      nextTrackAudio: prepareNextTrackAudio(nextTracks, nextIndex),
      isCrossfading: false,
    });
    
    if (!isMuted && isMusicPlaying) {
      nextAudio.play().catch(() => {});
    }
  },

  startCrossfade: () => {
    const {
      backgroundMusic,
      musicTracks,
      currentTrackIndex,
      isMuted,
      isMusicPlaying,
      isCrossfading,
      musicVolume,
      masterVolume,
      nextTrackAudio,
    } = get();

    if (!backgroundMusic || isMuted || !isMusicPlaying || isCrossfading || musicTracks.length <= 1) {
      return;
    }

    const { tracks: nextTracks, nextIndex } = resolveNextTrack(musicTracks, currentTrackIndex);
    const nextSrc = nextTracks[nextIndex];
    const nextAudio = audioSourceMatches(nextTrackAudio, nextSrc) && nextTrackAudio
      ? nextTrackAudio
      : createPreloadedAudio(nextSrc);

    backgroundMusic.onended = null;
    backgroundMusic.ontimeupdate = null;
    nextAudio.currentTime = 0;
    nextAudio.volume = 0;

    set({ isCrossfading: true, nextTrackAudio: nextAudio });

    const targetVolume = getEffectiveMusicVolume(musicVolume, masterVolume);
    const startVolume = clampVolume(backgroundMusic.volume);
    const nowFn = typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now.bind(performance)
      : Date.now;
    const startTime = nowFn();

    const step = (now: number) => {
      const { isCrossfading: stillCrossfading, isMuted: muted } = get();
      if (!stillCrossfading) return;
      if (muted) {
        backgroundMusic.pause();
        nextAudio.pause();
        attachTrackHandlers(backgroundMusic);
        set({
          isCrossfading: false,
          nextTrackAudio: prepareNextTrackAudio(musicTracks, currentTrackIndex),
        });
        return;
      }
      const progress = Math.min(1, (now - startTime) / CROSSFADE_DURATION_MS);
      nextAudio.volume = targetVolume * progress;
      backgroundMusic.volume = startVolume * (1 - progress);

      if (progress < 1) {
        scheduleFrame(step);
        return;
      }

      backgroundMusic.pause();
      backgroundMusic.currentTime = 0;
      attachTrackHandlers(nextAudio);
      set({
        backgroundMusic: nextAudio,
        musicTracks: nextTracks,
        currentTrackIndex: nextIndex,
        nextTrackAudio: prepareNextTrackAudio(nextTracks, nextIndex),
        isCrossfading: false,
      });
    };

    nextAudio.play()
      .then(() => {
        scheduleFrame(step);
      })
      .catch(() => {
        attachTrackHandlers(backgroundMusic);
        set({
          isCrossfading: false,
          nextTrackAudio: prepareNextTrackAudio(musicTracks, currentTrackIndex),
        });
      });
  },

  startBackgroundMusic: () => {
    const { backgroundMusic, isMuted, musicVolume, masterVolume, musicTracks, isMusicPlaying } = get();
    
    if (!backgroundMusic || musicTracks.length === 0) return;
    
    // Only shuffle if music is NOT already playing (first start or after stop)
    if (!isMusicPlaying && musicTracks.length > 1) {
      const shuffled = shuffleArray(musicTracks);
      backgroundMusic.src = shuffled[0];
      set({
        musicTracks: shuffled,
        currentTrackIndex: 0,
        nextTrackAudio: prepareNextTrackAudio(shuffled, 0),
        isCrossfading: false,
      });
    }
    
    if (!isMuted) {
      backgroundMusic.volume = getEffectiveMusicVolume(musicVolume, masterVolume);
      backgroundMusic.play().catch(() => {});
      set({ isMusicPlaying: true });
    }
  },

  pauseBackgroundMusic: (rememberPlayback = false) => {
    const { backgroundMusic, nextTrackAudio, isMusicPlaying } = get();
    if (backgroundMusic) {
      backgroundMusic.pause();
      attachTrackHandlers(backgroundMusic);
    }
    if (nextTrackAudio) {
      nextTrackAudio.pause();
    }
    set({
      wasPlayingBeforeHidden: rememberPlayback ? isMusicPlaying : false,
      isMusicPlaying: false,
      isCrossfading: false,
    });
  },

  resumeBackgroundMusic: () => {
    const { backgroundMusic, isMuted, musicVolume, masterVolume, wasPlayingBeforeHidden } = get();
    if (!backgroundMusic || isMuted || !wasPlayingBeforeHidden) {
      set({ wasPlayingBeforeHidden: false });
      return;
    }
    backgroundMusic.volume = getEffectiveMusicVolume(musicVolume, masterVolume);
    backgroundMusic.play().catch(() => {});
    set({ isMusicPlaying: true, wasPlayingBeforeHidden: false });
  },

  stopBackgroundMusic: () => {
    const { backgroundMusic, nextTrackAudio } = get();
    if (backgroundMusic) {
      backgroundMusic.pause();
      backgroundMusic.currentTime = 0;
    }
    if (nextTrackAudio) {
      nextTrackAudio.pause();
      nextTrackAudio.currentTime = 0;
    }
    set({ isMusicPlaying: false, wasPlayingBeforeHidden: false, isCrossfading: false });
  },
  
  playSfx: (key, volumeScale = 1) => {
    const { sfxMap, isMuted, sfxVolume, masterVolume, isInitialized } = get();
    if (!SFX_ENABLED || isMuted || !isInitialized) return;
    const sound = sfxMap[key];
    if (!sound) return;
    const volume = clampVolume(sfxVolume * masterVolume * volumeScale);
    const soundId = sound.play();
    if (soundId !== undefined && soundId !== null) {
      sound.volume(volume);
    }
  },

  playHit: () => {
    get().playSfx('hit');
  },
  
  playSuccess: () => {
    get().playSfx('success');
  },

  playUnitMove: () => {
    get().playSfx('unit-move', 0.6);
  },

  playConstruction: () => {
    get().playSfx('construction-complete', 0.7);
  },

  playNotification: () => {
    get().playSfx('notification', 0.5);
  }
  };
});
