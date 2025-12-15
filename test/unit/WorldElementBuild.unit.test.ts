import { describe, it, expect } from 'vitest';

import { executeElementBuild } from '../../shared/logic/worldElementActions';
import type { GameState, PlayerState } from '../../shared/types/game';
import type { City } from '../../shared/types/city';

const basePlayer = (overrides: Partial<PlayerState> = {}): PlayerState => ({
  id: 'player1',
  name: 'Builder',
  factionId: 'NEPHITES',
  isAI: false,
  stars: 20,
  stats: { faith: 10, pride: 0, internalDissent: 0 },
  modifiers: [],
  abilityCooldowns: {},
  researchedTechs: [],
  researchInspiration: 0,
  citiesOwned: ['city1'],
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

const baseCity: City = {
  id: 'city1',
  name: 'Capital',
  coordinate: { q: 0, r: 0, s: 0 },
  ownerId: 'player1',
  population: 1,
  maxPopulation: 4,
  level: 1,
  starProduction: 2,
  improvements: [],
  structures: [],
  unrestTurns: 0,
  harvestedResources: [],
};

const baseState = (overrides: Partial<GameState> = {}): GameState => ({
  id: 'world-build-test',
  players: [basePlayer()],
  currentPlayerIndex: 0,
  turn: 1,
  phase: 'playing',
  map: {
    width: 3,
    height: 3,
    tiles: [
      { coordinate: { q: 0, r: 0, s: 0 }, terrain: 'plains', resources: [], hasCity: true, cityOwner: 'player1', exploredBy: ['player1'] },
      { coordinate: { q: 1, r: 0, s: -1 }, terrain: 'water', resources: ['fishing_shoal'], hasCity: false, exploredBy: ['player1'] },
      { coordinate: { q: -1, r: 0, s: 1 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: ['player1'] },
    ],
  },
  units: [],
  cities: [baseCity],
  improvements: [],
  structures: [],
  ...overrides,
});

describe('executeElementBuild integration', () => {
  it('applies Fishing Jetty pop to nearest city and gates Harbor upgrade behind Trade', () => {
    const state = baseState({
      players: [basePlayer({ researchedTechs: ['fishing'], stars: 20 })],
    });

    const built = executeElementBuild(state, 'player1', 'fishing_shoal', { q: 1, r: 0, s: -1 });
    expect(built.success).toBe(true);
    expect(built.newState?.cities?.[0].population).toBe(2);
    expect(built.newState?.cities?.[0].starProduction).toBe(2);
    const tileAfter = built.newState?.map.tiles.find(t => t.coordinate.q === 1 && t.coordinate.r === 0);
    expect(tileAfter?.resources?.some(r => String(r).startsWith('we:fishing_shoal:'))).toBe(true);

    const upgradedAttempt = executeElementBuild(built.newState!, 'player1', 'fishing_shoal', { q: 1, r: 0, s: -1 });
    expect(upgradedAttempt.success).toBe(false);

    const upgradedState = {
      ...built.newState!,
      players: built.newState!.players.map(p =>
        p.id === 'player1' ? { ...p, researchedTechs: [...p.researchedTechs, 'trade'] } : p
      ),
    } as GameState;

    const upgraded = executeElementBuild(upgradedState, 'player1', 'fishing_shoal', { q: 1, r: 0, s: -1 });
    expect(upgraded.success).toBe(true);
    expect(upgraded.newState?.cities?.[0].starProduction).toBe(4);
  });

  it('builds Corral effects for Husbandry world elements', () => {
    const state = baseState({
      map: {
        width: 3,
        height: 3,
        tiles: [
          { coordinate: { q: 0, r: 0, s: 0 }, terrain: 'plains', resources: [], hasCity: true, cityOwner: 'player1', exploredBy: ['player1'] },
          { coordinate: { q: -1, r: 0, s: 1 }, terrain: 'plains', resources: ['wild_goats'], hasCity: false, exploredBy: ['player1'] },
        ],
      },
      players: [basePlayer({ researchedTechs: ['husbandry'], stars: 20, stats: { faith: 10, pride: 0, internalDissent: 0 } })],
    });

    const built = executeElementBuild(state, 'player1', 'wild_goats', { q: -1, r: 0, s: 1 });
    expect(built.success).toBe(true);
    expect(built.newState?.cities?.[0].population).toBe(2);
    expect(built.newState?.cities?.[0].starProduction).toBe(3);
    expect(built.newState?.players?.[0].stats.faith).toBe(11);
  });
});
