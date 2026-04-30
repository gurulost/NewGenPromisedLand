import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FactionAbilityButtons } from '../../client/src/components/hud/FactionAbilityButtons';
import type { GameState, PlayerState } from '../../shared/types/game';
import type { Unit } from '../../shared/types/unit';

const createPlayer = (overrides: Partial<PlayerState> = {}): PlayerState => ({
  id: 'player1',
  name: 'Player One',
  factionId: 'ANTI_NEPHI_LEHIES',
  isAI: false,
  aiDifficulty: undefined,
  stars: 20,
  stats: { faith: 90, pride: 10, internalDissent: 5 },
  modifiers: [],
  abilityCooldowns: {},
  researchedTechs: [],
  researchProgress: 0,
  researchInspiration: 0,
  citiesOwned: [],
  constructionQueue: [],
  visibilityMask: [],
  exploredTiles: [],
  isEliminated: false,
  turnOrder: 0,
  atWarWith: [],
  alliedWith: [],
  tradeRoutes: [],
  diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
  ...overrides,
});

const createUnit = (overrides: Partial<Unit>): Unit => ({
  id: 'unit1',
  type: 'warrior',
  playerId: 'player1',
  coordinate: { q: 0, r: 0, s: 0 },
  hp: 20,
  maxHp: 20,
  attack: 6,
  defense: 3,
  movement: 3,
  remainingMovement: 3,
  maxActions: 1,
  actionsRemaining: 1,
  visionRadius: 2,
  attackRange: 1,
  status: 'active',
  experience: 0,
  abilities: [],
  level: 1,
  hasAttacked: false,
  ...overrides,
});

const createState = (player: PlayerState, units: Unit[]): GameState => ({
  id: 'faction-ability-buttons-test',
  players: [
    player,
    createPlayer({
      id: 'player2',
      name: 'Player Two',
      factionId: 'LAMANITES',
      stats: { faith: 30, pride: 70, internalDissent: 20 },
      turnOrder: 1,
    }),
  ],
  currentPlayerIndex: 0,
  turn: 1,
  phase: 'playing',
  map: {
    width: 4,
    height: 4,
    tiles: [
      { coordinate: { q: 0, r: 0, s: 0 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: ['player1'] },
      { coordinate: { q: 2, r: 0, s: -2 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: ['player1'] },
    ],
  },
  units,
  cities: [],
  improvements: [],
  structures: [],
});

describe('FactionAbilityButtons', () => {
  it('enables implemented active faction abilities when shared availability is satisfied', async () => {
    const user = userEvent.setup();
    const player = createPlayer();
    const onUseFactionAbility = vi.fn();
    const gameState = createState(player, [
      createUnit({ id: 'missionary', type: 'missionary', abilities: ['heal', 'convert'] }),
      createUnit({ id: 'enemy', playerId: 'player2', coordinate: { q: 2, r: 0, s: -2 } }),
    ]);

    render(
      <FactionAbilityButtons
        player={player}
        gameState={gameState}
        onUseFactionAbility={onUseFactionAbility}
      />
    );

    const button = screen.getByTestId('hud-faction-ability-MISSIONARY_ZEAL');
    expect(button).not.toBeDisabled();

    await user.click(button);

    expect(onUseFactionAbility).toHaveBeenCalledWith('MISSIONARY_ZEAL');
  });
});
