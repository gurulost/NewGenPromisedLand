import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useReducedMotion } from '../useReducedMotion';
import { useUIPreferences } from '../useUIPreferences';
import type { UIPreferences } from '../../lib/userPreferences';

vi.mock('../useUIPreferences', () => ({
  useUIPreferences: vi.fn(),
}));

const mockUseUIPreferences = vi.mocked(useUIPreferences);

const createUIPreferences = (overrides: Partial<UIPreferences> = {}): UIPreferences => ({
  showTooltips: true,
  tooltipDelay: 500,
  reducedMotion: false,
  showAnimations: true,
  ...overrides,
});

const createMediaQueryList = (matches: boolean): MediaQueryList =>
  ({
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }) as unknown as MediaQueryList;

describe('useReducedMotion', () => {
  beforeEach(() => {
    mockUseUIPreferences.mockReturnValue({
      preferences: createUIPreferences(),
      isLoaded: true,
      isLoading: false,
      updateUI: vi.fn(async (updates) => createUIPreferences(updates)),
    });
  });

  it('enables reduced motion when the system preference is set', async () => {
    vi.mocked(window.matchMedia).mockReturnValue(createMediaQueryList(true));

    const { result } = renderHook(() => useReducedMotion());

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it('enables reduced motion when the persisted preference is set', () => {
    vi.mocked(window.matchMedia).mockReturnValue(createMediaQueryList(false));
    mockUseUIPreferences.mockReturnValue({
      preferences: createUIPreferences({ reducedMotion: true }),
      isLoaded: true,
      isLoading: false,
      updateUI: vi.fn(async (updates) => createUIPreferences(updates)),
    });

    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(true);
  });
});
