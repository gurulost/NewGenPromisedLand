import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseLocalGame = vi.fn();
const mockRefreshAnimationLabAccess = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  QueryClient: class QueryClient {},
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="canvas">{children}</div>,
}));

vi.mock('@react-three/drei', () => ({
  KeyboardControls: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../client/src/lib/stores/useLocalGame', () => ({
  useLocalGame: () => mockUseLocalGame(),
}));

vi.mock('../client/src/lib/stores/useAnimationLabAccess', () => ({
  useAnimationLabAccess: (selector: (state: { refresh: typeof mockRefreshAnimationLabAccess }) => unknown) =>
    selector({ refresh: mockRefreshAnimationLabAccess }),
}));

vi.mock('../client/src/hooks/useTouchMode', () => {
  const TouchModeContext = {
    Provider: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="touch-provider">{children}</div>
    ),
  };

  return {
    useTouchModeProvider: () => ({
      TouchModeContext,
      isTouchDevice: false,
      forceTouchMode: false,
      setForceTouchMode: vi.fn(),
    }),
  };
});

vi.mock('../client/src/components/ui/AudioProvider', () => ({
  AudioProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="audio-provider">{children}</div>
  ),
}));

vi.mock('../client/src/components/ui/VisualFeedback', () => ({
  VisualFeedbackProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="visual-feedback-provider">{children}</div>
  ),
}));

vi.mock('../client/src/components/ui/FloatingText', () => ({
  FloatingTextManager: () => <div data-testid="floating-text-manager" />,
}));

vi.mock('../client/src/components/ui/MainMenu', () => ({
  default: () => <div data-testid="main-menu" />,
}));

vi.mock('../client/src/components/ui/PlayerSetup', () => ({
  default: () => <div data-testid="player-setup" />,
}));

vi.mock('../client/src/components/ui/HandoffScreen', () => ({
  default: () => <div data-testid="handoff-screen" />,
}));

vi.mock('../client/src/components/ui/TutorialEpisodeIntro', () => ({
  default: () => <div data-testid="tutorial-episode-intro" />,
}));

vi.mock('../client/src/components/ui/LobbyList', () => ({
  default: () => <div data-testid="lobby-list" />,
}));

vi.mock('../client/src/components/ui/LobbyRoom', () => ({
  default: () => <div data-testid="lobby-room" />,
}));

vi.mock('../client/src/components/ui/WorldBuildLoader', () => ({
  WorldBuildLoader: () => <div data-testid="world-build-loader" />,
}));

vi.mock('../client/src/components/ui/MapGenerationOverlay', () => ({
  MapGenerationOverlay: () => <div data-testid="map-generation-overlay" />,
}));

vi.mock('../client/src/hooks/useMobileUI', () => ({
  useMobileUI: () => ({ isMobileUI: false }),
}));

vi.mock('../client/src/hooks/usePerformanceMode', () => ({
  usePerformanceMode: () => 'high',
}));

vi.mock('../client/src/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../client/src/components/ui/BugReportHost', () => ({
  default: () => <div data-testid="bug-report-host" />,
}));

vi.mock('../client/src/components/ui/AnimationLabGate', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="animation-lab-gate">{children}</div>,
}));

vi.mock('../client/src/components/game/GameCanvas', () => ({
  default: () => <div data-testid="game-canvas" />,
}));

vi.mock('../client/src/components/game/GameUI', () => ({
  default: () => <div data-testid="game-ui" />,
}));

vi.mock('../client/src/components/effects/CombatEffectsDemo', () => ({
  CombatEffectsDemo: () => <div data-testid="combat-effects-demo" />,
}));

vi.mock('../client/src/components/ui/AnimationLab', () => ({
  AnimationLab: () => <div data-testid="animation-lab" />,
}));

describe('App provider coverage', () => {
  beforeEach(() => {
    mockUseLocalGame.mockReturnValue({ gamePhase: 'menu' });
    mockRefreshAnimationLabAccess.mockClear();
    window.history.replaceState({}, '', '/');
    window.location.hash = '';
  });

  it('keeps shared providers around the combat demo route', async () => {
    window.location.hash = '#combat-demo';
    const { default: App } = await import('../client/src/App');

    render(<App />);

    expect(screen.getByTestId('touch-provider')).toBeInTheDocument();
    expect(screen.getByTestId('audio-provider')).toBeInTheDocument();
    expect(screen.getByTestId('visual-feedback-provider')).toBeInTheDocument();
    expect(screen.getByTestId('floating-text-manager')).toBeInTheDocument();
    expect(await screen.findByTestId('combat-effects-demo')).toBeInTheDocument();
  });

  it('keeps shared providers around the animation lab route', async () => {
    window.history.replaceState({}, '', '/animations');
    const { default: App } = await import('../client/src/App');

    render(<App />);

    expect(screen.getByTestId('touch-provider')).toBeInTheDocument();
    expect(screen.getByTestId('audio-provider')).toBeInTheDocument();
    expect(screen.getByTestId('visual-feedback-provider')).toBeInTheDocument();
    expect(screen.getByTestId('floating-text-manager')).toBeInTheDocument();
    expect(screen.getByTestId('animation-lab-gate')).toBeInTheDocument();
    expect(await screen.findByTestId('animation-lab')).toBeInTheDocument();
  });
});
