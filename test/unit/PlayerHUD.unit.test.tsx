import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlayerHUD } from '../../client/src/components/ui/PlayerHUD';

// Mock the game store
const mockGameState = {
  players: [{
    id: 'player1',
    name: 'Test Player',
    faction: 'nephites',
    stars: 25,
    faith: 8,
    pride: 3,
    dissent: 2,
    population: 12,
    cities: [
      { 
        id: 'city1', 
        population: 5, 
        structures: [{ type: 'temple', starsPerTurn: 2 }],
        improvements: [{ type: 'farm', starsPerTurn: 1 }]
      },
      { 
        id: 'city2', 
        population: 7, 
        structures: [],
        improvements: [{ type: 'mine', starsPerTurn: 2 }]
      }
    ]
  }],
  currentPlayerId: 'player1'
};

// Mock selectors
vi.mock('../../client/src/selectors/player', () => ({
  getPlayerStats: vi.fn(() => ({
    stars: 25,
    faith: 8,
    pride: 3,
    dissent: 2,
    population: 12
  })),
  getPlayerIncome: vi.fn(() => ({
    totalIncome: 8,
    breakdown: [
      { source: 'Base', amount: 2 },
      { source: 'Cities', amount: 3 },
      { source: 'Structures', amount: 2 },
      { source: 'Improvements', amount: 1 }
    ]
  }))
}));

describe('PlayerHUD Unit Tests', () => {
  it('renders memoized star production breakdown correctly', () => {
    render(<PlayerHUD gameState={mockGameState} playerId="player1" />);
    
    // Assert star count displays correctly
    expect(screen.getByText('25')).toBeInTheDocument(); // Stars
    
    // Assert expandable breakdown matches fixture data
    const incomeButton = screen.getByText(/8.*turn/); // "8 stars/turn" or similar
    expect(incomeButton).toBeInTheDocument();
    
    // Verify memoized calculations
    expect(screen.getByText('Faith: 8')).toBeInTheDocument();
    expect(screen.getByText('Pride: 3')).toBeInTheDocument();
    expect(screen.getByText('Population: 12')).toBeInTheDocument();
  });

  it('updates income breakdown when game state changes', () => {
    const { rerender } = render(<PlayerHUD gameState={mockGameState} playerId="player1" />);
    
    // Modify game state
    const updatedState = {
      ...mockGameState,
      players: [{
        ...mockGameState.players[0],
        stars: 30,
        cities: [...mockGameState.players[0].cities, { 
          id: 'city3', 
          population: 3, 
          structures: [{ type: 'barracks', starsPerTurn: 1 }],
          improvements: []
        }]
      }]
    };
    
    rerender(<PlayerHUD gameState={updatedState} playerId="player1" />);
    
    // Should reflect updated values
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('handles missing player gracefully', () => {
    const emptyState = { ...mockGameState, players: [] };
    
    expect(() => {
      render(<PlayerHUD gameState={emptyState} playerId="nonexistent" />);
    }).not.toThrow();
  });
});