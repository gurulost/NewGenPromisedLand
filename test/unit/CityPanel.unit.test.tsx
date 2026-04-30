import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CityPanel from '../../client/src/components/ui/CityPanel';
import { useLocalGame } from '../../client/src/lib/stores/useLocalGame';
import { useGameState } from '../../client/src/lib/stores/useGameState';
import type { GameState, PlayerState, City } from '../../shared/types/game';

vi.mock('../../client/src/lib/stores/useLocalGame');
vi.mock('../../client/src/lib/stores/useGameState');

describe('CityPanel Unit Tests', () => {
  let mockPlayer: PlayerState;
  let mockCity: City;
  let mockGameState: GameState;
  let mockDispatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockPlayer = {
      id: 'player1',
      name: 'Test Player',
      factionId: 'NEPHITES',
      stars: 5,
      stats: { faith: 50, pride: 30, internalDissent: 10 },
      modifiers: [],
      researchedTechs: ['spirituality', 'engineering'],
      researchProgress: 0,
      citiesOwned: ['city1'],
      constructionQueue: [],
      visibilityMask: [],
      exploredTiles: [],
      isEliminated: false,
      turnOrder: 0,
    };

    mockCity = {
      id: 'city1',
      name: 'Test City',
      ownerId: 'player1',
      coordinate: { q: 0, r: 0, s: 0 },
      population: 5,
      maxPopulation: 4,
      level: 1,
      starProduction: 3,
      improvements: [],
      structures: [],
      harvestedResources: [],
    };

    mockGameState = {
      id: 'game1',
      currentPlayerIndex: 0,
      turn: 1,
      phase: 'playing',
      map: {
        tiles: [
          { coordinate: { q: 0, r: 0, s: 0 }, terrain: 'plains', resources: [], hasCity: true, exploredBy: ['player1'] },
          { coordinate: { q: 1, r: 0, s: -1 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: ['player1'] },
        ],
        width: 10,
        height: 10
      },
      players: [mockPlayer],
      units: [],
      cities: [mockCity],
      improvements: [],
      structures: [],
    };

    mockDispatch = vi.fn();

    vi.mocked(useLocalGame).mockReturnValue({
      gameState: mockGameState,
      dispatch: mockDispatch,
    } as any);

    vi.mocked(useGameState).mockReturnValue({
      startConstruction: vi.fn(),
    } as any);
  });

  it('renders when open and owned', () => {
    render(
      <CityPanel
        open={true}
        onClose={vi.fn()}
        cityId={mockCity.id}
      />
    );

    expect(screen.getByText('Test City')).toBeInTheDocument();
    expect(screen.getByText('Construction Hall')).toBeInTheDocument();
  });

  it('exposes city rename controls to touch and assistive tech', () => {
    render(
      <CityPanel
        open={true}
        onClose={vi.fn()}
        cityId={mockCity.id}
      />
    );

    const renameButton = screen.getByRole('button', { name: 'Rename city Test City' });
    expect(renameButton).toHaveClass('opacity-100');

    fireEvent.click(renameButton);

    expect(screen.getByRole('textbox', { name: 'City name' })).toHaveValue('Test City');
    expect(screen.getByRole('button', { name: 'Save city name' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel city rename' })).toBeInTheDocument();
  });

  it('shows structure requirements and disables unaffordable builds', () => {
    render(
      <CityPanel
        open={true}
        onClose={vi.fn()}
        cityId={mockCity.id}
      />
    );

    fireEvent.click(screen.getByText('Structures'));

    expect(screen.getByText('Temple')).toBeInTheDocument();
    const needButton = screen.getByText('Need 3 more stars').closest('button');
    expect(needButton).toBeDisabled();
  });

  it('shows unit list and disables unaffordable recruits', () => {
    render(
      <CityPanel
        open={true}
        onClose={vi.fn()}
        cityId={mockCity.id}
      />
    );

    fireEvent.click(screen.getByText('Units'));

    expect(screen.getByText('Warrior')).toBeInTheDocument();
    const needButton = screen.getByText('Need 5 more stars').closest('button');
    expect(needButton).toBeDisabled();
  });

  it('updates availability when stars increase', () => {
    const { rerender } = render(
      <CityPanel
        open={true}
        onClose={vi.fn()}
        cityId={mockCity.id}
      />
    );

    fireEvent.click(screen.getByText('Structures'));
    expect(screen.getByText('Need 3 more stars')).toBeInTheDocument();

    const richPlayer = { ...mockPlayer, stars: 20 };
    const richGameState = { ...mockGameState, players: [richPlayer] };

    vi.mocked(useLocalGame).mockReturnValue({
      gameState: richGameState,
      dispatch: mockDispatch,
    } as any);

    rerender(
      <CityPanel
        open={true}
        onClose={vi.fn()}
        cityId={mockCity.id}
      />
    );

    expect(screen.queryByText('Need 3 more stars')).toBeNull();
    expect(screen.getAllByText('Build').length).toBeGreaterThan(0);
  });
});
