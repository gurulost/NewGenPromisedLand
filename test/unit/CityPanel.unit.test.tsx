import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CityPanel } from '../../client/src/components/ui/CityPanel';

const mockCity = {
  id: 'city1',
  name: 'Test City',
  ownerId: 'player1',
  coordinate: { q: 0, r: 0, s: 0 },
  population: 5,
  structures: [],
  improvements: []
};

const mockGameState = {
  players: [{
    id: 'player1',
    stars: 15,
    technologies: ['organization', 'hunting'],
    faction: 'nephites'
  }]
};

// Mock city selectors
vi.mock('../../client/src/selectors/city', () => ({
  getCityBuildOptions: vi.fn(() => ({
    structures: [
      { id: 'temple', name: 'Temple', cost: 10, canAfford: true, requirements: [] },
      { id: 'barracks', name: 'Barracks', cost: 8, canAfford: true, requirements: [] },
      { id: 'forge', name: 'Forge', cost: 20, canAfford: false, requirements: ['metallurgy'] }
    ],
    units: [
      { id: 'warrior', name: 'Warrior', cost: 5, canAfford: true, requirements: [] },
      { id: 'scout', name: 'Scout', cost: 3, canAfford: true, requirements: [] },
      { id: 'catapult', name: 'Catapult', cost: 25, canAfford: false, requirements: ['engineering'] }
    ]
  }))
}));

describe('CityPanel Unit Tests', () => {
  it('validates Build tab button states and tooltips', () => {
    render(
      <CityPanel 
        city={mockCity} 
        gameState={mockGameState}
        onClose={vi.fn()}
        onAction={vi.fn()}
      />
    );
    
    // Click Build tab
    fireEvent.click(screen.getByText('Build'));
    
    // Affordable structure should be enabled
    const templeButton = screen.getByText('Temple');
    expect(templeButton).toBeInTheDocument();
    expect(templeButton.closest('button')).not.toBeDisabled();
    
    // Unaffordable structure should show requirement tooltip
    const forgeButton = screen.getByText('Forge');
    expect(forgeButton).toBeInTheDocument();
    
    // Should display cost indicators
    expect(screen.getByText('10')).toBeInTheDocument(); // Temple cost
    expect(screen.getByText('20')).toBeInTheDocument(); // Forge cost
  });

  it('validates Recruit tab button states and tooltips', () => {
    render(
      <CityPanel 
        city={mockCity} 
        gameState={mockGameState}
        onClose={vi.fn()}
        onAction={vi.fn()}
      />
    );
    
    // Click Recruit tab
    fireEvent.click(screen.getByText('Recruit'));
    
    // Affordable units should be enabled
    const warriorButton = screen.getByText('Warrior');
    expect(warriorButton).toBeInTheDocument();
    expect(warriorButton.closest('button')).not.toBeDisabled();
    
    // Unaffordable unit should show requirements
    const catapultButton = screen.getByText('Catapult');
    expect(catapultButton).toBeInTheDocument();
    
    // Should display unit costs
    expect(screen.getByText('5')).toBeInTheDocument(); // Warrior cost
    expect(screen.getByText('25')).toBeInTheDocument(); // Catapult cost
  });

  it('updates button states when player stars change', () => {
    const { rerender } = render(
      <CityPanel 
        city={mockCity} 
        gameState={mockGameState}
        onClose={vi.fn()}
        onAction={vi.fn()}
      />
    );
    
    // Initially, forge is unaffordable (20 cost, 15 stars)
    fireEvent.click(screen.getByText('Build'));
    expect(screen.getByText('Forge')).toBeInTheDocument();
    
    // Update with more stars
    const richGameState = {
      ...mockGameState,
      players: [{
        ...mockGameState.players[0],
        stars: 25,
        technologies: [...mockGameState.players[0].technologies, 'metallurgy']
      }]
    };
    
    rerender(
      <CityPanel 
        city={mockCity} 
        gameState={richGameState}
        onClose={vi.fn()}
        onAction={vi.fn()}
      />
    );
    
    // Forge should now be affordable
    const forgeButton = screen.getByText('Forge');
    expect(forgeButton.closest('button')).not.toBeDisabled();
  });

  it('displays requirement banners for unmet prerequisites', () => {
    render(
      <CityPanel 
        city={mockCity} 
        gameState={mockGameState}
        onClose={vi.fn()}
        onAction={vi.fn()}
      />
    );
    
    fireEvent.click(screen.getByText('Build'));
    
    // Should show requirement banner for forge
    expect(screen.getByText(/metallurgy/i)).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Recruit'));
    
    // Should show requirement banner for catapult
    expect(screen.getByText(/engineering/i)).toBeInTheDocument();
  });
});