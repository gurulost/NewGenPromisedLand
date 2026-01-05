import { describe, it, expect } from 'vitest';

import { AIEngine } from '../../shared/ai/aiEngine';
import type { GameState, PlayerState } from '../../shared/types/game';
import type { Unit } from '../../shared/types/unit';

const makeTile = (
  q: number,
  r: number,
  terrain: GameState['map']['tiles'][number]['terrain'],
  exploredBy: string[] = ['1'],
  extra?: Partial<GameState['map']['tiles'][number]>
) => ({
  coordinate: { q, r, s: -q - r },
  terrain,
  resources: [],
  hasCity: false,
  exploredBy,
  ...extra,
});

const createBaseAIPlayer = (overrides: Partial<PlayerState> = {}): PlayerState => ({
  id: '1',
  name: 'AI',
  factionId: 'NEPHITES',
  isAI: true,
  aiDifficulty: 'normal',
  stars: 30,
  stats: { faith: 60, pride: 30, internalDissent: 10 },
  modifiers: [],
  abilityCooldowns: {},
  researchedTechs: [],
  researchInspiration: 0,
  citiesOwned: ['city1'],
  constructionQueue: [],
  visibilityMask: [],
  exploredTiles: ['0,0', '1,0', '0,1', '1,-1'],
  isEliminated: false,
  turnOrder: 0,
  ...overrides,
});

const createGameState = (players: PlayerState[], units: Unit[], tiles: ReturnType<typeof makeTile>[], cities: GameState['cities']) : GameState => ({
  id: 'game',
  players,
  units,
  currentPlayerIndex: 0,
  turn: 1,
  phase: 'playing',
  map: {
    width: 6,
    height: 6,
    tiles,
  },
  cities,
  improvements: [],
  structures: [],
  lastAction: undefined,
  winner: undefined,
});

describe('AIEngine strategic planner', () => {
  it('adds improvement and unit entries to city plans', () => {
    const aiPlayer = createBaseAIPlayer({ researchedTechs: ['organization'], stars: 15 });
    const warrior: Unit = {
      id: 'u1',
      type: 'warrior',
      playerId: '1',
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
    };

    const tiles = [
      makeTile(0, 0, 'plains', ['1'], { hasCity: true, cityOwner: '1' }),
      makeTile(1, -1, 'plains'),
      makeTile(0, 1, 'plains'),
    ];

    const cities: GameState['cities'] = [
      {
        id: 'city1',
        name: 'Capital',
        coordinate: { q: 0, r: 0, s: 0 },
        ownerId: '1',
        population: 2,
        maxPopulation: 4,
        level: 1,
        starProduction: 2,
        improvements: [],
        structures: [],
      },
    ];

    const state = createGameState([aiPlayer], [warrior], tiles, cities);
    const engine = new AIEngine(state, aiPlayer);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - accessing internal method for test insight
    engine.recalculateStrategy();
    const strategy = (engine as unknown as { strategy: any }).strategy;
    const cityPlans = strategy.cityPlans.city1 as Array<{ category: string; optionId: string }>;

    expect(cityPlans).toBeDefined();
    expect(cityPlans.some(plan => plan.category === 'improvements')).toBe(true);
    expect(cityPlans.some(plan => plan.category === 'units')).toBe(true);
  });
});

describe('AIEngine ability usage', () => {
  it('selects heal ability when missionaries have injured allies nearby', () => {
    const aiPlayer = createBaseAIPlayer({ stats: { faith: 20, pride: 10, internalDissent: 10 }, stars: 0 });
    const missionary: Unit = {
      id: 'm1',
      type: 'missionary',
      playerId: '1',
      coordinate: { q: 0, r: 0, s: 0 },
      hp: 18,
      maxHp: 18,
      attack: 1,
      defense: 2,
      movement: 3,
      remainingMovement: 3,
      visionRadius: 2,
      attackRange: 1,
      status: 'active',
      experience: 0,
      abilities: ['heal', 'convert'],
      level: 1,
      temporaryEffects: [],
    };
    const woundedAlly: Unit = {
      ...missionary,
      id: 'ally',
      type: 'warrior',
      hp: 10,
      maxHp: 25,
      attack: 6,
      defense: 4,
      movement: 3,
      remainingMovement: 3,
      abilities: [],
      coordinate: { q: 1, r: -1, s: 0 },
    };

    const tiles = [
      makeTile(0, 0, 'plains', ['1'], { hasCity: true, cityOwner: '1' }),
      makeTile(1, -1, 'plains'),
    ];
    const cities: GameState['cities'] = [
      {
        id: 'city1',
        name: 'Capital',
        coordinate: { q: 0, r: 0, s: 0 },
        ownerId: '1',
        population: 2,
        maxPopulation: 4,
        level: 1,
        starProduction: 2,
        improvements: [],
        structures: [],
      },
    ];

    const state = createGameState([aiPlayer], [missionary, woundedAlly], tiles, cities);
    const engine = new AIEngine(state, aiPlayer);

    const decisions = engine.makeDecision();
    expect(decisions.some(decision => decision.type === 'HEAL_UNIT' && decision.unitId === 'm1')).toBe(true);
  });

  it('prepares catapult siege mode when enemies are in range', () => {
    const aiPlayer = createBaseAIPlayer({ stars: 0, exploredTiles: ['0,0', '1,-1', '2,-2'] });
    const enemyPlayer: PlayerState = {
      ...createBaseAIPlayer({ id: '2', name: 'Enemy', factionId: 'LAMANITES', stars: 10 }),
      isAI: false,
      aiDifficulty: undefined,
      citiesOwned: ['enemyCity'],
      turnOrder: 1,
    };

    const catapult: Unit = {
      id: 'c1',
      type: 'catapult',
      playerId: '1',
      coordinate: { q: 0, r: 0, s: 0 },
      hp: 12,
      maxHp: 12,
      attack: 15,
      defense: 2,
      movement: 1,
      remainingMovement: 1,
      maxActions: 1,
      actionsRemaining: 1,
      visionRadius: 2,
      attackRange: 3,
      status: 'active',
      experience: 0,
      abilities: ['siege'],
      level: 1,
      temporaryEffects: [],
    };

    const enemyCityTile = makeTile(2, -2, 'plains', ['2'], { hasCity: true, cityOwner: '2' });
    const tiles = [
      makeTile(0, 0, 'plains', ['1'], { hasCity: true, cityOwner: '1' }),
      enemyCityTile,
    ];

    const cities: GameState['cities'] = [
      {
        id: 'city1',
        name: 'Capital',
        coordinate: { q: 0, r: 0, s: 0 },
        ownerId: '1',
        population: 2,
        maxPopulation: 4,
        level: 1,
        starProduction: 2,
        improvements: [],
        structures: [],
      },
      {
        id: 'enemyCity',
        name: 'Enemy Stronghold',
        coordinate: enemyCityTile.coordinate,
        ownerId: '2',
        population: 2,
        maxPopulation: 4,
        level: 1,
        starProduction: 2,
        improvements: [],
        structures: [],
      },
    ];

    const state = createGameState([aiPlayer, enemyPlayer], [catapult], tiles, cities);
    const engine = new AIEngine(state, aiPlayer);

    const decisions = engine.makeDecision();
    expect(decisions.some(decision => decision.type === 'SIEGE_MODE' && decision.unitId === 'c1')).toBe(true);
  });
});

