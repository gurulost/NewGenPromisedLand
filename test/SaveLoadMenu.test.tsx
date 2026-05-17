import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocalGame } from '../client/src/lib/stores/useLocalGame';
import SaveLoadMenu from '../client/src/components/ui/SaveLoadMenu';
import type { GameState } from '@shared/types/game';

vi.mock('../client/src/lib/stores/useLocalGame');

vi.mock('../client/src/components/primitives/PanelShell', () => ({
  PanelShell: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../client/src/components/primitives/PanelHeader', () => ({
  PanelHeader: ({ title, description, onClose }: any) => (
    <div>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {onClose ? (
        <button type="button" aria-label="Close panel" onClick={onClose}>
          Close
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock('../client/src/components/primitives/GlowingButton', () => ({
  GlowingButton: ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

const mockListSaves = vi.fn();
const mockListLocalSaves = vi.fn();
const mockCreateSave = vi.fn();
const mockCreateLocalSave = vi.fn();
const mockDeleteSave = vi.fn();
const mockDeleteLocalSave = vi.fn();
const mockGetLocalSavesSnapshot = vi.fn();
const saveApiErrorMocks = vi.hoisted(() => {
  class MockSaveApiError extends Error {
    constructor(
      message: string,
      public readonly code: 'timeout' | 'network' | 'server' | 'invalid_response' = 'server',
      public readonly status?: number,
    ) {
      super(message);
      this.name = 'SaveApiError';
    }
  }

  return {
    MockSaveApiError,
    isExpectedCloudSaveUnavailable: vi.fn((error: unknown) =>
      error instanceof MockSaveApiError &&
      error.code === 'server' &&
      error.status === 503 &&
      error.message === 'Save API unavailable',
    ),
  };
});
const MockSaveApiError = saveApiErrorMocks.MockSaveApiError;
const mockIsExpectedCloudSaveUnavailable = saveApiErrorMocks.isExpectedCloudSaveUnavailable;

vi.mock('../client/src/lib/saveApi', () => ({
  listSaves: (...args: any[]) => mockListSaves(...args),
  listLocalSaves: (...args: any[]) => mockListLocalSaves(...args),
  createSave: (...args: any[]) => mockCreateSave(...args),
  createLocalSave: (...args: any[]) => mockCreateLocalSave(...args),
  deleteSave: (...args: any[]) => mockDeleteSave(...args),
  deleteLocalSave: (...args: any[]) => mockDeleteLocalSave(...args),
  getLocalSavesSnapshot: (...args: any[]) => mockGetLocalSavesSnapshot(...args),
  isExpectedCloudSaveUnavailable: (...args: any[]) => mockIsExpectedCloudSaveUnavailable(...args),
  SaveApiError: saveApiErrorMocks.MockSaveApiError,
}));

const mockUseLocalGame = useLocalGame as any;

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
        citiesOwned: ['city1'],
      },
    ],
    currentPlayerIndex: 0,
    turn: 5,
    phase: 'playing',
    map: { width: 8, height: 8, tiles: [] },
    units: [],
    cities: [],
    improvements: [],
    structures: [],
  };

  const mockProps = { onClose: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetLocalSavesSnapshot.mockReturnValue([]);
    mockListLocalSaves.mockReturnValue([]);
    mockListSaves.mockResolvedValue([]);
    mockCreateSave.mockResolvedValue({ id: 101, name: 'Test Save', storage: 'server' });
    mockCreateLocalSave.mockReturnValue({ id: 202, name: 'Local Save', storage: 'local' });
    mockDeleteSave.mockResolvedValue(undefined);
    mockDeleteLocalSave.mockImplementation(() => undefined);
    mockIsExpectedCloudSaveUnavailable.mockImplementation((error: unknown) =>
      error instanceof MockSaveApiError &&
      error.code === 'server' &&
      error.status === 503 &&
      error.message === 'Save API unavailable',
    );

    mockUseLocalGame.mockReturnValue({
      gameState: mockGameState,
      loadGameState: vi.fn(),
    });
  });

  it('renders save/load menu with title', async () => {
    render(<SaveLoadMenu {...mockProps} />);
    expect(screen.getByText('Save & Load Game')).toBeInTheDocument();
    await waitFor(() => expect(mockListSaves).toHaveBeenCalled());
  });

  it('displays save current game section when gameState exists', async () => {
    render(<SaveLoadMenu {...mockProps} />);
    expect(screen.getByText('Save Current Game')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter save name...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save on this device' })).toBeInTheDocument();
    await waitFor(() => expect(mockListSaves).toHaveBeenCalled());
  });

  it('does not display save section when gameState is null', async () => {
    mockUseLocalGame.mockReturnValue({
      gameState: null,
      loadGameState: vi.fn(),
    });

    render(<SaveLoadMenu {...mockProps} />);
    expect(screen.queryByText('Save Current Game')).not.toBeInTheDocument();
    await waitFor(() => expect(mockListSaves).toHaveBeenCalled());
  });

  it('enables save button only when save name is entered', async () => {
    const user = userEvent.setup();
    render(<SaveLoadMenu {...mockProps} />);
    await waitFor(() => expect(mockListSaves).toHaveBeenCalled());

    const saveButton = screen.getByRole('button', { name: 'Save' });
    const nameInput = screen.getByPlaceholderText('Enter save name...');

    expect(saveButton).toBeDisabled();
    await user.click(nameInput);
    await user.type(nameInput, 'Test Save');

    expect(nameInput).toHaveValue('Test Save');
    await waitFor(() => expect(saveButton).toBeEnabled());
  });

  it('creates a save when save button is clicked', async () => {
    const user = userEvent.setup();
    render(<SaveLoadMenu {...mockProps} />);
    await waitFor(() => expect(mockListSaves).toHaveBeenCalled());

    const nameInput = screen.getByPlaceholderText('Enter save name...');
    const saveButton = screen.getByRole('button', { name: 'Save' });

    await user.click(nameInput);
    await user.type(nameInput, 'Test Save');
    await waitFor(() => expect(saveButton).toBeEnabled());
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockCreateSave).toHaveBeenCalledWith(
        'Test Save',
        mockGameState,
        expect.objectContaining({
          currentPlayer: 'Alice',
          turn: 5,
          playerCount: 1,
          mapSize: '8x8',
          factions: ['NEPHITES'],
        }),
      );
    });
  });

  it('uses a local save as the primary action when cloud saves are unavailable', async () => {
    const user = userEvent.setup();
    mockListSaves.mockRejectedValueOnce(new MockSaveApiError('Save API unavailable', 'server', 503));

    render(<SaveLoadMenu {...mockProps} />);
    await waitFor(() => expect(screen.getByText(/Cloud saves unavailable/i)).toBeInTheDocument());

    const nameInput = screen.getByPlaceholderText('Enter save name...');
    const saveButton = screen.getByRole('button', { name: 'Save' });

    await user.click(nameInput);
    await user.type(nameInput, 'Local Fallback Save');
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockCreateLocalSave).toHaveBeenCalledWith(
        'Local Fallback Save',
        mockGameState,
        expect.objectContaining({
          currentPlayer: 'Alice',
          turn: 5,
        }),
      );
    });
    expect(mockCreateSave).not.toHaveBeenCalled();
  });

  it('does not log an expected disabled cloud-save response', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockListSaves.mockRejectedValueOnce(new MockSaveApiError('Save API unavailable', 'server', 503));

    render(<SaveLoadMenu {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Cloud saves unavailable: Save API unavailable/i)).toBeInTheDocument();
    });

    expect(mockIsExpectedCloudSaveUnavailable).toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('still logs unexpected cloud-save list failures', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const unexpectedError = new Error('Request failed');
    mockListSaves.mockRejectedValueOnce(unexpectedError);

    render(<SaveLoadMenu {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Cloud saves unavailable/i)).toBeInTheDocument();
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading saves:', unexpectedError);
    consoleErrorSpy.mockRestore();
  });

  it('displays "No saved games found" when there are no saves', async () => {
    render(<SaveLoadMenu {...mockProps} />);
    await waitFor(() => expect(mockListSaves).toHaveBeenCalled());
    expect(screen.getByText('No saved games found')).toBeInTheDocument();
  });

  it('renders saves returned by the API', async () => {
    const mockSave = {
      id: 101,
      name: 'Test Save',
      storage: 'server',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      gameState: mockGameState,
      metadata: {
        currentPlayer: 'Alice',
        turn: 5,
        playerCount: 1,
        mapSize: '8x8',
        factions: ['NEPHITES'],
      },
    };

    mockListSaves.mockResolvedValueOnce([mockSave]);
    render(<SaveLoadMenu {...mockProps} />);

    await waitFor(() => expect(screen.getByText('Test Save')).toBeInTheDocument());
    expect(screen.getByText('1 players')).toBeInTheDocument();
    expect(screen.getByText('Turn 5')).toBeInTheDocument();
    expect(screen.getByText('8x8')).toBeInTheDocument();
  });

  it('loads selected game when load button is clicked', async () => {
    const user = userEvent.setup();
    const mockLoadGameState = vi.fn();

    const mockSave = {
      id: 101,
      name: 'Test Save',
      storage: 'server',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      gameState: mockGameState,
      metadata: {
        currentPlayer: 'Alice',
        turn: 5,
        playerCount: 1,
        mapSize: '8x8',
        factions: ['NEPHITES'],
      },
    };

    mockUseLocalGame.mockReturnValue({
      gameState: mockGameState,
      loadGameState: mockLoadGameState,
    });
    mockListSaves.mockResolvedValueOnce([mockSave]);

    render(<SaveLoadMenu {...mockProps} />);
    await waitFor(() => expect(screen.getByText('Test Save')).toBeInTheDocument());

    await user.click(screen.getByText('Test Save'));
    await user.click(screen.getByText('Load Selected Game'));

    await waitFor(() => {
      expect(mockLoadGameState).toHaveBeenCalledWith(mockGameState, { source: 'save_load_menu', saveId: 101 });
      expect(mockProps.onClose).toHaveBeenCalled();
    });
  });

  it('deletes a save when delete button is clicked', async () => {
    const mockSave = {
      id: 101,
      name: 'Test Save',
      storage: 'server',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      gameState: mockGameState,
      metadata: {
        currentPlayer: 'Alice',
        turn: 5,
        playerCount: 1,
        mapSize: '8x8',
        factions: ['NEPHITES'],
      },
    };

    mockListSaves
      .mockResolvedValueOnce([mockSave]) // initial load
      .mockResolvedValueOnce([]); // after delete refresh

    render(<SaveLoadMenu {...mockProps} />);
    await waitFor(() => expect(screen.getByText('Test Save')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(mockDeleteSave).toHaveBeenCalledWith(101));
  });

  it('closes menu when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<SaveLoadMenu {...mockProps} />);
    await waitFor(() => expect(mockListSaves).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('shows import/export section and hides export until a save is selected', async () => {
    const mockSave = {
      id: 101,
      name: 'Test Save',
      storage: 'server',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      gameState: mockGameState,
      metadata: {
        currentPlayer: 'Alice',
        turn: 5,
        playerCount: 1,
        mapSize: '8x8',
        factions: ['NEPHITES'],
      },
    };

    mockListSaves.mockResolvedValueOnce([mockSave]);
    render(<SaveLoadMenu {...mockProps} />);

    expect(screen.getByText('Import/Export')).toBeInTheDocument();
    expect(screen.getByText('Import Save')).toBeInTheDocument();
    expect(screen.queryByText('Export Selected')).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Test Save')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Test Save'));
    expect(screen.getByText('Export Selected')).toBeInTheDocument();
  });
});
