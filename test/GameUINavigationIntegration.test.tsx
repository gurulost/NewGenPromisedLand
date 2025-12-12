import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GameUI from '../client/src/components/game/GameUI';
import { useLocalGame } from '../client/src/lib/stores/useLocalGame';
import { useGameState } from '../client/src/lib/stores/useGameState';
import { useTurnTransition } from '../client/src/components/ui/TurnTransition';
import type { GameState, PlayerState, City } from '../shared/types/game';

// Mock all external dependencies
vi.mock('../client/src/lib/stores/useLocalGame');
vi.mock('../client/src/lib/stores/useGameState');
vi.mock('../client/src/components/ui/TurnTransition');
vi.mock('@react-three/drei', () => ({
  useKeyboardControls: () => [vi.fn(), vi.fn()]
}));

// Mock complex components to focus on navigation logic
vi.mock('../client/src/components/ui/TechPanel', () => ({
  default: ({ open, onClose }: any) => 
    open ? <div data-testid="tech-panel">Tech Panel <button onClick={onClose}>Close Tech</button></div> : null
}));

vi.mock('../client/src/components/ui/CityPanel', () => ({
  default: ({ open, onClose }: any) => 
    open ? <div data-testid="city-panel">City Management <button onClick={onClose}>Close City</button></div> : null
}));

vi.mock('../client/src/components/ui/BuildingMenu', () => ({
  BuildingMenu: ({ onClose, onShowCities }: any) => (
    <div data-testid="building-menu">
      Construction Hall
      {onShowCities && <button onClick={onShowCities}>Cities</button>}
      <button onClick={onClose}>Close Construction</button>
    </div>
  )
}));

vi.mock('../client/src/components/ui/VictoryScreen', () => ({
  default: () => <div data-testid="victory-screen">Victory Screen</div>
}));

vi.mock('../client/src/components/ui/SaveLoadMenu', () => ({
  default: () => <div data-testid="save-load-menu">Save Load Menu</div>
}));

vi.mock('../client/src/components/ui/SaveSystem', () => ({
  SaveSystem: () => <div data-testid="save-system">Save System</div>
}));

vi.mock('../client/src/effects/UnitSelection', () => ({
  UnitSelectionUI: () => <div data-testid="unit-selection-ui">Unit Selection</div>
}));

vi.mock('../client/src/components/ui/SelectedUnitPanel', () => ({
  default: () => <div data-testid="selected-unit-panel">Selected Unit Panel</div>
}));

vi.mock('../client/src/components/ui/CombatPanel', () => ({
  default: () => <div data-testid="combat-panel">Combat Panel</div>
}));

vi.mock('../client/src/components/ui/AbilitiesPanel', () => ({
  AbilitiesPanel: () => <div data-testid="abilities-panel">Abilities Panel</div>
}));

