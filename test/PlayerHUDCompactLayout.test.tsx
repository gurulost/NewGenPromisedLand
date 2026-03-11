import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PlayerHUD } from '../client/src/components/hud/PlayerHUD';
import { GameLogPanel } from '../client/src/components/ui/GameLogPanel';

const mocks = vi.hoisted(() => ({
  useMobileUI: vi.fn(),
  getPlayerStats: vi.fn(),
  openIfNeeded: vi.fn(),
  useAutosaveStatus: vi.fn(),
}));

vi.mock('../client/src/hooks/useMobileUI', () => ({
  useMobileUI: mocks.useMobileUI,
}));

vi.mock('../client/src/selectors/player', () => ({
  getPlayerStats: mocks.getPlayerStats,
}));

vi.mock('../client/src/lib/stores/useTutorial', () => ({
  useTutorialStore: (selector: (state: { openIfNeeded: typeof mocks.openIfNeeded }) => unknown) =>
    selector({ openIfNeeded: mocks.openIfNeeded }),
}));

vi.mock('../client/src/lib/stores/useLocalGame', () => ({
  useLocalGame: (selector: (state: { gameMode: string }) => unknown) => selector({ gameMode: 'standard' }),
}));

vi.mock('../client/src/lib/stores/useAutosaveStatus', () => ({
  useAutosaveStatus: mocks.useAutosaveStatus,
}));

describe('PlayerHUD compact desktop layout', () => {
  const player = {
    id: 'player-1',
    name: 'Dave',
    factionId: 'NEPHITES',
    stars: 10,
    citiesOwned: ['city-1'],
    researchedTechs: [],
    tradeRoutes: [],
    stats: {
      faith: 30,
      pride: 70,
      internalDissent: 40,
    },
  } as any;

  const gameState = {
    turn: 1,
    players: [
      player,
      {
        id: 'player-2',
        citiesOwned: ['city-2'],
      },
    ],
    cities: [
      { id: 'city-1', ownerId: 'player-1', population: 1 },
      { id: 'city-2', ownerId: 'player-2', population: 1 },
    ],
    structures: [],
    improvements: [],
    lastAction: null,
  } as any;

  beforeEach(() => {
    mocks.useMobileUI.mockReturnValue({
      isSmallViewport: true,
      isMobileUI: false,
      isPortrait: true,
      isTouchDevice: false,
      width: 320,
      height: 1100,
    });
    mocks.getPlayerStats.mockReturnValue({
      faithPercentage: 30,
      pridePercentage: 70,
      dissentPercentage: 40,
      cityCount: 1,
      techCount: 0,
      starProduction: 2,
      starProductionBreakdown: [
        { source: 'Cities', amount: 1 },
        { source: 'Improvements', amount: 1 },
      ],
    });
    mocks.useAutosaveStatus.mockReturnValue({
      lastFailureAt: null,
      lastSuccessAt: Date.now() - 120_000,
      lastSuccessTurn: 1,
      isSaving: false,
    });
    mocks.openIfNeeded.mockReset();
  });

  it('renders the compact victory summary and integrated game log action', () => {
    render(
      <PlayerHUD
        player={player}
        gameState={gameState}
        onShowTechPanel={vi.fn()}
        onShowConstructionHall={vi.fn()}
        onShowDiplomacy={vi.fn()}
        onToggleGameLog={vi.fn()}
        gameLogEntryCount={7}
        isGameLogOpen={false}
        onEndTurn={vi.fn()}
      />,
    );

    expect(screen.getByText('Victory Paths')).toBeInTheDocument();
    expect(screen.getByText('Population')).toBeInTheDocument();
    expect(screen.getByText('Territory')).toBeInTheDocument();
    expect(screen.getByTestId('hud-game-log-button')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('opens the game log from the HUD action in compact mode', async () => {
    const user = userEvent.setup();
    const onToggleGameLog = vi.fn();

    render(
      <PlayerHUD
        player={player}
        gameState={gameState}
        onShowTechPanel={vi.fn()}
        onShowConstructionHall={vi.fn()}
        onShowDiplomacy={vi.fn()}
        onToggleGameLog={onToggleGameLog}
        gameLogEntryCount={3}
        isGameLogOpen={false}
        onEndTurn={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId('hud-game-log-button'));
    expect(onToggleGameLog).toHaveBeenCalledTimes(1);
  });

  it('suppresses the floating collapsed game log trigger when the HUD owns it', () => {
    render(
      <GameLogPanel
        entries={[]}
        currentTurn={1}
        isOpen={false}
        onToggle={vi.fn()}
        hideCollapsedTrigger={true}
      />,
    );

    expect(screen.queryByText('Game Log')).not.toBeInTheDocument();
  });

  it('renders the compact desktop game log as a modal layer below the HUD', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <GameLogPanel
        entries={[
          {
            id: 'entry-1',
            turn: 1,
            playerId: 'player-1',
            playerName: 'Dave',
            type: 'system',
            message: 'Founded Zarahemla.',
            timestamp: Date.now(),
          },
        ]}
        currentTurn={1}
        isOpen={true}
        onToggle={onToggle}
        compactDesktopMode={true}
        hideCollapsedTrigger={true}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Recent turns and faction actions')).toBeInTheDocument();
    expect(screen.getByText('Founded Zarahemla.')).toBeInTheDocument();

    await user.click(screen.getByRole('dialog'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
