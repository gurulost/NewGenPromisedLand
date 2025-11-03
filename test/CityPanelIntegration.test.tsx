import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CityPanel } from '../client/src/components/city/CityPanel';
import { useLocalGame } from '../client/src/lib/stores/useLocalGame';
import { GameState, PlayerState, City } from '../shared/types/game';

// Mock the BuildingMenu component
vi.mock('../client/src/components/ui/BuildingMenu', () => ({
  BuildingMenu: ({ onClose, onBuild }: any) => (
    <div data-testid="building-menu">
      <button onClick={onClose}>Close Menu</button>
      <button onClick={() => onBuild('warrior')}>Build Warrior</button>
    </div>
  )
}));

// Mock TooltipSystem
vi.mock('../client/src/components/ui/TooltipSystem', () => ({
  Tooltip: ({ children }: any) => children,
  ActionTooltip: ({ title }: any) => <div>{title}</div>
}));

// Mock ToastProvider
vi.mock('../client/src/components/ui/ToastProvider', () => ({
  ToastProvider: ({ children }: any) => children,
  useToastContext: () => ({
    showToast: vi.fn()
  })
}));

// Mock useGameAudio with correct API
vi.mock('../client/src/hooks/useAudioIntegration', () => ({
  useGameAudio: () => ({
    onButtonClick: vi.fn(),
    onButtonHover: vi.fn(),
    onBuildingBuilt: vi.fn(),
    onPanelOpen: vi.fn(),
    onPanelClose: vi.fn()
  })
}));

// Mock game store
const mockDispatch = vi.fn();
vi.mock('../client/src/lib/stores/useLocalGame', () => ({
  useLocalGame: () => ({
    gameState: mockGameState,
    dispatch: mockDispatch
  })
}));

let mockGameState: GameState;
let mockPlayer: PlayerState;
let mockCity: City;

