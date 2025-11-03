import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TechPanel } from '../../client/src/components/ui/TechPanel';
import type { GameState, PlayerState } from '../../shared/types/game';

const createPlayer = (overrides: Partial<PlayerState> = {}): PlayerState => ({
  id: 'player1',
  name: 'Test Player',
  factionId: 'NEPHITES',
  isAI: false,
  stars: 40,
  stats: { faith: 30, pride: 20, internalDissent: 5 },
  modifiers: [],
  abilityCooldowns: {},
  researchedTechs: ['organization'],
  researchInspiration: 0,
  citiesOwned: [],
  constructionQueue: [],
  visibilityMask: [],
  exploredTiles: [],
  isEliminated: false,
  turnOrder: 0,
  ...overrides,
});

const createGameState = (player: PlayerState): GameState => ({
  id: 'game-1',
  players: [player],
  currentPlayerIndex: 0,
  turn: 1,
  phase: 'playing',
  map: { tiles: [], width: 5, height: 5 },
  units: [],
  cities: [],
  improvements: [],
  structures: [],
});

const renderPanel = (overrides: Partial<PlayerState> = {}) => {
  const player = createPlayer(overrides);
  const gameState = createGameState(player);
  const onResearchTech = vi.fn();

  const renderResult = render(
    <TechPanel
      isOpen
      onClose={vi.fn()}
      gameState={gameState}
      currentPlayer={player}
      onResearchTech={onResearchTech}
    />
  );

  return { ...renderResult, player, gameState, onResearchTech };
};

describe('TechPanel Component', () => {
  it('renders tier badges and prerequisite chips for each technology', () => {
    renderPanel();

    const node = screen.getByText('Organization').closest('[data-testid="tech-node"]');
    expect(node).not.toBeNull();
    expect(within(node!).getByText('Tier I')).toBeInTheDocument();

    const forestryNode = screen.getByText('Forestry').closest('[data-testid="tech-node"]');
    expect(forestryNode).not.toBeNull();
    expect(within(forestryNode!).getByText('Tier II')).toBeInTheDocument();
  });

  it('draws connector paths between prerequisite technologies', () => {
    const { container } = renderPanel();
    const connectors = container.querySelectorAll('svg path');
    expect(connectors.length).toBeGreaterThan(0);
  });

  it('disables research button when prerequisites are missing', async () => {
    const user = userEvent.setup();
    renderPanel({ researchedTechs: ['organization'] });

    await user.click(screen.getByText('Bronze Working'));

    expect(screen.getByText('Bronze Working')).toBeInTheDocument();
    expect(screen.getByText('Prerequisites not met.')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /requirements not met/i });
    expect(button).toBeDisabled();
  });

  it('displays research inspiration discount in details', async () => {
    const user = userEvent.setup();
    renderPanel({
      stars: 50,
      researchedTechs: ['organization'],
      researchInspiration: 5,
    });

    await user.click(screen.getByText('Agriculture'));

    expect(screen.getByText(/saved 5 \\(base 12\\)/i)).toBeInTheDocument();
    expect(screen.getByText(/research for 7 stars/i)).toBeInTheDocument();
  });

  it('invokes callback when researching an available technology', async () => {
    const user = userEvent.setup();
    const { onResearchTech } = renderPanel({
      researchedTechs: ['organization', 'hunting', 'mining'],
      stars: 200,
    });

    await user.click(screen.getByText('Bronze Working'));
    const button = screen.getByRole('button', { name: /research for/i });
    await user.click(button);

    expect(onResearchTech).toHaveBeenCalledWith('bronze_working');
  });
});
