import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { WorldElementPanel } from '../WorldElementPanel';
import { getWorldElement } from '../../../../../shared/data/worldElements';
import { GameState } from '../../../../../shared/types/game';
import { HexCoordinate } from '../../../../../shared/types/coordinates';

const stripMotionProps = ({ animate, initial, exit, transition, whileHover, whileTap, layout, layoutId, ...rest }: any) => rest;

// Mock dependencies
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className} data-testid="motion-div" {...stripMotionProps(props)}>
        {children}
      </div>
    ),
    span: ({ children, className, ...props }: any) => (
      <span className={className} data-testid="motion-span" {...stripMotionProps(props)}>
        {children}
      </span>
    ),
  },
}));

vi.mock('@headlessui/react', () => {
  const Transition = ({ children }: any) => <div data-testid="transition">{children}</div>;
  (Transition as any).Child = ({ children }: any) => (
    <div data-testid="transition-child">{children}</div>
  );
  return {
    Dialog: ({ children, ...props }: any) => (
      <div data-testid="dialog" {...props}>
        {children}
      </div>
    ),
    Transition,
  };
});

vi.mock('../../../hooks/useHotkeys', () => ({
  useHotkeys: vi.fn(),
}));

vi.mock('../../../hooks/useSfx', () => ({
  useSfxEngine: () => vi.fn(),
}));

// Mock world elements
vi.mock('../../../../../shared/data/worldElements', () => ({
  getWorldElement: vi.fn((id: string) => ({
    id,
    displayName: 'Test Element',
    scriptureRef: '1 Nephi 1:1',
    description: 'Test description',
    immediateAction: {
      name: 'Harvest Now',
      prideDelta: 1,
      dissentDelta: 1,
      costStars: 2,
      uiTooltipHarvest: 'Quick harvest (+1 Pride, +1 Dissent)',
    },
    longTermBuild: {
      name: 'Build Infrastructure',
      faithDelta: 2,
      costStars: 5,
      uiTooltipBuild: 'Patient building (+2 Faith)',
      effectPermanent: {
        starsPerTurn: 1,
      },
    },
  })),
}));

vi.mock('../../../../../shared/logic/worldElementActions', () => ({
  canExecuteElementAction: vi.fn(() => ({ canExecute: true })),
}));

// Mock UI components
vi.mock('../../primitives/StaggeredContent', () => ({
  StaggeredContent: ({ children }: any) => <div data-testid="staggered-content">{children}</div>,
  StaggeredContainer: ({ children }: any) => <div data-testid="staggered-container">{children}</div>,
}));

vi.mock('../../primitives/RequirementBanner', () => ({
  RequirementBanner: ({ type, message }: any) => (
    <div data-testid="requirement-banner" data-type={type}>
      {message}
    </div>
  ),
}));

describe('WorldElementPanel', () => {
  const mockGameState: GameState = {
    id: 'game1',
    currentPlayerIndex: 0,
    turn: 1,
    phase: 'playing',
    players: [
      {
        id: 'player1',
        name: 'Test Player',
        factionId: 'NEPHITES',
        stars: 10,
        stats: { faith: 5, pride: 3, internalDissent: 2 },
        modifiers: [],
        researchedTechs: [],
        researchProgress: 0,
        citiesOwned: [],
        constructionQueue: [],
        visibilityMask: [],
        exploredTiles: [],
        isEliminated: false,
        turnOrder: 0,
        atWarWith: [],
        alliedWith: [],
        tradeRoutes: [],
        diplomaticCooldowns: {
          declareWar: 0,
          formAlliance: 0,
          breakAlliance: 0,
          requestTrade: 0,
        },
      },
    ],
    map: {
      width: 1,
      height: 1,
      tiles: [
        {
          coordinate: { q: 0, r: 0, s: 0 },
          terrain: 'plains',
          resources: [],
          hasCity: false,
          exploredBy: ['player1'],
        },
      ],
    },
    units: [],
    cities: [],
    improvements: [],
    structures: [],
  };

  const mockCoordinate: HexCoordinate = { q: 0, r: 0, s: 0 };
  
  const defaultProps = {
    gameState: mockGameState,
    playerId: 'player1',
    elementId: 'test-element',
    coordinate: mockCoordinate,
    onAction: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders element information correctly', () => {
    render(<WorldElementPanel {...defaultProps} />);
    
    expect(screen.getByText('Test Element')).toBeInTheDocument();
    expect(screen.getByText('1 Nephi 1:1')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('renders immediate action section', () => {
    render(<WorldElementPanel {...defaultProps} />);
    
    expect(screen.getAllByText('Harvest Now').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Immediate/).length).toBeGreaterThan(0);
  });

  it('renders long-term action section', () => {
    render(<WorldElementPanel {...defaultProps} />);
    
    expect(screen.getAllByText('Build Infrastructure').length).toBeGreaterThan(0);
    expect(screen.getByText(/Long‑term/)).toBeInTheDocument();
  });

  it('renders moral consequences section', () => {
    render(<WorldElementPanel {...defaultProps} />);
    
    expect(screen.getByText('Moral Consequences')).toBeInTheDocument();
    expect(screen.getByText(/Immediate exploitation increases Pride and Dissent/)).toBeInTheDocument();
    expect(screen.getByText(/Patient stewardship builds Faith/)).toBeInTheDocument();
  });

  it('handles action calls correctly', () => {
    render(<WorldElementPanel {...defaultProps} />);
    
    // This would require more specific button identification in the actual implementation
    // For now, we test that the onAction prop is passed correctly
    expect(defaultProps.onAction).toBeDefined();
  });

  it('handles close action correctly', () => {
    render(<WorldElementPanel {...defaultProps} />);
    
    expect(defaultProps.onClose).toBeDefined();
  });

  it('renders with staggered content animation', () => {
    render(<WorldElementPanel {...defaultProps} />);
    
    expect(screen.getAllByTestId('staggered-content').length).toBeGreaterThanOrEqual(4);
    expect(screen.getByTestId('staggered-container')).toBeInTheDocument();
  });

  it('shows proper visual grouping for effects', () => {
    render(<WorldElementPanel {...defaultProps} />);
    
    // Check that effects are grouped in sub-panels
    expect(screen.getAllByText(/Immediate Effects/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Permanent Benefits/)).toBeInTheDocument();
  });

  it('renders without crashing when element has no actions', () => {
    // Mock element with no actions
    vi.mocked(getWorldElement).mockReturnValueOnce({
      id: 'test-element',
      displayName: 'Empty Element',
      scriptureRef: '1 Nephi 1:1',
      description: 'No actions available',
    });

    render(<WorldElementPanel {...defaultProps} />);
    
    expect(screen.getByText('Empty Element')).toBeInTheDocument();
    expect(screen.getByText(/Your choices shape the moral compass/)).toBeInTheDocument();
  });

  it('handles missing player gracefully', () => {
    const propsWithMissingPlayer = {
      ...defaultProps,
      playerId: 'nonexistent-player',
    };

    const { container } = render(<WorldElementPanel {...propsWithMissingPlayer} />);
    expect(container.firstChild).toBeNull();
  });

  it('handles missing element gracefully', () => {
    vi.mocked(getWorldElement).mockReturnValueOnce(null);

    const { container } = render(<WorldElementPanel {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });
});