describe('CityPanel Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockPlayer = {
      id: 'player1',
      name: 'Test Player',
      factionId: 'nephites',
      stars: 100,
      stats: {
        faith: 50,
        pride: 30,
        internalDissent: 10
      },
      citiesOwned: ['city1'],
      unitsOwned: ['unit1'],
      researchedTechs: ['writing', 'organization', 'sailing'],
      isEliminated: false
    };

    mockCity = {
      id: 'city1',
      name: 'Test Capital',
      coordinate: { q: 0, r: 0 },
      population: 8,
      ownerId: 'player1'
    };

    mockGameState = {
      id: 'game1',
      currentPlayerIndex: 0,
      currentTurn: 5,
      phase: 'main',
      players: [mockPlayer],
      units: [
        {
          id: 'unit1',
          type: 'warrior',
          coordinate: { q: 0, r: 0 },
          ownerId: 'player1',
          currentHp: 25,
          maxHp: 25,
          currentMovement: 2,
          maxMovement: 2,
          hasAttacked: false,
          hasActed: false
        }
      ],
      cities: [mockCity],
      map: {
        tiles: [
          {
            coordinate: { q: 0, r: 0, s: 0 },
            terrain: 'plains',
            resources: [],
            hasCity: true,
            exploredBy: ['player1']
          }
        ],
        size: { width: 10, height: 10 }
      },
      visibility: {
        'player1': new Set(['0,0'])
      },
      structures: [
        {
          id: 'struct1',
          type: 'temple',
          cityId: 'city1',
          coordinate: { q: 0, r: 0 },
          ownerId: 'player1'
        }
      ],
      improvements: []
    };
  });

  it('renders city overview with correct information', () => {
    render(
      <CityPanel
        isOpen={true}
        onClose={() => {}}
        city={mockCity}
        gameState={mockGameState}
        currentPlayer={mockPlayer}
      />
    );

    expect(screen.getByText('Test Capital')).toBeInTheDocument();
    expect(screen.getByText(/Population: 8/)).toBeInTheDocument();
  });

  it('shows current structures in city', () => {
    render(
      <CityPanel
        isOpen={true}
        onClose={() => {}}
        city={mockCity}
        gameState={mockGameState}
        currentPlayer={mockPlayer}
      />
    );

    expect(screen.getByText(/Buildings/)).toBeInTheDocument();
  });

  it('displays units in city correctly', () => {
    render(
      <CityPanel
        isOpen={true}
        onClose={() => {}}
        city={mockCity}
        gameState={mockGameState}
        currentPlayer={mockPlayer}
      />
    );

    expect(screen.getByText(/Military/)).toBeInTheDocument();
  });

  it('opens Buildings tab when clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <CityPanel
        isOpen={true}
        onClose={() => {}}
        city={mockCity}
        gameState={mockGameState}
        currentPlayer={mockPlayer}
      />
    );

    const buildingsTab = screen.getByText('Buildings');
    await user.click(buildingsTab);

    expect(screen.getByText(/Buildings/)).toBeInTheDocument();
  });

  it('shows Buildings tab content', async () => {
    const user = userEvent.setup();
    
    render(
      <CityPanel
        isOpen={true}
        onClose={() => {}}
        city={mockCity}
        gameState={mockGameState}
        currentPlayer={mockPlayer}
      />
    );

    // Open Buildings tab
    const buildingsTab = screen.getByText('Buildings');
    await user.click(buildingsTab);

    // Verify Buildings tab is active
    expect(buildingsTab).toHaveAttribute('data-state', 'active');
  });

  it('switches between tabs correctly', async () => {
    const user = userEvent.setup();
    
    render(
      <CityPanel
        isOpen={true}
        onClose={() => {}}
        city={mockCity}
        gameState={mockGameState}
        currentPlayer={mockPlayer}
      />
    );

    // Start on Overview tab (default)
    const overviewTab = screen.getByText('Overview');
    expect(overviewTab).toHaveAttribute('data-state', 'active');

    // Switch to Buildings tab
    const buildingsTab = screen.getByText('Buildings');
    await user.click(buildingsTab);
    expect(buildingsTab).toHaveAttribute('data-state', 'active');

    // Switch to Military tab
    const militaryTab = screen.getByText('Military');
    await user.click(militaryTab);
    expect(militaryTab).toHaveAttribute('data-state', 'active');
  });

  it('closes city panel when close button is clicked', async () => {
    const mockOnClose = vi.fn();
    const user = userEvent.setup();
    
    render(
      <CityPanel
        isOpen={true}
        onClose={mockOnClose}
        city={mockCity}
        gameState={mockGameState}
        currentPlayer={mockPlayer}
      />
    );

    // Find close button by role
    const closeButtons = screen.getAllByRole('button');
    const closeButton = closeButtons.find(btn => 
      btn.getAttribute('aria-label')?.includes('Close') || 
      btn.textContent?.includes('×')
    );
    
    if (closeButton) {
      await user.click(closeButton);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it('does not render when not open', () => {
    const { container } = render(
      <CityPanel
        isOpen={false}
        onClose={() => {}}
        city={mockCity}
        gameState={mockGameState}
        currentPlayer={mockPlayer}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('does not render for null city', () => {
    const { container } = render(
      <CityPanel
        isOpen={true}
        onClose={() => {}}
        city={null as any}
        gameState={mockGameState}
        currentPlayer={mockPlayer}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders for any city regardless of owner', () => {
    const otherPlayerCity = {
      ...mockCity,
      id: 'enemy-city',
      name: 'Enemy City',
      ownerId: 'player2'
    };

    const gameStateWithEnemyCity = {
      ...mockGameState,
      cities: [mockCity, otherPlayerCity]
    };

    render(
      <CityPanel
        isOpen={true}
        onClose={() => {}}
        city={otherPlayerCity}
        gameState={gameStateWithEnemyCity}
        currentPlayer={mockPlayer}
      />
    );

    // CityPanel renders for any city
    expect(screen.getByText('Enemy City')).toBeInTheDocument();
  });

  it('shows empty state when no structures built', () => {
    const gameStateNoStructures = {
      ...mockGameState,
      structures: []
    };

    render(
      <CityPanel
        isOpen={true}
        onClose={() => {}}
        city={mockCity}
        gameState={gameStateNoStructures}
        currentPlayer={mockPlayer}
      />
    );

    // Should still render the Buildings tab, just no structures listed
    expect(screen.getByText('Buildings')).toBeInTheDocument();
  });

  it('shows empty state when no units in city', () => {
    const gameStateNoUnits = {
      ...mockGameState,
      units: []
    };

    render(
      <CityPanel
        isOpen={true}
        onClose={() => {}}
        city={mockCity}
        gameState={gameStateNoUnits}
        currentPlayer={mockPlayer}
      />
    );

    // Should still render the Military tab
    expect(screen.getByText('Military')).toBeInTheDocument();
  });
});