import { beforeEach, describe, expect, it, vi } from 'vitest';

const captureMock = vi.fn();

vi.mock('../../client/src/utils/telemetry/posthog', () => ({
  capture: (...args: unknown[]) => captureMock(...args),
}));

import type { GameState } from '@shared/types/game';
import {
  trackGameplayActionApplied,
  trackGameplayActionBlocked,
  trackPlayerSetupChoices,
} from '../../client/src/utils/telemetry/gameplayAnalytics';

const basePlayer = (id: string, name: string, isAI = false) => ({
  id,
  name,
  factionId: id === 'p1' ? 'NEPHITES' : 'LAMANITES',
  isAI,
  aiDifficulty: isAI ? 'normal' : undefined,
  stars: 10,
  stats: { faith: 50, pride: 30, internalDissent: 10 },
  modifiers: [],
  researchedTechs: [],
  currentResearch: undefined,
  researchProgress: 0,
  researchInspiration: 0,
  abilityCooldowns: {},
  citiesOwned: [`city-${id}`],
  constructionQueue: [],
  visibilityMask: [],
  exploredTiles: [],
  isEliminated: false,
  turnOrder: id === 'p1' ? 0 : 1,
  atWarWith: [],
  alliedWith: [],
  tradeRoutes: [],
  diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
});

const createState = (overrides: Partial<GameState> = {}): GameState => {
  const state: GameState = {
    id: 'game-1',
    rngSeed: 123,
    players: [basePlayer('p1', 'Player 1', false), basePlayer('p2', 'AI 1', true)] as any,
    currentPlayerIndex: 0,
    turn: 1,
    phase: 'playing',
    map: {
      width: 8,
      height: 8,
      tiles: [
        { coordinate: { q: 0, r: 0, s: 0 }, terrain: 'plains', resources: [], hasCity: true, cityOwner: 'p1', exploredBy: [] },
        { coordinate: { q: 1, r: 0, s: -1 }, terrain: 'forest', resources: [], hasCity: true, cityOwner: 'p2', exploredBy: [] },
      ],
    },
    units: [
      {
        id: 'u1',
        type: 'warrior',
        playerId: 'p1',
        coordinate: { q: 0, r: 0, s: 0 },
        hp: 25,
        maxHp: 25,
        attack: 6,
        defense: 4,
        movement: 3,
        remainingMovement: 3,
        maxActions: 1,
        actionsRemaining: 1,
        status: 'active',
        abilities: [],
        level: 1,
        experience: 0,
        visionRadius: 2,
        attackRange: 1,
        hasAttacked: false,
      },
      {
        id: 'u2',
        type: 'warrior',
        playerId: 'p2',
        coordinate: { q: 1, r: 0, s: -1 },
        hp: 25,
        maxHp: 25,
        attack: 6,
        defense: 4,
        movement: 3,
        remainingMovement: 3,
        maxActions: 1,
        actionsRemaining: 1,
        status: 'active',
        abilities: [],
        level: 1,
        experience: 0,
        visionRadius: 2,
        attackRange: 1,
        hasAttacked: false,
      },
    ] as any,
    cities: [
      {
        id: 'city-p1',
        name: 'City 1',
        coordinate: { q: 0, r: 0, s: 0 },
        ownerId: 'p1',
        population: 1,
        maxPopulation: 4,
        level: 1,
        starProduction: 2,
        unrestTurns: 0,
        improvements: [],
        structures: [],
        harvestedResources: [],
      },
      {
        id: 'city-p2',
        name: 'City 2',
        coordinate: { q: 1, r: 0, s: -1 },
        ownerId: 'p2',
        population: 1,
        maxPopulation: 4,
        level: 1,
        starProduction: 2,
        unrestTurns: 0,
        improvements: [],
        structures: [],
        harvestedResources: [],
      },
    ],
    improvements: [],
    structures: [],
    lastAction: undefined,
    winner: undefined,
    victoryType: undefined,
    ...overrides,
  };

  return state;
};

describe('Gameplay analytics telemetry', () => {
  beforeEach(() => {
    captureMock.mockReset();
  });

  it('captures action + turn event for END_TURN', () => {
    const before = createState();
    const after = createState({
      turn: 2,
      currentPlayerIndex: 1,
      players: [
        { ...basePlayer('p1', 'Player 1', false), stars: 12 },
        basePlayer('p2', 'AI 1', true),
      ] as any,
    });

    trackGameplayActionApplied(
      { type: 'END_TURN', payload: { playerId: 'p1' } },
      before,
      after,
      { actionSource: 'local_offline', gameMode: 'standard', isOnline: false }
    );

    const eventNames = captureMock.mock.calls.map((call) => call[0]);
    expect(eventNames).toContain('gameplay_action');
    expect(eventNames).toContain('turn_ended');
  });

  it('captures combat and removal events for ATTACK_UNIT', () => {
    const before = createState();
    const after = createState({
      units: [
        {
          ...before.units[0],
          hp: 20,
        },
      ] as any,
    });

    trackGameplayActionApplied(
      { type: 'ATTACK_UNIT', payload: { attackerId: 'u1', targetId: 'u2' } },
      before,
      after,
      { actionSource: 'local_offline', gameMode: 'standard', isOnline: false }
    );

    const eventNames = captureMock.mock.calls.map((call) => call[0]);
    expect(eventNames).toContain('gameplay_action');
    expect(eventNames).toContain('combat_event');
    expect(eventNames).toContain('units_removed');
  });

  it('captures blocked actions and setup choices', () => {
    const state = createState();

    trackGameplayActionBlocked(
      { type: 'MOVE_UNIT', payload: { unitId: 'u1' } },
      'not_player_turn',
      { actionSource: 'online_guest', gameMode: 'standard', isOnline: true },
      state
    );
    trackPlayerSetupChoices(
      [
        { id: 'p1', factionId: 'NEPHITES', isAI: false },
        { id: 'p2', factionId: 'LAMANITES', isAI: true, aiDifficulty: 'hard' },
      ],
      'normal'
    );

    const eventNames = captureMock.mock.calls.map((call) => call[0]);
    expect(eventNames).toContain('gameplay_action_blocked');
    expect(eventNames).toContain('player_choice');
  });
});
