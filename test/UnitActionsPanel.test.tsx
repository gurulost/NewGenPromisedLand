import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useLocalGame } from '../client/src/lib/stores/useLocalGame';
import UnitActionsPanel from '../client/src/components/ui/UnitActionsPanel';
import { Unit } from '@shared/types/unit';
import { GameState } from '@shared/types/game';

// Mock the useLocalGame hook
vi.mock('../client/src/lib/stores/useLocalGame');

const mockUseLocalGame = useLocalGame as any;

describe('UnitActionsPanel', () => {
  const mockGameState: GameState = {
    id: 'test-game',
    players: [
      {
        id: 'player1',
        name: 'Alice',
        factionId: 'NEPHITES',
        stats: { faith: 50, pride: 30, internalDissent: 10 },
        visibilityMask: [],
        exploredTiles: [],
        isEliminated: false,
        turnOrder: 0,
        stars: 20,
        researchedTechs: [],
        researchProgress: 0,
        citiesOwned: []
      }
    ],
    currentPlayerIndex: 0,
    turn: 1,
    phase: 'playing',
    map: { width: 8, height: 8, tiles: [] },
    units: [],
    cities: [],
    improvements: [],
    structures: []
  };

  const mockWorkerUnit: Unit = {
    id: 'worker1',
    status: 'active',
    type: 'worker',
    playerId: 'player1',
    coordinate: { q: 0, r: 0, s: 0 },
    hp: 8,
    maxHp: 8,
    movement: 2,
    remainingMovement: 2,
    attack: 1,
    defense: 1,
    visionRadius: 2,
    attackRange: 1,
    abilities: ['build'],
    level: 1,
    experience: 0
  };

  const mockScoutUnit: Unit = {
    id: 'scout1',
    status: 'active',
    type: 'scout',
    playerId: 'player1',
    coordinate: { q: 1, r: 0, s: -1 },
    hp: 6,
    maxHp: 6,
    movement: 3,
    remainingMovement: 3,
    attack: 2,
    defense: 1,
    visionRadius: 3,
    attackRange: 1,
    abilities: ['stealth', 'reconnaissance'],
    level: 1,
    experience: 0
  };

  const mockMissionaryUnit: Unit = {
    id: 'missionary1',
    status: 'active',
    type: 'missionary',
    playerId: 'player1',
    coordinate: { q: 2, r: 0, s: -2 },
    hp: 5,
    maxHp: 5,
    movement: 2,
    remainingMovement: 2,
    attack: 0,
    defense: 1,
    visionRadius: 2,
    attackRange: 1,
    abilities: ['heal', 'convert'],
    level: 1,
    experience: 0
  };

  const mockProps = {
    onClose: vi.fn()
  };

  const mockDispatch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLocalGame.mockReturnValue({
      gameState: mockGameState,
      dispatch: mockDispatch
    });
  });

  it('renders unit actions panel with unit name', () => {
    render(<UnitActionsPanel unit={mockWorkerUnit} {...mockProps} />);
    
    expect(screen.getByText('Worker Actions')).toBeInTheDocument();
    expect(screen.getByText('Select an action for this unit to perform')).toBeInTheDocument();
  });

  it('displays unit status correctly', () => {
    render(<UnitActionsPanel unit={mockWorkerUnit} {...mockProps} />);
    
    expect(screen.getByText('8/8')).toBeInTheDocument(); // Health
    expect(screen.getByText('2/2')).toBeInTheDocument(); // Movement
  });

  it('shows basic movement action when unit has movement', () => {
    render(<UnitActionsPanel unit={mockWorkerUnit} {...mockProps} />);
    
    expect(screen.getByText('Move')).toBeInTheDocument();
    expect(screen.getByText('Move to adjacent tiles')).toBeInTheDocument();
  });

  it('does not show movement action when unit has no movement', () => {
    const exhaustedUnit = { ...mockWorkerUnit, remainingMovement: 0 };
    render(<UnitActionsPanel unit={exhaustedUnit} {...mockProps} />);
    
    expect(screen.queryByText('Move')).not.toBeInTheDocument();
  });

  it('shows attack action for units with attack and no previous attack', () => {
    const attackUnit = { ...mockWorkerUnit, attack: 5, hasAttacked: false };
    render(<UnitActionsPanel unit={attackUnit} {...mockProps} />);
    
    expect(screen.getByText('Attack')).toBeInTheDocument();
    expect(screen.getByText('Attack adjacent enemy units')).toBeInTheDocument();
  });

  it('does not show attack action for units that already attacked', () => {
    const attackedUnit = { ...mockWorkerUnit, attack: 5, hasAttacked: true };
    render(<UnitActionsPanel unit={attackedUnit} {...mockProps} />);
    
    expect(screen.queryByText('Attack')).not.toBeInTheDocument();
  });

  it('shows worker-specific build improvement action', () => {
    render(<UnitActionsPanel unit={mockWorkerUnit} {...mockProps} />);
    
    expect(screen.getByText('Build Improvement')).toBeInTheDocument();
    expect(screen.getByText('Construct terrain improvements')).toBeInTheDocument();
  });

  it('shows scout-specific stealth and reconnaissance actions', () => {
    render(<UnitActionsPanel unit={mockScoutUnit} {...mockProps} />);
    
    expect(screen.getByText('Stealth Mode')).toBeInTheDocument();
    expect(screen.getByText('Become invisible to enemies')).toBeInTheDocument();
    expect(screen.getByText('Reconnaissance')).toBeInTheDocument();
    expect(screen.getByText('Reveal large area around unit')).toBeInTheDocument();
  });

  it('shows stealth as unavailable when scout has insufficient movement', () => {
    const lowMovementScout = { ...mockScoutUnit, remainingMovement: 1 };
    render(<UnitActionsPanel unit={lowMovementScout} {...mockProps} />);
    
    const stealthAction = screen.getByText('Stealth Mode').closest('div');
    expect(stealthAction).toHaveClass('opacity-50');
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });

  it('shows missionary-specific heal and convert actions', () => {
    render(<UnitActionsPanel unit={mockMissionaryUnit} {...mockProps} />);
    
    expect(screen.getByText('Heal Nearby Units')).toBeInTheDocument();
    expect(screen.getByText('Restore health to friendly units')).toBeInTheDocument();
    expect(screen.getByText('Convert Enemy')).toBeInTheDocument();
    expect(screen.getByText('Convert enemy unit to your side')).toBeInTheDocument();
  });

  it('shows heal as unavailable when player has insufficient faith', () => {
    const lowFaithGameState = {
      ...mockGameState,
      players: [{
        ...mockGameState.players[0],
        stats: { faith: 2, pride: 30, internalDissent: 10 }
      }]
    };

    mockUseLocalGame.mockReturnValue({
      gameState: lowFaithGameState,
      dispatch: mockDispatch
    });

    render(<UnitActionsPanel unit={mockMissionaryUnit} {...mockProps} />);
    
    const healAction = screen.getByText('Heal Nearby Units').closest('div');
    expect(healAction).toHaveClass('opacity-50');
  });

  it('allows selecting and executing actions', () => {
    render(<UnitActionsPanel unit={mockScoutUnit} {...mockProps} />);
    
    // Select stealth action
    const stealthAction = screen.getByText('Stealth Mode').closest('div');
    fireEvent.click(stealthAction!);
    
    // Execute button should appear
    const executeButton = screen.getByText('Execute Action');
    expect(executeButton).toBeInTheDocument();
    
    // Click execute
    fireEvent.click(executeButton);
    
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'UNIT_ACTION',
      payload: {
        unitId: 'scout1',
        actionType: 'stealth',
        playerId: 'player1'
      }
    });
    
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('closes panel when close button is clicked', () => {
    render(<UnitActionsPanel unit={mockWorkerUnit} {...mockProps} />);
    
    const closeButton = screen.getByRole('button', { name: '' }); // Close button (X)
    fireEvent.click(closeButton);
    
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('shows "No actions available" when unit has no available actions', () => {
    const exhaustedUnit = {
      ...mockWorkerUnit,
      remainingMovement: 0,
      hasAttacked: true,
      abilities: []
    };
    
    render(<UnitActionsPanel unit={exhaustedUnit} {...mockProps} />);
    
    expect(screen.getByText('No actions available')).toBeInTheDocument();
    expect(screen.getByText('This unit has exhausted all available actions this turn.')).toBeInTheDocument();
  });

  it('returns null when gameState is not available', () => {
    mockUseLocalGame.mockReturnValue({
      gameState: null,
      dispatch: mockDispatch
    });
    
    const { container } = render(<UnitActionsPanel unit={mockWorkerUnit} {...mockProps} />);
    expect(container.firstChild).toBeNull();
  });

  it('logs action execution for unimplemented actions', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    render(<UnitActionsPanel unit={mockWorkerUnit} {...mockProps} />);
    
    // Select build improvement action
    const buildAction = screen.getByText('Build Improvement').closest('div');
    fireEvent.click(buildAction!);
    
    // Execute action
    const executeButton = screen.getByText('Execute Action');
    fireEvent.click(executeButton);
    
    expect(consoleSpy).toHaveBeenCalledWith('Opening improvement selection...');
    
    consoleSpy.mockRestore();
  });
});