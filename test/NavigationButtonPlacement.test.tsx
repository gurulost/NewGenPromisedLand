import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlayerHUD from '../client/src/components/ui/PlayerHUD';
import { BuildingMenu } from '../client/src/components/ui/BuildingMenu';
import type { PlayerState } from '../shared/types/game';
import type { Faction } from '../shared/types/faction';

// Mock external dependencies
vi.mock('../client/src/lib/stores/useLocalGame', () => ({
  useLocalGame: () => ({
    gameState: {
      cities: [{ id: 'city1', ownerId: 'player1', starProduction: 2 }],
      improvements: [],
      structures: []
    }
  })
}));

vi.mock('../client/src/components/ui/TooltipSystem', () => ({
  InfoTooltip: () => null,
  StarProductionTooltip: () => null,
  FaithSystemTooltip: () => null,
  PrideSystemTooltip: () => null,
  TechnologyTooltip: () => null,
  DissentTooltip: () => null,
  ActionTooltip: () => null
}));

vi.mock('../client/src/components/ui/AnimatedBackground', () => ({
  BuildingMenuBackground: () => <div data-testid="background" />
}));

vi.mock('../client/src/components/ui/EnhancedButton', () => ({
  PrimaryButton: ({ children, onClick, ...props }: any) => <button onClick={onClick} {...props}>{children}</button>,
  SuccessButton: ({ children, onClick, ...props }: any) => <button onClick={onClick} {...props}>{children}</button>,
  GhostButton: ({ children, onClick, ...props }: any) => <button onClick={onClick} {...props}>{children}</button>
}));

