import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CombatPanel } from '../../client/src/components/ui/CombatPanel';

const mockSelectedUnit = {
  id: 'unit1',
  type: 'warrior',
  ownerId: 'player1',
  coordinate: { q: 0, r: 0, s: 0 },
  health: 10,
  maxHealth: 10,
  attackRange: 1
};

const mockEnemies = [
  {
    id: 'enemy1',
    type: 'warrior',
    ownerId: 'player2',
    coordinate: { q: 1, r: 0, s: -1 },
    health: 8,
    maxHealth: 10
  },
  {
    id: 'enemy2',
    type: 'scout',
    ownerId: 'player2',
    coordinate: { q: 0, r: 1, s: -1 },
    health: 5,
    maxHealth: 6
  }
];

// Mock combat calculations
vi.mock('../../client/src/selectors/combat', () => ({
  getCombatOdds: vi.fn((attacker, defender) => {
    if (defender.id === 'enemy1') {
      return { attackerWinChance: 0.75, defenderWinChance: 0.25, outcome: 'favorable' };
    }
    return { attackerWinChance: 0.45, defenderWinChance: 0.55, outcome: 'unfavorable' };
  })
}));

// Mock ToastProvider
vi.mock('../../client/src/components/ui/ToastProvider', () => ({
  ToastProvider: ({ children }: any) => children,
  useToastContext: () => ({
    showToast: vi.fn()
  })
}));

// Mock useGameAudio with correct API
vi.mock('../../client/src/hooks/useAudioIntegration', () => ({
  useGameAudio: () => ({
    onUnitAttack: vi.fn(),
    onButtonClick: vi.fn(),
    onButtonHover: vi.fn()
  })
}));

describe('CombatPanel Unit Tests', () => {
  it('displays combat odds with correct color classes', () => {
    render(
      <CombatPanel 
        selectedUnit={mockSelectedUnit}
        enemies={mockEnemies}
        onAttack={vi.fn()}
        onClose={vi.fn()}
      />
    );
    
    // Should show both enemies
    expect(screen.getByText(/enemy1/i)).toBeInTheDocument();
    expect(screen.getByText(/enemy2/i)).toBeInTheDocument();
    
    // Should display odds percentages
    expect(screen.getByText('75%')).toBeInTheDocument(); // Favorable odds
    expect(screen.getByText('45%')).toBeInTheDocument(); // Unfavorable odds
  });

  it('changes odds icon color when outcome enum flips', () => {
    const { rerender } = render(
      <CombatPanel 
        selectedUnit={mockSelectedUnit}
        enemies={mockEnemies}
        onAttack={vi.fn()}
        onClose={vi.fn()}
      />
    );
    
    // Check for favorable outcome styling (should be green/positive)
    const favorableOdds = screen.getByText('75%');
    expect(favorableOdds.closest('[class*="text-green"]')).toBeTruthy();
    
    // Check for unfavorable outcome styling (should be red/negative)
    const unfavorableOdds = screen.getByText('45%');
    expect(unfavorableOdds.closest('[class*="text-red"]')).toBeTruthy();
  });

  it('handles empty enemies list gracefully', () => {
    render(
      <CombatPanel 
        selectedUnit={mockSelectedUnit}
        enemies={[]}
        onAttack={vi.fn()}
        onClose={vi.fn()}
      />
    );
    
    expect(screen.getByText(/No enemies in range/i)).toBeInTheDocument();
  });

  it('displays unit health status correctly', () => {
    const damagedUnit = {
      ...mockSelectedUnit,
      health: 6
    };
    
    render(
      <CombatPanel 
        selectedUnit={damagedUnit}
        enemies={mockEnemies}
        onAttack={vi.fn()}
        onClose={vi.fn()}
      />
    );
    
    // Should show unit health
    expect(screen.getByText('6/10')).toBeInTheDocument();
  });

  it('virtualizes enemy list for performance', () => {
    const manyEnemies = Array.from({ length: 50 }, (_, i) => ({
      id: `enemy${i}`,
      type: 'warrior',
      ownerId: 'player2',
      coordinate: { q: i % 5, r: Math.floor(i / 5), s: -(i % 5 + Math.floor(i / 5)) },
      health: 10,
      maxHealth: 10
    }));
    
    render(
      <CombatPanel 
        selectedUnit={mockSelectedUnit}
        enemies={manyEnemies}
        onAttack={vi.fn()}
        onClose={vi.fn()}
      />
    );
    
    // Should render component without performance issues
    expect(screen.getByText(/Combat Options/i)).toBeInTheDocument();
    
    // Should not render all 50 enemies at once (virtualization)
    const renderedEnemies = screen.getAllByText(/enemy\d+/i);
    expect(renderedEnemies.length).toBeLessThan(50);
  });
});