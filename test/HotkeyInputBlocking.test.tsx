import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GameUI from '../client/src/components/game/GameUI';
import { useLocalGame } from '../client/src/lib/stores/useLocalGame';
import { useGameState } from '../client/src/lib/stores/useGameState';
import { useTurnTransition } from '../client/src/components/ui/TurnTransition';
import type { GameState, PlayerState, City } from '../shared/types/game';

vi.mock('../client/src/lib/stores/useLocalGame');
vi.mock('../client/src/lib/stores/useGameState');
vi.mock('../client/src/components/ui/TurnTransition');

const keyboardSubscribers: Array<(pressed: boolean) => void> = [];
const tutorialState = vi.hoisted(() => ({
  activeCardId: null as string | null,
  isLibraryOpen: false,
  openIfNeeded: vi.fn(),
  setActiveProfile: vi.fn(),
  closeCard: vi.fn(),
  markSeen: vi.fn(),
  dismissForGame: vi.fn(),
  openLibrary: vi.fn(),
  clearQueue: vi.fn(),
  skipTutorialForGame: vi.fn(),
  closeLibrary: vi.fn(),
  openCard: vi.fn(),
}));

vi.mock('@react-three/drei', () => ({
  useKeyboardControls: () => [
    (selector: any, callback: (pressed: boolean) => void) => {
      keyboardSubscribers.push(callback);
      return () => {};
    },
    () => ({})
  ]
}));

vi.mock('../client/src/lib/stores/useTutorial', () => ({
  useTutorialStore: (selector: (state: typeof tutorialState) => unknown) => selector(tutorialState),
}));

vi.mock('../client/src/components/ui/SaveLoadMenu', () => ({
  default: () => (
    <div data-testid="save-load-menu">
      <input data-testid="save-name-input" />
    </div>
  )
}));

vi.mock('../client/src/components/ui/DiplomacyPanel', () => ({
  default: () => <div data-testid="diplomacy-panel" />
}));

vi.mock('../client/src/components/ui/TechPanel', () => ({
  default: () => null
}));
vi.mock('../client/src/components/ui/CityPanel', () => ({
  default: () => null
}));
vi.mock('../client/src/components/ui/BuildingMenu', () => ({
  BuildingMenu: () => null
}));
vi.mock('../client/src/components/ui/VictoryScreen', () => ({
  default: () => null
}));
vi.mock('../client/src/components/ui/SaveSystem', () => ({
  SaveSystem: () => null
}));
vi.mock('../client/src/effects/UnitSelection', () => ({
  UnitSelectionUI: () => null
}));
vi.mock('../client/src/components/ui/SelectedUnitPanel', () => ({
  default: () => null
}));
vi.mock('../client/src/components/ui/CombatPanel', () => ({
  default: () => null
}));
vi.mock('../client/src/components/ui/AbilitiesPanel', () => ({
  AbilitiesPanel: () => null
}));
vi.mock('../client/src/components/ui/SettingsMenu', () => ({
  SettingsMenu: () => null,
}));