describe('AIEngine automation loops', () => {
  it('assigns worker jobs to build improvements', () => {
    const aiPlayer = createBaseAIPlayer({
      stars: 40,
      researchedTechs: ['organization'],
      exploredTiles: ['0,0', '1,-1'],
    });

    const worker: Unit = {
      id: 'worker1',
      type: 'worker',
      playerId: '1',
      coordinate: { q: 0, r: 0, s: 0 },
      hp: 10,
      maxHp: 10,
      attack: 1,
      defense: 1,
      movement: 2,
      remainingMovement: 2,
      visionRadius: 2,
      attackRange: 1,
      status: 'active',
      experience: 0,
      abilities: ['BUILD'],
      level: 1,
      temporaryEffects: [],
    };

    const tiles = [
      makeTile(0, 0, 'plains', ['1'], { hasCity: true, cityOwner: '1' }),
      makeTile(1, -1, 'plains', ['1']),
    ];

    const cities: GameState['cities'] = [
      {
        id: 'city1',
        name: 'Capital',
        coordinate: { q: 0, r: 0, s: 0 },
        ownerId: '1',
        population: 2,
        maxPopulation: 4,
        level: 1,
        starProduction: 2,
        improvements: [],
        structures: [],
      },
    ];

    const state = createGameState([aiPlayer], [worker], tiles, cities);
    const engine = new AIEngine(state, aiPlayer);

    const decisions = engine.makeDecision();
    const moveDecision = decisions.find(decision => decision.type === 'MOVE_UNIT' && decision.unitId === 'worker1');
    expect(moveDecision).toBeDefined();
    expect(moveDecision?.targetCoordinate).toMatchObject({ q: 1, r: -1 });
  });

  it('directs scouts toward unexplored tiles', () => {
    const aiPlayer = createBaseAIPlayer({
      stars: 10,
      exploredTiles: ['0,0'],
    });

    const scout: Unit = {
      id: 'scout1',
      type: 'scout',
      playerId: '1',
      coordinate: { q: 0, r: 0, s: 0 },
      hp: 12,
      maxHp: 12,
      attack: 3,
      defense: 2,
      movement: 5,
      remainingMovement: 5,
      visionRadius: 4,
      attackRange: 1,
      status: 'active',
      experience: 0,
      abilities: ['STEALTH', 'RECONNAISSANCE'],
      level: 1,
      temporaryEffects: [],
    };

    const tiles = [
      makeTile(0, 0, 'plains', ['1'], { hasCity: true, cityOwner: '1' }),
      makeTile(1, -1, 'plains', []),
      makeTile(2, -2, 'plains', []),
    ];

    const cities: GameState['cities'] = [
      {
        id: 'city1',
        name: 'Capital',
        coordinate: { q: 0, r: 0, s: 0 },
        ownerId: '1',
        population: 2,
        maxPopulation: 4,
        level: 1,
        starProduction: 2,
        improvements: [],
        structures: [],
      },
    ];

    const state = createGameState([aiPlayer], [scout], tiles, cities);
    const engine = new AIEngine(state, aiPlayer);

    const decisions = engine.makeDecision();
    const moveDecision = decisions.find(decision => decision.type === 'MOVE_UNIT' && decision.unitId === 'scout1');
    expect(moveDecision).toBeDefined();
  });
});
