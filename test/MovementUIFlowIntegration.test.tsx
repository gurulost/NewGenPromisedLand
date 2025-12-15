import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SelectedUnitPanel from '../client/src/components/ui/SelectedUnitPanel';
import MovementControls from '../client/src/components/game/MovementControls';

const mockUseLocalGame = vi.fn();
vi.mock('../client/src/lib/stores/useLocalGame', () => ({
  useLocalGame: () => mockUseLocalGame(),
}));

const mockUseGameState = vi.fn();
vi.mock('../client/src/lib/stores/useGameState', () => ({
  useGameState: () => mockUseGameState(),
}));

vi.mock('../client/src/lib/helpers/actionAvailabilityHelpers', () => ({
  getActionAvailability: () => ({
    canMove: true,
    canAttack: true,
    hasAbilities: false,
    reachableTilesCount: 3,
    attackTargetsCount: 1,
    isPlayerTurn: true,
    movementReason: '',
    attackReason: '',
    abilityReason: '',
  }),
  getDetailedActionFeedback: () => ({}),
}));

describe('Movement UI Flow (light integration)', () => {
  beforeEach(() => {
    mockUseLocalGame.mockReturnValue({
      gameState: { currentPlayerIndex: 0, players: [{ id: 'player-1' }] },
    });
  });

  it('renders SelectedUnitPanel with unit stats and action summary', () => {
    render(
      <SelectedUnitPanel
        unit={
          {
            id: 'unit-1',
            type: 'warrior',
            playerId: 'player-1',
            coordinate: { q: 0, r: 0, s: 0 },
            hp: 25,
            maxHp: 25,
            attack: 6,
            defense: 4,
            movement: 3,
            remainingMovement: 3,
            visionRadius: 2,
            attackRange: 1,
            upgrades: {},
            abilities: [],
            status: 'active',
            hasAttacked: false,
          } as any
        }
      />,
    );

    expect(screen.getByText('Warrior')).toBeInTheDocument();
    expect(screen.getByText('View All Actions')).toBeInTheDocument();
    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(screen.getByText('Move')).toBeInTheDocument();
    expect(screen.getByText('Attack')).toBeInTheDocument();
    expect(screen.getByText('Abilities')).toBeInTheDocument();
  });

  it('cancels MovementControls and clears reachable coordinates', async () => {
    const user = userEvent.setup();
    const setMovementMode = vi.fn();
    const setReachableCoordinates = vi.fn();

    mockUseGameState.mockReturnValue({
      setMovementMode,
      setReachableCoordinates,
    });

    render(
      <MovementControls
        selectedUnit={{ type: 'warrior', remainingMovement: 2 }}
        reachableCount={4}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Cancel Movement' }));
    expect(setMovementMode).toHaveBeenCalledWith(false);
    expect(setReachableCoordinates).toHaveBeenCalledWith([]);
  });
});

