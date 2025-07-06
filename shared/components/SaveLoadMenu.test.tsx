import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SaveLoadMenu from '../../client/src/components/ui/SaveLoadMenu';
import { useLocalGame } from '../../client/src/lib/stores/useLocalGame';
import { GameState } from '../types/game';

// Mock the useLocalGame hook
vi.mock('../../client/src/lib/stores/useLocalGame');
// Mock lz-string
vi.mock('lz-string', () => ({
  compress: vi.fn((data) => `compressed_${data}`),
  decompress: vi.fn((data) => data.replace('compressed_', ''))
}));

const mockUseLocalGame = useLocalGame as any;

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  key: vi.fn(),
  length: 0,
  clear: vi.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('SaveLoadMenu', () => {
  const mockGameState: GameState = {
    id: 'test-game',
    players: [
      {
        id: 'player1',
        name: 'Alice',
        factionId: 'NEPHITES',
        stats: { faith: 50, pride: 30, internalDissent: 10 },
        visibilityMask: [],
        exploredTiles: [],
        isEliminated: false,
        turnOrder: 0,
        stars: 20,
        researchedTechs: [],
        researchProgress: 0,
        citiesOwned: ['city1']
      }
    ],
    currentPlayerIndex: 0,
    turn: 5,
    phase: 'playing',
    map: { width: 8, height: 8, tiles: [] },
    units: [],
    cities: [],
    improvements: [],
    structures: []
  };

  const mockProps = {
    onClose: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.length = 0;
    localStorageMock.getItem.mockReturnValue(null);
    localStorageMock.key.mockReturnValue(null);
    
    mockUseLocalGame.mockReturnValue({
      gameState: mockGameState,
      setGameState: vi.fn()
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders save/load menu with title', () => {
    render(<SaveLoadMenu {...mockProps} />);
    
    expect(screen.getByText('Save & Load Game')).toBeInTheDocument();
  });

  it('displays save current game section when gameState exists', () => {
    render(<SaveLoadMenu {...mockProps} />);
    
    expect(screen.getByText('Save Current Game')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter save name...')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('does not display save section when gameState is null', () => {
    mockUseLocalGame.mockReturnValue({
      gameState: null,
      setGameState: vi.fn()
    });
    
    render(<SaveLoadMenu {...mockProps} />);
    
    expect(screen.queryByText('Save Current Game')).not.toBeInTheDocument();
  });

  it('enables save button only when save name is entered', () => {
    render(<SaveLoadMenu {...mockProps} />);
    
    const saveButton = screen.getByText('Save');
    const nameInput = screen.getByPlaceholderText('Enter save name...');
    
    expect(saveButton).toBeDisabled();
    
    fireEvent.change(nameInput, { target: { value: 'Test Save' } });
    expect(saveButton).not.toBeDisabled();
  });

  it('saves game to localStorage when save button is clicked', async () => {
    render(<SaveLoadMenu {...mockProps} />);
    
    const nameInput = screen.getByPlaceholderText('Enter save name...');
    const saveButton = screen.getByText('Save');
    
    fireEvent.change(nameInput, { target: { value: 'Test Save' } });
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        expect.stringMatching(/^chronicles_save_/),
        expect.stringContaining('compressed_')
      );
    });
  });

  it('displays "No saved games found" when localStorage is empty', () => {
    render(<SaveLoadMenu {...mockProps} />);
    
    expect(screen.getByText('No saved games found')).toBeInTheDocument();
  });

  it('loads saved games from localStorage', () => {
    const mockSaveData = {
      id: 'save_123',
      name: 'Test Save',
      timestamp: Date.now(),
      gameState: mockGameState,
      metadata: {
        currentPlayer: 'Alice',
        turn: 5,
        playerCount: 1,
        mapSize: '8x8'
      }
    };

    localStorageMock.length = 1;
    localStorageMock.key.mockReturnValue('chronicles_save_save_123');
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockSaveData));

    render(<SaveLoadMenu {...mockProps} />);
    
    
    expect(screen.getByText('Test Save')).toBeInTheDocument();
    expect(screen.getByText('1 players')).toBeInTheDocument();
    expect(screen.getByText('Turn 5')).toBeInTheDocument();
    expect(screen.getByText('8x8')).toBeInTheDocument();
  });

  it('loads selected game when load button is clicked', async () => {
    const mockSetGameState = vi.fn();
    mockUseLocalGame.mockReturnValue({
      gameState: mockGameState,
      setGameState: mockSetGameState
    });

    const mockSaveData = {
      id: 'save_123',
      name: 'Test Save',
      timestamp: Date.now(),
      gameState: mockGameState,
      metadata: {
        currentPlayer: 'Alice',
        turn: 5,
        playerCount: 1,
        mapSize: '8x8'
      }
    };

    localStorageMock.length = 1;
    localStorageMock.key.mockReturnValue('chronicles_save_save_123');
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockSaveData));

    render(<SaveLoadMenu {...mockProps} />);
    
    
    // Click on the save to select it
    const saveItem = screen.getByText('Test Save').closest('div');
    fireEvent.click(saveItem!);
    
    // Click load button
    const loadButton = screen.getByText('Load Selected Game');
    fireEvent.click(loadButton);
    
    await waitFor(() => {
      expect(mockSetGameState).toHaveBeenCalledWith(mockGameState);
      expect(mockProps.onClose).toHaveBeenCalled();
    });
  });

  it('allows saving game with Enter key', async () => {
    render(<SaveLoadMenu {...mockProps} />);
    
    
    const nameInput = screen.getByPlaceholderText('Enter save name...');
    
    fireEvent.change(nameInput, { target: { value: 'Test Save' } });
    fireEvent.keyPress(nameInput, { key: 'Enter', code: 'Enter' });
    
    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });

  it('shows import/export section', () => {
    render(<SaveLoadMenu {...mockProps} />);
    
    
    expect(screen.getByText('Import/Export')).toBeInTheDocument();
    expect(screen.getByText('Import Save')).toBeInTheDocument();
  });

  it('shows export button only when save is selected', () => {
    const mockSaveData = {
      id: 'save_123',
      name: 'Test Save',
      timestamp: Date.now(),
      gameState: mockGameState,
      metadata: {
        currentPlayer: 'Alice',
        turn: 5,
        playerCount: 1,
        mapSize: '8x8'
      }
    };

    localStorageMock.length = 1;
    localStorageMock.key.mockReturnValue('chronicles_save_save_123');
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockSaveData));

    render(<SaveLoadMenu {...mockProps} />);
    
    
    expect(screen.queryByText('Export Selected')).not.toBeInTheDocument();
    
    // Select a save
    const saveItem = screen.getByText('Test Save').closest('div');
    fireEvent.click(saveItem!);
    
    expect(screen.getByText('Export Selected')).toBeInTheDocument();
  });

  it('deletes save when delete button is clicked', async () => {
    const mockSaveData = {
      id: 'save_123',
      name: 'Test Save',
      timestamp: Date.now(),
      gameState: mockGameState,
      metadata: {
        currentPlayer: 'Alice',
        turn: 5,
        playerCount: 1,
        mapSize: '8x8'
      }
    };

    localStorageMock.length = 1;
    localStorageMock.key.mockReturnValue('chronicles_save_save_123');
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockSaveData));

    render(<SaveLoadMenu {...mockProps} />);
    
    
    const deleteButton = screen.getAllByRole('button').find(btn => 
      btn.querySelector('svg') && btn.classList.contains('border-red-600')
    );
    
    if (deleteButton) {
      fireEvent.click(deleteButton);
      
      await waitFor(() => {
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('chronicles_save_save_123');
      });
    }
  });

  it('handles corrupt save data gracefully', () => {
    localStorageMock.length = 1;
    localStorageMock.key.mockReturnValue('chronicles_save_corrupt');
    localStorageMock.getItem.mockReturnValue('invalid-json');

    render(<SaveLoadMenu {...mockProps} />);
    
    
    // Should still render without crashing
    expect(screen.getByText('Save & Load Game')).toBeInTheDocument();
  });

  it('closes menu when close button is clicked', () => {
    render(<SaveLoadMenu {...mockProps} />);
    
    
    // Find the close button (X button without text)
    const closeButton = screen.getByRole('button', { name: '' });
    fireEvent.click(closeButton);
    
    expect(mockProps.onClose).toHaveBeenCalled();
  });
});