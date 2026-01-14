import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useSfxEngine } from '../useSfx';
import { useAudio } from '../../lib/stores/useAudio';

vi.mock('../../lib/stores/useAudio', () => ({
  useAudio: {
    getState: vi.fn(),
  },
}));

const playSfxMock = vi.fn();
let nowSeed = 1_000_000;

describe('useSfxEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nowSeed += 1000;
    vi.spyOn(Date, 'now').mockReturnValue(nowSeed);
    (useAudio.getState as unknown as { mockReturnValue: (value: any) => void }).mockReturnValue({ playSfx: playSfxMock });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a function', () => {
    const { result } = renderHook(() => useSfxEngine());
    
    expect(typeof result.current).toBe('function');
  });

  it('handles sound playback calls', () => {
    const { result } = renderHook(() => useSfxEngine());
    const playSfx = result.current;
    
    act(() => {
      playSfx('cta-click');
    });
    
    expect(playSfxMock).toHaveBeenCalledWith('cta-click');
  });

  it('throttles rapid consecutive calls', () => {
    const { result } = renderHook(() => useSfxEngine());
    const playSfx = result.current;
    
    act(() => {
      playSfx('cta-click');
      playSfx('cta-click');
      playSfx('cta-click');
    });
    
    // Should only create audio once due to throttling
    expect(playSfxMock).toHaveBeenCalledTimes(1);
  });

  it('allows different sounds to play simultaneously', () => {
    const { result } = renderHook(() => useSfxEngine());
    const playSfx = result.current;
    
    act(() => {
      playSfx('cta-click');
      playSfx('panel-open');
    });
    
    // Should create audio for both different sounds
    expect(playSfxMock).toHaveBeenCalledTimes(2);
  });

  it('handles audio playback errors gracefully', () => {
    playSfxMock.mockImplementationOnce(() => {
      throw new Error('Audio failed');
    });
    
    const { result } = renderHook(() => useSfxEngine());
    const playSfx = result.current;
    
    expect(() => {
      act(() => {
        playSfx('cta-click');
      });
    }).not.toThrow();
  });

  it('respects throttle timing', () => {
    const { result } = renderHook(() => useSfxEngine());
    const playSfx = result.current;
    
    act(() => {
      playSfx('cta-click');
    });
    
    expect(playSfxMock).toHaveBeenCalledTimes(1);
    
    const nowSpy = Date.now as unknown as { mockReturnValueOnce: (value: number) => void };
    nowSpy.mockReturnValueOnce(nowSeed + 200);

    act(() => {
      playSfx('cta-click');
    });

    expect(playSfxMock).toHaveBeenCalledTimes(2);
  });

  it('handles missing audio files gracefully', () => {
    playSfxMock.mockImplementationOnce(() => {
      throw new Error('404 Not Found');
    });
    
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
      playSfx('cta-click');
    });
    
    expect(() => {
      unmount();
    }).not.toThrow();
  });

  it('forwards calls to the audio store', () => {
    const { result } = renderHook(() => useSfxEngine());
    const playSfx = result.current;

    act(() => {
      playSfx('panel-open');
    });

    expect(playSfxMock).toHaveBeenCalledWith('panel-open');
  });
});
