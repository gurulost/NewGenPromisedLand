import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useLocalGame } from '../client/src/lib/stores/useLocalGame';
import VictoryScreen from '../client/src/components/ui/VictoryScreen';
import { GameState } from '@shared/types/game';

// Mock the useLocalGame hook
vi.mock('../client/src/lib/stores/useLocalGame');

const mockUseLocalGame = useLocalGame as any;

describe('VictoryScreen', () => {
  const mockGameState: GameState = {
    id: 'test-game',
    players: [
      {
        id: 'player1',
        name: 'Alice',
        factionId: 'NEPHITES',
        stats: { faith: 100, pride: 50, internalDissent: 10 },
        visibilityMask: [],
        exploredTiles: [],
        isEliminated: false,
        turnOrder: 0,
        stars: 25,
        researchedTechs: ['agriculture', 'pottery'],
        researchProgress: 0,
        citiesOwned: ['city1', 'city2']
      },
      {
        id: 'player2',
        name: 'Bob',
        factionId: 'LAMANITES',
        stats: { faith: 75, pride: 60, internalDissent: 20 },
        visibilityMask: [],
        exploredTiles: [],
        isEliminated: false,
        turnOrder: 1,
        stars: 15,
        researchedTechs: ['hunting'],
        researchProgress: 0,
        citiesOwned: ['city3']
      }
    ],
    currentPlayerIndex: 0,
    turn: 15,
    phase: 'ended',
    map: {
      width: 10,
      height: 10,
      tiles: []
    },
    units: [
      {
        id: 'unit1',
        status: 'active',
        type: 'warrior',
        playerId: 'player1',
        coordinate: { q: 0, r: 0, s: 0 },
        hp: 10,
        maxHp: 10,
        movement: 2,
        remainingMovement: 2,
        attack: 5,
        defense: 2,
        visionRadius: 2,
        attackRange: 1,
        abilities: [],
        level: 1,
        experience: 0
      }
    ],
    cities: [],
    improvements: [],
    structures: [],
    winner: 'player1'
  };

  const mockProps = {
    winnerId: 'player1',
    victoryType: 'faith' as const,
    onPlayAgain: vi.fn(),
    onMainMenu: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLocalGame.mockReturnValue({
      gameState: mockGameState
    });
  });

  it('renders victory screen with winner information', () => {
    render(<VictoryScreen {...mockProps} />);
    
    expect(screen.getByText('Divine Victory')).toBeInTheDocument();
    expect(screen.getByText('Alice Victorious!')).toBeInTheDocument();
    expect(screen.getByText('Nephites')).toBeInTheDocument();
  });

  it('displays correct victory type and description', () => {
    render(<VictoryScreen {...mockProps} />);
    
    expect(screen.getByText('Divine Victory')).toBeInTheDocument();
    expect(screen.getByText(/Through unwavering faith and spiritual leadership/)).toBeInTheDocument();
  });

  it('shows final statistics correctly', () => {
    render(<VictoryScreen {...mockProps} />);
    
    expect(screen.getByText('15')).toBeInTheDocument(); // Total turns
    expect(screen.getByText('2')).toBeInTheDocument(); // Cities controlled
    expect(screen.getByText('1')).toBeInTheDocument(); // Units remaining
    expect(screen.getByText('2')).toBeInTheDocument(); // Technologies researched
  });

  it('calls onPlayAgain when play again button is clicked', () => {
    render(<VictoryScreen {...mockProps} />);
    
    const playAgainButton = screen.getByText('Play Again');
    fireEvent.click(playAgainButton);
    
    expect(mockProps.onPlayAgain).toHaveBeenCalledTimes(1);
  });

  it('calls onMainMenu when main menu button is clicked', () => {
    render(<VictoryScreen {...mockProps} />);
    
    const mainMenuButton = screen.getByText('Main Menu');
    fireEvent.click(mainMenuButton);
    
    expect(mockProps.onMainMenu).toHaveBeenCalledTimes(1);
  });

  it('handles different victory types correctly', () => {
    const territorialProps = { ...mockProps, victoryType: 'territorial' as const };
    const { rerender } = render(<VictoryScreen {...territorialProps} />);
    
    expect(screen.getByText('Territorial Conquest')).toBeInTheDocument();
    expect(screen.getByText(/By controlling the majority of cities/)).toBeInTheDocument();
    
    const eliminationProps = { ...mockProps, victoryType: 'elimination' as const };
    rerender(<VictoryScreen {...eliminationProps} />);
    
    expect(screen.getByText('Total Domination')).toBeInTheDocument();
    expect(screen.getByText(/Through strategic warfare and tactical brilliance/)).toBeInTheDocument();
  });

  it('returns null when gameState is not available', () => {
    mockUseLocalGame.mockReturnValue({ gameState: null });
    
    const { container } = render(<VictoryScreen {...mockProps} />);
    expect(container.firstChild).toBeNull();
  });
});