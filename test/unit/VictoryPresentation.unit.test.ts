import { describe, expect, it } from 'vitest';
import {
  getFinalStats,
  getRankedPlayers,
  getVictoryMetricCards,
} from '../../client/src/lib/victoryPresentation';
import type { GameState, PlayerState } from '../../shared/types/game';
import type { Unit } from '../../shared/types/unit';

const makePlayer = (overrides: Partial<PlayerState>): PlayerState => ({
  id: overrides.id ?? 'player-1',
  name: overrides.name ?? 'Player',
  factionId: overrides.factionId ?? 'NEPHITES',
  stars: overrides.stars ?? 10,
  stats: overrides.stats ?? { faith: 50, pride: 20, internalDissent: 5 },
  modifiers: overrides.modifiers ?? [],
  researchedTechs: overrides.researchedTechs ?? [],
  researchProgress: overrides.researchProgress ?? 0,
  citiesOwned: overrides.citiesOwned ?? [],
  constructionQueue: overrides.constructionQueue ?? [],
  visibilityMask: overrides.visibilityMask ?? [],
  exploredTiles: overrides.exploredTiles ?? [],
  isEliminated: overrides.isEliminated ?? false,
  turnOrder: overrides.turnOrder ?? 0,
});

const makeUnit = (id: string, playerId: string): Unit => ({
  id,
  type: 'warrior',
  playerId,
  coordinate: { q: 0, r: 0, s: 0 },
  hp: 10,
  maxHp: 10,
  attack: 5,
  defense: 3,
  movement: 2,
  remainingMovement: 2,
  status: 'active',
  abilities: [],
  level: 1,
  experience: 0,
  visionRadius: 2,
  attackRange: 1,
  hasAttacked: false,
});

const makeGameState = (overrides: Partial<GameState> = {}): GameState => {
  const players = overrides.players ?? [
    makePlayer({ id: 'winner', name: 'Winner', citiesOwned: ['city-1'], turnOrder: 0 }),
    makePlayer({ id: 'rival', name: 'Rival', factionId: 'LAMANITES', citiesOwned: ['city-2'], turnOrder: 1 }),
  ];

  return {
    id: 'victory-presentation-test',
    rngSeed: 1,
    players,
    currentPlayerIndex: 0,
    turn: 12,
    phase: 'ended',
    map: { width: 4, height: 4, tiles: [] },
    units: [
      makeUnit('winner-warrior-1', 'winner'),
      makeUnit('winner-warrior-2', 'winner'),
      makeUnit('rival-warrior-1', 'rival'),
    ],
    cities: [],
    improvements: [],
    structures: [],
    winner: 'winner',
    victoryType: 'elimination',
    ...overrides,
  };
};

describe('victory presentation unit metrics', () => {
  it('counts each player units in final rankings', () => {
    const rankings = getRankedPlayers(makeGameState(), 'winner');

    expect(rankings.find((entry) => entry.player.id === 'winner')?.unitsRemaining).toBe(2);
    expect(rankings.find((entry) => entry.player.id === 'rival')?.unitsRemaining).toBe(1);
  });

  it('reports winner units in final stats', () => {
    const stats = getFinalStats(makeGameState(), 'winner');

    expect(stats.find((entry) => entry.label === 'Units Remaining')?.value).toBe('2');
  });

  it('uses winner units for the elimination forces metric', () => {
    const cards = getVictoryMetricCards(makeGameState(), 'winner', 'elimination');

    expect(cards.find((card) => card.key === 'forces')?.value).toBe('2');
  });
});
