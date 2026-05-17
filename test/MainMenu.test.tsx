import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import MainMenu from '../client/src/components/ui/MainMenu';
import { useLocalGame } from '../client/src/lib/stores/useLocalGame';
import { useAnimationLabAccess } from '../client/src/lib/stores/useAnimationLabAccess';
import { loadAutosave } from '../client/src/lib/autosaveStorage';

const saveApiMocks = vi.hoisted(() => {
  class MockSaveApiError extends Error {
    constructor(
      message: string,
      public readonly code: 'timeout' | 'network' | 'server' | 'invalid_response' = 'server',
      public readonly status?: number,
    ) {
      super(message);
      this.name = 'SaveApiError';
    }
  }

  const isExpectedCloudSaveUnavailable = vi.fn((error: unknown) =>
    error instanceof MockSaveApiError &&
    error.code === 'server' &&
    error.status === 503 &&
    error.message === 'Save API unavailable',
  );

  return {
    MockSaveApiError,
    getLocalSavesSnapshot: vi.fn(),
    listSaves: vi.fn(),
    isExpectedCloudSaveUnavailable,
  };
});

vi.mock('../client/src/lib/stores/useLocalGame');
vi.mock('../client/src/lib/stores/useAnimationLabAccess');
vi.mock('../client/src/lib/autosaveStorage');
vi.mock('../client/src/components/ui/SaveLoadMenu', () => ({
  default: () => <div data-testid="save-load-menu" />,
}));
vi.mock('../client/src/components/ui/HeroBackground', () => ({
  HeroBackground: () => <div data-testid="hero-background" />,
}));
vi.mock('../client/src/components/primitives/ContentShell', () => ({
  ContentShell: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('../client/src/components/primitives/PanelHeader', () => ({
  PanelHeader: ({ title, description }: any) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  ),
}));
vi.mock('../client/src/components/primitives/GlowingButton', () => ({
  GlowingButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('../client/src/components/primitives/StepFretDivider', () => ({
  StepFretDivider: () => <hr />,
}));
vi.mock('../client/src/components/primitives/ThematicIcons', () => ({
  HeaddressIcon: () => <span />,
  WarriorShieldIcon: () => <span />,
  TempleIcon: () => <span />,
}));
vi.mock('../client/src/lib/saveApi', () => ({
  getLocalSavesSnapshot: (...args: any[]) => saveApiMocks.getLocalSavesSnapshot(...args),
  isExpectedCloudSaveUnavailable: (...args: any[]) =>
    saveApiMocks.isExpectedCloudSaveUnavailable(...args),
  listSaves: (...args: any[]) => saveApiMocks.listSaves(...args),
  SaveApiError: saveApiMocks.MockSaveApiError,
}));

const mockUseLocalGame = useLocalGame as any;
const mockUseAnimationLabAccess = useAnimationLabAccess as any;
const mockLoadAutosave = loadAutosave as any;

describe('MainMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveApiMocks.getLocalSavesSnapshot.mockReturnValue([]);
    saveApiMocks.listSaves.mockResolvedValue([]);
    saveApiMocks.isExpectedCloudSaveUnavailable.mockImplementation((error: unknown) =>
      error instanceof saveApiMocks.MockSaveApiError &&
      error.code === 'server' &&
      error.status === 503 &&
      error.message === 'Save API unavailable',
    );
    mockUseLocalGame.mockReturnValue({
      setGamePhase: vi.fn(),
      loadGameState: vi.fn(),
    });
    mockUseAnimationLabAccess.mockReturnValue(false);
    mockLoadAutosave.mockResolvedValue(null);
  });

  it('does not log expected disabled cloud-save list failures', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    saveApiMocks.listSaves.mockRejectedValueOnce(
      new saveApiMocks.MockSaveApiError('Save API unavailable', 'server', 503),
    );

    render(<MainMenu />);

    await waitFor(() => expect(saveApiMocks.listSaves).toHaveBeenCalled());
    expect(saveApiMocks.isExpectedCloudSaveUnavailable).toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('still logs unexpected save-list failures', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const unexpectedError = new Error('Request failed');
    saveApiMocks.listSaves.mockRejectedValueOnce(unexpectedError);

    render(<MainMenu />);

    await waitFor(() => expect(saveApiMocks.listSaves).toHaveBeenCalled());
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load saved games:', unexpectedError);
    consoleErrorSpy.mockRestore();
  });
});
