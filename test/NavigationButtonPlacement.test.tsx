import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayerHUD } from '../client/src/components/ui/PlayerHUD';
import { BuildingMenu } from '../client/src/components/ui/BuildingMenu';

vi.mock('../client/src/components/ui/TooltipSystem', () => ({
  InfoTooltip: ({ children }: any) => children ?? null,
  StarProductionTooltip: () => null,
  FaithSystemTooltip: () => null,
  PrideSystemTooltip: () => null,
  DissentSystemTooltip: () => null,
  DissentTooltip: () => null,
  ActionTooltip: () => null,
}));

describe('Navigation Button Placement', () => {
  it('renders PlayerHUD navigation actions', () => {
    const player: any = {
      id: 'player1',
      name: 'Test Player',
      factionId: 'NEPHITES',
      stars: 10,
      stats: { faith: 10, pride: 0, internalDissent: 0 },
      researchedTechs: [],
      citiesOwned: ['city1'],
      constructionQueue: [],
      exploredTiles: [],
      visibilityMask: [],
      isEliminated: false,
      turnOrder: 0,
      atWarWith: [],
      alliedWith: [],
      tradeRoutes: [],
      diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
    };

    const gameState: any = {
      id: 'g',
      players: [player],
      currentPlayerIndex: 0,
      turn: 1,
      phase: 'playing',
      map: { tiles: [], width: 10, height: 10 },
      units: [],
      cities: [{ id: 'city1', name: 'Test City', coordinate: { q: 0, r: 0 }, ownerId: 'player1', population: 1, starProduction: 1 }],
      improvements: [],
      structures: [],
    };

    render(
      <PlayerHUD
        player={player}
        gameState={gameState}
        onShowTechPanel={vi.fn()}
        onShowConstructionHall={vi.fn()}
        onShowDiplomacy={vi.fn()}
        onEndTurn={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /knowledge/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^build$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /diplomacy/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /end turn/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^cities$/i })).not.toBeInTheDocument();
  });

  it('calls PlayerHUD Build handler', async () => {
    const user = userEvent.setup();
    const onShowConstructionHall = vi.fn();

    const player: any = {
      id: 'player1',
      name: 'Test Player',
      factionId: 'NEPHITES',
      stars: 10,
      stats: { faith: 10, pride: 0, internalDissent: 0 },
      researchedTechs: [],
      citiesOwned: ['city1'],
      constructionQueue: [],
      exploredTiles: [],
      visibilityMask: [],
      isEliminated: false,
      turnOrder: 0,
      atWarWith: [],
      alliedWith: [],
      tradeRoutes: [],
      diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
    };

    const gameState: any = {
      id: 'g',
      players: [player],
      currentPlayerIndex: 0,
      turn: 1,
      phase: 'playing',
      map: { tiles: [], width: 10, height: 10 },
      units: [],
      cities: [{ id: 'city1', name: 'Test City', coordinate: { q: 0, r: 0 }, ownerId: 'player1', population: 1, starProduction: 1 }],
      improvements: [],
      structures: [],
    };

    render(
      <PlayerHUD
        player={player}
        gameState={gameState}
        onShowTechPanel={vi.fn()}
        onShowConstructionHall={onShowConstructionHall}
        onShowDiplomacy={vi.fn()}
        onEndTurn={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /^build$/i }));
    expect(onShowConstructionHall).toHaveBeenCalledOnce();
  });

  it('shows BuildingMenu Cities button only when handler provided', async () => {
    const user = userEvent.setup();
    const onShowCities = vi.fn();

    const player: any = {
      id: 'player1',
      name: 'Test Player',
      factionId: 'NEPHITES',
      stars: 10,
      stats: { faith: 10, pride: 0, internalDissent: 0 },
      researchedTechs: [],
      citiesOwned: ['city1'],
    };

    const city: any = { id: 'city1', name: 'Test City', coordinate: { q: 0, r: 0 }, population: 1, ownerId: 'player1', starProduction: 1 };

    const gameState: any = {
      id: 'g',
      players: [player],
      currentPlayerIndex: 0,
      turn: 1,
      phase: 'playing',
      map: { tiles: [], width: 10, height: 10 },
      units: [],
      cities: [city],
      improvements: [],
      structures: [],
    };

    const { rerender } = render(
      <BuildingMenu
        city={city}
        player={player}
        gameState={gameState}
        onBuild={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /^cities$/i })).not.toBeInTheDocument();

    rerender(
      <BuildingMenu
        city={city}
        player={player}
        gameState={gameState}
        onBuild={vi.fn()}
        onClose={vi.fn()}
        onShowCities={onShowCities}
      />
    );

    const citiesButton = screen.getByRole('button', { name: /^cities$/i });
    expect(citiesButton).toBeInTheDocument();
    await user.click(citiesButton);
    expect(onShowCities).toHaveBeenCalledOnce();
  });
});

