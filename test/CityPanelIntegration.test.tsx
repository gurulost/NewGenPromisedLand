import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CityPanel from '../client/src/components/ui/CityPanel';

// Mock the BuildingMenu component (Construction Hall)
vi.mock('../client/src/components/ui/BuildingMenu', () => ({
  BuildingMenu: ({ onClose, onBuild }: any) => (
    <div data-testid="building-menu">
      <button onClick={onClose}>Close Menu</button>
      <button onClick={() => onBuild('warrior')}>Build Warrior</button>
    </div>
  ),
}));

const mockDispatch = vi.fn();
const mockStartConstruction = vi.fn();

vi.mock('../client/src/lib/stores/useGameState', () => ({
  useGameState: () => ({ startConstruction: mockStartConstruction }),
}));

const mockUseLocalGame = vi.fn();
vi.mock('../client/src/lib/stores/useLocalGame', () => ({
  useLocalGame: () => mockUseLocalGame(),
}));

describe('CityPanel Integration Tests', () => {
  let baseGameState: any;

  beforeEach(() => {
    vi.clearAllMocks();

    const mockPlayer: any = {
      id: 'player1',
      name: 'Test Player',
      factionId: 'NEPHITES',
      stars: 100,
      stats: { faith: 50, pride: 30, internalDissent: 10 },
      researchedTechs: ['organization'],
      citiesOwned: ['city1'],
    };

    const mockCity: any = {
      id: 'city1',
      name: 'Test Capital',
      coordinate: { q: 0, r: 0, s: 0 },
      population: 8,
      maxPopulation: 10,
      level: 2,
      starProduction: 2,
      ownerId: 'player1',
    };

    baseGameState = {
      id: 'game1',
      currentPlayerIndex: 0,
      turn: 5,
      phase: 'playing',
      players: [mockPlayer],
      units: [
        {
          id: 'unit1',
          type: 'warrior',
          playerId: 'player1',
          coordinate: { q: 0, r: 0, s: 0 },
          hp: 25,
          maxHp: 25,
        },
      ],
      cities: [mockCity],
      map: { tiles: [], width: 10, height: 10 },
      structures: [
        {
          id: 'struct1',
          type: 'temple',
          cityId: 'city1',
          ownerId: 'player1',
          constructionTurns: 0,
          effects: {},
        },
      ],
      improvements: [],
    };

    mockUseLocalGame.mockReturnValue({ gameState: baseGameState, dispatch: mockDispatch });
  });

  it('renders city overview with correct information', () => {
    render(<CityPanel open onClose={vi.fn()} cityId="city1" />);

    expect(screen.getByText('Test Capital')).toBeInTheDocument();
    expect(screen.getByText('Population: 8/10')).toBeInTheDocument();
    expect(screen.getByText('Owner: Test Player')).toBeInTheDocument();
    expect(screen.getByText('100 Stars')).toBeInTheDocument();
  });

  it('shows current structures in city', () => {
    render(<CityPanel open onClose={vi.fn()} cityId="city1" />);

    expect(screen.getByText('Current Structures')).toBeInTheDocument();
    expect(screen.getByText('temple')).toBeInTheDocument();
  });

  it('displays units in city correctly', () => {
    render(<CityPanel open onClose={vi.fn()} cityId="city1" />);

    expect(screen.getAllByText('Units in City').length).toBeGreaterThan(0);
    expect(screen.getAllByText('warrior').length).toBeGreaterThan(0);
    expect(screen.getByText('HP: 25/25')).toBeInTheDocument();
  });

  it('opens Construction Hall when button is clicked', async () => {
    const user = userEvent.setup();
    render(<CityPanel open onClose={vi.fn()} cityId="city1" />);

    await user.click(screen.getByText('Construction Hall'));
    expect(screen.getByTestId('building-menu')).toBeInTheDocument();
  });

  it('starts construction through Construction Hall', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<CityPanel open onClose={onClose} cityId="city1" />);

    await user.click(screen.getByText('Construction Hall'));
    await user.click(screen.getByText('Build Warrior'));

    expect(mockStartConstruction).toHaveBeenCalledWith('warrior', 'units', 'city1', 'player1');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes Construction Hall when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<CityPanel open onClose={vi.fn()} cityId="city1" />);

    await user.click(screen.getByText('Construction Hall'));
    expect(screen.getByTestId('building-menu')).toBeInTheDocument();

    await user.click(screen.getByText('Close Menu'));
    expect(screen.queryByTestId('building-menu')).not.toBeInTheDocument();
  });

  it('closes city panel when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CityPanel open onClose={onClose} cityId="city1" />);

    await user.click(screen.getAllByText('Close')[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not render when not open', () => {
    render(<CityPanel open={false} onClose={vi.fn()} cityId="city1" />);
    expect(screen.queryByText('Test Capital')).not.toBeInTheDocument();
  });

  it('does not render for non-existent city', () => {
    render(<CityPanel open onClose={vi.fn()} cityId="non-existent" />);
    expect(screen.queryByText('Test Capital')).not.toBeInTheDocument();
  });

  it('does not render for city not owned by current player', () => {
    const notOwnedState = {
      ...baseGameState,
      players: [{ ...baseGameState.players[0], citiesOwned: [] }],
    };
    mockUseLocalGame.mockReturnValue({ gameState: notOwnedState, dispatch: mockDispatch });

    render(<CityPanel open onClose={vi.fn()} cityId="city1" />);
    expect(screen.queryByText('Test Capital')).not.toBeInTheDocument();
  });

  it('shows empty state when no structures built yet', () => {
    mockUseLocalGame.mockReturnValue({ gameState: { ...baseGameState, structures: [] }, dispatch: mockDispatch });

    render(<CityPanel open onClose={vi.fn()} cityId="city1" />);
    expect(screen.getByText('No structures built yet')).toBeInTheDocument();
  });

  it('shows empty state when no units in city', () => {
    mockUseLocalGame.mockReturnValue({ gameState: { ...baseGameState, units: [] }, dispatch: mockDispatch });

    render(<CityPanel open onClose={vi.fn()} cityId="city1" />);
    expect(screen.getByText('No units in city')).toBeInTheDocument();
  });
});
