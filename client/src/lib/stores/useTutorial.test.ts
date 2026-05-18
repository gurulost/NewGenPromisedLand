import { beforeEach, describe, expect, it } from 'vitest';
import { useTutorialStore } from './useTutorial';

describe('useTutorialStore multiplayer suppression', () => {
  beforeEach(() => {
    useTutorialStore.setState({
      activeProfileKey: 'local:Tester',
      activeGameId: 'game-1',
      activeCardId: null,
      queuedCardIds: [],
      isLibraryOpen: false,
      blockingSuppressionReason: null,
      profiles: {},
      dismissedByProfile: {},
      skippedByProfile: {},
    });
  });

  it('clears existing blocking tutorial surfaces and blocks new ones while suppressed', () => {
    useTutorialStore.getState().openCard('overview');
    useTutorialStore.getState().openLibrary();
    expect(useTutorialStore.getState().activeCardId).toBe('overview');
    expect(useTutorialStore.getState().isLibraryOpen).toBe(true);

    useTutorialStore.getState().setBlockingSuppression('public-multiplayer');

    expect(useTutorialStore.getState().blockingSuppressionReason).toBe('public-multiplayer');
    expect(useTutorialStore.getState().activeCardId).toBeNull();
    expect(useTutorialStore.getState().queuedCardIds).toEqual([]);
    expect(useTutorialStore.getState().isLibraryOpen).toBe(false);

    useTutorialStore.getState().openCard('movement');
    useTutorialStore.getState().openLibrary();

    expect(useTutorialStore.getState().activeCardId).toBeNull();
    expect(useTutorialStore.getState().isLibraryOpen).toBe(false);
    expect(useTutorialStore.getState().openIfNeeded('combat')).toBe(false);

    useTutorialStore.getState().setBlockingSuppression(null);
    useTutorialStore.getState().openCard('movement');

    expect(useTutorialStore.getState().blockingSuppressionReason).toBeNull();
    expect(useTutorialStore.getState().activeCardId).toBe('movement');
  });
});