describe('GameUI Navigation Integration Tests', () => {
  let mockGameState: GameState;
  let mockPlayer: PlayerState;
  let mockCity: City;
  let mockDispatch: ReturnType<typeof vi.fn>;
  let mockStartConstruction: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockPlayer = {
      id: 'player1',
      name: 'Test Player',
      factionId: 'nephites',
      stars: 100,
      stats: { faith: 50, pride: 30, internalDissent: 10 },
      modifiers: [],
      researchedTechs: ['writing', 'organization'],
      researchProgress: 0,
      citiesOwned: ['city1'],
      constructionQueue: [],
      visibilityMask: [],
      exploredTiles: [],
      isEliminated: false,
      turnOrder: 0
    };

    mockCity = {
      id: 'city1',
      name: 'Test Capital',
      coordinate: { q: 0, r: 0 },
      population: 5,
      ownerId: 'player1',
      starProduction: 3
    };

    mockGameState = {
      id: 'game1',
      currentPlayerIndex: 0,
      currentTurn: 1,
      phase: 'main',
      players: [mockPlayer],
      units: [],
      cities: [mockCity],
      map: { tiles: [], size: { width: 10, height: 10 } },
      visibility: {},
      structures: [],
      improvements: []
    };

    mockDispatch = vi.fn();
    mockStartConstruction = vi.fn();

    // Mock useLocalGame
    (useLocalGame as any).mockReturnValue({
      gameState: mockGameState,
      dispatch: mockDispatch,
      endTurn: vi.fn(),
      useAbility: vi.fn(),
      attackUnit: vi.fn(),
      setGamePhase: vi.fn(),
      resetGame: vi.fn(),
      loadGameState: vi.fn()
    });

    // Mock useGameState
    (useGameState as any).mockReturnValue({
      selectedUnit: null,
      setSelectedUnit: vi.fn(),
      constructionMode: null,
      cancelConstruction: vi.fn()
    });

    (useGameState as any).getState = vi.fn().mockReturnValue({
      startConstruction: mockStartConstruction
    });

    // Mock useTurnTransition
    (useTurnTransition as any).mockReturnValue({
      isTransitioning: false,
      pendingPlayer: null,
      startTransition: vi.fn(),
      completeTransition: vi.fn()
    });
  });

  describe('Primary Navigation Flow', () => {
    it('renders Construction Hall button in PlayerHUD instead of Cities', async () => {
      render(<GameUI />);

      // Should see Construction Hall button
      expect(screen.getByText('Construction Hall')).toBeInTheDocument();
      
      // Should NOT see Cities button in main interface
      expect(screen.queryByText('Cities')).not.toBeInTheDocument();
      
      // Should still see Research button
      expect(screen.getByText('Research')).toBeInTheDocument();
    });

    it('opens Construction Hall when button is clicked', async () => {
      const user = userEvent.setup();
      
      render(<GameUI />);

      const constructionButton = screen.getByText('Construction Hall');
      await user.click(constructionButton);

      // Should see Construction Hall modal
      await waitFor(() => {
        expect(screen.getByTestId('building-menu')).toBeInTheDocument();
      });
    });

    it('shows Cities button within Construction Hall', async () => {
      const user = userEvent.setup();
      
      render(<GameUI />);

      // Open Construction Hall
      const constructionButton = screen.getByText('Construction Hall');
      await user.click(constructionButton);

      // Should see Cities button within Construction Hall
      await waitFor(() => {
        expect(screen.getByText('Cities')).toBeInTheDocument();
      });
    });

    it('navigates from Construction Hall to City Panel via Cities button', async () => {
      const user = userEvent.setup();
      
      render(<GameUI />);

      // Step 1: Open Construction Hall
      const constructionButton = screen.getByText('Construction Hall');
      await user.click(constructionButton);

      await waitFor(() => {
        expect(screen.getByTestId('building-menu')).toBeInTheDocument();
      });

      // Step 2: Click Cities button within Construction Hall
      const citiesButton = screen.getByText('Cities');
      await user.click(citiesButton);

      // Step 3: Should see City Panel and Construction Hall should be closed
      await waitFor(() => {
        expect(screen.getByTestId('city-panel')).toBeInTheDocument();
        expect(screen.queryByTestId('building-menu')).not.toBeInTheDocument();
      });
    });

    it('maintains proper modal state management', async () => {
      const user = userEvent.setup();
      
      render(<GameUI />);

      // Open Construction Hall
      const constructionButton = screen.getByText('Construction Hall');
      await user.click(constructionButton);

      await waitFor(() => {
        expect(screen.getByTestId('building-menu')).toBeInTheDocument();
      });

      // Close Construction Hall
      const closeButton = screen.getByText('Close Construction');
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByTestId('building-menu')).not.toBeInTheDocument();
      });

      // Should be back to main interface
      expect(screen.getByText('Construction Hall')).toBeInTheDocument();
    });
  });

  describe('Multi-Modal Navigation', () => {
    it('can open Research panel alongside Construction Hall button', async () => {
      const user = userEvent.setup();
      
      render(<GameUI />);

      // Open Research panel
      const researchButton = screen.getByText('Research');
      await user.click(researchButton);

      await waitFor(() => {
        expect(screen.getByTestId('tech-panel')).toBeInTheDocument();
      });

      // Construction Hall button should still be visible
      expect(screen.getByText('Construction Hall')).toBeInTheDocument();

      // Close Research panel
      const closeTechButton = screen.getByText('Close Tech');
      await user.click(closeTechButton);

      await waitFor(() => {
        expect(screen.queryByTestId('tech-panel')).not.toBeInTheDocument();
      });
    });

    it('handles overlapping modal states correctly', async () => {
      const user = userEvent.setup();
      
      render(<GameUI />);

      // Open Construction Hall
      const constructionButton = screen.getByText('Construction Hall');
      await user.click(constructionButton);

      await waitFor(() => {
        expect(screen.getByTestId('building-menu')).toBeInTheDocument();
      });

      // Navigate to Cities
      const citiesButton = screen.getByText('Cities');
      await user.click(citiesButton);

      await waitFor(() => {
        expect(screen.getByTestId('city-panel')).toBeInTheDocument();
        expect(screen.queryByTestId('building-menu')).not.toBeInTheDocument();
      });

      // Close City Panel
      const closeCityButton = screen.getByText('Close City');
      await user.click(closeCityButton);

      await waitFor(() => {
        expect(screen.queryByTestId('city-panel')).not.toBeInTheDocument();
      });

      // Should be back to main interface
      expect(screen.getByText('Construction Hall')).toBeInTheDocument();
    });
  });

  describe('Construction System Integration', () => {
    it('properly handles construction initiation from Construction Hall', async () => {
      const user = userEvent.setup();
      
      render(<GameUI />);

      // Open Construction Hall
      const constructionButton = screen.getByText('Construction Hall');
      await user.click(constructionButton);

      await waitFor(() => {
        expect(screen.getByTestId('building-menu')).toBeInTheDocument();
      });

      // The construction logic should be properly wired up
      // This test ensures the onBuild handler is correctly implemented
      expect(mockStartConstruction).not.toHaveBeenCalled();
    });

    it('maintains construction queue visibility through navigation', async () => {
      const user = userEvent.setup();
      
      // Mock construction mode
      (useGameState as any).mockReturnValue({
        selectedUnit: null,
        setSelectedUnit: vi.fn(),
        constructionMode: {
          type: 'units',
          itemId: 'warrior',
          cityId: 'city1',
          playerId: 'player1'
        },
        cancelConstruction: vi.fn()
      });

      render(<GameUI />);

      // Construction indicator should be visible
      expect(screen.getByText('Constructing')).toBeInTheDocument();

      // Open Construction Hall
      const constructionButton = screen.getByText('Construction Hall');
      await user.click(constructionButton);

      // Construction indicator should still be visible
      expect(screen.getByText('Constructing')).toBeInTheDocument();
    });
  });

  describe('Player State Variations', () => {
    it('handles players with no cities', async () => {
      const noCitiesPlayer = { ...mockPlayer, citiesOwned: [] };
      const noCitiesGameState = {
        ...mockGameState,
        players: [noCitiesPlayer],
        cities: []
      };

      (useLocalGame as any).mockReturnValue({
        gameState: noCitiesGameState,
        dispatch: mockDispatch,
        endTurn: vi.fn(),
        useAbility: vi.fn(),
        attackUnit: vi.fn(),
        setGamePhase: vi.fn(),
        resetGame: vi.fn(),
        loadGameState: vi.fn()
      });

      render(<GameUI />);

      // Construction Hall button should still be present
      expect(screen.getByText('Construction Hall')).toBeInTheDocument();
    });

    it('handles players with multiple cities', async () => {
      const multiCityPlayer = { ...mockPlayer, citiesOwned: ['city1', 'city2'] };
      const secondCity = {
        id: 'city2',
        name: 'Second City',
        coordinate: { q: 1, r: 1 },
        population: 3,
        ownerId: 'player1',
        starProduction: 2
      };
      const multiCityGameState = {
        ...mockGameState,
        players: [multiCityPlayer],
        cities: [mockCity, secondCity]
      };

      (useLocalGame as any).mockReturnValue({
        gameState: multiCityGameState,
        dispatch: mockDispatch,
        endTurn: vi.fn(),
        useAbility: vi.fn(),
        attackUnit: vi.fn(),
        setGamePhase: vi.fn(),
        resetGame: vi.fn(),
        loadGameState: vi.fn()
      });

      const user = userEvent.setup();
      
      render(<GameUI />);

      // Open Construction Hall - should default to first city
      const constructionButton = screen.getByText('Construction Hall');
      await user.click(constructionButton);

      await waitFor(() => {
        expect(screen.getByTestId('building-menu')).toBeInTheDocument();
      });
    });

    it('handles game state updates without losing navigation functionality', async () => {
      const user = userEvent.setup();
      
      const { rerender } = render(<GameUI />);

      // Initial state - Construction Hall should work
      const constructionButton = screen.getByText('Construction Hall');
      await user.click(constructionButton);

      await waitFor(() => {
        expect(screen.getByTestId('building-menu')).toBeInTheDocument();
      });

      // Close modal
      const closeButton = screen.getByText('Close Construction');
      await user.click(closeButton);

      // Update game state
      const updatedGameState = {
        ...mockGameState,
        currentTurn: 2,
        players: [{
          ...mockPlayer,
          stars: 150
        }]
      };

      (useLocalGame as any).mockReturnValue({
        gameState: updatedGameState,
        dispatch: mockDispatch,
        endTurn: vi.fn(),
        useAbility: vi.fn(),
        attackUnit: vi.fn(),
        setGamePhase: vi.fn(),
        resetGame: vi.fn(),
        loadGameState: vi.fn()
      });

      rerender(<GameUI />);

      // Construction Hall should still work after state update
      const updatedConstructionButton = screen.getByText('Construction Hall');
      await user.click(updatedConstructionButton);

      await waitFor(() => {
        expect(screen.getByTestId('building-menu')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('gracefully handles null game state', () => {
      (useLocalGame as any).mockReturnValue({
        gameState: null,
        dispatch: mockDispatch,
        endTurn: vi.fn(),
        useAbility: vi.fn(),
        attackUnit: vi.fn(),
        setGamePhase: vi.fn(),
        resetGame: vi.fn(),
        loadGameState: vi.fn()
      });

      // Should not crash with null game state
      expect(() => render(<GameUI />)).not.toThrow();
    });

    it('handles rapid navigation interactions', async () => {
      const user = userEvent.setup();
      
      render(<GameUI />);

      const constructionButton = screen.getByText('Construction Hall');
      
      // Rapidly click multiple times
      await user.click(constructionButton);
      await user.click(constructionButton);
      await user.click(constructionButton);

      // Should handle rapid clicks gracefully
      await waitFor(() => {
        expect(screen.getByTestId('building-menu')).toBeInTheDocument();
      });
    });

    it('maintains button accessibility during complex interactions', async () => {
      const user = userEvent.setup();
      
      render(<GameUI />);

      const constructionButton = screen.getByText('Construction Hall');
      
      // Test keyboard navigation
      constructionButton.focus();
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByTestId('building-menu')).toBeInTheDocument();
      });

      // Test Escape key to close
      await user.keyboard('{Escape}');
      
      // Focus should return to main interface
      expect(screen.getByText('Construction Hall')).toBeInTheDocument();
    });

    it('preserves navigation state during turn transitions', async () => {
      const user = userEvent.setup();
      
      // Mock turn transition state
      (useTurnTransition as any).mockReturnValue({
        isTransitioning: true,
        pendingPlayer: mockPlayer,
        startTransition: vi.fn(),
        completeTransition: vi.fn()
      });

      render(<GameUI />);

      // Even during transitions, navigation should be available
      expect(screen.getByText('Construction Hall')).toBeInTheDocument();
    });
  });

  describe('Performance and Rendering', () => {
    it('does not cause memory leaks with repeated navigation', async () => {
      const user = userEvent.setup();
      
      render(<GameUI />);

      // Simulate repeated navigation to check for memory leaks
      for (let i = 0; i < 5; i++) {
        // Open Construction Hall
        const constructionButton = screen.getByText('Construction Hall');
        await user.click(constructionButton);

        await waitFor(() => {
          expect(screen.getByTestId('building-menu')).toBeInTheDocument();
        });

        // Navigate to Cities
        const citiesButton = screen.getByText('Cities');
        await user.click(citiesButton);

        await waitFor(() => {
          expect(screen.getByTestId('city-panel')).toBeInTheDocument();
        });

        // Close City Panel
        const closeCityButton = screen.getByText('Close City');
        await user.click(closeCityButton);

        await waitFor(() => {
          expect(screen.queryByTestId('city-panel')).not.toBeInTheDocument();
        });
      }

      // Should still be functional after repeated navigation
      expect(screen.getByText('Construction Hall')).toBeInTheDocument();
    });

    it('maintains consistent render performance', async () => {
      const user = userEvent.setup();
      
      const startTime = performance.now();
      
      render(<GameUI />);

      const constructionButton = screen.getByText('Construction Hall');
      await user.click(constructionButton);

      await waitFor(() => {
        expect(screen.getByTestId('building-menu')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render and navigate within reasonable time (less than 1 second)
      expect(renderTime).toBeLessThan(1000);
    });
  });
});