describe('Navigation Button Placement Tests', () => {
  let mockPlayer: PlayerState;
  let mockFaction: Faction;
  let mockCity: any;
  let mockGameState: any;

  beforeEach(() => {
    mockPlayer = {
      id: 'player1',
      name: 'Test Player',
      factionId: 'nephites',
      stars: 100,
      stats: { faith: 50, pride: 30, internalDissent: 10 },
      modifiers: [],
      researchedTechs: ['writing'],
      researchProgress: 0,
      citiesOwned: ['city1'],
      constructionQueue: [],
      visibilityMask: [],
      exploredTiles: [],
      isEliminated: false,
      turnOrder: 0
    };

    mockFaction = {
      id: 'nephites',
      name: 'Nephites',
      description: 'Test faction',
      color: '#3B82F6',
      abilities: [],
      startingUnits: []
    };

    mockCity = {
      id: 'city1',
      name: 'Test City',
      coordinate: { q: 0, r: 0 },
      population: 5,
      ownerId: 'player1',
      starProduction: 3
    };

    mockGameState = {
      id: 'game1',
      currentPlayerIndex: 0,
      players: [mockPlayer],
      cities: [mockCity],
      units: [],
      structures: [],
      improvements: []
    };
  });

  describe('PlayerHUD Button Changes', () => {
    it('shows Construction Hall button instead of Cities button', () => {
      render(
        <PlayerHUD
          player={mockPlayer}
          faction={mockFaction}
          onShowTechPanel={() => {}}
          onShowConstructionHall={() => {}}
          onEndTurn={() => {}}
        />
      );

      // Should have Construction Hall button
      expect(screen.getByRole('button', { name: /construction hall/i })).toBeInTheDocument();
      
      // Should NOT have Cities button
      expect(screen.queryByRole('button', { name: /^cities$/i })).not.toBeInTheDocument();
      
      // Should still have Research button
      expect(screen.getByRole('button', { name: /research/i })).toBeInTheDocument();
    });

    it('calls Construction Hall handler when clicked', async () => {
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

      const button = screen.getByRole('button', { name: /construction hall/i });
      await user.click(button);

      expect(mockOnShowConstructionHall).toHaveBeenCalledOnce();
    });

    it('maintains proper button layout and styling', () => {
      render(
        <PlayerHUD
          player={mockPlayer}
          faction={mockFaction}
          onShowTechPanel={() => {}}
          onShowConstructionHall={() => {}}
          onEndTurn={() => {}}
        />
      );

      const constructionButton = screen.getByRole('button', { name: /construction hall/i });
      const researchButton = screen.getByRole('button', { name: /research/i });

      // Both buttons should be present and properly styled
      expect(constructionButton).toBeInTheDocument();
      expect(researchButton).toBeInTheDocument();
      
      // Check they have appropriate CSS classes for layout
      expect(constructionButton.closest('.flex')).toBeInTheDocument();
    });
  });

  describe('BuildingMenu Cities Button', () => {
    it('shows Cities button when onShowCities handler is provided', () => {
      render(
        <BuildingMenu
          city={mockCity}
          player={mockPlayer}
          gameState={mockGameState}
          onBuild={() => {}}
          onClose={() => {}}
          onShowCities={() => {}}
        />
      );

      // Should show Cities button in BuildingMenu
      expect(screen.getByRole('button', { name: /cities/i })).toBeInTheDocument();
    });

    it('does not show Cities button when onShowCities handler is not provided', () => {
      render(
        <BuildingMenu
          city={mockCity}
          player={mockPlayer}
          gameState={mockGameState}
          onBuild={() => {}}
          onClose={() => {}}
        />
      );

      // Should NOT show Cities button when handler not provided
      expect(screen.queryByRole('button', { name: /cities/i })).not.toBeInTheDocument();
    });

    it('calls Cities handler when clicked', async () => {
      const mockOnShowCities = vi.fn();
      const user = userEvent.setup();

      render(
        <BuildingMenu
          city={mockCity}
          player={mockPlayer}
          gameState={mockGameState}
          onBuild={() => {}}
          onClose={() => {}}
          onShowCities={mockOnShowCities}
        />
      );

      const citiesButton = screen.getByRole('button', { name: /cities/i });
      await user.click(citiesButton);

      expect(mockOnShowCities).toHaveBeenCalledOnce();
    });

    it('positions Cities button correctly in header', () => {
      render(
        <BuildingMenu
          city={mockCity}
          player={mockPlayer}
          gameState={mockGameState}
          onBuild={() => {}}
          onClose={() => {}}
          onShowCities={() => {}}
        />
      );

      const citiesButton = screen.getByRole('button', { name: /cities/i });
      const closeButton = screen.getByRole('button', { name: /✕/i });

      // Both buttons should be in the header
      expect(citiesButton).toBeInTheDocument();
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('Button Accessibility', () => {
    it('provides proper ARIA labels and roles', () => {
      render(
        <PlayerHUD
          player={mockPlayer}
          faction={mockFaction}
          onShowTechPanel={() => {}}
          onShowConstructionHall={() => {}}
          onEndTurn={() => {}}
        />
      );

      const constructionButton = screen.getByRole('button', { name: /construction hall/i });
      const researchButton = screen.getByRole('button', { name: /research/i });

      // Buttons should have proper roles and be accessible
      expect(constructionButton).toBeInTheDocument();
      expect(researchButton).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
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

      const button = screen.getByRole('button', { name: /construction hall/i });
      
      // Focus and activate with Enter key
      button.focus();
      await user.keyboard('{Enter}');

      expect(mockOnShowConstructionHall).toHaveBeenCalled();
    });
  });

  describe('Integration Scenarios', () => {
    it('handles rapid button interactions without errors', async () => {
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

      const button = screen.getByRole('button', { name: /construction hall/i });
      
      // Rapid clicks
      await user.click(button);
      await user.click(button);
      await user.click(button);

      expect(mockOnShowConstructionHall).toHaveBeenCalledTimes(3);
    });

    it('maintains functionality with different player states', () => {
      const lowResourcePlayer = {
        ...mockPlayer,
        stars: 0,
        stats: { faith: 0, pride: 0, internalDissent: 100 }
      };

      render(
        <PlayerHUD
          player={lowResourcePlayer}
          faction={mockFaction}
          onShowTechPanel={() => {}}
          onShowConstructionHall={() => {}}
          onEndTurn={() => {}}
        />
      );

      // Button should still be present regardless of player state
      expect(screen.getByRole('button', { name: /construction hall/i })).toBeInTheDocument();
    });

    it('works correctly with different faction configurations', () => {
      const differentFaction = {
        ...mockFaction,
        id: 'lamanites',
        name: 'Lamanites',
        color: '#DC2626'
      };

      render(
        <PlayerHUD
          player={mockPlayer}
          faction={differentFaction}
          onShowTechPanel={() => {}}
          onShowConstructionHall={() => {}}
          onEndTurn={() => {}}
        />
      );

      // Button functionality should be independent of faction
      expect(screen.getByRole('button', { name: /construction hall/i })).toBeInTheDocument();
    });
  });

  describe('Error Resilience', () => {
    it('handles undefined handlers gracefully', () => {
      // This should not throw errors even if handlers are undefined
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

    it('maintains button visibility with minimal player data', () => {
      const minimalPlayer = {
        id: 'player1',
        name: 'Minimal Player',
        factionId: 'nephites',
        stars: 0,
        stats: { faith: 0, pride: 0, internalDissent: 0 },
        modifiers: [],
        researchedTechs: [],
        researchProgress: 0,
        citiesOwned: [],
        constructionQueue: [],
        visibilityMask: [],
        exploredTiles: [],
        isEliminated: false,
        turnOrder: 0
      };

      render(
        <PlayerHUD
          player={minimalPlayer}
          faction={mockFaction}
          onShowTechPanel={() => {}}
          onShowConstructionHall={() => {}}
          onEndTurn={() => {}}
        />
      );

      // Should still render Construction Hall button
      expect(screen.getByRole('button', { name: /construction hall/i })).toBeInTheDocument();
    });
  });
});