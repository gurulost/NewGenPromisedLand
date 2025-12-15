import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BuildingMenu } from '../client/src/components/ui/BuildingMenu';
import { GameState, PlayerState, City } from '../shared/types/game';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
    button: ({ children, className, ...props }: any) => <button className={className} {...props}>{children}</button>
  },
  AnimatePresence: ({ children }: any) => children
}));

// Mock TooltipSystem
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

// Mock AnimatedBackground
vi.mock('../client/src/components/ui/AnimatedBackground', () => ({
  BuildingMenuBackground: () => <div data-testid="animated-background" />
}));

// Mock EnhancedButton
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

describe('BuildingMenu Component', () => {
  let mockPlayer: PlayerState;
  let mockCity: City;
  let mockGameState: GameState;
  let mockOnBuild: ReturnType<typeof vi.fn>;
  let mockOnClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockPlayer = {
      id: 'player1',
      name: 'Test Player',
      factionId: 'NEPHITES' as any,
      stars: 50,
      stats: {
        faith: 30,
        pride: 20,
        internalDissent: 5
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
	      name: 'Test City',
	      coordinate: { q: 0, r: 0 },
	      population: 5,
	      ownerId: 'player1',
	      starProduction: 2
	    };

    mockGameState = {
      id: 'game1',
      currentPlayerIndex: 0,
      turn: 1,
      phase: 'playing',
      players: [mockPlayer],
      units: [],
      cities: [mockCity],
      map: {
        tiles: [],
        width: 10,
        height: 10
      },
      structures: [],
      improvements: []
    };

    mockOnBuild = vi.fn();
    mockOnClose = vi.fn();
  });

  it('renders the building menu with correct structure', () => {
    render(
      <BuildingMenu
        city={mockCity}
        player={mockPlayer}
        gameState={mockGameState}
        onBuild={mockOnBuild}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Construction Hall')).toBeInTheDocument();
    expect(screen.getByText('Test City — Build in the Promised Land')).toBeInTheDocument();
    expect(screen.getByTestId('animated-background')).toBeInTheDocument();
  });

	  it('displays player resources correctly', () => {
    render(
      <BuildingMenu
        city={mockCity}
        player={mockPlayer}
        gameState={mockGameState}
        onBuild={mockOnBuild}
        onClose={mockOnClose}
      />
    );

	    expect(screen.getByLabelText('Stars')).toHaveTextContent('50');
	    expect(screen.getByLabelText('Faith')).toHaveTextContent('30');
	    expect(screen.getByLabelText('Pride')).toHaveTextContent('20');
	    expect(screen.getByLabelText('Dissent')).toHaveTextContent('5');
	  });

  it('shows category tabs and allows switching', async () => {
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

    expect(screen.getByText('Units')).toBeInTheDocument();
    expect(screen.getByText('Structures')).toBeInTheDocument();
    expect(screen.getByText('Improvements')).toBeInTheDocument();

    await user.click(screen.getByText('Structures'));
    // Should switch to structures category
  });

  it('displays building options with correct information', () => {
    render(
      <BuildingMenu
        city={mockCity}
        player={mockPlayer}
        gameState={mockGameState}
        onBuild={mockOnBuild}
        onClose={mockOnClose}
      />
    );

    // Should show warrior unit by default (units tab)
    expect(screen.getByText('Warrior')).toBeInTheDocument();
    expect(screen.getByText('Basic melee unit with balanced stats - the backbone of any army')).toBeInTheDocument();
  });

  it('handles search functionality', async () => {
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

    const searchInput = screen.getByPlaceholderText('Search buildings...');
    await user.type(searchInput, 'warrior');

    expect(searchInput).toHaveValue('warrior');
  });

  it('handles sorting functionality', async () => {
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

    const sortSelect = screen.getByDisplayValue('Cost');
    await user.selectOptions(sortSelect, 'name');

    expect(sortSelect).toHaveValue('name');
  });

  it('shows correct affordability status for buildings', () => {
    // Test with insufficient resources
    const poorPlayer = {
      ...mockPlayer,
      stars: 5, // Not enough for most buildings
      stats: { faith: 0, pride: 0, internalDissent: 0 }
    };

    render(
      <BuildingMenu
        city={mockCity}
        player={poorPlayer}
        gameState={mockGameState}
        onBuild={mockOnBuild}
        onClose={mockOnClose}
      />
    );

    // Should show locked/disabled state for expensive items
    expect(screen.getAllByText('Locked').length).toBeGreaterThan(0);
  });

  it('handles building selection and construction', async () => {
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

    const card = screen.getByText('Warrior').closest('div[class*="rounded-xl"]');
    expect(card).toBeTruthy();
    const buildButton = within(card as HTMLElement).getByRole('button', { name: /build/i });
    await user.click(buildButton);

    expect(mockOnBuild).toHaveBeenCalledWith('warrior');
  });

  it('respects technology requirements', () => {
    // Test with missing tech requirements
    const playerWithoutTech = {
      ...mockPlayer,
      researchedTechs: [] // No techs researched
    };

    render(
      <BuildingMenu
        city={mockCity}
        player={playerWithoutTech}
        gameState={mockGameState}
        onBuild={mockOnBuild}
        onClose={mockOnClose}
      />
    );

    // Buildings requiring tech should be locked
    expect(screen.getAllByText('Locked').length).toBeGreaterThan(0);
  });

  it('closes menu when close button is clicked', async () => {
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

    const closeButton = screen.getByText('✕');
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

	  it('shows rarity indicators correctly', () => {
    render(
      <BuildingMenu
        city={mockCity}
        player={mockPlayer}
        gameState={mockGameState}
        onBuild={mockOnBuild}
        onClose={mockOnClose}
      />
    );

	    // Should show rarity badges
	    expect(screen.getAllByText('common').length).toBeGreaterThan(0);
	  });

	  it('displays build time and costs accurately', () => {
    render(
      <BuildingMenu
        city={mockCity}
        player={mockPlayer}
        gameState={mockGameState}
        onBuild={mockOnBuild}
        onClose={mockOnClose}
      />
    );

	    const card = screen.getByText('Warrior').closest('div[class*="rounded-xl"]');
	    expect(card).toBeTruthy();
	    expect(within(card as HTMLElement).getByLabelText('Stars cost')).toHaveTextContent('10');
	    expect(within(card as HTMLElement).getByLabelText('Build time')).toHaveTextContent('1T');
	  });

  it('handles faction-specific restrictions', () => {
    // Test with different faction
    const lamanitePlayer = {
      ...mockPlayer,
      factionId: 'LAMANITES' as any
    };

    render(
      <BuildingMenu
        city={mockCity}
        player={lamanitePlayer}
        gameState={mockGameState}
        onBuild={mockOnBuild}
        onClose={mockOnClose}
      />
    );

    // Should still show available units (most are not faction-specific)
    expect(screen.getByText('Warrior')).toBeInTheDocument();
  });
});
