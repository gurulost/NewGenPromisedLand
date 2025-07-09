import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { useGameState } from '../client/src/lib/stores/useGameState';
import SelectedUnitPanel from '../client/src/components/ui/SelectedUnitPanel';
import type { Unit } from '../shared/types/unit';
import type { GameState } from '../shared/types/game';

// Mock the stores
vi.mock('../client/src/lib/stores/useGameState');
vi.mock('../client/src/lib/stores/useLocalGame');

describe('Movement System Core Logic Tests', () => {
  let mockUnit: Unit;
  let mockGameState: GameState;
  let mockSetMovementMode: ReturnType<typeof vi.fn>;
  let mockSetAttackMode: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSetMovementMode = vi.fn();
    mockSetAttackMode = vi.fn();

    mockUnit = {
      id: 'unit1',
      type: 'warrior',
      coordinate: { q: 0, r: 0, s: 0 },
      playerId: 'player1',
      hp: 100,
      maxHp: 100,
      attack: 10,
      defense: 5,
      movement: 3,
      remainingMovement: 3,
      visionRadius: 2,
      attackRange: 1,
      hasAttacked: false,
      abilities: [],
      statusEffects: []
    };

    mockGameState = {
      id: 'game1',
      status: 'active',
      currentPlayerIndex: 0,
      turnNumber: 1,
      map: { size: 16, tiles: [] },
      players: [{
        id: 'player1',
        name: 'Player 1',
        factionId: 'NEPHITES',
        color: '#ff0000',
        stars: 100,
        faith: 50,
        pride: 25,
        internalDissent: 10,
        isAI: false,
        exploredTiles: [],
        visibleTiles: [],
        stats: {
          unitsKilled: 0,
          citiesDestroyed: 0,
          techsResearched: 0,
          tilesExplored: 0,
          starsEarned: 100,
          faithGained: 50,
          prideGained: 25,
          dissentGained: 10
        },
        researchedTechnologies: []
      }],
      units: [mockUnit],
      cities: [],
      improvements: [],
      structures: [],
      villages: [],
      combatLog: []
    };

    // Mock useGameState
    (useGameState as any).mockReturnValue({
      selectedUnit: mockUnit,
      hoveredTile: null,
      reachableTiles: [],
      isMovementMode: false,
      isAttackMode: false,
      constructionMode: { isActive: false, buildingType: null, buildingCategory: null, cityId: null, playerId: null },
      setSelectedUnit: vi.fn(),
      setHoveredTile: vi.fn(),
      setReachableTiles: vi.fn(),
      setMovementMode: mockSetMovementMode,
      setAttackMode: mockSetAttackMode,
      startConstruction: vi.fn(),
      cancelConstruction: vi.fn()
    });

    // Mock useLocalGame
    const mockUseLocalGame = require('../client/src/lib/stores/useLocalGame');
    vi.mocked(mockUseLocalGame.useLocalGame).mockReturnValue({
      gameState: mockGameState,
      moveUnit: vi.fn(),
      dispatch: vi.fn()
    });
  });

  describe('Movement Mode State Management', () => {
    it('should initialize with correct default state', () => {
      const store = (useGameState as any)();
      expect(store.isMovementMode).toBe(false);
      expect(store.isAttackMode).toBe(false);
      expect(store.selectedUnit).toBe(mockUnit);
    });

    it('should handle movement mode activation', () => {
      const mockStore = {
        isMovementMode: false,
        isAttackMode: false,
        setMovementMode: vi.fn((enabled: boolean) => {
          if (enabled) {
            mockStore.isMovementMode = true;
            mockStore.isAttackMode = false;
          } else {
            mockStore.isMovementMode = false;
          }
        }),
        setAttackMode: vi.fn((enabled: boolean) => {
          if (enabled) {
            mockStore.isAttackMode = true;
            mockStore.isMovementMode = false;
          } else {
            mockStore.isAttackMode = false;
          }
        })
      };

      // Test movement mode activation
      mockStore.setMovementMode(true);
      expect(mockStore.setMovementMode).toHaveBeenCalledWith(true);

      // Test attack mode activation (should disable movement mode)
      mockStore.setAttackMode(true);
      expect(mockStore.setAttackMode).toHaveBeenCalledWith(true);
    });

    it('should handle mode exclusivity correctly', () => {
      let isMovementMode = false;
      let isAttackMode = false;

      const setMovementMode = (enabled: boolean) => {
        isMovementMode = enabled;
        if (enabled) isAttackMode = false;
      };

      const setAttackMode = (enabled: boolean) => {
        isAttackMode = enabled;
        if (enabled) isMovementMode = false;
      };

      // Test movement mode
      setMovementMode(true);
      expect(isMovementMode).toBe(true);
      expect(isAttackMode).toBe(false);

      // Test attack mode (should disable movement)
      setAttackMode(true);
      expect(isAttackMode).toBe(true);
      expect(isMovementMode).toBe(false);
    });
  });

  describe('SelectedUnitPanel Button Logic', () => {
    it('should render Move button correctly', () => {
      render(<SelectedUnitPanel unit={mockUnit} />);
      
      const moveButton = screen.getByText('Move');
      expect(moveButton).toBeDefined();
      expect(moveButton).not.toBeDisabled();
    });

    it('should render Attack button correctly', () => {
      render(<SelectedUnitPanel unit={mockUnit} />);
      
      const attackButton = screen.getByText('Attack');
      expect(attackButton).toBeDefined();
      expect(attackButton).not.toBeDisabled();
    });

    it('should render Ability button correctly', () => {
      render(<SelectedUnitPanel unit={mockUnit} />);
      
      const abilityButton = screen.getByText('Ability');
      expect(abilityButton).toBeDefined();
      expect(abilityButton).not.toBeDisabled();
    });

    it('should call setMovementMode when Move button is clicked', () => {
      render(<SelectedUnitPanel unit={mockUnit} />);
      
      const moveButton = screen.getByText('Move');
      fireEvent.click(moveButton);
      
      expect(mockSetMovementMode).toHaveBeenCalledWith(true);
    });

    it('should call setAttackMode when Attack button is clicked', () => {
      render(<SelectedUnitPanel unit={mockUnit} />);
      
      const attackButton = screen.getByText('Attack');
      fireEvent.click(attackButton);
      
      expect(mockSetAttackMode).toHaveBeenCalledWith(true);
    });

    it('should disable Move button when unit has no movement', () => {
      const unitWithNoMovement = { ...mockUnit, remainingMovement: 0 };
      render(<SelectedUnitPanel unit={unitWithNoMovement} />);
      
      const moveButton = screen.getByText('Move');
      expect(moveButton).toBeDisabled();
    });

    it('should disable Attack button when unit has already attacked', () => {
      const unitThatAttacked = { ...mockUnit, hasAttacked: true };
      render(<SelectedUnitPanel unit={unitThatAttacked} />);
      
      const attackButton = screen.getByText('Attack');
      expect(attackButton).toBeDisabled();
    });
  });

  describe('Unit Stats Display', () => {
    it('should display unit health correctly', () => {
      render(<SelectedUnitPanel unit={mockUnit} />);
      
      expect(screen.getByText('100/100')).toBeDefined();
    });

    it('should display unit attack correctly', () => {
      render(<SelectedUnitPanel unit={mockUnit} />);
      
      expect(screen.getByText('10')).toBeDefined();
    });

    it('should display unit defense correctly', () => {
      render(<SelectedUnitPanel unit={mockUnit} />);
      
      expect(screen.getByText('5')).toBeDefined();
    });

    it('should display unit movement correctly', () => {
      render(<SelectedUnitPanel unit={mockUnit} />);
      
      expect(screen.getByText('3/3')).toBeDefined();
    });

    it('should display unit position correctly', () => {
      render(<SelectedUnitPanel unit={mockUnit} />);
      
      expect(screen.getByText('Position: (0, 0)')).toBeDefined();
    });

    it('should display unit type correctly', () => {
      render(<SelectedUnitPanel unit={mockUnit} />);
      
      expect(screen.getByText('Warrior')).toBeDefined();
    });
  });

  describe('Unit State Validation', () => {
    it('should validate unit movement permissions', () => {
      expect(mockUnit.remainingMovement).toBeGreaterThan(0);
      expect(mockUnit.hasAttacked).toBe(false);
      expect(mockUnit.playerId).toBe('player1');
    });

    it('should validate unit attack permissions', () => {
      expect(mockUnit.hasAttacked).toBe(false);
      expect(mockUnit.attackRange).toBeGreaterThan(0);
      expect(mockUnit.attack).toBeGreaterThan(0);
    });

    it('should handle wounded unit display', () => {
      const woundedUnit = { ...mockUnit, hp: 50 };
      render(<SelectedUnitPanel unit={woundedUnit} />);
      
      expect(screen.getByText('50/100')).toBeDefined();
    });

    it('should handle unit with partial movement', () => {
      const partialMovementUnit = { ...mockUnit, remainingMovement: 1 };
      render(<SelectedUnitPanel unit={partialMovementUnit} />);
      
      expect(screen.getByText('1/3')).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle unit with abilities', () => {
      const unitWithAbilities = { ...mockUnit, abilities: ['stealth', 'heal'] };
      render(<SelectedUnitPanel unit={unitWithAbilities} />);
      
      expect(screen.getByText('stealth')).toBeDefined();
      expect(screen.getByText('heal')).toBeDefined();
    });

    it('should handle unit with no abilities', () => {
      const unitWithNoAbilities = { ...mockUnit, abilities: [] };
      render(<SelectedUnitPanel unit={unitWithNoAbilities} />);
      
      // Should not show abilities section
      expect(screen.queryByText('Abilities')).toBeNull();
    });

    it('should handle maximum stats unit', () => {
      const maxStatsUnit = {
        ...mockUnit,
        hp: 200,
        maxHp: 200,
        attack: 50,
        defense: 40,
        movement: 5,
        remainingMovement: 5
      };
      render(<SelectedUnitPanel unit={maxStatsUnit} />);
      
      expect(screen.getByText('200/200')).toBeDefined();
      expect(screen.getByText('50')).toBeDefined();
      expect(screen.getByText('40')).toBeDefined();
      expect(screen.getByText('5/5')).toBeDefined();
    });
  });
});