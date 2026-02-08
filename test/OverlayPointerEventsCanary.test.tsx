import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AITurnIndicator } from '../client/src/components/ui/AITurnIndicator';
import { TurnTransition } from '../client/src/components/ui/TurnTransition';
import { GameLogPanel, type GameLogEntry } from '../client/src/components/ui/GameLogPanel';
import type { PlayerState } from '../shared/types/game';

const mockPlayer: PlayerState = {
  id: 'p1',
  name: 'Test Player',
  factionId: 'NEPHITES',
  stars: 10,
  stats: { faith: 5, pride: 2, internalDissent: 1 },
  modifiers: [],
  researchedTechs: [],
  researchProgress: 0,
  citiesOwned: [],
  constructionQueue: [],
  visibilityMask: [],
  exploredTiles: [],
  isEliminated: false,
  turnOrder: 0,
};

const mockEntries: GameLogEntry[] = [
  {
    id: 'e1',
    turn: 1,
    playerId: 'p1',
    playerName: 'Test Player',
    type: 'system',
    message: 'Game started',
    timestamp: Date.now(),
  },
];

describe('Overlay pointer-event canary coverage', () => {
  it('AI turn overlay explicitly captures pointer input', () => {
    const { container } = render(<AITurnIndicator isVisible aiName="AI Opponent" />);
    const fullscreenRoot = container.querySelector('div.fixed.inset-0');
    expect(fullscreenRoot).toBeInTheDocument();
    expect(fullscreenRoot).toHaveClass('pointer-events-auto');
    expect(fullscreenRoot).toHaveAttribute('data-ui-layer', 'modal');
    expect(fullscreenRoot).toHaveAttribute('aria-modal', 'true');
  });

  it('turn transition overlay explicitly captures pointer input', () => {
    const { container } = render(
      <TurnTransition isVisible currentPlayer={mockPlayer} onComplete={vi.fn()} />,
    );
    const fullscreenRoot = container.querySelector('div.fixed.inset-0');
    expect(fullscreenRoot).toBeInTheDocument();
    expect(fullscreenRoot).toHaveClass('pointer-events-auto');
    expect(fullscreenRoot).toHaveAttribute('data-ui-layer', 'modal');
    expect(fullscreenRoot).toHaveAttribute('aria-modal', 'true');
  });

  it('desktop game log button stays interactive inside pointer-events-none parents', () => {
    render(
      <GameLogPanel
        entries={mockEntries}
        currentTurn={1}
        isOpen={false}
        onToggle={vi.fn()}
      />,
    );

    const toggleButton = screen.getByRole('button', { name: /game log/i });
    expect(toggleButton).toHaveClass('pointer-events-auto');
  });

  it('desktop game log expanded panel stays interactive inside pointer-events-none parents', () => {
    const { container } = render(
      <GameLogPanel
        entries={mockEntries}
        currentTurn={1}
        isOpen
        onToggle={vi.fn()}
      />,
    );

    const expandedPanel = container.querySelector('div.fixed.inset-0');
    const floatingPanel = Array.from(container.querySelectorAll('div.fixed')).find((node) =>
      node.className.includes('w-80'),
    );

    expect(expandedPanel).not.toBeInTheDocument();
    expect(floatingPanel).toBeInTheDocument();
    expect(floatingPanel).toHaveClass('pointer-events-auto');
  });
});
