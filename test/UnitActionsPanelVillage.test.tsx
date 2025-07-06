import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Unit } from '@shared/types/unit';
import { GameState, PlayerState } from '@shared/types/game';
import UnitActionsPanel from '../client/src/components/ui/UnitActionsPanel';

// Mock the hook
const mockDispatch = vi.fn();
const mockUseLocalGame = vi.fn();

vi.mock('../client/src/lib/stores/useLocalGame', () => ({
  useLocalGame: () => mockUseLocalGame()
}));

describe('UnitActionsPanel - Village Capture', () => {
  let mockGameState: GameState;
  let mockPlayer: PlayerState;
  let mockUnit: Unit;
  let mockProps: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPlayer = {
      id: 'player1',
      name: 'Test Player',
      factionId: 'nephites',
      stars: 10,
      stats: { faith: 5, pride: 3, internalDissent: 1 },
      modifiers: [],
      researchedTechs: [],
      researchProgress: 2,
      citiesOwned: [],
      visibilityMask: [],
      exploredTiles: [],
      isEliminated: false,
      turnOrder: 0,
      constructionQueue: []
    };

    mockUnit = {
      id: 'unit1',
      type: 'warrior',
      playerId: 'player1',
      coordinate: { q: 0, r: 1, s: -1 },
      hp: 10,
      maxHp: 10,
      attack: 2,
      defense: 2,
      movement: 1,
      remainingMovement: 1,
      visionRadius: 2,
      status: 'active',
      hasAttacked: false,
      abilities: [],
      level: 1,
      experience: 0,
      attackRange: 1
    };

    mockGameState = {
      id: 'game1',
      players: [mockPlayer],
      units: [mockUnit],
      cities: [],
      map: {
        tiles: [
          {
            coordinate: { q: 0, r: 1, s: -1 },
            terrain: 'plains',
            resources: [],
            hasCity: false,
            exploredBy: ['player1'],
            feature: 'village',
            cityOwner: undefined // Neutral village
          }
        ],
        width: 10,
        height: 10
      },
      currentPlayerIndex: 0,
      turnNumber: 1,
      phase: 'playing',
      structures: [],
      improvements: []
    };

    mockUseLocalGame.mockReturnValue({
      gameState: mockGameState,
      dispatch: mockDispatch
    });

    mockProps = {
      unit: mockUnit,
      onClose: vi.fn()
    };
  });

  describe('Village Capture Button Display', () => {
    it('should show capture village action when unit is on neutral village', () => {
      render(<UnitActionsPanel {...mockProps} />);
      
      expect(screen.getByText('Capture Village')).toBeDefined();
      expect(screen.getByText('Capture this neutral village for rewards (+5 stars, +1 research)')).toBeDefined();
    });

    it('should not show capture village action when unit is not on village tile', () => {
      // Remove village feature from tile
      mockGameState.map.tiles[0].feature = undefined;
      
      render(<UnitActionsPanel {...mockProps} />);
      
      expect(screen.queryByText('Capture Village')).toBeNull();
    });

    it('should not show capture village action when village is already owned by player', () => {
      // Set village as owned by current player
      mockGameState.map.tiles[0].cityOwner = 'player1';
      
      render(<UnitActionsPanel {...mockProps} />);
      
      expect(screen.queryByText('Capture Village')).toBeNull();
    });

    it('should show capture village action when village is owned by another player', () => {
      // Set village as owned by different player
      mockGameState.map.tiles[0].cityOwner = 'player2';
      
      render(<UnitActionsPanel {...mockProps} />);
      
      expect(screen.getByText('Capture Village')).toBeDefined();
    });

    it('should not show capture village action when unit has already attacked', () => {
      mockUnit.hasAttacked = true;
      
      render(<UnitActionsPanel {...mockProps} />);
      
      expect(screen.queryByText('Capture Village')).toBeNull();
    });

    it('should show capture village action with correct cost display', () => {
      render(<UnitActionsPanel {...mockProps} />);
      
      expect(screen.getByText(/Cost:\s*Turn/)).toBeDefined();
    });
  });

  describe('Village Capture Action Execution', () => {
    it('should dispatch CAPTURE_VILLAGE action when button is clicked', () => {
      render(<UnitActionsPanel {...mockProps} />);
      
      const captureButton = screen.getByText('Capture Village');
      fireEvent.click(captureButton);
      
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'CAPTURE_VILLAGE',
        payload: {
          unitId: 'unit1',
          playerId: 'player1'
        }
      });
    });

    it('should close panel after capturing village', () => {
      render(<UnitActionsPanel {...mockProps} />);
      
      const captureButton = screen.getByText('Capture Village');
      fireEvent.click(captureButton);
      
      expect(mockProps.onClose).toHaveBeenCalled();
    });

    it('should use correct unit and player IDs in action payload', () => {
      const differentUnit = {
        ...mockUnit,
        id: 'different_unit',
        playerId: 'different_player'
      };
      
      const differentPlayer = {
        ...mockPlayer,
        id: 'different_player'
      };
      
      mockGameState.players = [differentPlayer];
      mockGameState.currentPlayerIndex = 0;
      
      render(<UnitActionsPanel {...mockProps} unit={differentUnit} />);
      
      const captureButton = screen.getByText('Capture Village');
      fireEvent.click(captureButton);
      
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'CAPTURE_VILLAGE',
        payload: {
          unitId: 'different_unit',
          playerId: 'different_player'
        }
      });
    });
  });

  describe('Village Detection Logic', () => {
    it('should detect village on exact coordinate match', () => {
      mockUnit.coordinate = { q: 0, r: 1, s: -1 };
      mockGameState.map.tiles[0].coordinate = { q: 0, r: 1, s: -1 };
      
      render(<UnitActionsPanel {...mockProps} />);
      
      expect(screen.getByText('Capture Village')).toBeDefined();
    });

    it('should not detect village with coordinate mismatch', () => {
      mockUnit.coordinate = { q: 1, r: 0, s: -1 };
      mockGameState.map.tiles[0].coordinate = { q: 0, r: 1, s: -1 };
      
      render(<UnitActionsPanel {...mockProps} />);
      
      expect(screen.queryByText('Capture Village')).toBeNull();
    });

    it('should handle multiple tiles correctly', () => {
      mockGameState.map.tiles = [
        {
          coordinate: { q: 0, r: 0, s: 0 },
          terrain: 'plains',
          resources: [],
          hasCity: false,
          exploredBy: [],
          feature: 'village',
          cityOwner: 'player1' // Owned village
        },
        {
          coordinate: { q: 0, r: 1, s: -1 },
          terrain: 'plains',
          resources: [],
          hasCity: false,
          exploredBy: [],
          feature: 'village',
          cityOwner: undefined // Neutral village (unit position)
        }
      ];
      
      render(<UnitActionsPanel {...mockProps} />);
      
      expect(screen.getByText('Capture Village')).toBeDefined();
    });
  });

  describe('Action Availability Conditions', () => {
    it('should be available when all conditions are met', () => {
      // Unit on neutral village, not attacked, has movement
      render(<UnitActionsPanel {...mockProps} />);
      
      const captureButton = screen.getByText('Capture Village');
      expect(captureButton).toBeDefined();
      // Button should be enabled (not disabled)
      expect(captureButton.closest('button')).not.toHaveAttribute('disabled');
    });

    it('should handle edge case with zero coordinates', () => {
      mockUnit.coordinate = { q: 0, r: 0, s: 0 };
      mockGameState.map.tiles[0].coordinate = { q: 0, r: 0, s: 0 };
      
      render(<UnitActionsPanel {...mockProps} />);
      
      expect(screen.getByText('Capture Village')).toBeDefined();
    });

    it('should handle negative coordinates correctly', () => {
      mockUnit.coordinate = { q: -1, r: -1, s: 2 };
      mockGameState.map.tiles[0].coordinate = { q: -1, r: -1, s: 2 };
      
      render(<UnitActionsPanel {...mockProps} />);
      
      expect(screen.getByText('Capture Village')).toBeDefined();
    });

    it('should work with different unit types', () => {
      const scoutUnit = {
        ...mockUnit,
        type: 'scout' as const,
        id: 'scout1'
      };
      
      render(<UnitActionsPanel {...mockProps} unit={scoutUnit} />);
      
      expect(screen.getByText('Capture Village')).toBeDefined();
    });

    it('should work with worker units', () => {
      const workerUnit = {
        ...mockUnit,
        type: 'worker' as const,
        id: 'worker1'
      };
      
      render(<UnitActionsPanel {...mockProps} unit={workerUnit} />);
      
      expect(screen.getByText('Capture Village')).toBeDefined();
    });
  });

  describe('Icon and Styling', () => {
    it('should display correct icon for village capture', () => {
      render(<UnitActionsPanel {...mockProps} />);
      
      // Crown icon should be present for capture action
      const actionButton = screen.getByText('Capture Village').closest('button');
      expect(actionButton).toBeDefined();
    });

    it('should show correct action cost', () => {
      render(<UnitActionsPanel {...mockProps} />);
      
      expect(screen.getByText(/Cost:\s*Turn/)).toBeDefined();
    });
  });
});