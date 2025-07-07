import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GameUI from '../client/src/components/game/GameUI';
import PlayerHUD from '../client/src/components/ui/PlayerHUD';
import { BuildingMenu } from '../client/src/components/ui/BuildingMenu';
import CityPanel from '../client/src/components/ui/CityPanel';
import { useLocalGame } from '../client/src/lib/stores/useLocalGame';
import { useGameState } from '../client/src/lib/stores/useGameState';
import type { GameState, PlayerState, City } from '../shared/types/game';
import type { Faction } from '../shared/types/faction';

// Mock the stores
vi.mock('../client/src/lib/stores/useLocalGame');
vi.mock('../client/src/lib/stores/useGameState');

// Mock components to focus on navigation logic
vi.mock('../client/src/components/ui/TechPanel', () => ({
  default: ({ open, onClose }: any) => open ? <div data-testid="tech-panel">Tech Panel <button onClick={onClose}>Close</button></div> : null
}));

vi.mock('../client/src/components/ui/AnimatedBackground', () => ({
  BuildingMenuBackground: () => <div data-testid="animated-background" />
}));

vi.mock('../client/src/components/ui/EnhancedButton', () => ({
  PrimaryButton: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
  SuccessButton: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
  GhostButton: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  )
}));

describe('UI Navigation Flow Tests', () => {
  let mockGameState: GameState;
  let mockPlayer: PlayerState;
  let mockCity: City;
  let mockFaction: Faction;
  let mockDispatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
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

    mockFaction = {
      id: 'nephites',
      name: 'Nephites',
      description: 'Test faction',
      color: '#3B82F6',
      abilities: [],
      startingUnits: []
    };

    mockDispatch = vi.fn();

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
      startConstruction: vi.fn()
    });
  });

  describe('PlayerHUD Navigation Changes', () => {
    it('displays Construction Hall button instead of Cities button', () => {
      const mockOnShowTechPanel = vi.fn();
      const mockOnShowConstructionHall = vi.fn();
      const mockOnEndTurn = vi.fn();

      render(
        <PlayerHUD
          player={mockPlayer}
          faction={mockFaction}
          onShowTechPanel={mockOnShowTechPanel}
          onShowConstructionHall={mockOnShowConstructionHall}
          onEndTurn={mockOnEndTurn}
        />
      );

      // Should have Construction Hall button
      expect(screen.getByText('Construction Hall')).toBeInTheDocument();
      
      // Should NOT have Cities button
      expect(screen.queryByText('Cities')).not.toBeInTheDocument();
      
      // Should still have Research button
      expect(screen.getByText('Research')).toBeInTheDocument();
    });

    it('calls Construction Hall handler when button is clicked', async () => {
      const mockOnShowTechPanel = vi.fn();
      const mockOnShowConstructionHall = vi.fn();
      const mockOnEndTurn = vi.fn();
      const user = userEvent.setup();

      render(
        <PlayerHUD
          player={mockPlayer}
          faction={mockFaction}
          onShowTechPanel={mockOnShowTechPanel}
          onShowConstructionHall={mockOnShowConstructionHall}
          onEndTurn={mockOnEndTurn}
        />
      );

      const constructionButton = screen.getByText('Construction Hall');
      await user.click(constructionButton);

      expect(mockOnShowConstructionHall).toHaveBeenCalledTimes(1);
    });

    it('maintains proper button styling and icons', () => {
      const mockOnShowTechPanel = vi.fn();
      const mockOnShowConstructionHall = vi.fn();
      const mockOnEndTurn = vi.fn();

      render(
        <PlayerHUD
          player={mockPlayer}
          faction={mockFaction}
          onShowTechPanel={mockOnShowTechPanel}
          onShowConstructionHall={mockOnShowConstructionHall}
          onEndTurn={mockOnEndTurn}
        />
      );

      const constructionButton = screen.getByText('Construction Hall');
      
      // Check button has proper styling classes
      expect(constructionButton).toHaveClass('bg-green-600/20', 'border-green-400', 'text-green-100');
    });
  });

  describe('Construction Hall with Cities Button', () => {
    it('displays Cities button in Construction Hall header', () => {
      const mockOnBuild = vi.fn();
      const mockOnClose = vi.fn();
      const mockOnShowCities = vi.fn();

      render(
        <BuildingMenu
          city={mockCity}
          player={mockPlayer}
          gameState={mockGameState}
          onBuild={mockOnBuild}
          onClose={mockOnClose}
          onShowCities={mockOnShowCities}
        />
      );

      // Should display Cities button in header
      expect(screen.getByText('Cities')).toBeInTheDocument();
      
      // Should still have Construction Hall title
      expect(screen.getByText('Construction Hall')).toBeInTheDocument();
    });

    it('calls Cities handler when Cities button is clicked', async () => {
      const mockOnBuild = vi.fn();
      const mockOnClose = vi.fn();
      const mockOnShowCities = vi.fn();
      const user = userEvent.setup();

      render(
        <BuildingMenu
          city={mockCity}
          player={mockPlayer}
          gameState={mockGameState}
          onBuild={mockOnBuild}
          onClose={mockOnClose}
          onShowCities={mockOnShowCities}
        />
      );

      const citiesButton = screen.getByText('Cities');
      await user.click(citiesButton);

      expect(mockOnShowCities).toHaveBeenCalledTimes(1);
    });

    it('does not show Cities button when onShowCities is not provided', () => {
      const mockOnBuild = vi.fn();
      const mockOnClose = vi.fn();

      render(
        <BuildingMenu
          city={mockCity}
          player={mockPlayer}
          gameState={mockGameState}
          onBuild={mockOnBuild}
          onClose={mockOnClose}
        />
      );

      // Cities button should not be present when handler is not provided
      expect(screen.queryByText('Cities')).not.toBeInTheDocument();
    });

    it('maintains proper Cities button styling', () => {
      const mockOnBuild = vi.fn();
      const mockOnClose = vi.fn();
      const mockOnShowCities = vi.fn();

      render(
        <BuildingMenu
          city={mockCity}
          player={mockPlayer}
          gameState={mockGameState}
          onBuild={mockOnBuild}
          onClose={mockOnClose}
          onShowCities={mockOnShowCities}
        />
      );

      const citiesButton = screen.getByText('Cities');
      
      // Check Cities button has proper styling
      expect(citiesButton).toHaveClass('bg-blue-600/20', 'border-blue-400/50', 'text-blue-100');
    });
  });

  describe('Complete Navigation Flow', () => {
    it('completes full navigation flow: Main UI → Construction Hall → Cities', async () => {
      const user = userEvent.setup();
      
      // Mock the complete GameUI component behavior
      const TestNavigationFlow = () => {
        const [showConstructionHall, setShowConstructionHall] = React.useState(false);
        const [showCityPanel, setShowCityPanel] = React.useState(false);
        
        return (
          <div>
            {/* Main PlayerHUD */}
            <PlayerHUD
              player={mockPlayer}
              faction={mockFaction}
              onShowTechPanel={() => {}}
              onShowConstructionHall={() => setShowConstructionHall(true)}
              onEndTurn={() => {}}
            />
            
            {/* Construction Hall Modal */}
            {showConstructionHall && (
              <BuildingMenu
                city={mockCity}
                player={mockPlayer}
                gameState={mockGameState}
                onBuild={() => {}}
                onClose={() => setShowConstructionHall(false)}
                onShowCities={() => {
                  setShowConstructionHall(false);
                  setShowCityPanel(true);
                }}
              />
            )}
            
            {/* City Panel Modal */}
            {showCityPanel && (
              <CityPanel
                open={showCityPanel}
                onClose={() => setShowCityPanel(false)}
                cityId={mockCity.id}
              />
            )}
          </div>
        );
      };

      render(<TestNavigationFlow />);

      // Step 1: Click Construction Hall from main interface
      const constructionHallButton = screen.getByText('Construction Hall');
      await user.click(constructionHallButton);
      
      // Should see Construction Hall
      await waitFor(() => {
        expect(screen.getByText('Construction Hall')).toBeInTheDocument();
      });

      // Step 2: Click Cities from Construction Hall
      const citiesButton = screen.getByText('Cities');
      await user.click(citiesButton);
      
      // Should see City Panel and Construction Hall should be closed
      await waitFor(() => {
        expect(screen.getByText('City Management')).toBeInTheDocument();
      });
    });

    it('handles multiple city selection scenarios', async () => {
      const multiCityPlayer = {
        ...mockPlayer,
        citiesOwned: ['city1', 'city2']
      };

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
        cities: [mockCity, secondCity],
        players: [multiCityPlayer]
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

      render(
        <PlayerHUD
          player={multiCityPlayer}
          faction={mockFaction}
          onShowTechPanel={() => {}}
          onShowConstructionHall={() => {}}
          onEndTurn={() => {}}
        />
      );

      // Should still work with multiple cities
      expect(screen.getByText('Construction Hall')).toBeInTheDocument();
    });

    it('handles edge case with no cities owned', () => {
      const noCitiesPlayer = {
        ...mockPlayer,
        citiesOwned: []
      };

      const noCitiesGameState = {
        ...mockGameState,
        cities: [],
        players: [noCitiesPlayer]
      };

      render(
        <PlayerHUD
          player={noCitiesPlayer}
          faction={mockFaction}
          onShowTechPanel={() => {}}
          onShowConstructionHall={() => {}}
          onEndTurn={() => {}}
        />
      );

      // Button should still be present even with no cities
      expect(screen.getByText('Construction Hall')).toBeInTheDocument();
    });
  });

  describe('Button Accessibility and UX', () => {
    it('provides proper keyboard navigation support', async () => {
      const mockOnShowConstructionHall = vi.fn();
      const user = userEvent.setup();

      render(
        <PlayerHUD
          player={mockPlayer}
          faction={mockFaction}
          onShowTechPanel={() => {}}
          onShowConstructionHall={mockOnShowConstructionHall}
          onEndTurn={() => {}}
        />
      );

      const constructionButton = screen.getByText('Construction Hall');
      
      // Test keyboard activation
      constructionButton.focus();
      await user.keyboard('{Enter}');
      
      expect(mockOnShowConstructionHall).toHaveBeenCalled();
    });

    it('maintains consistent button placement across different screen states', () => {
      // Test with different player stats
      const lowResourcesPlayer = {
        ...mockPlayer,
        stars: 0,
        stats: { faith: 0, pride: 0, internalDissent: 100 }
      };

      const { rerender } = render(
        <PlayerHUD
          player={mockPlayer}
          faction={mockFaction}
          onShowTechPanel={() => {}}
          onShowConstructionHall={() => {}}
          onEndTurn={() => {}}
        />
      );

      const initialButton = screen.getByText('Construction Hall');
      const initialRect = initialButton.getBoundingClientRect();

      // Rerender with different player state
      rerender(
        <PlayerHUD
          player={lowResourcesPlayer}
          faction={mockFaction}
          onShowTechPanel={() => {}}
          onShowConstructionHall={() => {}}
          onEndTurn={() => {}}
        />
      );

      const updatedButton = screen.getByText('Construction Hall');
      const updatedRect = updatedButton.getBoundingClientRect();

      // Button position should remain consistent
      expect(Math.abs(initialRect.left - updatedRect.left)).toBeLessThan(5);
      expect(Math.abs(initialRect.top - updatedRect.top)).toBeLessThan(5);
    });

    it('provides clear visual feedback for button interactions', async () => {
      const user = userEvent.setup();

      render(
        <PlayerHUD
          player={mockPlayer}
          faction={mockFaction}
          onShowTechPanel={() => {}}
          onShowConstructionHall={() => {}}
          onEndTurn={() => {}}
        />
      );

      const constructionButton = screen.getByText('Construction Hall');
      
      // Check initial state
      expect(constructionButton).toHaveClass('hover:bg-green-600/40');
      
      // Test hover state (simulated through classes)
      await user.hover(constructionButton);
      
      // Button should maintain proper styling for interactions
      expect(constructionButton).toBeVisible();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('gracefully handles missing game state', () => {
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

      // Should not crash when gameState is null
      expect(() => {
        render(
          <PlayerHUD
            player={mockPlayer}
            faction={mockFaction}
            onShowTechPanel={() => {}}
            onShowConstructionHall={() => {}}
            onEndTurn={() => {}}
          />
        );
      }).not.toThrow();
    });

    it('handles rapid button clicking without errors', async () => {
      const mockOnShowConstructionHall = vi.fn();
      const user = userEvent.setup();

      render(
        <PlayerHUD
          player={mockPlayer}
          faction={mockFaction}
          onShowTechPanel={() => {}}
          onShowConstructionHall={mockOnShowConstructionHall}
          onEndTurn={() => {}}
        />
      );

      const constructionButton = screen.getByText('Construction Hall');
      
      // Rapidly click the button multiple times
      await user.click(constructionButton);
      await user.click(constructionButton);
      await user.click(constructionButton);
      
      // Should handle multiple rapid clicks gracefully
      expect(mockOnShowConstructionHall).toHaveBeenCalledTimes(3);
    });

    it('maintains button functionality during game state updates', async () => {
      const mockOnShowConstructionHall = vi.fn();
      const user = userEvent.setup();

      const { rerender } = render(
        <PlayerHUD
          player={mockPlayer}
          faction={mockFaction}
          onShowTechPanel={() => {}}
          onShowConstructionHall={mockOnShowConstructionHall}
          onEndTurn={() => {}}
        />
      );

      // Update player state
      const updatedPlayer = { ...mockPlayer, stars: 200 };
      
      rerender(
        <PlayerHUD
          player={updatedPlayer}
          faction={mockFaction}
          onShowTechPanel={() => {}}
          onShowConstructionHall={mockOnShowConstructionHall}
          onEndTurn={() => {}}
        />
      );

      const constructionButton = screen.getByText('Construction Hall');
      await user.click(constructionButton);
      
      // Button should still work after state updates
      expect(mockOnShowConstructionHall).toHaveBeenCalled();
    });
  });
});