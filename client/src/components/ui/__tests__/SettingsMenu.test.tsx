import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsMenu } from '../SettingsMenu';
import { useUIPreferences } from '../../../hooks/useUIPreferences';
import type { UIPreferences } from '../../../lib/userPreferences';

vi.mock('../dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  DialogHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}));

vi.mock('../../../hooks/useAudioIntegration', () => ({
  useAudioControls: () => ({
    isMuted: false,
    masterVolume: 0.7,
    musicVolume: 0.6,
    sfxVolume: 0.8,
    toggleMute: vi.fn(),
    setMasterVolume: vi.fn(),
    setMusicVolume: vi.fn(),
    setSfxVolume: vi.fn(),
    startBackgroundMusic: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useMobileUI', () => ({
  useMobileUI: () => ({
    isMobileUI: false,
  }),
}));

vi.mock('../../../lib/stores/useTutorial', () => ({
  useTutorialStore: (selector: (state: { openLibrary: () => void }) => unknown) =>
    selector({
      openLibrary: vi.fn(),
    }),
}));

vi.mock('../../../hooks/useUIPreferences', () => ({
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

describe('SettingsMenu', () => {
  beforeEach(() => {
    mockUseUIPreferences.mockReturnValue({
      preferences: createUIPreferences(),
      isLoaded: true,
      isLoading: false,
      updateUI: vi.fn(async (updates) => createUIPreferences(updates)),
    });
  });

  it('renders real display controls instead of placeholder copy', () => {
    render(<SettingsMenu isOpen onClose={vi.fn()} />);

    expect(screen.queryByText('Additional display options coming soon...')).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Reduce Motion' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Show Tooltips' })).toBeInTheDocument();
  });

  it('persists display preference changes', async () => {
    const user = userEvent.setup();
    const updateUI = vi.fn(async (updates: Partial<UIPreferences>) => createUIPreferences(updates));

    mockUseUIPreferences.mockReturnValue({
      preferences: createUIPreferences(),
      isLoaded: true,
      isLoading: false,
      updateUI,
    });

    render(<SettingsMenu isOpen onClose={vi.fn()} />);

    await user.click(screen.getByRole('switch', { name: 'Reduce Motion' }));
    await user.click(screen.getByRole('switch', { name: 'Show Tooltips' }));

    expect(updateUI).toHaveBeenCalledWith({ reducedMotion: true });
    expect(updateUI).toHaveBeenCalledWith({ showTooltips: false });
  });
});
