import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TechPanel } from '../../client/src/components/ui/TechPanel';

const mockTechStatuses = {
  organization: { status: 'researched', turnsRemaining: 0 },
  hunting: { status: 'researching', turnsRemaining: 2 },
  agriculture: { status: 'available', turnsRemaining: 0 },
  metallurgy: { status: 'locked', turnsRemaining: 0 },
  engineering: { status: 'available', turnsRemaining: 0 }
};

const mockGameState = {
  players: [{
    id: 'player1',
    stars: 20,
    technologies: ['organization'],
    researchProgress: { hunting: { turnsInvested: 1, totalTurns: 3 } }
  }]
};

// Mock ToastProvider
vi.mock('../../client/src/components/ui/ToastProvider', () => ({
  ToastProvider: ({ children }: any) => children,
  useToastContext: () => ({
    showToast: vi.fn()
  })
}));

// Mock useGameAudio
vi.mock('../../client/src/hooks/useAudioIntegration', () => ({
  useGameAudio: () => ({
    onTechResearch: vi.fn(),
    onButtonClick: vi.fn(),
    onButtonHover: vi.fn(),
    onPanelOpen: vi.fn(),
    onPanelClose: vi.fn()
  })
}));

describe('TechPanel Unit Tests', () => {
  it('snapshots tech tree with different status pillars', () => {
    const component = render(
      <TechPanel 
        gameState={mockGameState}
        playerId="player1"
        onClose={vi.fn()}
        onResearch={vi.fn()}
      />
    );
    
    // Verify researched tech has completed styling
    expect(screen.getByText('Organization')).toBeInTheDocument();
    const orgTech = screen.getByText('Organization').closest('[data-testid="tech-node"]');
    expect(orgTech).toHaveClass('bg-green'); // Completed styling
    
    // Verify researching tech has progress styling
    expect(screen.getByText('Hunting')).toBeInTheDocument();
    const huntingTech = screen.getByText('Hunting').closest('[data-testid="tech-node"]');
    expect(huntingTech).toHaveClass('bg-yellow'); // In-progress styling
    
    // Verify available tech has glow effects
    expect(screen.getByText('Agriculture')).toBeInTheDocument();
    const agriTech = screen.getByText('Agriculture').closest('[data-testid="tech-node"]');
    expect(agriTech).toHaveClass('glow-effect'); // Available glow
    
    // Verify locked tech has disabled styling
    expect(screen.getByText('Metallurgy')).toBeInTheDocument();
    const metalTech = screen.getByText('Metallurgy').closest('[data-testid="tech-node"]');
    expect(metalTech).toHaveClass('opacity-50'); // Locked styling
    
    // Snapshot the entire tree structure
    expect(component.container.firstChild).toMatchSnapshot();
  });

  it('displays progress indicators for researching technologies', () => {
    render(
      <TechPanel 
        gameState={mockGameState}
        playerId="player1"
        onClose={vi.fn()}
        onResearch={vi.fn()}
      />
    );
    
    // Should show progress bar for hunting (1/3 turns)
    expect(screen.getByText('Hunting')).toBeInTheDocument();
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('value', '33'); // 1/3 = 33%
  });

  it('validates tech prerequisite connections', () => {
    render(
      <TechPanel 
        gameState={mockGameState}
        playerId="player1"
        onClose={vi.fn()}
        onResearch={vi.fn()}
      />
    );
    
    // Should show connection lines between prerequisites
    const connections = screen.getAllByTestId('tech-connection');
    expect(connections.length).toBeGreaterThan(0);
    
    // Metallurgy should be locked (requires Engineering)
    const metalTech = screen.getByText('Metallurgy');
    expect(metalTech.closest('[data-testid="tech-node"]')).toHaveClass('opacity-50');
  });

  it('handles pinch-zoom and pan gestures', () => {
    const component = render(
      <TechPanel 
        gameState={mockGameState}
        playerId="player1"
        onClose={vi.fn()}
        onResearch={vi.fn()}
      />
    );
    
    // Should have gesture-enabled container
    const gestureContainer = component.container.querySelector('[data-testid="gesture-container"]');
    expect(gestureContainer).toBeInTheDocument();
    expect(gestureContainer).toHaveStyle('touch-action: none');
  });

  it('validates modal system with proper z-index', () => {
    render(
      <TechPanel 
        gameState={mockGameState}
        playerId="player1"
        onClose={vi.fn()}
        onResearch={vi.fn()}
      />
    );
    
    // Tech panel should have modal z-index
    const modal = screen.getByRole('dialog');
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveClass('z-100'); // Modal z-index level
  });

  it('displays tech costs and research buttons correctly', () => {
    render(
      <TechPanel 
        gameState={mockGameState}
        playerId="player1"
        onClose={vi.fn()}
        onResearch={vi.fn()}
      />
    );
    
    // Available techs should show research buttons
    const agriTech = screen.getByText('Agriculture');
    const researchButton = agriTech.closest('[data-testid="tech-node"]')?.querySelector('button');
    expect(researchButton).toBeInTheDocument();
    expect(researchButton).not.toBeDisabled();
    
    // Locked techs should not have active research buttons
    const metalTech = screen.getByText('Metallurgy');
    const lockedButton = metalTech.closest('[data-testid="tech-node"]')?.querySelector('button');
    expect(lockedButton).toBeDisabled();
  });
});