import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PlayerHUD } from '../../client/src/components/hud/PlayerHUD';
import type { PlayerState, GameState } from '../../shared/types/game';

const basePlayer: PlayerState = {
  id: 'player1',
  name: 'Nephite Leader',
  factionId: 'NEPHITES',
  isAI: false,
  aiDifficulty: undefined,
  stars: 25,
  stats: { faith: 80, pride: 20, internalDissent: 10 },
  modifiers: [],
  abilityCooldowns: {},
  researchedTechs: [],
  researchInspiration: 0,
  citiesOwned: [],
  constructionQueue: [],
  visibilityMask: [],
  exploredTiles: [],
  isEliminated: false,
  turnOrder: 0,
};

const baseGameState: GameState = {
  id: 'state',
  players: [basePlayer],
  currentPlayerIndex: 0,
  turn: 1,
  phase: 'playing',
  map: {
    width: 5,
    height: 5,
    tiles: [
      { coordinate: { q: 0, r: 0, s: 0 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [] },
    ],
  },
  units: [],
  cities: [],
  improvements: [],
  structures: [],
  lastAction: undefined,
  winner: undefined,
};

describe('PlayerHUD', () => {
  it('renders ability buttons and triggers activation', () => {
    const onActivateAbility = vi.fn();

    render(
      <PlayerHUD
        player={basePlayer}
        gameState={baseGameState}
        onShowTechPanel={() => {}}
        onShowConstructionHall={() => {}}
        onEndTurn={() => {}}
        abilities={[{
          id: 'DIVINE_WARD',
          name: 'Divine Ward',
          description: 'Protect a unit',
          canUse: true,
          requiresTarget: true,
          meta: {},
        }]}
        onActivateAbility={onActivateAbility}
      />
    );

    const button = screen.getByRole('button', { name: /Divine Ward/i });
    fireEvent.click(button);
    expect(onActivateAbility).toHaveBeenCalledWith('DIVINE_WARD');
  });

  it('disables abilities when requirements are unmet', () => {
    render(
      <PlayerHUD
        player={basePlayer}
        gameState={baseGameState}
        onShowTechPanel={() => {}}
        onShowConstructionHall={() => {}}
        onEndTurn={() => {}}
        abilities={[{
          id: 'RIGHTEOUS_FURY',
          name: 'Righteous Fury',
          description: 'Boost nearby allies',
          canUse: false,
          disabledReason: 'Faith 10/30',
          requiresTarget: false,
          meta: {},
        }]}
      />
    );

    const button = screen.getByRole('button', { name: /Righteous Fury/i });
    expect(button).toBeDisabled();
    expect(screen.getByText(/Faith 10\/30/)).toBeInTheDocument();
  });

  it('highlights ready and cooling abilities', () => {
    render(
      <PlayerHUD
        player={basePlayer}
        gameState={baseGameState}
        onShowTechPanel={() => {}}
        onShowConstructionHall={() => {}}
        onEndTurn={() => {}}
        abilities={[
          {
            id: 'ANCIENT_MIGHT',
            name: 'Ancient Might',
            description: 'Empower the giants',
            canUse: true,
            requiresTarget: false,
            meta: { cooldown: 5 },
          },
          {
            id: 'MISSIONARY_ZEAL',
            name: 'Missionary Zeal',
            description: 'Improve conversions',
            canUse: false,
            requiresTarget: false,
            meta: { cooldown: 4, cooldownRemaining: 3 },
          },
        ]}
      />
    );

    expect(screen.getByText(/Ready/i)).toBeInTheDocument();
    expect(screen.getByText(/Cooling/i)).toBeInTheDocument();
  });

  it('shows research inspiration reserves', () => {
    const inspirationalPlayer = { ...basePlayer, researchInspiration: 8 };

    render(
      <PlayerHUD
        player={inspirationalPlayer}
        gameState={{ ...baseGameState, players: [inspirationalPlayer] }}
        onShowTechPanel={() => {}}
        onShowConstructionHall={() => {}}
        onEndTurn={() => {}}
      />
    );

    const inspirationRow = screen.getByText(/Inspiration/i).closest('div');
    expect(inspirationRow).toHaveTextContent('8');
  });
});
