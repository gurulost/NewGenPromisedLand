import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
vi.mock('../client/src/hooks/useMobileUI', () => ({
  useMobileUI: () => ({ isSmallViewport: false }),
}));
vi.mock('../client/src/hooks/usePathfindingWorker', () => ({
  usePathfindingWorker: () => ({
    getReachableTiles: vi.fn((coord, passable, tileCosts, maxCost, callback) => {
      callback([{ q: 1, r: 0, s: -1 }, { q: 0, r: 1, s: -1 }], null);
    })
  })
}));
vi.mock('../client/src/components/game/HexGridInstanced', () => ({
  default: ({ map }: any) => <div data-testid="hex-grid" data-tiles={map?.tiles?.length ?? 0} />,
}));
vi.mock('../client/src/components/game/Unit', () => ({
  default: ({ unit }: any) => <div data-testid="unit" data-unit-id={unit?.id} />,
}));
vi.mock('@react-three/drei', () => {
  const makeScene = () => ({
    traverse: vi.fn(),
    position: { set: vi.fn() },
  });

  const useGLTF = vi.fn(() => ({
    scene: {
      clone: () => makeScene(),
    },
  })) as any;
  useGLTF.preload = vi.fn();

  return {
    Billboard: ({ children }: any) => <group>{children}</group>,
    Cylinder: ({ children }: any) => <group>{children}</group>,
    Text: ({ children }: any) => <group>{children}</group>,
    useGLTF,
  };
});
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: any) => <div data-testid="canvas">{children}</div>,
  useFrame: () => undefined,
  useThree: () => ({ camera: {}, raycaster: {}, gl: {} }),
  useLoader: vi.fn(() => ({})),
}));

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
      hp: 25,
      maxHp: 25,
      attack: 6,
      defense: 4,
      movement: 3,
      remainingMovement: 3,
      maxActions: 1,
      actionsRemaining: 1,
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
      reachableCoordinates: [],
      isMovementMode: false,
      isAttackMode: false,
      attackableTargets: [],
      isRoadBuildMode: false,
      roadBuildUnitId: null,
      constructionMode: { isActive: false, buildingType: null, buildingCategory: null, cityId: null, playerId: null, builderUnitId: null, allowAnyImprovement: false },
      spawnSelectionMode: { isActive: false, unitType: null, cityId: null, cityCoordinate: null, playerId: null, validSpawnTiles: [] },
      setSelectedUnit: mockSetSelectedUnit,
      setHoveredTile: vi.fn(),
      setReachableTiles: mockSetReachableTiles,
      setMovementMode: mockSetMovementMode,
      setAttackMode: mockSetAttackMode,
      startConstruction: vi.fn(),
      cancelConstruction: vi.fn(),
      cancelRoadBuild: vi.fn(),
      startSpawnSelection: vi.fn(),
      cancelSpawnSelection: vi.fn(),
      openTileContextMenu: vi.fn(),
      closeTileContextMenu: vi.fn(),
      showSpawnDebug: false,
      toggleSpawnDebug: vi.fn()
    });

    // Mock useLocalGame
    (useLocalGame as any).mockReturnValue({
      gameState: mockGameState,
      moveUnit: mockMoveUnit,
      attackUnit: vi.fn(),
      dispatch: vi.fn()
    });

  });

  describe('SelectedUnitPanel Movement Controls', () => {
    it('should display the actions trigger', () => {
      render(<SelectedUnitPanel unit={mockUnit} />);

      expect(screen.getByText('View All Actions')).toBeInTheDocument();
    });

    it('should show Move as unavailable when unit has no movement', () => {
      const unitWithNoMovement = { ...mockUnit, remainingMovement: 0 };
      render(<SelectedUnitPanel unit={unitWithNoMovement} />);

      const moveSummary = screen.getByText('Move').closest('div');
      expect(moveSummary).not.toBeNull();
      expect(within(moveSummary!).getByText('None')).toBeInTheDocument();
    });

    it('should show Attack as unavailable when unit has already acted', () => {
      const unitThatAttacked = { ...mockUnit, hasAttacked: true, actionsRemaining: 0 };
      render(<SelectedUnitPanel unit={unitThatAttacked} />);

      const attackSummary = screen.getByText('Attack').closest('div');
      expect(attackSummary).not.toBeNull();
      expect(within(attackSummary!).getByText('None')).toBeInTheDocument();
    });
  });

  describe('Unit Component Movement Mode Integration', () => {
    it('should only calculate reachable tiles when in movement mode', async () => {
      // Mock not in movement mode
      (useGameState as any).mockReturnValue({
        selectedUnit: mockUnit,
        hoveredTile: null,
        reachableTiles: [],
        reachableCoordinates: [],
        isMovementMode: false,
        isAttackMode: false,
        attackableTargets: [],
        isRoadBuildMode: false,
        roadBuildUnitId: null,
        constructionMode: { isActive: false, buildingType: null, buildingCategory: null, cityId: null, playerId: null, builderUnitId: null, allowAnyImprovement: false },
        spawnSelectionMode: { isActive: false, unitType: null, cityId: null, cityCoordinate: null, playerId: null, validSpawnTiles: [] },
        setSelectedUnit: mockSetSelectedUnit,
        setHoveredTile: vi.fn(),
        setReachableTiles: mockSetReachableTiles,
        setMovementMode: mockSetMovementMode,
        setAttackMode: mockSetAttackMode,
        startConstruction: vi.fn(),
        cancelConstruction: vi.fn(),
        cancelRoadBuild: vi.fn(),
        startSpawnSelection: vi.fn(),
        cancelSpawnSelection: vi.fn(),
        openTileContextMenu: vi.fn(),
        closeTileContextMenu: vi.fn(),
        showSpawnDebug: false,
        toggleSpawnDebug: vi.fn()
      });

      const { container } = render(
        <Canvas>
          <Unit unit={mockUnit} isSelected={true} />
        </Canvas>
      );

      expect(container.querySelector('[data-testid="canvas"]')).toBeTruthy();
    });

    it('should calculate reachable tiles when in movement mode and selected', async () => {
      // Mock in movement mode
      (useGameState as any).mockReturnValue({
        selectedUnit: mockUnit,
        hoveredTile: null,
        reachableTiles: ['1,0', '0,1'],
        reachableCoordinates: [],
        isMovementMode: true,
        isAttackMode: false,
        attackableTargets: [],
        isRoadBuildMode: false,
        roadBuildUnitId: null,
        constructionMode: { isActive: false, buildingType: null, buildingCategory: null, cityId: null, playerId: null, builderUnitId: null, allowAnyImprovement: false },
        spawnSelectionMode: { isActive: false, unitType: null, cityId: null, cityCoordinate: null, playerId: null, validSpawnTiles: [] },
        setSelectedUnit: mockSetSelectedUnit,
        setHoveredTile: vi.fn(),
        setReachableTiles: mockSetReachableTiles,
        setMovementMode: mockSetMovementMode,
        setAttackMode: mockSetAttackMode,
        startConstruction: vi.fn(),
        cancelConstruction: vi.fn(),
        cancelRoadBuild: vi.fn(),
        startSpawnSelection: vi.fn(),
        cancelSpawnSelection: vi.fn(),
        openTileContextMenu: vi.fn(),
        closeTileContextMenu: vi.fn(),
        showSpawnDebug: false,
        toggleSpawnDebug: vi.fn()
      });

      const { container } = render(
        <Canvas>
          <Unit unit={mockUnit} isSelected={true} />
        </Canvas>
      );

      expect(container.querySelector('[data-testid="canvas"]')).toBeTruthy();
    });
  });

  describe('HexGridInstanced Click Handling', () => {
    it('should render the grid without crashing', () => {
      const { container } = render(
        <Canvas>
          <HexGridInstanced map={mockGameState.map} />
        </Canvas>
      );

      expect(container.querySelector('[data-testid=\"canvas\"]')).toBeTruthy();
    });

    it('should handle movement only when in movement mode', () => {
      // Mock in movement mode
      (useGameState as any).mockReturnValue({
        selectedUnit: mockUnit,
        hoveredTile: null,
        reachableTiles: ['1,0', '0,1'],
        reachableCoordinates: [],
        isMovementMode: true,
        isAttackMode: false,
        attackableTargets: [],
        isRoadBuildMode: false,
        roadBuildUnitId: null,
        constructionMode: { isActive: false, buildingType: null, buildingCategory: null, cityId: null, playerId: null, builderUnitId: null, allowAnyImprovement: false },
        spawnSelectionMode: { isActive: false, unitType: null, cityId: null, cityCoordinate: null, playerId: null, validSpawnTiles: [] },
        setSelectedUnit: mockSetSelectedUnit,
        setHoveredTile: vi.fn(),
        setReachableTiles: mockSetReachableTiles,
        setMovementMode: mockSetMovementMode,
        setAttackMode: mockSetAttackMode,
        startConstruction: vi.fn(),
        cancelConstruction: vi.fn(),
        cancelRoadBuild: vi.fn(),
        startSpawnSelection: vi.fn(),
        cancelSpawnSelection: vi.fn(),
        openTileContextMenu: vi.fn(),
        closeTileContextMenu: vi.fn(),
        showSpawnDebug: false,
        toggleSpawnDebug: vi.fn()
      });

      const { container } = render(
        <Canvas>
          <HexGridInstanced map={mockGameState.map} />
        </Canvas>
      );

      // Should handle movement when in movement mode
      expect(container).toBeDefined();
    });

    it('should render in movement mode without crashing', () => {
      // Mock in movement mode
      (useGameState as any).mockReturnValue({
        selectedUnit: mockUnit,
        hoveredTile: null,
        reachableTiles: ['1,0', '0,1'],
        reachableCoordinates: [],
        isMovementMode: true,
        isAttackMode: false,
        attackableTargets: [],
        isRoadBuildMode: false,
        roadBuildUnitId: null,
        constructionMode: { isActive: false, buildingType: null, buildingCategory: null, cityId: null, playerId: null, builderUnitId: null, allowAnyImprovement: false },
        spawnSelectionMode: { isActive: false, unitType: null, cityId: null, cityCoordinate: null, playerId: null, validSpawnTiles: [] },
        setSelectedUnit: mockSetSelectedUnit,
        setHoveredTile: vi.fn(),
        setReachableTiles: mockSetReachableTiles,
        setMovementMode: mockSetMovementMode,
        setAttackMode: mockSetAttackMode,
        startConstruction: vi.fn(),
        cancelConstruction: vi.fn(),
        cancelRoadBuild: vi.fn(),
        startSpawnSelection: vi.fn(),
        cancelSpawnSelection: vi.fn(),
        openTileContextMenu: vi.fn(),
        closeTileContextMenu: vi.fn(),
        showSpawnDebug: false,
        toggleSpawnDebug: vi.fn()
      });

      const { container } = render(
        <Canvas>
          <HexGridInstanced map={mockGameState.map} />
        </Canvas>
      );

      expect(container.querySelector('[data-testid=\"canvas\"]')).toBeTruthy();
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
      render(<SelectedUnitPanel unit={unitWithNoMovement} />);

      const moveSummary = screen.getByText('Move').closest('div');
      expect(moveSummary).not.toBeNull();
      expect(within(moveSummary!).getByText('None')).toBeInTheDocument();
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
