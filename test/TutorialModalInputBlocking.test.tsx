import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TutorialOverlay } from '../client/src/components/ui/TutorialOverlay';
import { TutorialLibrary } from '../client/src/components/ui/TutorialLibrary';

const tutorialState = vi.hoisted(() => ({
  activeCardId: null as string | null,
  isLibraryOpen: false,
  closeCard: vi.fn(),
  markSeen: vi.fn(),
  dismissForGame: vi.fn(),
  openLibrary: vi.fn(),
  clearQueue: vi.fn(),
  skipTutorialForGame: vi.fn(),
  closeLibrary: vi.fn(),
  openCard: vi.fn(),
}));

vi.mock('../client/src/lib/stores/useTutorial', () => ({
  useTutorialStore: (selector: (state: typeof tutorialState) => unknown) => selector(tutorialState),
}));

describe('Tutorial modal input blocking', () => {
  beforeEach(() => {
    tutorialState.activeCardId = null;
    tutorialState.isLibraryOpen = false;
    tutorialState.closeCard.mockReset();
    tutorialState.markSeen.mockReset();
    tutorialState.dismissForGame.mockReset();
    tutorialState.openLibrary.mockReset();
    tutorialState.clearQueue.mockReset();
    tutorialState.skipTutorialForGame.mockReset();
    tutorialState.closeLibrary.mockReset();
    tutorialState.openCard.mockReset();
  });

  it('tutorial overlay root is interactive and blocks click-through from dialog content', () => {
    tutorialState.activeCardId = 'overview';
    const gameClick = vi.fn();

    render(
      <div onClick={gameClick}>
        <TutorialOverlay />
      </div>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('pointer-events-auto');
    expect(dialog).toHaveAttribute('data-ui-layer', 'modal');
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Begin' }));
    expect(tutorialState.markSeen).toHaveBeenCalledWith('overview');
    expect(tutorialState.dismissForGame).not.toHaveBeenCalled();
    expect(gameClick).not.toHaveBeenCalled();
  });

  it('tutorial overlay backdrop handles close action', () => {
    tutorialState.activeCardId = 'overview';

    render(<TutorialOverlay />);

    fireEvent.click(screen.getByRole('dialog'));
    expect(tutorialState.dismissForGame).toHaveBeenCalledWith('overview');
    expect(tutorialState.closeCard).toHaveBeenCalled();
  });

  it('tutorial library root is interactive and blocks click-through from dialog content', () => {
    tutorialState.isLibraryOpen = true;
    const gameClick = vi.fn();

    render(
      <div onClick={gameClick}>
        <TutorialLibrary />
      </div>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('pointer-events-auto');
    expect(dialog).toHaveAttribute('data-ui-layer', 'modal');
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    fireEvent.click(screen.getByText('Tutorial Guides'));
    expect(tutorialState.closeLibrary).not.toHaveBeenCalled();
    expect(gameClick).not.toHaveBeenCalled();
  });
});
