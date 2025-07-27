import { renderHook } from '@testing-library/react';
import { useHotkeys } from '../useHotkeys';

describe('useHotkeys', () => {
  let originalAddEventListener: typeof document.addEventListener;
  let originalRemoveEventListener: typeof document.removeEventListener;
  let mockCallback: jest.Mock;

  beforeEach(() => {
    mockCallback = jest.fn();
    originalAddEventListener = document.addEventListener;
    originalRemoveEventListener = document.removeEventListener;
    
    document.addEventListener = jest.fn();
    document.removeEventListener = jest.fn();
  });

  afterEach(() => {
    document.addEventListener = originalAddEventListener;
    document.removeEventListener = originalRemoveEventListener;
    jest.clearAllMocks();
  });

  it('adds event listener on mount', () => {
    renderHook(() => useHotkeys('Escape', mockCallback));
    
    expect(document.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('removes event listener on unmount', () => {
    const { unmount } = renderHook(() => useHotkeys('Escape', mockCallback));
    
    unmount();
    
    expect(document.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('handles single key hotkey', () => {
    renderHook(() => useHotkeys('Escape', mockCallback));
    
    const [[, handler]] = (document.addEventListener as jest.Mock).mock.calls;
    
    // Simulate Escape key press
    handler({ key: 'Escape', preventDefault: jest.fn() });
    
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  it('handles multiple key hotkeys', () => {
    renderHook(() => useHotkeys(['Escape', 'b'], mockCallback));
    
    const [[, handler]] = (document.addEventListener as jest.Mock).mock.calls;
    
    // Simulate Escape key press
    handler({ key: 'Escape', preventDefault: jest.fn() });
    expect(mockCallback).toHaveBeenCalledTimes(1);
    
    // Simulate 'b' key press
    handler({ key: 'b', preventDefault: jest.fn() });
    expect(mockCallback).toHaveBeenCalledTimes(2);
  });

  it('prevents default behavior when key matches', () => {
    const preventDefault = jest.fn();
    renderHook(() => useHotkeys('Escape', mockCallback));
    
    const [[, handler]] = (document.addEventListener as jest.Mock).mock.calls;
    
    handler({ key: 'Escape', preventDefault });
    
    expect(preventDefault).toHaveBeenCalled();
  });

  it('does not trigger callback for non-matching keys', () => {
    renderHook(() => useHotkeys('Escape', mockCallback));
    
    const [[, handler]] = (document.addEventListener as jest.Mock).mock.calls;
    
    handler({ key: 'Enter', preventDefault: jest.fn() });
    
    expect(mockCallback).not.toHaveBeenCalled();
  });

  it('updates callback when it changes', () => {
    const newCallback = jest.fn();
    const { rerender } = renderHook(
      ({ callback }) => useHotkeys('Escape', callback),
      { initialProps: { callback: mockCallback } }
    );
    
    const [[, handler]] = (document.addEventListener as jest.Mock).mock.calls;
    
    // Test with original callback
    handler({ key: 'Escape', preventDefault: jest.fn() });
    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(newCallback).not.toHaveBeenCalled();
    
    // Update callback
    rerender({ callback: newCallback });
    
    // Test with new callback
    handler({ key: 'Escape', preventDefault: jest.fn() });
    expect(mockCallback).toHaveBeenCalledTimes(1); // Should not increase
    expect(newCallback).toHaveBeenCalledTimes(1);
  });
});