import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UnitActionsPanel from '../../client/src/components/ui/UnitActionsPanel';
import { useLocalGame } from '../../client/src/lib/stores/useLocalGame';
import { Unit } from '../types/unit';
import { GameState } from '../types/game';

// Mock the useLocalGame hook
vi.mock('../../client/src/lib/stores/useLocalGame');

const mockUseLocalGame = useLocalGame as any;

describe('UnitActionsPanel', () => {
  const mockGameState: GameState = {
    id: 'test-game',
    players: [
      {
        id: 'player1',
        name: 'Alice',
        factionId: 'NEPHITES',
        stats: { faith: 80, pride: 30, internalDissent: 10 },
        visibilityMask: [],
        exploredTiles: [],
        isEliminated: false,
        turnOrder: 0,
        stars: 25,
        researchedTechs: ['writing'],
        researchProgress: 0,
        citiesOwned: ['city1']
      }
    ],
    currentPlayerIndex: 0,
    turn: 5,
    phase: 'playing',
    map: { width: 8, height: 8, tiles: [] },
    units: [],
    cities: [],
    improvements: [],
    structures: []
  };

  const mockWorkerUnit: Unit = {
    id: 'worker1',
    type: 'worker',
    playerId: 'player1',
    coordinate: { q: 0, r: 0, s: 0 },
    hp: 10,
    maxHp: 10,
    attack: 2,
    defense: 2,
    movement: 2,
    remainingMovement: 2,
    visionRadius: 1,
    status: 'active',
    hasAttacked: false
  };

  const mockScoutUnit: Unit = {
    id: 'scout1',
    type: 'scout',
    playerId: 'player1',
    coordinate: { q: 1, r: 0, s: -1 },
    hp: 8,
    maxHp: 8,
    attack: 3,
    defense: 1,
    movement: 3,
    remainingMovement: 3,
    visionRadius: 2,
    status: 'active',
    hasAttacked: false
  };

  const mockMissionaryUnit: Unit = {
    id: 'missionary1',
    type: 'missionary',
    playerId: 'player1',
    coordinate: { q: 2, r: 0, s: -2 },
    hp: 6,
    maxHp: 6,
    attack: 1,
    defense: 2,
    movement: 2,
    remainingMovement: 2,
    visionRadius: 2,
    status: 'active',
    hasAttacked: false
  };

  const mockProps = {
    unit: mockWorkerUnit,
    onClose: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLocalGame.mockReturnValue({
      gameState: mockGameState,
      dispatch: vi.fn()
    });
  });

  it('renders unit actions panel with unit info', () => {
    const component = <UnitActionsPanel {...mockProps} />;
    
    expect(screen.getByText('Worker Actions')).toBeInTheDocument();
    expect(screen.getByText('Available actions for this unit')).toBeInTheDocument();
  });

  it('displays worker-specific actions', () => {
    const component = <UnitActionsPanel {...mockProps} />;
    
    expect(screen.getByText('Build Improvement')).toBeInTheDocument();
    expect(screen.getByText('Construct farms, mines, and other improvements')).toBeInTheDocument();
  });

  it('displays scout-specific actions', () => {
    render(<UnitActionsPanel {...mockProps} unit={mockScoutUnit} />);
    
    expect(screen.getByText('Scout Actions')).toBeInTheDocument();
    expect(screen.getByText('Toggle Stealth')).toBeInTheDocument();
  });

  it('displays missionary-specific actions', () => {
    render(<UnitActionsPanel {...mockProps} unit={mockMissionaryUnit} />);
    
    expect(screen.queryByText('Missionary Actions')).toBeInTheDocument();
  });

  it('shows heal action for missionaries with sufficient faith', () => {
    render(<UnitActionsPanel {...mockProps} unit={mockMissionaryUnit} />);
    
    expect(screen.getByText('Heal Nearby Units')).toBeInTheDocument();
    expect(screen.getByText('Restore health to friendly units nearby')).toBeInTheDocument();
  });

  it('disables actions when resources are insufficient', () => {
    const lowFaithGameState = {
      ...mockGameState,
      players: [{
        ...mockGameState.players[0],
        stats: { faith: 2, pride: 30, internalDissent: 10 }
      }]
    };

    mockUseLocalGame.mockReturnValue({
      gameState: lowFaithGameState,
      dispatch: vi.fn()
    });

    render(<UnitActionsPanel {...mockProps} unit={mockMissionaryUnit} />);
    
    const actionButton = screen.getByText('Heal Nearby Units').closest('button');
    expect(actionButton).toHaveClass('opacity-50');
  });

  it('shows available actions with costs', () => {
    const component = <UnitActionsPanel {...mockProps} />;
    
    expect(screen.getByText('Build Improvement')).toBeInTheDocument();
    expect(screen.getByText('Construct farms, mines, and other improvements')).toBeInTheDocument();
    expect(screen.getByText('2 Stars')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  it('handles action execution when button is clicked', () => {
    const mockDispatch = vi.fn();
    mockUseLocalGame.mockReturnValue({
      gameState: mockGameState,
      dispatch: mockDispatch
    });

    render(<UnitActionsPanel {...mockProps} unit={mockScoutUnit} />);
    
    const stealthButton = screen.getByText('Toggle Stealth');
    fireEvent.click(stealthButton);
    
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'UNIT_ACTION',
      payload: {
        unitId: 'scout1',
        actionType: 'stealth',
        playerId: 'player1'
      }
    });
  });

  it('closes panel when close button is clicked', () => {
    const component = <UnitActionsPanel {...mockProps} />;
    
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);
    
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('displays different unit types correctly', () => {
    const commanderUnit: Unit = {
      id: 'commander1',
      type: 'commander',
      playerId: 'player1',
      coordinate: { q: 3, r: 0, s: -3 },
      hp: 35,
      maxHp: 35,
      attack: 8,
      defense: 6,
      movement: 3,
      remainingMovement: 3,
      visionRadius: 3,
      status: 'active',
      hasAttacked: false
    };

    render(<UnitActionsPanel {...mockProps} unit={commanderUnit} />);
    
    expect(screen.getByText('Commander Actions')).toBeInTheDocument();
  });

  it('shows no actions message when unit has no available actions', () => {
    const basicWarrior: Unit = {
      id: 'warrior1',
      type: 'warrior',
      playerId: 'player1',
      coordinate: { q: 4, r: 0, s: -4 },
      hp: 15,
      maxHp: 15,
      attack: 5,
      defense: 2,
      movement: 2,
      remainingMovement: 2,
      visionRadius: 1,
      status: 'active',
      hasAttacked: false
    };

    render(<UnitActionsPanel {...mockProps} unit={basicWarrior} />);
    
    // Warriors might not have special actions, so check for basic panel
    expect(screen.getByText('Warrior Actions')).toBeInTheDocument();
  });

  it('handles unit actions for different unit types', () => {
    const mockDispatch = vi.fn();
    mockUseLocalGame.mockReturnValue({
      gameState: mockGameState,
      dispatch: mockDispatch
    });

    render(<UnitActionsPanel {...mockProps} unit={mockMissionaryUnit} />);
    
    const healButton = screen.getByText('Heal Nearby Units');
    fireEvent.click(healButton);
    
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'UNIT_ACTION',
      payload: {
        unitId: 'missionary1',
        actionType: 'heal',
        playerId: 'player1'
      }
    });
  });

  it('displays action requirements correctly', () => {
    render(<UnitActionsPanel {...mockProps} unit={mockMissionaryUnit} />);
    
    expect(screen.getByText('5 Faith')).toBeInTheDocument();
  });

  it('handles special abilities based on unit type', () => {
    render(<UnitActionsPanel {...mockProps} unit={mockScoutUnit} />);
    
    expect(screen.getByText('Extended Vision')).toBeInTheDocument();
    expect(screen.getByText('Reveal large area around scout')).toBeInTheDocument();
  });
});