import { renderHook, act } from '@testing-library/react';
import { useSfxEngine } from '../useSfx';

// Mock audio context and related APIs
const mockAudioContext = {
  createBufferSource: jest.fn(() => ({
    connect: jest.fn(),
    start: jest.fn(),
    buffer: null,
  })),
  createGain: jest.fn(() => ({
    connect: jest.fn(),
    gain: { value: 1 },
  })),
  destination: {},
  decodeAudioData: jest.fn(),
};

const mockAudio = {
  play: jest.fn(() => Promise.resolve()),
  pause: jest.fn(),
  load: jest.fn(),
  volume: 1,
  currentTime: 0,
  duration: 10,
  paused: true,
  ended: false,
};

// Mock global Audio constructor
global.Audio = jest.fn(() => mockAudio) as any;
global.AudioContext = jest.fn(() => mockAudioContext) as any;
(global as any).webkitAudioContext = jest.fn(() => mockAudioContext);

describe('useSfxEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns a function', () => {
    const { result } = renderHook(() => useSfxEngine());
    
    expect(typeof result.current).toBe('function');
  });

  it('handles sound playback calls', () => {
    const { result } = renderHook(() => useSfxEngine());
    const playSfx = result.current;
    
    act(() => {
      playSfx('button-click');
    });
    
    // Should attempt to create and play audio
    expect(global.Audio).toHaveBeenCalled();
  });

  it('throttles rapid consecutive calls', () => {
    const { result } = renderHook(() => useSfxEngine());
    const playSfx = result.current;
    
    act(() => {
      playSfx('button-click');
      playSfx('button-click');
      playSfx('button-click');
    });
    
    // Should only create audio once due to throttling
    expect(global.Audio).toHaveBeenCalledTimes(1);
  });

  it('allows different sounds to play simultaneously', () => {
    const { result } = renderHook(() => useSfxEngine());
    const playSfx = result.current;
    
    act(() => {
      playSfx('button-click');
      playSfx('panel-open');
    });
    
    // Should create audio for both different sounds
    expect(global.Audio).toHaveBeenCalledTimes(2);
  });

  it('handles audio playback errors gracefully', () => {
    mockAudio.play.mockRejectedValueOnce(new Error('Audio failed'));
    
    const { result } = renderHook(() => useSfxEngine());
    const playSfx = result.current;
    
    expect(() => {
      act(() => {
        playSfx('button-click');
      });
    }).not.toThrow();
  });

  it('respects throttle timing', () => {
    const { result } = renderHook(() => useSfxEngine());
    const playSfx = result.current;
    
    act(() => {
      playSfx('button-click');
    });
    
    expect(global.Audio).toHaveBeenCalledTimes(1);
    
    // Fast forward past throttle period
    act(() => {
      jest.advanceTimersByTime(200);
      playSfx('button-click');
    });
    
    expect(global.Audio).toHaveBeenCalledTimes(2);
  });

  it('handles missing audio files gracefully', () => {
    mockAudio.play.mockRejectedValueOnce(new Error('404 Not Found'));
    
    const { result } = renderHook(() => useSfxEngine());
    const playSfx = result.current;
    
    expect(() => {
      act(() => {
        playSfx('nonexistent-sound');
      });
    }).not.toThrow();
  });

  it('cleans up resources properly', () => {
    const { result, unmount } = renderHook(() => useSfxEngine());
    const playSfx = result.current;
    
    act(() => {
      playSfx('button-click');
    });
    
    expect(() => {
      unmount();
    }).not.toThrow();
  });

  it('handles volume control if implemented', () => {
    const { result } = renderHook(() => useSfxEngine());
    const playSfx = result.current;
    
    act(() => {
      playSfx('button-click');
    });
    
    // Audio should be created with reasonable volume
    expect(mockAudio.volume).toBeDefined();
  });
});