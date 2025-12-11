import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CityPanel from '../client/src/components/ui/CityPanel';
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
        open={true}
        onClose={() => {}}
        cityId="city1"
      />
    );

    expect(screen.getByText('Test Capital - City Management')).toBeInTheDocument();
    expect(screen.getByText('Population: 8')).toBeInTheDocument();
    expect(screen.getByText('Owner: Test Player')).toBeInTheDocument();
    expect(screen.getByText('100 Stars')).toBeInTheDocument();
  });

  it('shows current structures in city', () => {
    render(
      <CityPanel
        open={true}
        onClose={() => {}}
        cityId="city1"
      />
    );

    expect(screen.getByText('Current Structures')).toBeInTheDocument();
    expect(screen.getByText('temple')).toBeInTheDocument();
  });

  it('displays units in city correctly', () => {
    render(
      <CityPanel
        open={true}
        onClose={() => {}}
        cityId="city1"
      />
    );

    expect(screen.getByText('Units in City')).toBeInTheDocument();
    expect(screen.getByText('warrior')).toBeInTheDocument();
    expect(screen.getByText('HP: 25/25')).toBeInTheDocument();
  });

  it('opens Construction Hall when button is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <CityPanel
        open={true}
        onClose={() => {}}
        cityId="city1"
      />
    );

    const constructionButton = screen.getByText('Construction Hall');
    await user.click(constructionButton);

    expect(screen.getByTestId('building-menu')).toBeInTheDocument();
  });

  it('handles building construction through Construction Hall', async () => {
    const user = userEvent.setup();
    
    render(
      <CityPanel
        open={true}
        onClose={() => {}}
        cityId="city1"
      />
    );

    // Open Construction Hall
    const constructionButton = screen.getByText('Construction Hall');
    await user.click(constructionButton);

    // Build a warrior
    const buildButton = screen.getByText('Build Warrior');
    await user.click(buildButton);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'RECRUIT_UNIT',
      payload: {
        playerId: 'player1',
        cityId: 'city1',
        unitType: 'warrior'
      }
    });
  });

  it('closes Construction Hall when close button is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <CityPanel
        open={true}
        onClose={() => {}}
        cityId="city1"
      />
    );

    // Open Construction Hall
    const constructionButton = screen.getByText('Construction Hall');
    await user.click(constructionButton);

    expect(screen.getByTestId('building-menu')).toBeInTheDocument();

    // Close it
    const closeButton = screen.getByText('Close Menu');
    await user.click(closeButton);

    expect(screen.queryByTestId('building-menu')).not.toBeInTheDocument();
  });

  it('closes city panel when close button is clicked', async () => {
    const mockOnClose = vi.fn();
    const user = userEvent.setup();
    
    render(
      <CityPanel
        open={true}
        onClose={mockOnClose}
        cityId="city1"
      />
    );

    const closeButton = screen.getByText('Close');
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('does not render when not open', () => {
    render(
      <CityPanel
        open={false}
        onClose={() => {}}
        cityId="city1"
      />
    );

    expect(screen.queryByText('Test Capital - City Management')).not.toBeInTheDocument();
  });

  it('does not render for non-existent city', () => {
    render(
      <CityPanel
        open={true}
        onClose={() => {}}
        cityId="non-existent"
      />
    );

    expect(screen.queryByText('City Management')).not.toBeInTheDocument();
  });

  it('does not render for city not owned by current player', () => {
    const otherPlayerCity = {
      ...mockCity,
      id: 'enemy-city',
      ownerId: 'player2'
    };

    const gameStateWithEnemyCity = {
      ...mockGameState,
      cities: [mockCity, otherPlayerCity]
    };

    // Mock the game state to include enemy city
    vi.mocked(require('../client/src/lib/stores/useLocalGame').useLocalGame).mockReturnValue({
      gameState: gameStateWithEnemyCity,
      dispatch: mockDispatch
    });

    render(
      <CityPanel
        open={true}
        onClose={() => {}}
        cityId="enemy-city"
      />
    );

    expect(screen.queryByText('City Management')).not.toBeInTheDocument();
  });

  it('shows empty state when no structures built', () => {
    const gameStateNoStructures = {
      ...mockGameState,
      structures: []
    };

    vi.mocked(require('../client/src/lib/stores/useLocalGame').useLocalGame).mockReturnValue({
      gameState: gameStateNoStructures,
      dispatch: mockDispatch
    });

    render(
      <CityPanel
        open={true}
        onClose={() => {}}
        cityId="city1"
      />
    );

    expect(screen.getByText('No structures built yet')).toBeInTheDocument();
  });

  it('shows empty state when no units in city', () => {
    const gameStateNoUnits = {
      ...mockGameState,
      units: []
    };

    vi.mocked(require('../client/src/lib/stores/useLocalGame').useLocalGame).mockReturnValue({
      gameState: gameStateNoUnits,
      dispatch: mockDispatch
    });

    render(
      <CityPanel
        open={true}
        onClose={() => {}}
        cityId="city1"
      />
    );

    expect(screen.getByText('No units in city')).toBeInTheDocument();
  });
});