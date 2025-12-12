import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { useGameState } from '../client/src/lib/stores/useGameState';
import { useLocalGame } from '../client/src/lib/stores/useLocalGame';
import GameUI from '../client/src/components/game/GameUI';
import type { GameState } from '../shared/types/game';
import type { Unit } from '../shared/types/unit';

// Mock the stores and dependencies
vi.mock('../client/src/lib/stores/useGameState');
vi.mock('../client/src/lib/stores/useLocalGame');
vi.mock('../client/src/components/game/GameCanvas', () => ({
  default: () => <div data-testid="game-canvas">Mock Game Canvas</div>
}));

describe('Movement UI Flow Integration Tests', () => {
  let mockGameState: GameState;
  let mockUnit: Unit;
  let mockSetMovementMode: ReturnType<typeof vi.fn>;
  let mockSetAttackMode: ReturnType<typeof vi.fn>;
  let mockSetSelectedUnit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSetMovementMode = vi.fn();
    mockSetAttackMode = vi.fn();
    mockSetSelectedUnit = vi.fn();

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
      map: {
        size: 16,
        tiles: [
          { coordinate: { q: 0, r: 0, s: 0 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [] }
        ]
      },
      players: [
        {
          id: 'player1',
          name: 'Player 1',
          factionId: 'NEPHITES',
          color: '#ff0000',
          stars: 100,
          faith: 50,
          pride: 25,
          internalDissent: 10,
          isAI: false,
          exploredTiles: ['0,0'],
          visibleTiles: ['0,0'],
          stats: {
            unitsKilled: 0,
            citiesDestroyed: 0,
            techsResearched: 0,
            tilesExplored: 1,
            starsEarned: 100,
            faithGained: 50,
            prideGained: 25,
            dissentGained: 10
          },
          researchedTechnologies: []
        }
      ],
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
      reachableTiles: ['1,0', '0,1'],
      isMovementMode: false,
      isAttackMode: false,
      constructionMode: { isActive: false, buildingType: null, buildingCategory: null, cityId: null, playerId: null },
      setSelectedUnit: mockSetSelectedUnit,
      setHoveredTile: vi.fn(),
      setReachableTiles: vi.fn(),
      setMovementMode: mockSetMovementMode,
      setAttackMode: mockSetAttackMode,
      startConstruction: vi.fn(),
      cancelConstruction: vi.fn()
    });

    // Mock useLocalGame
    (useLocalGame as any).mockReturnValue({
      gameState: mockGameState,
      moveUnit: vi.fn(),
      dispatch: vi.fn(),
      endTurn: vi.fn()
    });
  });

  describe('Complete Movement Flow', () => {
    it('should render GameUI with selected unit panel', () => {
      render(<GameUI />);
      
      // Should show the selected unit panel
      expect(screen.getByText('Warrior')).toBeDefined();
      expect(screen.getByText('Move')).toBeDefined();
      expect(screen.getByText('Attack')).toBeDefined();
      expect(screen.getByText('Ability')).toBeDefined();
    });

    it('should show unit stats correctly', () => {
      render(<GameUI />);
      
      // Should display unit stats
      expect(screen.getByText('100/100')).toBeDefined(); // HP
      expect(screen.getByText('10')).toBeDefined(); // Attack
      expect(screen.getByText('5')).toBeDefined(); // Defense
      expect(screen.getByText('3/3')).toBeDefined(); // Movement
    });

    it('should handle Move button click flow', () => {
      render(<GameUI />);
      
      const moveButton = screen.getByText('Move');
      expect(moveButton).not.toBeDisabled();
      
      fireEvent.click(moveButton);
      expect(mockSetMovementMode).toHaveBeenCalledWith(true);
    });

    it('should handle Attack button click flow', () => {
      render(<GameUI />);
      
      const attackButton = screen.getByText('Attack');
      expect(attackButton).not.toBeDisabled();
      
      fireEvent.click(attackButton);
      expect(mockSetAttackMode).toHaveBeenCalledWith(true);
    });

    it('should display movement restrictions correctly', () => {
      const unitWithNoMovement = { ...mockUnit, remainingMovement: 0 };
      
      (useGameState as any).mockReturnValue({
        selectedUnit: unitWithNoMovement,
        hoveredTile: null,
        reachableTiles: [],
        isMovementMode: false,
        isAttackMode: false,
        constructionMode: { isActive: false, buildingType: null, buildingCategory: null, cityId: null, playerId: null },
        setSelectedUnit: mockSetSelectedUnit,
        setHoveredTile: vi.fn(),
        setReachableTiles: vi.fn(),
        setMovementMode: mockSetMovementMode,
        setAttackMode: mockSetAttackMode,
        startConstruction: vi.fn(),
        cancelConstruction: vi.fn()
      });

      render(<GameUI />);
      
      const moveButton = screen.getByText('Move');
      expect(moveButton).toBeDisabled();
    });

    it('should display attack restrictions correctly', () => {
      const unitThatAttacked = { ...mockUnit, hasAttacked: true };
      
      (useGameState as any).mockReturnValue({
        selectedUnit: unitThatAttacked,
        hoveredTile: null,
        reachableTiles: [],
        isMovementMode: false,
        isAttackMode: false,
        constructionMode: { isActive: false, buildingType: null, buildingCategory: null, cityId: null, playerId: null },
        setSelectedUnit: mockSetSelectedUnit,
        setHoveredTile: vi.fn(),
        setReachableTiles: vi.fn(),
        setMovementMode: mockSetMovementMode,
        setAttackMode: mockSetAttackMode,
        startConstruction: vi.fn(),
        cancelConstruction: vi.fn()
      });

      render(<GameUI />);
      
      const attackButton = screen.getByText('Attack');
      expect(attackButton).toBeDisabled();
    });
  });

  describe('Unit Panel Visibility and Positioning', () => {
    it('should show unit panel when unit is selected', () => {
      render(<GameUI />);
      
      // Should show unit panel
      expect(screen.getByText('Warrior')).toBeDefined();
      
      // Should show unit position
      expect(screen.getByText('Position: (0, 0)')).toBeDefined();
    });

    it('should handle no selected unit', () => {
      (useGameState as any).mockReturnValue({
        selectedUnit: null,
        hoveredTile: null,
        reachableTiles: [],
        isMovementMode: false,
        isAttackMode: false,
        constructionMode: { isActive: false, buildingType: null, buildingCategory: null, cityId: null, playerId: null },
        setSelectedUnit: mockSetSelectedUnit,
        setHoveredTile: vi.fn(),
        setReachableTiles: vi.fn(),
        setMovementMode: mockSetMovementMode,
        setAttackMode: mockSetAttackMode,
        startConstruction: vi.fn(),
        cancelConstruction: vi.fn()
      });

      render(<GameUI />);
      
      // Should not show unit panel
      expect(screen.queryByText('Warrior')).toBeNull();
    });
  });

  describe('Movement Mode Visual Feedback', () => {
    it('should provide visual feedback for movement mode', () => {
      (useGameState as any).mockReturnValue({
        selectedUnit: mockUnit,
        hoveredTile: null,
        reachableTiles: ['1,0', '0,1'],
        isMovementMode: true,
        isAttackMode: false,
        constructionMode: { isActive: false, buildingType: null, buildingCategory: null, cityId: null, playerId: null },
        setSelectedUnit: mockSetSelectedUnit,
        setHoveredTile: vi.fn(),
        setReachableTiles: vi.fn(),
        setMovementMode: mockSetMovementMode,
        setAttackMode: mockSetAttackMode,
        startConstruction: vi.fn(),
        cancelConstruction: vi.fn()
      });

      render(<GameUI />);
      
      // Should show the game canvas (where reachable tiles would be highlighted)
      expect(screen.getByTestId('game-canvas')).toBeDefined();
    });

    it('should provide visual feedback for attack mode', () => {
      (useGameState as any).mockReturnValue({
        selectedUnit: mockUnit,
        hoveredTile: null,
        reachableTiles: [],
        isMovementMode: false,
        isAttackMode: true,
        constructionMode: { isActive: false, buildingType: null, buildingCategory: null, cityId: null, playerId: null },
        setSelectedUnit: mockSetSelectedUnit,
        setHoveredTile: vi.fn(),
        setReachableTiles: vi.fn(),
        setMovementMode: mockSetMovementMode,
        setAttackMode: mockSetAttackMode,
        startConstruction: vi.fn(),
        cancelConstruction: vi.fn()
      });

      render(<GameUI />);
      
      // Should show the game canvas (where attack targets would be highlighted)
      expect(screen.getByTestId('game-canvas')).toBeDefined();
    });
  });

  describe('Player HUD Integration', () => {
    it('should display player information alongside unit panel', () => {
      render(<GameUI />);
      
      // Should show player name
      expect(screen.getByText('Player 1')).toBeDefined();
      
      // Should show player resources
      expect(screen.getByText('100')).toBeDefined(); // Stars
      expect(screen.getByText('50')).toBeDefined(); // Faith
    });

    it('should handle turn information display', () => {
      render(<GameUI />);
      
      // Should show turn number
      expect(screen.getByText('Turn 1')).toBeDefined();
    });
  });

  describe('Responsiveness and Layout', () => {
    it('should position unit panel correctly', () => {
      render(<GameUI />);
      
      const unitPanel = screen.getByText('Warrior').closest('div');
      expect(unitPanel).toBeDefined();
      
      // Should have proper positioning classes
      expect(unitPanel?.className).toContain('absolute');
      expect(unitPanel?.className).toContain('bottom-4');
      expect(unitPanel?.className).toContain('left-4');
    });

    it('should handle overlapping UI elements', () => {
      render(<GameUI />);
      
      // Should have proper z-index for pointer events
      const unitPanel = screen.getByText('Warrior').closest('div');
      expect(unitPanel?.className).toContain('pointer-events-auto');
    });
  });
});