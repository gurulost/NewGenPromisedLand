import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import Unit from '../client/src/components/game/Unit';
import { useGameState } from '../client/src/lib/stores/useGameState';
import { useLocalGame } from '../client/src/lib/stores/useLocalGame';
import type { GameState } from '../shared/types/game';
import type { Unit as UnitType } from '../shared/types/unit';

vi.mock('../client/src/lib/stores/useGameState');
vi.mock('../client/src/lib/stores/useLocalGame');
vi.mock('../client/src/hooks/usePathfindingWorker', () => ({
  usePathfindingWorker: () => ({
    getReachableTiles: vi.fn((start, passable, tileCosts, maxCost, callback) => {
      callback([{ q: 1, r: 0, s: -1 }, { q: 0, r: 1, s: -1 }], null);
    }),
  }),
}));
vi.mock('@react-three/fiber', () => ({
  useFrame: () => undefined,
}));
vi.mock('@react-three/drei', () => ({
  Billboard: ({ children }: any) => <group>{children}</group>,
  Cylinder: ({ children }: any) => <group>{children}</group>,
  Text: ({ children }: any) => <group>{children}</group>,
}));
vi.mock('../client/src/components/game/UnitModel', () => ({
  UnitModel: () => <group data-testid="unit-model" />,
}));
vi.mock('../client/src/components/game/GLTFErrorBoundary', () => ({
  GLTFErrorBoundary: ({ children }: any) => <group>{children}</group>,
}));

describe('Unit reachable tiles', () => {
  let mockUnit: UnitType;
  let mockGameState: GameState;
  let setReachableTiles: ReturnType<typeof vi.fn>;
  let setReachableCoordinates: ReturnType<typeof vi.fn>;
  let setSelectedUnit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setReachableTiles = vi.fn();
    setReachableCoordinates = vi.fn();
    setSelectedUnit = vi.fn();

    mockUnit = {
      id: 'unit-1',
      type: 'warrior',
      playerId: 'player-1',
      coordinate: { q: 0, r: 0, s: 0 },
      hp: 20,
      maxHp: 20,
      attack: 6,
      defense: 4,
      movement: 3,
      remainingMovement: 3,
      maxActions: 1,
      actionsRemaining: 1,
      status: 'active',
      abilities: [],
      statusEffects: [],
      level: 1,
      experience: 0,
      visionRadius: 2,
      attackRange: 1,
      hasAttacked: false,
    };

    mockGameState = {
      id: 'game-1',
      players: [
        {
          id: 'player-1',
          name: 'Player 1',
          factionId: 'NEPHITES',
          isAI: false,
          stars: 10,
          stats: { faith: 0, pride: 0, internalDissent: 0 },
          researchedTechs: [],
          citiesOwned: [],
          constructionQueue: [],
          visibilityMask: [],
          exploredTiles: [],
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
      currentPlayerIndex: 0,
      turn: 1,
      phase: 'playing',
      map: {
        width: 3,
        height: 3,
        tiles: [
          {
            coordinate: { q: 0, r: 0, s: 0 },
            terrain: 'plains',
            resources: [],
            hasCity: false,
            exploredBy: [],
          },
          {
            coordinate: { q: 1, r: 0, s: -1 },
            terrain: 'plains',
            resources: [],
            hasCity: false,
            exploredBy: [],
          },
          {
            coordinate: { q: 0, r: 1, s: -1 },
            terrain: 'plains',
            resources: [],
            hasCity: false,
            exploredBy: [],
          },
        ],
      },
      units: [mockUnit],
      cities: [],
      improvements: [],
      structures: [],
    } as GameState;

    (useLocalGame as any).mockReturnValue({ gameState: mockGameState });
  });

  const mockGameStateHook = (overrides: Record<string, unknown>) => {
    (useGameState as any).mockReturnValue({
      setSelectedUnit,
      setReachableTiles,
      setReachableCoordinates,
      isMovementMode: false,
      ...overrides,
    });
  };

  it('does not clear reachable tiles for non-selected units', async () => {
    mockGameStateHook({ isMovementMode: true });

    render(<Unit unit={mockUnit} isSelected={false} />);

    await waitFor(() => {
      expect(setReachableTiles).not.toHaveBeenCalled();
      expect(setReachableCoordinates).not.toHaveBeenCalled();
    });
  });

  it('computes reachable tiles when selected and in movement mode', async () => {
    mockGameStateHook({ isMovementMode: true });

    render(<Unit unit={mockUnit} isSelected={true} />);

    await waitFor(() => {
      expect(setReachableTiles).toHaveBeenCalledWith(['1,0', '0,1']);
      expect(setReachableCoordinates).toHaveBeenCalledWith([
        { q: 1, r: 0, s: -1 },
        { q: 0, r: 1, s: -1 },
      ]);
    });
  });

  it('clears reachable tiles when movement mode is off', async () => {
    mockGameStateHook({ isMovementMode: false });

    render(<Unit unit={mockUnit} isSelected={true} />);

    await waitFor(() => {
      expect(setReachableTiles).toHaveBeenCalledWith([]);
      expect(setReachableCoordinates).toHaveBeenCalledWith([]);
    });
  });
});
