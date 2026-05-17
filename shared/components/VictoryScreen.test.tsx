import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import VictoryScreen from '../../client/src/components/ui/VictoryScreen';
import { useLocalGame } from '../../client/src/lib/stores/useLocalGame';
import { GameState } from '../types/game';

// Mock the useLocalGame hook
vi.mock('../../client/src/lib/stores/useLocalGame');

const mockUseLocalGame = useLocalGame as any;

describe('VictoryScreen', () => {
  const getFinalStat = (label: string) => {
    const statsPanel = screen.getByText('Final Statistics').parentElement as HTMLElement;
    return within(statsPanel).getByText(label).parentElement as HTMLElement;
  };

  const mockGameState: GameState = {
    id: 'test-game',
    players: [
      {
        id: 'player1',
        name: 'Alice',
        factionId: 'NEPHITES',
        stats: { faith: 100, pride: 30, internalDissent: 10 },
        visibilityMask: [],
        exploredTiles: [],
        isEliminated: false,
        turnOrder: 0,
        stars: 25,
        researchedTechs: ['writing'],
        researchProgress: 0,
        citiesOwned: ['city1']
      },
      {
        id: 'player2',
        name: 'Bob',
        factionId: 'LAMANITES',
        stats: { faith: 40, pride: 80, internalDissent: 20 },
        visibilityMask: [],
        exploredTiles: [],
        isEliminated: false,
        turnOrder: 1,
        stars: 15,
        researchedTechs: [],
        researchProgress: 0,
        citiesOwned: ['city2']
      }
    ],
    currentPlayerIndex: 0,
    turn: 10,
    phase: 'playing',
    map: { width: 8, height: 8, tiles: [] },
    units: [],
    cities: [],
    improvements: [],
    structures: []
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

  it('renders victory screen with winner announcement', () => {
    render(<VictoryScreen {...mockProps} />);
    
    expect(screen.getByText('Consecration Victory')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getAllByText('Nephites')).toHaveLength(2); // Badge and ranking
  });

  it('displays correct victory type', () => {
    render(<VictoryScreen {...mockProps} />);
    
    expect(screen.getByText('Consecration Victory')).toBeInTheDocument();
    expect(screen.getByText(/Through sustained faith, low dissent, and protected holy cities/)).toBeInTheDocument();
  });

  it('shows territorial victory correctly', () => {
    render(<VictoryScreen {...mockProps} victoryType="territorial" />);
    
    expect(screen.getByText('Territorial Conquest')).toBeInTheDocument();
    expect(screen.getByText(/By controlling the majority of cities/)).toBeInTheDocument();
  });

  it('displays player rankings', () => {
    render(<VictoryScreen {...mockProps} />);
    
    expect(screen.getByText('Final Rankings')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows game statistics', () => {
    render(<VictoryScreen {...mockProps} />);
    
    expect(screen.getByText('Final Statistics')).toBeInTheDocument();
    expect(getFinalStat('Total Turns')).toHaveTextContent('10');
    expect(getFinalStat('Faith')).toHaveTextContent('100');
  });

  it('calls onPlayAgain when Play Again button is clicked', () => {
    render(<VictoryScreen {...mockProps} />);
    
    const playAgainButton = screen.getByText('Play Again');
    fireEvent.click(playAgainButton);
    
    expect(mockProps.onPlayAgain).toHaveBeenCalledTimes(1);
  });

  it('calls onMainMenu when Main Menu button is clicked', () => {
    render(<VictoryScreen {...mockProps} />);
    
    const mainMenuButton = screen.getByText('Main Menu');
    fireEvent.click(mainMenuButton);
    
    expect(mockProps.onMainMenu).toHaveBeenCalledTimes(1);
  });

  it('displays elimination victory correctly', () => {
    render(<VictoryScreen {...mockProps} victoryType="elimination" />);
    
    expect(screen.getByText('Total Domination')).toBeInTheDocument();
    expect(screen.getByText(/Through strategic warfare and tactical brilliance/)).toBeInTheDocument();
  });

  it('shows economic victory correctly', () => {
    render(<VictoryScreen {...mockProps} victoryType="economic" />);

    expect(screen.getByText('Economic Supremacy')).toBeInTheDocument();
    expect(screen.getByText(/thriving economy and mastery of commerce/i)).toBeInTheDocument();
  });

  it('shows cultural victory correctly', () => {
    render(<VictoryScreen {...mockProps} victoryType="cultural" />);

    expect(screen.getByText('Cultural Ascendancy')).toBeInTheDocument();
    expect(screen.getByText(/lasting legacy of learning, worship, and civic harmony/i)).toBeInTheDocument();
  });

  it('shows domination victory correctly', () => {
    render(<VictoryScreen {...mockProps} victoryType="domination" />);
    
    expect(screen.getByText('Strategic Supremacy')).toBeInTheDocument();
    expect(screen.getByText(/Your superior strategy and leadership/)).toBeInTheDocument();
  });

  it('displays winner stats correctly', () => {
    render(<VictoryScreen {...mockProps} />);
    
    expect(getFinalStat('Faith')).toHaveTextContent('100');
    expect(getFinalStat('Stars')).toHaveTextContent('25');
    expect(getFinalStat('Pride')).toHaveTextContent('30');
  });
});
