import { describe, expect, it } from 'vitest';

import { resolveActionState } from '../../shared/logic/resolveAction';
import type { GameState, PlayerState } from '../../shared/types/game';

const makePlayer = (id: string, cityId: string, turnOrder: number, overrides: Partial<PlayerState> = {}): PlayerState => ({
  id,
  name: id,
  factionId: id === 'p1' ? 'NEPHITES' : 'LAMANITES',
  isEliminated: false,
  stats: { faith: 0, pride: 0, internalDissent: 0 },
  stars: 20,
  researchedTechs: [],
  researchProgress: 0,
  researchInspiration: 0,
  abilityCooldowns: {},
  citiesOwned: [cityId],
  constructionQueue: [],
  visibilityMask: [],
  exploredTiles: [],
  turnOrder,
  atWarWith: [],
  alliedWith: [],
  tradeRoutes: [],
  diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
  modifiers: [],
  ...overrides,
});

const makeState = (overrides: Partial<GameState> = {}): GameState => ({
  id: 'economy-turn-flow',
  rngSeed: 0,
  currentPlayerIndex: 0,
  turn: 1,
  phase: 'playing',
  map: {
    width: 3,
    height: 3,
    tiles: [
      { coordinate: { q: 0, r: 0, s: 0 }, terrain: 'plains', resources: [], hasCity: true, cityOwner: 'p1', exploredBy: ['p1'] },
      { coordinate: { q: 2, r: 0, s: -2 }, terrain: 'plains', resources: [], hasCity: true, cityOwner: 'p2', exploredBy: ['p2'] },
    ],
  },
  players: [makePlayer('p1', 'c1', 0), makePlayer('p2', 'c2', 1)],
  units: [],
  cities: [
    {
      id: 'c1',
      name: 'Zarahemla',
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
      id: 'c2',
      name: 'Nephi',
      coordinate: { q: 2, r: 0, s: -2 },
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
  activeEffects: [],
  winner: undefined,
  victoryType: undefined,
  lastAction: undefined,
  ...overrides,
});

describe('economy turn flow', () => {
  it('applies structure population growth once on construction completion and not every owner end turn', () => {
    const state = makeState({
      players: [
        makePlayer('p1', 'c1', 0, {
          researchedTechs: ['spirituality'],
          constructionQueue: [
            {
              id: 'temple-queued',
              type: 'temple',
              category: 'structures',
              coordinate: { q: 0, r: 0, s: 0 },
              cityId: 'c1',
              playerId: 'p1',
              turnsRemaining: 1,
              totalTurns: 1,
              cost: { stars: 8, faith: 0, pride: 0 },
            },
          ],
        }),
        makePlayer('p2', 'c2', 1),
      ],
    });

    const afterCompletion = resolveActionState(state, { type: 'END_TURN', payload: { playerId: 'p1' } });
    expect(afterCompletion.cities.find(city => city.id === 'c1')?.population).toBe(2);
    expect(afterCompletion.structures).toEqual([
      expect.objectContaining({ id: 'temple-queued', type: 'temple', cityId: 'c1', ownerId: 'p1' }),
    ]);

    const afterP2 = resolveActionState(afterCompletion, { type: 'END_TURN', payload: { playerId: 'p2' } });
    const afterNextP1Turn = resolveActionState(afterP2, { type: 'END_TURN', payload: { playerId: 'p1' } });

    expect(afterNextP1Turn.cities.find(city => city.id === 'c1')?.population).toBe(2);
  });
});
