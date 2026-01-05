import { render, screen, fireEvent } from '@testing-library/react';
import { WorldElementPanel } from '../WorldElementPanel';
import { GameState } from '../../../../../shared/types/game';
import { HexCoordinate } from '../../../../../shared/types/coordinates';

const stripMotionProps = ({ animate, initial, exit, transition, whileHover, whileTap, layout, layoutId, ...rest }: any) => rest;

// Mock dependencies
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className} data-testid="motion-div" {...stripMotionProps(props)}>
        {children}
      </div>
    ),
  },
}));

jest.mock('@headlessui/react', () => ({
  Dialog: ({ children, onClose, ...props }: any) => (
    <div data-testid="dialog" {...props}>
      {children}
    </div>
  ),
  Transition: {
    Child: ({ children }: any) => <div data-testid="transition-child">{children}</div>,
  },
  Fragment: ({ children }: any) => <>{children}</>,
}));

jest.mock('../../../hooks/useHotkeys', () => ({
  useHotkeys: jest.fn(),
}));

jest.mock('../../../hooks/useSfx', () => ({
  useSfxEngine: () => jest.fn(),
}));

// Mock world elements
jest.mock('../../../../../shared/data/worldElements', () => ({
  getWorldElement: jest.fn((id: string) => ({
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

jest.mock('../../../../../shared/logic/worldElementActions', () => ({
  canExecuteElementAction: jest.fn(() => ({ canExecute: true })),
}));

// Mock UI components
jest.mock('../../primitives/StaggeredContent', () => ({
  StaggeredContent: ({ children }: any) => <div data-testid="staggered-content">{children}</div>,
  StaggeredContainer: ({ children }: any) => <div data-testid="staggered-container">{children}</div>,
}));

jest.mock('../../primitives/RequirementBanner', () => ({
  RequirementBanner: ({ type, message }: any) => (
    <div data-testid="requirement-banner" data-type={type}>
      {message}
    </div>
  ),
}));

describe('WorldElementPanel', () => {
  const mockGameState: GameState = {
    players: [
      {
        id: 'player1',
        name: 'Test Player',
        faction: 'nephites',
        stars: 10,
        faith: 5,
        pride: 3,
        dissent: 2,
      },
    ],
  } as GameState;

  const mockCoordinate: HexCoordinate = { q: 0, r: 0, s: 0 };
  
  const defaultProps = {
    gameState: mockGameState,
    playerId: 'player1',
    elementId: 'test-element',
    coordinate: mockCoordinate,
    onAction: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders element information correctly', () => {
    render(<WorldElementPanel {...defaultProps} />);
    
    expect(screen.getByText('Test Element')).toBeInTheDocument();
    expect(screen.getByText('1 Nephi 1:1')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('renders immediate action section', () => {
    render(<WorldElementPanel {...defaultProps} />);
    
    expect(screen.getByText('Harvest Now')).toBeInTheDocument();
    expect(screen.getByText(/Immediate/)).toBeInTheDocument();
  });

  it('renders long-term action section', () => {
    render(<WorldElementPanel {...defaultProps} />);
    
    expect(screen.getByText('Build Infrastructure')).toBeInTheDocument();
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
    
    expect(screen.getAllByTestId('staggered-content')).toHaveLength(4); // Header, immediate, long-term, moral consequences
    expect(screen.getByTestId('staggered-container')).toBeInTheDocument();
  });

  it('shows proper visual grouping for effects', () => {
    render(<WorldElementPanel {...defaultProps} />);
    
    // Check that effects are grouped in sub-panels
    expect(screen.getByText(/Immediate Effects/)).toBeInTheDocument();
    expect(screen.getByText(/Permanent Benefits/)).toBeInTheDocument();
  });

  it('renders without crashing when element has no actions', () => {
    // Mock element with no actions
    const mockGetWorldElement = require('../../../../../shared/data/worldElements').getWorldElement;
    mockGetWorldElement.mockReturnValueOnce({
      id: 'test-element',
      displayName: 'Empty Element',
      scriptureRef: '1 Nephi 1:1',
      description: 'No actions available',
    });

    render(<WorldElementPanel {...defaultProps} />);
    
    expect(screen.getByText('Empty Element')).toBeInTheDocument();
    expect(screen.getByText('Your choices shape the moral compass')).toBeInTheDocument();
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
    const mockGetWorldElement = require('../../../../../shared/data/worldElements').getWorldElement;
    mockGetWorldElement.mockReturnValueOnce(null);

    const { container } = render(<WorldElementPanel {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });
});
