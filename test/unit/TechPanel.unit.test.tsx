import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TechPanel from '../../client/src/components/ui/TechPanel';

const dispatch = vi.fn();

const mockGameState: any = {
  id: 'game-1',
  currentPlayerIndex: 0,
  players: [
    {
      id: 'player-1',
      stars: 100,
      researchedTechs: [],
      currentResearch: undefined,
    },
  ],
};

vi.mock('../../client/src/lib/stores/useLocalGame', () => ({
  useLocalGame: () => ({ gameState: mockGameState, dispatch }),
}));

vi.mock('../../client/src/hooks/useHaptic', () => ({
  useHaptic: () => () => {},
}));

describe('TechPanel', () => {
  beforeEach(() => {
    dispatch.mockClear();
    mockGameState.players[0].stars = 100;
    mockGameState.players[0].researchedTechs = [];
    mockGameState.players[0].currentResearch = undefined;
    mockGameState.players[0].researchInspiration = 0;
  });

  it('renders nothing when closed', () => {
    const { container } = render(<TechPanel open={false} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the modal chrome and tech nodes when open', () => {
    render(<TechPanel open onClose={vi.fn()} />);
    expect(screen.getByText('Sacred Knowledge')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-tech-node="true"]').length).toBeGreaterThan(0);
  });

  it('selects a technology and dispatches research', async () => {
    const user = userEvent.setup();
    render(<TechPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText('Organization'));
    expect(screen.getAllByText('Organization').length).toBeGreaterThan(0);

    const researchButton = screen.getByRole('button', { name: 'Research Technology' });
    expect(researchButton).toBeEnabled();
    await user.click(researchButton);

    expect(dispatch).toHaveBeenCalledWith({
      type: 'RESEARCH_TECHNOLOGY',
      payload: { playerId: 'player-1', technologyId: 'organization' },
    });
  });

  it('does not research the selected technology when pressing enter in search', async () => {
    const user = userEvent.setup();
    render(<TechPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText('Organization'));
    await user.click(screen.getByPlaceholderText('Search technologies...'));
    await user.keyboard('{Enter}');

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('uses canonical research inspiration discounts for affordability', async () => {
    const user = userEvent.setup();
    mockGameState.players[0].stars = 1;
    mockGameState.players[0].researchInspiration = 10;

    render(<TechPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText('Organization'));
    await user.click(screen.getByRole('button', { name: 'Research Technology' }));

    expect(dispatch).toHaveBeenCalledWith({
      type: 'RESEARCH_TECHNOLOGY',
      payload: { playerId: 'player-1', technologyId: 'organization' },
    });
  });
});
