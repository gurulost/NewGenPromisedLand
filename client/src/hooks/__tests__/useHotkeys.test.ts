import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useHotkeys } from '../useHotkeys';

describe('useHotkeys', () => {
  let originalAddEventListener: typeof window.addEventListener;
  let originalRemoveEventListener: typeof window.removeEventListener;
  let mockCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockCallback = vi.fn();
    originalAddEventListener = window.addEventListener;
    originalRemoveEventListener = window.removeEventListener;

    window.addEventListener = vi.fn();
    window.removeEventListener = vi.fn();
  });

  afterEach(() => {
    window.addEventListener = originalAddEventListener;
    window.removeEventListener = originalRemoveEventListener;
    vi.clearAllMocks();
  });

  it('adds event listener on mount', () => {
    renderHook(() => useHotkeys('Escape', mockCallback));
    
    expect(window.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('removes event listener on unmount', () => {
    const { unmount } = renderHook(() => useHotkeys('Escape', mockCallback));
    
    unmount();
    
    expect(window.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('handles single key hotkey', () => {
    renderHook(() => useHotkeys('Escape', mockCallback));
    
    const [[, handler]] = (window.addEventListener as unknown as ReturnType<typeof vi.fn>).mock.calls;
    
    // Simulate Escape key press
    handler({ key: 'Escape', preventDefault: vi.fn() });
    
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  it('handles multiple key hotkeys', () => {
    renderHook(() => useHotkeys(['Escape', 'b'], mockCallback));
    
    const [[, handler]] = (window.addEventListener as unknown as ReturnType<typeof vi.fn>).mock.calls;
    
    // Simulate Escape key press
    handler({ key: 'Escape', preventDefault: vi.fn() });
    expect(mockCallback).toHaveBeenCalledTimes(1);
    
    // Simulate 'b' key press
    handler({ key: 'b', preventDefault: vi.fn() });
    expect(mockCallback).toHaveBeenCalledTimes(2);
  });

  it('prevents default behavior when key matches', () => {
    const preventDefault = vi.fn();
    renderHook(() => useHotkeys('Escape', mockCallback));
    
    const [[, handler]] = (window.addEventListener as unknown as ReturnType<typeof vi.fn>).mock.calls;
    
    handler({ key: 'Escape', preventDefault });
    
    expect(preventDefault).toHaveBeenCalled();
  });

  it('ignores hotkeys while typing in inputs', () => {
    renderHook(() => useHotkeys('KeyB', mockCallback));

    const [[, handler]] = (window.addEventListener as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const input = document.createElement('input');

    handler({ key: 'b', target: input, preventDefault: vi.fn() });

    expect(mockCallback).not.toHaveBeenCalled();
  });

  it('does not trigger callback for non-matching keys', () => {
    renderHook(() => useHotkeys('Escape', mockCallback));
    
    const [[, handler]] = (window.addEventListener as unknown as ReturnType<typeof vi.fn>).mock.calls;
    
    handler({ key: 'Enter', preventDefault: vi.fn() });
    
    expect(mockCallback).not.toHaveBeenCalled();
  });

  it('updates callback when it changes', () => {
    const newCallback = vi.fn();
    const { rerender } = renderHook(
      ({ callback }) => useHotkeys('Escape', callback),
      { initialProps: { callback: mockCallback } }
    );
    
    const [[, handler]] = (window.addEventListener as unknown as ReturnType<typeof vi.fn>).mock.calls;
    
    // Test with original callback
    handler({ key: 'Escape', preventDefault: vi.fn() });
    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(newCallback).not.toHaveBeenCalled();
    
    // Update callback
    rerender({ callback: newCallback });
    
    // Test with new callback
    handler({ key: 'Escape', preventDefault: vi.fn() });
    expect(mockCallback).toHaveBeenCalledTimes(1); // Should not increase
    expect(newCallback).toHaveBeenCalledTimes(1);
  });
});
