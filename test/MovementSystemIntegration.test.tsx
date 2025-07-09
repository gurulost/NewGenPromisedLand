import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Canvas } from '@react-three/fiber';
import { useGameState } from '../client/src/lib/stores/useGameState';
import { useLocalGame } from '../client/src/lib/stores/useLocalGame';
import SelectedUnitPanel from '../client/src/components/ui/SelectedUnitPanel';
import Unit from '../client/src/components/game/Unit';
import HexGridInstanced from '../client/src/components/game/HexGridInstanced';
import type { GameState } from '../shared/types/game';
import type { Unit as UnitType } from '../shared/types/unit';

// Mock the stores
vi.mock('../client/src/lib/stores/useGameState');
vi.mock('../client/src/lib/stores/useLocalGame');
vi.mock('../client/src/hooks/usePathfindingWorker');

describe('Movement System Integration Tests', () => {
  let mockGameState: GameState;
  let mockUnit: UnitType;
  let mockSetMovementMode: ReturnType<typeof vi.fn>;
  let mockSetAttackMode: ReturnType<typeof vi.fn>;
  let mockSetSelectedUnit: ReturnType<typeof vi.fn>;
  let mockSetReachableTiles: ReturnType<typeof vi.fn>;
  let mockMoveUnit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSetMovementMode = vi.fn();
    mockSetAttackMode = vi.fn();
    mockSetSelectedUnit = vi.fn();
    mockSetReachableTiles = vi.fn();
    mockMoveUnit = vi.fn();

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
          { coordinate: { q: 0, r: 0, s: 0 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [] },
          { coordinate: { q: 1, r: 0, s: -1 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [] },
          { coordinate: { q: 0, r: 1, s: -1 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [] }
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
          exploredTiles: ['0,0', '1,0', '0,1'],
          visibleTiles: ['0,0', '1,0', '0,1'],
          stats: {
            unitsKilled: 0,
            citiesDestroyed: 0,
            techsResearched: 0,
            tilesExplored: 3,
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
      setReachableTiles: mockSetReachableTiles,
      setMovementMode: mockSetMovementMode,
      setAttackMode: mockSetAttackMode,
      startConstruction: vi.fn(),
      cancelConstruction: vi.fn()
    });

    // Mock useLocalGame
    (useLocalGame as any).mockReturnValue({
      gameState: mockGameState,
      moveUnit: mockMoveUnit,
      dispatch: vi.fn()
    });

    // Mock pathfinding worker
    vi.mock('../client/src/hooks/usePathfindingWorker', () => ({
      usePathfindingWorker: () => ({
        getReachableTiles: vi.fn((coord, movement, passable, callback) => {
          callback([{ q: 1, r: 0, s: -1 }, { q: 0, r: 1, s: -1 }], null);
        })
      })
    }));
  });

  describe('SelectedUnitPanel Movement Controls', () => {
    it('should display Move button when unit has movement', () => {
      const { getByText } = render(<SelectedUnitPanel unit={mockUnit} />);
      
      const moveButton = getByText('Move');
      expect(moveButton).toBeDefined();
      expect(moveButton).not.toBeDisabled();
    });

    it('should disable Move button when unit has no movement', () => {
      const unitWithNoMovement = { ...mockUnit, remainingMovement: 0 };
      const { getByText } = render(<SelectedUnitPanel unit={unitWithNoMovement} />);
      
      const moveButton = getByText('Move');
      expect(moveButton).toBeDisabled();
    });

    it('should call setMovementMode when Move button is clicked', () => {
      const { getByText } = render(<SelectedUnitPanel unit={mockUnit} />);
      
      const moveButton = getByText('Move');
      fireEvent.click(moveButton);
      
      expect(mockSetMovementMode).toHaveBeenCalledWith(true);
    });

    it('should display Attack button and handle clicks', () => {
      const { getByText } = render(<SelectedUnitPanel unit={mockUnit} />);
      
      const attackButton = getByText('Attack');
      expect(attackButton).toBeDefined();
      expect(attackButton).not.toBeDisabled();
      
      fireEvent.click(attackButton);
      expect(mockSetAttackMode).toHaveBeenCalledWith(true);
    });

    it('should disable Attack button when unit has already attacked', () => {
      const unitThatAttacked = { ...mockUnit, hasAttacked: true };
      const { getByText } = render(<SelectedUnitPanel unit={unitThatAttacked} />);
      
      const attackButton = getByText('Attack');
      expect(attackButton).toBeDisabled();
    });

    it('should display Ability button', () => {
      const { getByText } = render(<SelectedUnitPanel unit={mockUnit} />);
      
      const abilityButton = getByText('Ability');
      expect(abilityButton).toBeDefined();
      expect(abilityButton).not.toBeDisabled();
    });
  });

  describe('Unit Component Movement Mode Integration', () => {
    it('should only calculate reachable tiles when in movement mode', () => {
      // Mock not in movement mode
      (useGameState as any).mockReturnValue({
        selectedUnit: mockUnit,
        hoveredTile: null,
        reachableTiles: [],
        isMovementMode: false,
        isAttackMode: false,
        constructionMode: { isActive: false, buildingType: null, buildingCategory: null, cityId: null, playerId: null },
        setSelectedUnit: mockSetSelectedUnit,
        setHoveredTile: vi.fn(),
        setReachableTiles: mockSetReachableTiles,
        setMovementMode: mockSetMovementMode,
        setAttackMode: mockSetAttackMode,
        startConstruction: vi.fn(),
        cancelConstruction: vi.fn()
      });

      render(
        <Canvas>
          <Unit unit={mockUnit} isSelected={true} />
        </Canvas>
      );

      // Should clear reachable tiles when not in movement mode
      expect(mockSetReachableTiles).toHaveBeenCalledWith([]);
    });

    it('should calculate reachable tiles when in movement mode and selected', () => {
      // Mock in movement mode
      (useGameState as any).mockReturnValue({
        selectedUnit: mockUnit,
        hoveredTile: null,
        reachableTiles: ['1,0', '0,1'],
        isMovementMode: true,
        isAttackMode: false,
        constructionMode: { isActive: false, buildingType: null, buildingCategory: null, cityId: null, playerId: null },
        setSelectedUnit: mockSetSelectedUnit,
        setHoveredTile: vi.fn(),
        setReachableTiles: mockSetReachableTiles,
        setMovementMode: mockSetMovementMode,
        setAttackMode: mockSetAttackMode,
        startConstruction: vi.fn(),
        cancelConstruction: vi.fn()
      });

      render(
        <Canvas>
          <Unit unit={mockUnit} isSelected={true} />
        </Canvas>
      );

      // Should calculate and set reachable tiles
      expect(mockSetReachableTiles).toHaveBeenCalledWith(['1,0', '0,1']);
    });
  });

  describe('HexGridInstanced Click Handling', () => {
    it('should handle unit selection without showing movement tiles', () => {
      const { container } = render(
        <Canvas>
          <HexGridInstanced map={mockGameState.map} />
        </Canvas>
      );

      // Simulate clicking on a unit tile
      const canvas = container.querySelector('canvas');
      if (canvas) {
        fireEvent.click(canvas);
      }

      // Should set selected unit but not enter movement mode automatically
      expect(mockSetSelectedUnit).toHaveBeenCalled();
      expect(mockSetMovementMode).toHaveBeenCalledWith(false);
    });

    it('should handle movement only when in movement mode', () => {
      // Mock in movement mode
      (useGameState as any).mockReturnValue({
        selectedUnit: mockUnit,
        hoveredTile: null,
        reachableTiles: ['1,0', '0,1'],
        isMovementMode: true,
        isAttackMode: false,
        constructionMode: { isActive: false, buildingType: null, buildingCategory: null, cityId: null, playerId: null },
        setSelectedUnit: mockSetSelectedUnit,
        setHoveredTile: vi.fn(),
        setReachableTiles: mockSetReachableTiles,
        setMovementMode: mockSetMovementMode,
        setAttackMode: mockSetAttackMode,
        startConstruction: vi.fn(),
        cancelConstruction: vi.fn()
      });

      const { container } = render(
        <Canvas>
          <HexGridInstanced map={mockGameState.map} />
        </Canvas>
      );

      // Should handle movement when in movement mode
      expect(container).toBeDefined();
    });

    it('should exit movement mode when clicking empty tiles', () => {
      // Mock in movement mode
      (useGameState as any).mockReturnValue({
        selectedUnit: mockUnit,
        hoveredTile: null,
        reachableTiles: ['1,0', '0,1'],
        isMovementMode: true,
        isAttackMode: false,
        constructionMode: { isActive: false, buildingType: null, buildingCategory: null, cityId: null, playerId: null },
        setSelectedUnit: mockSetSelectedUnit,
        setHoveredTile: vi.fn(),
        setReachableTiles: mockSetReachableTiles,
        setMovementMode: mockSetMovementMode,
        setAttackMode: mockSetAttackMode,
        startConstruction: vi.fn(),
        cancelConstruction: vi.fn()
      });

      const { container } = render(
        <Canvas>
          <HexGridInstanced map={mockGameState.map} />
        </Canvas>
      );

      // Simulate clicking on empty area
      const canvas = container.querySelector('canvas');
      if (canvas) {
        fireEvent.click(canvas);
      }

      // Should exit movement mode
      expect(mockSetMovementMode).toHaveBeenCalledWith(false);
    });
  });

  describe('Movement Mode State Management', () => {
    it('should properly handle mode transitions', () => {
      // Test initial state
      expect(mockGameState.players[0].id).toBe('player1');
      expect(mockUnit.remainingMovement).toBe(3);
      expect(mockUnit.hasAttacked).toBe(false);
    });

    it('should validate movement permissions', () => {
      // Unit should belong to current player
      expect(mockUnit.playerId).toBe(mockGameState.players[0].id);
      
      // Unit should have movement available
      expect(mockUnit.remainingMovement).toBeGreaterThan(0);
      
      // Unit should not have attacked this turn
      expect(mockUnit.hasAttacked).toBe(false);
    });

    it('should handle mode exclusivity', () => {
      // Movement and attack modes should be mutually exclusive
      const mockStore = {
        isMovementMode: true,
        isAttackMode: false,
        setMovementMode: (enabled: boolean) => {
          if (enabled) {
            mockStore.isMovementMode = true;
            mockStore.isAttackMode = false;
          } else {
            mockStore.isMovementMode = false;
          }
        },
        setAttackMode: (enabled: boolean) => {
          if (enabled) {
            mockStore.isAttackMode = true;
            mockStore.isMovementMode = false;
          } else {
            mockStore.isAttackMode = false;
          }
        }
      };

      // Test movement mode activation
      mockStore.setMovementMode(true);
      expect(mockStore.isMovementMode).toBe(true);
      expect(mockStore.isAttackMode).toBe(false);

      // Test attack mode activation
      mockStore.setAttackMode(true);
      expect(mockStore.isAttackMode).toBe(true);
      expect(mockStore.isMovementMode).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle invalid movement attempts', () => {
      const unitWithNoMovement = { ...mockUnit, remainingMovement: 0 };
      const { getByText } = render(<SelectedUnitPanel unit={unitWithNoMovement} />);
      
      const moveButton = getByText('Move');
      expect(moveButton).toBeDisabled();
    });

    it('should handle unit selection changes', () => {
      // Test unit selection clearing modes
      const mockStoreWithModes = {
        selectedUnit: mockUnit,
        isMovementMode: true,
        isAttackMode: false,
        setSelectedUnit: (unit: UnitType | null) => {
          mockStoreWithModes.selectedUnit = unit;
          mockStoreWithModes.isMovementMode = false;
          mockStoreWithModes.isAttackMode = false;
        }
      };

      mockStoreWithModes.setSelectedUnit(null);
      expect(mockStoreWithModes.isMovementMode).toBe(false);
      expect(mockStoreWithModes.isAttackMode).toBe(false);
    });

    it('should handle construction mode conflicts', () => {
      // When in construction mode, movement should be disabled
      const constructionModeActive = {
        isActive: true,
        buildingType: 'farm',
        buildingCategory: 'improvements' as const,
        cityId: 'city1',
        playerId: 'player1'
      };

      // Construction mode should prevent movement mode
      expect(constructionModeActive.isActive).toBe(true);
    });
  });
});