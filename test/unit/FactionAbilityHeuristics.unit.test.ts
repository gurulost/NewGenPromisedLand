import { describe, expect, it } from 'vitest';

import { evaluateAIFactionAbilityUsage } from '../../shared/ai/factionAbilityHeuristics';
import type { GameState, PlayerState } from '../../shared/types/game';
import type { Unit } from '../../shared/types/unit';

const makePlayer = (overrides: Partial<PlayerState> = {}): PlayerState => ({
  id: 'player1',
  name: 'AI Player',
  factionId: 'MULEKITES',
  isAI: true,
  aiDifficulty: 'normal',
  stars: 20,
  stats: { faith: 90, pride: 40, internalDissent: 10 },
  modifiers: [],
  researchedTechs: [],
  researchInspiration: 0,
  abilityCooldowns: {},
  citiesOwned: ['city1'],
  constructionQueue: [],
  visibilityMask: ['0,0', '1,0', '2,0'],
  exploredTiles: ['0,0', '1,0', '2,0'],
  isEliminated: false,
  turnOrder: 0,
  atWarWith: [],
  alliedWith: [],
  tradeRoutes: [],
  diplomaticCooldowns: {
    declareWar: 0,
    formAlliance: 0,
    breakAlliance: 0,
    requestTrade: 0,
  },
  ...overrides,
});

const makeUnit = (overrides: Partial<Unit> = {}): Unit => ({
  id: 'unit1',
  type: 'warrior',
  playerId: 'player1',
  coordinate: { q: 0, r: 0, s: 0 },
  hp: 25,
  maxHp: 25,
  attack: 6,
  defense: 4,
  movement: 3,
  remainingMovement: 3,
  visionRadius: 2,
  attackRange: 1,
  status: 'active',
  experience: 0,
  abilities: [],
  level: 1,
  temporaryEffects: [],
  ...overrides,
});

const makeTile = (q: number, r: number, exploredBy: string[] = ['player1']): GameState['map']['tiles'][number] => ({
  coordinate: { q, r, s: -q - r },
  terrain: 'plains',
  resources: [],
  hasCity: q === 0 && r === 0,
  cityOwner: q === 0 && r === 0 ? 'player1' : undefined,
  exploredBy,
});

const makeState = (
  player: PlayerState,
  units: Unit[],
  overrides: Partial<GameState> = {}
): GameState => ({
  id: 'ai-faction-ability-heuristics',
  rngSeed: 1,
  players: [
    player,
    makePlayer({
      id: 'player2',
      name: 'Opponent',
      factionId: 'LAMANITES',
      isAI: false,
      aiDifficulty: undefined,
      stats: { faith: 30, pride: 45, internalDissent: 20 },
      citiesOwned: [],
      visibilityMask: [],
      exploredTiles: [],
      turnOrder: 1,
      atWarWith: [player.id],
    }),
  ],
  units,
  currentPlayerIndex: 0,
  turn: 1,
  phase: 'playing',
  map: {
    width: 4,
    height: 4,
    tiles: [makeTile(0, 0), makeTile(1, 0), makeTile(2, 0)],
  },
  cities: [
    {
      id: 'city1',
      name: 'Capital',
      coordinate: { q: 0, r: 0, s: 0 },
      ownerId: player.id,
      population: 1,
      maxPopulation: 4,
      level: 1,
      starProduction: 2,
      improvements: [],
      structures: [],
    },
  ],
  improvements: [],
  structures: [],
  lastAction: undefined,
  winner: undefined,
  ...overrides,
});

describe('AI faction ability heuristics', () => {
  it('selects Cultural Reclamation when visible enemies are in cultural range', () => {
    const aiPlayer = makePlayer();
    const state = makeState(aiPlayer, [
      makeUnit({ id: 'enemy1', playerId: 'player2', coordinate: { q: 1, r: 0, s: -1 } }),
      makeUnit({ id: 'enemy2', playerId: 'player2', coordinate: { q: 2, r: 0, s: -2 }, hp: 10 }),
    ]);

    const decisions = evaluateAIFactionAbilityUsage(state, aiPlayer);

    expect(decisions.some(decision => decision.abilityId === 'CULTURAL_RECLAMATION')).toBe(true);
  });

  it('selects Ancient Might when Jaredites have a meaningful army committed to war', () => {
    const aiPlayer = makePlayer({
      factionId: 'JAREDITES',
      stats: { faith: 25, pride: 70, internalDissent: 10 },
      atWarWith: ['player2'],
    });
    const state = makeState(aiPlayer, [
      makeUnit({ id: 'j1' }),
      makeUnit({ id: 'j2', coordinate: { q: 1, r: 0, s: -1 } }),
      makeUnit({ id: 'j3', coordinate: { q: 0, r: 1, s: -1 } }),
      makeUnit({ id: 'enemy1', playerId: 'player2', coordinate: { q: 2, r: 0, s: -2 } }),
    ]);

    const decisions = evaluateAIFactionAbilityUsage(state, aiPlayer);

    expect(decisions.some(decision => decision.abilityId === 'ANCIENT_MIGHT')).toBe(true);
  });
});
