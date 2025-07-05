import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import VictoryScreen from '../../client/src/components/ui/VictoryScreen';
import { useLocalGame } from '../../client/src/lib/stores/useLocalGame';
import { GameState } from '../types/game';

// Mock the useLocalGame hook
vi.mock('../../client/src/lib/stores/useLocalGame');

const mockUseLocalGame = useLocalGame as any;

describe('VictoryScreen', () => {
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
    phase: 'victory',
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
    const component = React.createElement(VictoryScreen, mockProps);
    render(component);
    
    expect(screen.getByText('Victory!')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Nephites')).toBeInTheDocument();
  });

  it('displays correct victory type', () => {
    const component = React.createElement(VictoryScreen, mockProps);
    render(component);
    
    expect(screen.getByText('Faith Victory')).toBeInTheDocument();
    expect(screen.getByText('Through divine inspiration and righteousness!')).toBeInTheDocument();
  });

  it('shows territorial victory correctly', () => {
    const component = React.createElement(VictoryScreen, { ...mockProps, victoryType: 'territorial' });
    render(component);
    
    expect(screen.getByText('Territorial Victory')).toBeInTheDocument();
    expect(screen.getByText('By conquering the promised land!')).toBeInTheDocument();
  });

  it('displays player rankings', () => {
    const component = React.createElement(VictoryScreen, mockProps);
    render(component);
    
    expect(screen.getByText('Final Rankings')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows game statistics', () => {
    const component = React.createElement(VictoryScreen, mockProps);
    render(component);
    
    expect(screen.getByText('Game Statistics')).toBeInTheDocument();
    expect(screen.getByText('Turn 10')).toBeInTheDocument();
    expect(screen.getByText('2 players')).toBeInTheDocument();
  });

  it('calls onPlayAgain when Play Again button is clicked', () => {
    const component = React.createElement(VictoryScreen, mockProps);
    render(component);
    
    const playAgainButton = screen.getByText('Play Again');
    fireEvent.click(playAgainButton);
    
    expect(mockProps.onPlayAgain).toHaveBeenCalledTimes(1);
  });

  it('calls onMainMenu when Main Menu button is clicked', () => {
    const component = React.createElement(VictoryScreen, mockProps);
    render(component);
    
    const mainMenuButton = screen.getByText('Main Menu');
    fireEvent.click(mainMenuButton);
    
    expect(mockProps.onMainMenu).toHaveBeenCalledTimes(1);
  });

  it('displays elimination victory correctly', () => {
    const component = React.createElement(VictoryScreen, { ...mockProps, victoryType: 'elimination' });
    render(component);
    
    expect(screen.getByText('Elimination Victory')).toBeInTheDocument();
    expect(screen.getByText('Last faction standing!')).toBeInTheDocument();
  });

  it('shows domination victory correctly', () => {
    const component = React.createElement(VictoryScreen, { ...mockProps, victoryType: 'domination' });
    render(component);
    
    expect(screen.getByText('Domination Victory')).toBeInTheDocument();
    expect(screen.getByText('Supreme control achieved!')).toBeInTheDocument();
  });

  it('displays winner stats correctly', () => {
    const component = React.createElement(VictoryScreen, mockProps);
    render(component);
    
    expect(screen.getByText('100')).toBeInTheDocument(); // Faith stat
    expect(screen.getByText('25')).toBeInTheDocument(); // Stars
  });
});