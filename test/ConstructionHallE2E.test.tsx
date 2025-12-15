import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock all dependencies
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
    button: ({ children, className, onClick, ...props }: any) => (
      <button className={className} onClick={onClick} {...props}>{children}</button>
    )
  },
  AnimatePresence: ({ children }: any) => children
}));

vi.mock('../client/src/components/ui/TooltipSystem', () => ({
  Tooltip: ({ children }: any) => children,
  ActionTooltip: ({ title }: any) => <div>{title}</div>,
  InfoTooltip: ({ title, content }: any) => <div>{title}: {content}</div>,
  StarProductionTooltip: ({ totalIncome, breakdown }: any) => (
    <div>Star Income: {totalIncome}/turn</div>
  ),
  FaithSystemTooltip: () => <div>Faith System Info</div>,
  PrideSystemTooltip: () => <div>Pride System Info</div>,
  DissentTooltip: () => <div>Dissent System Info</div>,
  TechnologyTooltip: () => <div>Technology System Info</div>,
  UnitTooltip: ({ unit, unitDef }: any) => <div>{unitDef.name} Unit</div>
}));

vi.mock('../client/src/components/ui/AnimatedBackground', () => ({
  BuildingMenuBackground: () => <div data-testid="animated-background" />
}));

vi.mock('../client/src/components/ui/EnhancedButton', () => ({
  SuccessButton: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled} data-testid="success-button">
      {children}
    </button>
  ),
  GhostButton: ({ children, disabled }: any) => (
    <button disabled={disabled} data-testid="ghost-button">
      {children}
    </button>
  )
}));

