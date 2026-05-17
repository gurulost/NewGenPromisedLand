import { describe, it, expect } from 'vitest';

import { AIEngine } from '../../shared/ai/aiEngine';
import { simulateAITurns } from '../../shared/ai/aiHarness';
import { TacticalEngine } from '../../shared/ai/aiTacticalEngine';
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
    const buildDecision = decisions.find(decision =>
      decision.type === 'START_CONSTRUCTION' &&
      decision.unitId === 'worker1' &&
      decision.targetCoordinate?.q === 1 &&
      decision.targetCoordinate?.r === -1
    );
    expect(buildDecision).toMatchObject({
      builderUnitId: 'worker1',
      constructionCategory: 'improvements',
    });
  });

  it('includes the builder unit when a worker builds on its own tile', () => {
    const aiPlayer = createBaseAIPlayer({
      stars: 40,
      researchedTechs: ['organization'],
      exploredTiles: ['0,0', '1,-1'],
      visibilityMask: ['0,0', '1,-1'],
    });

    const worker: Unit = {
      id: 'worker_build',
      type: 'worker',
      playerId: '1',
      coordinate: { q: 1, r: -1, s: 0 },
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
    const decisions = new AIEngine(state, aiPlayer).makeDecision();
    const buildDecision = decisions.find(decision =>
      decision.type === 'START_CONSTRUCTION' &&
      decision.unitId === 'worker_build' &&
      decision.targetCoordinate?.q === 1 &&
      decision.targetCoordinate?.r === -1
    );

    expect(buildDecision).toMatchObject({
      builderUnitId: 'worker_build',
      constructionCategory: 'improvements',
    });

    const result = simulateAITurns(state, 1);
    expect(result.actionsApplied).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it('does not emit a worker build decision when the nearby worker has no action remaining', () => {
    const aiPlayer = createBaseAIPlayer({
      stars: 40,
      researchedTechs: ['organization'],
      exploredTiles: ['0,0', '1,-1'],
      visibilityMask: ['0,0', '1,-1'],
    });

    const worker: Unit = {
      id: 'spent_worker',
      type: 'worker',
      playerId: '1',
      coordinate: { q: 1, r: -1, s: 0 },
      hp: 10,
      maxHp: 10,
      attack: 1,
      defense: 1,
      movement: 2,
      remainingMovement: 2,
      maxActions: 1,
      actionsRemaining: 0,
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
    const decisions = new AIEngine(state, aiPlayer).makeDecision();

    expect(decisions.some(decision =>
      decision.type === 'START_CONSTRUCTION' &&
      decision.unitId === 'spent_worker'
    )).toBe(false);
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

describe('AI tactical visibility', () => {
  it('does not target hidden enemy units or unexplored enemy cities', () => {
    const aiPlayer = createBaseAIPlayer({
      atWarWith: ['2'],
      exploredTiles: ['0,0'],
      visibilityMask: ['0,0'],
    });
    const enemyPlayer: PlayerState = {
      ...createBaseAIPlayer({ id: '2', name: 'Enemy', factionId: 'LAMANITES' }),
      isAI: false,
      aiDifficulty: undefined,
      atWarWith: ['1'],
      citiesOwned: ['enemyCity'],
      turnOrder: 1,
    };

    const warrior: Unit = {
      id: 'warrior_visible',
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
    const hiddenEnemy: Unit = {
      ...warrior,
      id: 'hidden_enemy',
      playerId: '2',
      coordinate: { q: 1, r: -1, s: 0 },
    };

    const tiles = [
      makeTile(0, 0, 'plains', ['1'], { hasCity: true, cityOwner: '1' }),
      makeTile(1, -1, 'plains', []),
      makeTile(2, -2, 'plains', ['2'], { hasCity: true, cityOwner: '2' }),
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
        name: 'Hidden City',
        coordinate: { q: 2, r: -2, s: 0 },
        ownerId: '2',
        population: 2,
        maxPopulation: 4,
        level: 1,
        starProduction: 2,
        improvements: [],
        structures: [],
      },
    ];

    const state = createGameState([aiPlayer, enemyPlayer], [warrior, hiddenEnemy], tiles, cities);
    const targets = new TacticalEngine(state, aiPlayer, 7).findTacticalTargets(warrior);

    expect(targets.some(target => target.unitId === 'hidden_enemy')).toBe(false);
    expect(targets.some(target => target.cityId === 'enemyCity')).toBe(false);
  });

  it('moves toward explored tactical city targets', () => {
    const aiPlayer = createBaseAIPlayer({
      stars: 0,
      atWarWith: ['2'],
      exploredTiles: ['0,0', '1,-1', '2,-2'],
      visibilityMask: ['0,0', '1,-1'],
    });
    const enemyPlayer: PlayerState = {
      ...createBaseAIPlayer({ id: '2', name: 'Enemy', factionId: 'LAMANITES' }),
      isAI: false,
      aiDifficulty: undefined,
      atWarWith: ['1'],
      citiesOwned: ['enemyCity'],
      turnOrder: 1,
    };

    const warrior: Unit = {
      id: 'city_hunter',
      type: 'warrior',
      playerId: '1',
      coordinate: { q: 0, r: 0, s: 0 },
      hp: 25,
      maxHp: 25,
      attack: 6,
      defense: 4,
      movement: 1,
      remainingMovement: 1,
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
      makeTile(1, -1, 'plains', ['1']),
      makeTile(2, -2, 'plains', ['1'], { hasCity: true, cityOwner: '2' }),
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
        name: 'Outpost',
        coordinate: { q: 2, r: -2, s: 0 },
        ownerId: '2',
        population: 2,
        maxPopulation: 4,
        level: 1,
        starProduction: 2,
        improvements: [],
        structures: [],
      },
    ];

    const state = createGameState([aiPlayer, enemyPlayer], [warrior], tiles, cities);
    const decisions = new AIEngine(state, aiPlayer).makeDecision();

    expect(decisions.some(decision =>
      decision.type === 'MOVE_UNIT' &&
      decision.unitId === 'city_hunter' &&
      decision.targetCoordinate?.q === 1 &&
      decision.targetCoordinate?.r === -1
    )).toBe(true);
  });
});

describe('AIEngine objective actions', () => {
  it('captures adjacent enemy cities', () => {
    const aiPlayer = createBaseAIPlayer({
      atWarWith: ['2'],
      exploredTiles: ['0,0', '1,-1'],
      visibilityMask: ['1,-1'],
    });
    const enemyPlayer: PlayerState = {
      ...createBaseAIPlayer({ id: '2', name: 'Enemy', factionId: 'LAMANITES' }),
      isAI: false,
      aiDifficulty: undefined,
      atWarWith: ['1'],
      citiesOwned: ['enemyCity'],
      turnOrder: 1,
    };

    const warrior: Unit = {
      id: 'w1',
      type: 'warrior',
      playerId: '1',
      coordinate: { q: 0, r: 0, s: 0 },
      hp: 25,
      maxHp: 25,
      attack: 6,
      defense: 4,
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
      temporaryEffects: [],
    };

    const tiles = [
      makeTile(0, 0, 'plains', ['1'], { hasCity: true, cityOwner: '1' }),
      makeTile(1, -1, 'plains', ['1'], { hasCity: true, cityOwner: '2' }),
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
        name: 'Outpost',
        coordinate: { q: 1, r: -1, s: 0 },
        ownerId: '2',
        population: 2,
        maxPopulation: 4,
        level: 1,
        starProduction: 2,
        improvements: [],
        structures: [],
      },
    ];

    const state = createGameState([aiPlayer, enemyPlayer], [warrior], tiles, cities);
    const decisions = new AIEngine(state, aiPlayer).makeDecision();

    expect(decisions.some(decision => decision.type === 'CAPTURE_CITY' && decision.cityId === 'enemyCity')).toBe(true);
  });

  it('conquers villages when conversion is unavailable', () => {
    const aiPlayer = createBaseAIPlayer({
      stars: 5,
      stats: { faith: 0, pride: 10, internalDissent: 5 },
      exploredTiles: ['0,0', '2,-2'],
    });

    const warrior: Unit = {
      id: 'v1',
      type: 'warrior',
      playerId: '1',
      coordinate: { q: 0, r: 0, s: 0 },
      hp: 25,
      maxHp: 25,
      attack: 6,
      defense: 4,
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
      temporaryEffects: [],
    };

    const tiles = [
      makeTile(0, 0, 'plains', ['1'], { feature: 'village' }),
      makeTile(2, -2, 'plains', ['1'], { hasCity: true, cityOwner: '1' }),
    ];

    const cities: GameState['cities'] = [
      {
        id: 'city1',
        name: 'Capital',
        coordinate: { q: 2, r: -2, s: 0 },
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
    const decisions = new AIEngine(state, aiPlayer).makeDecision();

    expect(decisions.some(decision => decision.type === 'CONQUER_VILLAGE' && decision.unitId === 'v1')).toBe(true);
  });

  it('explores adjacent ruin features', () => {
    const aiPlayer = createBaseAIPlayer({
      exploredTiles: ['0,0', '1,-1'],
    });

    const scout: Unit = {
      id: 'scout_ruin',
      type: 'scout',
      playerId: '1',
      coordinate: { q: 0, r: 0, s: 0 },
      hp: 12,
      maxHp: 12,
      attack: 3,
      defense: 2,
      movement: 5,
      remainingMovement: 5,
      maxActions: 1,
      actionsRemaining: 1,
      visionRadius: 4,
      attackRange: 1,
      status: 'active',
      experience: 0,
      abilities: ['RECONNAISSANCE'],
      level: 1,
      temporaryEffects: [],
    };

    const tiles = [
      makeTile(0, 0, 'plains', ['1'], { hasCity: true, cityOwner: '1' }),
      makeTile(1, -1, 'plains', ['1'], { feature: 'ruin' }),
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
    const decisions = new AIEngine(state, aiPlayer).makeDecision();

    expect(decisions.some(decision =>
      decision.type === 'EXPLORE_RUINS' &&
      decision.unitId === 'scout_ruin' &&
      decision.targetCoordinate?.q === 1 &&
      decision.targetCoordinate?.r === -1
    )).toBe(true);
  });

  it('harvests world elements when standing on a profitable tile', () => {
    const aiPlayer = createBaseAIPlayer({
      stars: 0,
      researchedTechs: ['agriculture'],
      exploredTiles: ['0,0', '2,-2'],
    });

    const worker: Unit = {
      id: 'worker_harvest',
      type: 'worker',
      playerId: '1',
      coordinate: { q: 0, r: 0, s: 0 },
      hp: 10,
      maxHp: 10,
      attack: 1,
      defense: 1,
      movement: 2,
      remainingMovement: 2,
      maxActions: 1,
      actionsRemaining: 1,
      visionRadius: 2,
      attackRange: 1,
      status: 'active',
      experience: 0,
      abilities: ['BUILD'],
      level: 1,
      temporaryEffects: [],
    };

    const tiles = [
      makeTile(0, 0, 'plains', ['1'], { resources: ['grain_patch'] }),
      makeTile(2, -2, 'plains', ['1'], { hasCity: true, cityOwner: '1' }),
    ];

    const cities: GameState['cities'] = [
      {
        id: 'city1',
        name: 'Capital',
        coordinate: { q: 2, r: -2, s: 0 },
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
    const decisions = new AIEngine(state, aiPlayer).makeDecision();

    expect(decisions.some(decision =>
      decision.type === 'WORLD_ELEMENT_HARVEST' &&
      decision.unitId === 'worker_harvest' &&
      decision.elementId === 'grain_patch'
    )).toBe(true);
  });

  it('stays deterministic for easy AI with non-numeric player ids', () => {
    const aiPlayer = createBaseAIPlayer({
      id: 'ai-alpha',
      aiDifficulty: 'easy',
      stars: 20,
      exploredTiles: ['0,0', '1,-1'],
      citiesOwned: ['city1'],
    });

    const tiles = [
      makeTile(0, 0, 'plains', ['ai-alpha'], { hasCity: true, cityOwner: 'ai-alpha' }),
      makeTile(1, -1, 'plains', ['ai-alpha']),
    ];

    const cities: GameState['cities'] = [
      {
        id: 'city1',
        name: 'Capital',
        coordinate: { q: 0, r: 0, s: 0 },
        ownerId: 'ai-alpha',
        population: 2,
        maxPopulation: 4,
        level: 1,
        starProduction: 2,
        improvements: [],
        structures: [],
      },
    ];

    const state = createGameState([aiPlayer], [], tiles, cities);
    const firstPass = new AIEngine(state, aiPlayer).makeDecision();
    const secondPass = new AIEngine(state, aiPlayer).makeDecision();

    expect(firstPass.length).toBeGreaterThan(0);
    expect(secondPass).toEqual(firstPass);
  });
});

describe('AI turn execution replanning', () => {
  it('executes direct unit ability decisions in the harness', () => {
    const aiPlayer = createBaseAIPlayer({
      stars: 0,
      exploredTiles: ['0,0', '2,-2'],
      visibilityMask: ['0,0', '2,-2'],
    });
    const enemyPlayer: PlayerState = {
      ...createBaseAIPlayer({ id: '2', name: 'Enemy', factionId: 'LAMANITES' }),
      isAI: false,
      aiDifficulty: undefined,
      citiesOwned: ['enemyCity'],
      turnOrder: 1,
    };

    const catapult: Unit = {
      id: 'siege_harness',
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

    const tiles = [
      makeTile(0, 0, 'plains', ['1'], { hasCity: true, cityOwner: '1' }),
      makeTile(2, -2, 'plains', ['1'], { hasCity: true, cityOwner: '2' }),
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
        coordinate: { q: 2, r: -2, s: 0 },
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
    const result = simulateAITurns(state, 1);
    const finalCatapult = result.finalState.units.find(unit => unit.id === 'siege_harness');

    expect(result.errors).toHaveLength(0);
    expect(result.actionsApplied).toBeGreaterThan(0);
    expect(finalCatapult?.status).toBe('siege_mode');
  });

  it('moves onto nearby ruins and re-plans to harvest them in the same turn', () => {
    const aiPlayer = createBaseAIPlayer({
      stars: 0,
      aiDifficulty: 'hard',
      exploredTiles: ['0,0', '1,-1'],
      visibilityMask: ['1,-1'],
    });

    const scout: Unit = {
      id: 'scout_replan',
      type: 'scout',
      playerId: '1',
      coordinate: { q: 0, r: 0, s: 0 },
      hp: 12,
      maxHp: 12,
      attack: 3,
      defense: 2,
      movement: 1,
      remainingMovement: 1,
      maxActions: 1,
      actionsRemaining: 1,
      visionRadius: 4,
      attackRange: 1,
      status: 'active',
      experience: 0,
      abilities: ['RECONNAISSANCE'],
      level: 1,
      temporaryEffects: [],
    };

    const tiles = [
      makeTile(0, 0, 'plains', ['1'], { hasCity: true, cityOwner: '1' }),
      makeTile(1, -1, 'plains', ['1'], { resources: ['jaredite_ruins'] }),
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
    const result = simulateAITurns(state, 1);
    const ruinTile = result.finalState.map.tiles.find(tile => tile.coordinate.q === 1 && tile.coordinate.r === -1);

    expect(ruinTile?.resources).not.toContain('jaredite_ruins');
    expect(result.actionsApplied).toBeGreaterThanOrEqual(2);
    expect(result.errors).toHaveLength(0);
  });
});
