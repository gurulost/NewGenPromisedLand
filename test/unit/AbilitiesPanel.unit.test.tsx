import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import UnitActionsPanel from '../../client/src/components/ui/AbilitiesPanel';
import { useLocalGame } from '../../client/src/lib/stores/useLocalGame';
import { useGameState } from '../../client/src/lib/stores/useGameState';

vi.mock('../../client/src/lib/stores/useLocalGame');
vi.mock('../../client/src/lib/stores/useGameState');
vi.mock('../../client/src/hooks/useMobileUI', () => ({
  useMobileUI: () => ({ isMobileUI: false }),
}));

describe('UnitActionsPanel', () => {
  const dispatch = vi.fn();
  const onClose = vi.fn();
  const setMovementMode = vi.fn();
  const setAttackMode = vi.fn();
  const startRoadBuild = vi.fn();

  const commander: any = {
    id: 'commander-1',
    type: 'commander',
    playerId: 'player1',
    coordinate: { q: 0, r: 0, s: 0 },
    hp: 20,
    maxHp: 20,
    attack: 0,
    defense: 4,
    movement: 1,
    remainingMovement: 0,
    vision: 2,
    actionsRemaining: 1,
    maxActions: 1,
    abilities: ['RALLY_TROOPS'],
  };

  const gameState: any = {
    id: 'game1',
    currentPlayerIndex: 0,
    turn: 1,
    phase: 'playing',
    players: [
      {
        id: 'player1',
        name: 'Test Player',
        factionId: 'NEPHITES',
        stars: 0,
        stats: { faith: 0, pride: 0, internalDissent: 0 },
        modifiers: [],
        researchedTechs: [],
        researchProgress: 0,
        citiesOwned: [],
        constructionQueue: [],
        visibilityMask: [],
        exploredTiles: [],
        abilityCooldowns: {},
        isEliminated: false,
        turnOrder: 0,
      },
    ],
    units: [commander],
    cities: [],
    structures: [],
    improvements: [],
    map: {
      width: 5,
      height: 5,
      tiles: [
        {
          coordinate: { q: 0, r: 0, s: 0 },
          terrain: 'plains',
          resources: [],
          hasCity: false,
          exploredBy: ['player1'],
        },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLocalGame).mockReturnValue({ gameState, dispatch } as any);
    vi.mocked(useGameState).mockReturnValue({
      setMovementMode,
      setAttackMode,
      startRoadBuild,
    } as any);
  });

  it('uses canonical rally availability instead of requiring pride', () => {
    render(<UnitActionsPanel unit={commander} onClose={onClose} />);

    const rallyAction = screen.getByRole('button', { name: /Rally Troops: Boost nearby friendly military units/ });
    expect(rallyAction).toHaveAttribute('aria-disabled', 'false');
    expect(screen.getByText(/Gain \+1 Pride/)).toBeInTheDocument();
    expect(screen.queryByText(/Insufficient pride/)).not.toBeInTheDocument();
  });

  it('lets keyboard users select and execute unit action rows', () => {
    render(<UnitActionsPanel unit={commander} onClose={onClose} />);

    fireEvent.keyDown(screen.getByRole('button', { name: /Rally Troops/ }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: /Execute Action/ }));

    expect(dispatch).toHaveBeenCalledWith({
      type: 'RALLY_TROOPS',
      payload: { playerId: 'player1', unitId: 'commander-1' },
    });
    expect(onClose).toHaveBeenCalled();
  });
});
