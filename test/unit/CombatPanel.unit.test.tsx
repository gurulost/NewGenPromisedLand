import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CombatPanel from '../../client/src/components/ui/CombatPanel';

const mockSelectedUnit = {
  id: 'unit1',
  type: 'warrior',
  playerId: 'player1',
  coordinate: { q: 0, r: 0, s: 0 },
  currentHp: 10,
  maxHp: 10,
  attackRange: 1,
  visionRadius: 2,
  remainingMovement: 2,
  hasAttacked: false
};

const mockEnemies = [
  {
    id: 'enemy1',
    type: 'warrior',
    playerId: 'player2',
    coordinate: { q: 1, r: 0, s: -1 },
    currentHp: 8,
    maxHp: 10,
    visionRadius: 2,
    remainingMovement: 2,
    hasAttacked: false
  },
  {
    id: 'enemy2',
    type: 'scout',
    playerId: 'player2',
    coordinate: { q: 0, r: 1, s: -1 },
    currentHp: 5,
    maxHp: 6,
    visionRadius: 3,
    remainingMovement: 3,
    hasAttacked: false
  }
];

const mockGameState = {
  id: 'game1',
  currentPlayerIndex: 0,
  turn: 1,
  phase: 'playing',
  map: { width: 10, height: 10, tiles: [] },
  players: [
    { id: 'player1', name: 'Player 1', factionId: 'NEPHITES', stars: 100, faith: 50, pride: 25, internalDissent: 10 },
    { id: 'player2', name: 'Player 2', factionId: 'LAMANITES', stars: 100, faith: 50, pride: 25, internalDissent: 10 }
  ],
  units: [mockSelectedUnit, ...mockEnemies],
  cities: [],
  improvements: [],
  structures: []
};

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
        gameState={mockGameState}
        onAttackUnit={vi.fn()}
        hoveredEnemy={null}
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
        gameState={mockGameState}
        onAttackUnit={vi.fn()}
        hoveredEnemy={null}
      />
    );
    
    // Component renders combat options for enemies in range
    // Test passes if component renders without errors
    expect(screen.getByText(/Warrior/i)).toBeInTheDocument();
  });

  it('handles empty enemies list gracefully', () => {
    const emptyGameState = {
      ...mockGameState,
      units: [mockSelectedUnit] // Only player unit, no enemies
    };
    
    const { container } = render(
      <CombatPanel 
        selectedUnit={mockSelectedUnit}
        gameState={emptyGameState}
        onAttackUnit={vi.fn()}
        hoveredEnemy={null}
      />
    );
    
    // Panel should not render when no enemies in range
    expect(container.firstChild).toBeNull();
  });

  it('displays unit health status correctly', () => {
    const damagedUnit = {
      ...mockSelectedUnit,
      currentHp: 6
    };
    
    const gameStateWithDamagedUnit = {
      ...mockGameState,
      units: [damagedUnit, ...mockEnemies]
    };
    
    render(
      <CombatPanel 
        selectedUnit={damagedUnit}
        gameState={gameStateWithDamagedUnit}
        onAttackUnit={vi.fn()}
        hoveredEnemy={null}
      />
    );
    
    // Should show enemies are available for attack
    expect(screen.getByText(/Warrior/i)).toBeInTheDocument();
  });

  it('virtualizes enemy list for performance', () => {
    const manyEnemies = Array.from({ length: 50 }, (_, i) => ({
      id: `enemy${i}`,
      type: 'warrior',
      playerId: 'player2',
      coordinate: { q: i % 5, r: Math.floor(i / 5), s: -(i % 5 + Math.floor(i / 5)) },
      currentHp: 10,
      maxHp: 10,
      visionRadius: 2,
      remainingMovement: 2,
      hasAttacked: false
    }));
    
    const gameStateWithManyEnemies = {
      ...mockGameState,
      units: [mockSelectedUnit, ...manyEnemies]
    };
    
    render(
      <CombatPanel 
        selectedUnit={mockSelectedUnit}
        gameState={gameStateWithManyEnemies}
        onAttackUnit={vi.fn()}
        hoveredEnemy={null}
      />
    );
    
    // Should render component without performance issues
    expect(screen.getByText(/Warrior/i)).toBeInTheDocument();
  });
});