describe('GameUI hotkeys while typing', () => {
  let mockGameState: GameState;
  let mockPlayer: PlayerState;
  let mockCity: City;
  let mockEndTurn: ReturnType<typeof vi.fn>;
  let mockSetSelectedUnit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    keyboardSubscribers.length = 0;
    tutorialState.activeCardId = null;
    tutorialState.isLibraryOpen = false;
    tutorialState.openIfNeeded.mockReset();
    tutorialState.setActiveProfile.mockReset();
    tutorialState.closeCard.mockReset();
    tutorialState.markSeen.mockReset();
    tutorialState.dismissForGame.mockReset();
    tutorialState.openLibrary.mockReset();
    tutorialState.clearQueue.mockReset();
    tutorialState.skipTutorialForGame.mockReset();
    tutorialState.closeLibrary.mockReset();
    tutorialState.openCard.mockReset();

    mockPlayer = {
      id: 'player1',
      name: 'Test Player',
      factionId: 'NEPHITES',
      stars: 100,
      stats: { faith: 50, pride: 30, internalDissent: 10 },
      modifiers: [],
      researchedTechs: ['writing', 'organization'],
      researchProgress: 0,
      citiesOwned: ['city1'],
      constructionQueue: [],
      visibilityMask: [],
      exploredTiles: [],
      isEliminated: false,
      turnOrder: 0
    };

    mockCity = {
      id: 'city1',
      name: 'Test Capital',
      coordinate: { q: 0, r: 0, s: 0 },
      population: 5,
      maxPopulation: 4,
      level: 1,
      ownerId: 'player1',
      starProduction: 3,
      improvements: [],
      structures: [],
      harvestedResources: []
    };

    mockGameState = {
      id: 'game1',
      currentPlayerIndex: 0,
      turn: 1,
      phase: 'playing',
      players: [mockPlayer],
      units: [],
      cities: [mockCity],
      map: { tiles: [], width: 10, height: 10 },
      visibility: {},
      structures: [],
      improvements: []
    };

    mockEndTurn = vi.fn();
    mockSetSelectedUnit = vi.fn();

    (useLocalGame as any).mockReturnValue({
      gameState: mockGameState,
      dispatch: vi.fn(),
      endTurn: mockEndTurn,
      useAbility: vi.fn(),
      attackUnit: vi.fn(),
      setGamePhase: vi.fn(),
      resetGame: vi.fn(),
      loadGameState: vi.fn()
    });

    (useGameState as any).mockReturnValue({
      selectedUnit: { id: 'u1', playerId: 'player1', coordinate: { q: 0, r: 0, s: 0 } },
      setSelectedUnit: mockSetSelectedUnit,
      constructionMode: { isActive: false, buildingType: null, buildingCategory: null, cityId: null, playerId: null },
      cancelConstruction: vi.fn(),
      spawnSelectionMode: { isActive: false, unitType: null, cityId: null, cityCoordinate: null, playerId: null, validSpawnTiles: [] },
      cancelSpawnSelection: vi.fn(),
      isRoadBuildMode: false,
      cancelRoadBuild: vi.fn(),
      isMovementMode: false,
      isAttackMode: false,
      setMovementMode: vi.fn(),
      setAttackMode: vi.fn(),
      reachableCoordinates: [],
      closeTileContextMenu: vi.fn(),
      showSpawnDebug: false,
      toggleSpawnDebug: vi.fn()
    });

    (useGameState as any).getState = vi.fn().mockReturnValue({
      startConstruction: vi.fn(),
      selectedUnit: null
    });

    (useTurnTransition as any).mockReturnValue({
      isTransitioning: false,
      pendingPlayer: null,
      startTransition: vi.fn(),
      completeTransition: vi.fn()
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ignores global hotkeys while typing in save name input', async () => {
    const user = userEvent.setup();
    render(<GameUI />);

    const saveButton = await screen.findByTitle('Save/Load Game (S)');
    await user.click(saveButton);

    const input = await screen.findByTestId('save-name-input');
    input.focus();

    // Simulate hotkey presses while input is focused.
    const timeoutSpy = vi.spyOn(window, 'setTimeout');
    act(() => {
      keyboardSubscribers.forEach((callback) => callback(true));
    });

    expect(mockEndTurn).not.toHaveBeenCalled();
    expect(mockSetSelectedUnit).not.toHaveBeenCalled();
    expect(timeoutSpy).not.toHaveBeenCalled();
  });

  it('ignores gameplay hotkeys while a tutorial modal is active', () => {
    tutorialState.activeCardId = 'overview';
    render(<GameUI />);

    const timeoutSpy = vi.spyOn(window, 'setTimeout');
    act(() => {
      keyboardSubscribers.forEach((callback) => callback(true));
    });

    expect(mockEndTurn).not.toHaveBeenCalled();
    expect(mockSetSelectedUnit).not.toHaveBeenCalled();
    expect(timeoutSpy).not.toHaveBeenCalled();
  });
});