describe('Construction Hall End-to-End Tests', () => {
  describe('Complete User Workflows', () => {
    it('completes full building selection and construction workflow', async () => {
      const { BuildingMenu } = await import('../client/src/components/ui/BuildingMenu');
      
      const mockPlayer = {
        id: 'player1',
        name: 'Test Player',
        factionId: 'nephites' as const,
        stars: 100,
        stats: { faith: 50, pride: 30, internalDissent: 5 },
        citiesOwned: ['city1'],
        unitsOwned: [],
        researchedTechs: ['writing', 'organization'],
        isEliminated: false
      };

      const mockCity = {
        id: 'city1',
        name: 'Test City',
        coordinate: { q: 0, r: 0 },
        population: 5,
        ownerId: 'player1'
      };

      const mockGameState = {
        id: 'game1',
        currentPlayerIndex: 0,
        currentTurn: 1,
        phase: 'main' as const,
        players: [mockPlayer],
        units: [],
        cities: [mockCity],
        map: { tiles: [], size: { width: 10, height: 10 } },
        visibility: {},
        structures: [],
        improvements: []
      };

      const mockOnBuild = vi.fn();
      const mockOnClose = vi.fn();
      const user = userEvent.setup();

      render(
        <BuildingMenu
          city={mockCity}
          player={mockPlayer}
          gameState={mockGameState}
          onBuild={mockOnBuild}
          onClose={mockOnClose}
        />
      );

      // Verify Construction Hall opens with proper structure
      expect(screen.getByText('Construction Hall')).toBeInTheDocument();
      expect(screen.getByText('Test City — Build in the Promised Land')).toBeInTheDocument();
      expect(screen.getByTestId('animated-background')).toBeInTheDocument();

      // Check resource display
      expect(screen.getAllByText('100').length).toBeGreaterThan(0); // Stars
      expect(screen.getAllByText('50').length).toBeGreaterThan(0);  // Faith
      expect(screen.getAllByText('30').length).toBeGreaterThan(0);  // Pride

      // Verify category tabs are present
      expect(screen.getByText('Units')).toBeInTheDocument();
      expect(screen.getByText('Structures')).toBeInTheDocument();
      expect(screen.getByText('Improvements')).toBeInTheDocument();

      // Test search functionality
      const searchInput = screen.getByPlaceholderText('Search buildings...');
      await user.type(searchInput, 'warrior');
      expect(searchInput).toHaveValue('warrior');

      // Test sorting
      const sortSelect = screen.getByDisplayValue('Cost');
      await user.selectOptions(sortSelect, 'name');
      expect(sortSelect).toHaveValue('name');

      // Test category switching
      await user.click(screen.getByText('Structures'));
      // Should switch to structures view

      // Reset search so build options are visible
      await user.clear(searchInput);
      expect(searchInput).toHaveValue('');
      await user.click(screen.getByText('Units'));

      // Test building selection and construction
      const buildButtons = screen.getAllByRole('button', { name: /Build/i });
      const enabledBuild = buildButtons.find(btn => !btn.hasAttribute('disabled'));
      if (enabledBuild) {
        await user.click(enabledBuild);
        expect(mockOnBuild).toHaveBeenCalled();
      }
    });

    it('handles insufficient resources workflow', async () => {
      const { BuildingMenu } = await import('../client/src/components/ui/BuildingMenu');
      
      const poorPlayer = {
        id: 'player1',
        name: 'Poor Player',
        factionId: 'nephites' as const,
        stars: 1, // Very low resources
        stats: { faith: 0, pride: 0, internalDissent: 0 },
        citiesOwned: ['city1'],
        unitsOwned: [],
        researchedTechs: [],
        isEliminated: false
      };

      const mockCity = {
        id: 'city1',
        name: 'Poor City',
        coordinate: { q: 0, r: 0 },
        population: 1,
        ownerId: 'player1'
      };

      const mockGameState = {
        id: 'game1',
        currentPlayerIndex: 0,
        currentTurn: 1,
        phase: 'main' as const,
        players: [poorPlayer],
        units: [],
        cities: [mockCity],
        map: { tiles: [], size: { width: 10, height: 10 } },
        visibility: {},
        structures: [],
        improvements: []
      };

      const mockOnBuild = vi.fn();
      const mockOnClose = vi.fn();

      render(
        <BuildingMenu
          city={mockCity}
          player={poorPlayer}
          gameState={mockGameState}
          onBuild={mockOnBuild}
          onClose={mockOnClose}
        />
      );

      // Should show resource constraints
      expect(screen.getAllByText('1').length).toBeGreaterThan(0); // Low stars
      
      // Most buildings should be locked due to insufficient resources
      const lockedButtons = screen.getAllByRole('button', { name: /Locked/i });
      expect(lockedButtons.length).toBeGreaterThan(0);
      
      // Verify locked buttons show "Locked" text
      lockedButtons.forEach(button => {
        expect(button).toHaveTextContent('Locked');
        expect(button).toBeDisabled();
      });
    });

    it('handles technology requirements workflow', async () => {
      const { BuildingMenu } = await import('../client/src/components/ui/BuildingMenu');
      
      const techLimitedPlayer = {
        id: 'player1',
        name: 'Tech Limited Player',
        factionId: 'nephites' as const,
        stars: 1000, // High resources
        stats: { faith: 100, pride: 100, internalDissent: 0 },
        citiesOwned: ['city1'],
        unitsOwned: [],
        researchedTechs: [], // No technologies researched
        isEliminated: false
      };

      const mockCity = {
        id: 'city1',
        name: 'Advanced City',
        coordinate: { q: 0, r: 0 },
        population: 10,
        ownerId: 'player1'
      };

      const mockGameState = {
        id: 'game1',
        currentPlayerIndex: 0,
        currentTurn: 1,
        phase: 'main' as const,
        players: [techLimitedPlayer],
        units: [],
        cities: [mockCity],
        map: { tiles: [], size: { width: 10, height: 10 } },
        visibility: {},
        structures: [],
        improvements: []
      };

      const mockOnBuild = vi.fn();
      const mockOnClose = vi.fn();

      render(
        <BuildingMenu
          city={mockCity}
          player={techLimitedPlayer}
          gameState={mockGameState}
          onBuild={mockOnBuild}
          onClose={mockOnClose}
        />
      );

      // Should show high resources
      expect(screen.getAllByText('1000').length).toBeGreaterThan(0); // High stars
      expect(screen.getAllByText('100').length).toBeGreaterThan(0);  // High faith

      // Switch to structures tab to see tech-dependent buildings
      const user = userEvent.setup();
      await user.click(screen.getByText('Structures'));

      // Many structures should be locked due to missing technologies
      const lockedButtons = screen.getAllByRole('button', { name: /Locked/i });
      expect(lockedButtons.length).toBeGreaterThan(0);
    });

    it('handles close menu workflow', async () => {
      const { BuildingMenu } = await import('../client/src/components/ui/BuildingMenu');
      
      const mockPlayer = {
        id: 'player1',
        name: 'Test Player',
        factionId: 'nephites' as const,
        stars: 50,
        stats: { faith: 25, pride: 15, internalDissent: 5 },
        citiesOwned: ['city1'],
        unitsOwned: [],
        researchedTechs: ['writing'],
        isEliminated: false
      };

      const mockCity = {
        id: 'city1',
        name: 'Test City',
        coordinate: { q: 0, r: 0 },
        population: 5,
        ownerId: 'player1'
      };

      const mockGameState = {
        id: 'game1',
        currentPlayerIndex: 0,
        currentTurn: 1,
        phase: 'main' as const,
        players: [mockPlayer],
        units: [],
        cities: [mockCity],
        map: { tiles: [], size: { width: 10, height: 10 } },
        visibility: {},
        structures: [],
        improvements: []
      };

      const mockOnBuild = vi.fn();
      const mockOnClose = vi.fn();
      const user = userEvent.setup();

      render(
        <BuildingMenu
          city={mockCity}
          player={mockPlayer}
          gameState={mockGameState}
          onBuild={mockOnBuild}
          onClose={mockOnClose}
        />
      );

      // Find and click close button
      const closeButton = screen.getByText('✕');
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Data Integration Validation', () => {
    it('properly integrates with real game data structures', async () => {
      const { BuildingMenu } = await import('../client/src/components/ui/BuildingMenu');
      
      // Test with realistic game data
      const realisticPlayer = {
        id: 'player1',
        name: 'Nephite Leader',
        factionId: 'nephites' as const,
        stars: 75,
        stats: { faith: 40, pride: 25, internalDissent: 8 },
        citiesOwned: ['capital'],
        unitsOwned: ['unit1', 'unit2'],
        researchedTechs: ['writing', 'organization', 'sailing', 'mathematics'],
        isEliminated: false
      };

      const realisticCity = {
        id: 'capital',
        name: 'Zarahemla',
        coordinate: { q: 0, r: 0 },
        population: 12,
        ownerId: 'player1'
      };

      const realisticGameState = {
        id: 'campaign-game',
        currentPlayerIndex: 0,
        currentTurn: 15,
        phase: 'main' as const,
        players: [realisticPlayer],
        units: [
          {
            id: 'unit1',
            type: 'warrior' as const,
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
        cities: [realisticCity],
        map: { tiles: [], size: { width: 20, height: 20 } },
        visibility: {},
        structures: [
          {
            id: 'temple1',
            type: 'temple' as const,
            cityId: 'capital',
            coordinate: { q: 0, r: 0 },
            ownerId: 'player1'
          }
        ],
        improvements: []
      };

      const mockOnBuild = vi.fn();
      const mockOnClose = vi.fn();

      render(
        <BuildingMenu
          city={realisticCity}
          player={realisticPlayer}
          gameState={realisticGameState}
          onBuild={mockOnBuild}
          onClose={mockOnClose}
        />
      );

      // Verify realistic data is displayed correctly
      expect(screen.getByText('Zarahemla — Build in the Promised Land')).toBeInTheDocument();
      expect(screen.getAllByText('75').length).toBeGreaterThan(0); // Stars
      expect(screen.getAllByText('40').length).toBeGreaterThan(0); // Faith
      expect(screen.getAllByText('25').length).toBeGreaterThan(0); // Pride

      // Should show various building options based on researched techs
      expect(screen.getByText('Units')).toBeInTheDocument();
      expect(screen.getByText('Structures')).toBeInTheDocument();
      expect(screen.getByText('Improvements')).toBeInTheDocument();
    });
  });
});
