import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('howler', () => ({
  Howl: vi.fn(() => ({
    play: vi.fn(() => 1),
    stop: vi.fn(),
    unload: vi.fn(),
    volume: vi.fn(),
  })),
}));

describe('useAudio crossfade volume clamping', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('never writes a negative volume when an animation frame predates crossfade start', async () => {
    const observedVolumes: number[] = [];

    class FakeAudio {
      src: string;
      preload = '';
      loop = false;
      currentTime = 0;
      duration = 10;
      onended: (() => void) | null = null;
      ontimeupdate: (() => void) | null = null;
      pause = vi.fn();
      play = vi.fn(() => Promise.resolve());
      load = vi.fn();
      private currentVolume = 0;

      constructor(src = '') {
        this.src = src;
      }

      get volume() {
        return this.currentVolume;
      }

      set volume(value: number) {
        observedVolumes.push(value);
        if (!Number.isFinite(value) || value < 0 || value > 1) {
          throw new Error(`volume out of range: ${value}`);
        }
        this.currentVolume = value;
      }
    }

    const frameTimes = [900, 2800];
    vi.stubGlobal('Audio', FakeAudio);
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      const timestamp = frameTimes.shift() ?? 2800;
      callback(timestamp);
      return 1;
    }));
    vi.stubGlobal('performance', {
      now: vi.fn(() => 1000),
    });

    const { useAudio } = await import('./useAudio');
    const backgroundMusic = new Audio('/sounds/one.mp3');
    const nextTrackAudio = new Audio('/sounds/two.mp3');
    backgroundMusic.volume = 0.7;

    useAudio.setState({
      backgroundMusic,
      nextTrackAudio,
      musicTracks: ['/sounds/one.mp3', '/sounds/two.mp3'],
      currentTrackIndex: 0,
      sfxMap: {},
      isMuted: false,
      isInitialized: true,
      masterVolume: 1,
      musicVolume: 1,
      sfxVolume: 0.6,
      isMusicPlaying: true,
      isCrossfading: false,
      wasPlayingBeforeHidden: false,
    });

    useAudio.getState().startCrossfade();
    await Promise.resolve();

    expect(observedVolumes.length).toBeGreaterThan(0);
    expect(observedVolumes.every((volume) => volume >= 0 && volume <= 1)).toBe(true);
    expect(backgroundMusic.pause).toHaveBeenCalled();
    expect(useAudio.getState().isCrossfading).toBe(false);
  });
});
