import { describe, it, expect } from 'vitest';

import { getUnitAbilityStates } from '../../client/src/utils/unitAbilityState';
import type { GameState, PlayerState } from '../../shared/types/game';
import type { Unit } from '../../shared/types/unit';

const createPlayer = (overrides: Partial<PlayerState> = {}): PlayerState => ({
  id: 'player1',
  name: 'Player One',
  factionId: 'NEPHITES',
  isAI: false,
  aiDifficulty: undefined,
  stars: 10,
  stats: { faith: 50, pride: 20, internalDissent: 10 },
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
  ...overrides,
});

const createUnit = (overrides: Partial<Unit> = {}): Unit => ({
  id: 'unit1',
  type: 'missionary',
  playerId: 'player1',
  coordinate: { q: 0, r: 0, s: 0 },
  hp: 20,
  maxHp: 20,
  attack: 2,
  defense: 1,
  movement: 3,
  remainingMovement: 3,
  visionRadius: 2,
  attackRange: 1,
  status: 'active',
  experience: 0,
  abilities: ['heal', 'convert'],
  level: 1,
  temporaryEffects: [],
  hasAttacked: false,
  ...overrides,
});

const createState = (players: PlayerState[], units: Unit[]): GameState => ({
  id: 'ability-test',
  players,
  units,
  currentPlayerIndex: 0,
  turn: 1,
  phase: 'playing',
  map: {
    width: 3,
    height: 3,
    tiles: [
      { coordinate: { q: 0, r: 0, s: 0 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: ['player1'] },
      { coordinate: { q: 1, r: 0, s: -1 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: ['player1'] },
    ],
  },
  cities: [],
  improvements: [],
  structures: [],
  lastAction: undefined,
  winner: undefined,
});

describe('getUnitAbilityStates', () => {
  it('marks missionary abilities ready with sufficient faith and tech', () => {
    const missionary = createUnit();
    const player = createPlayer({
      stats: { faith: 30, pride: 10, internalDissent: 5 },
      researchedTechs: ['spirituality'],
    });
    const state = createState([player], [missionary]);

    const abilityStates = getUnitAbilityStates(missionary, player, state);
    const heal = abilityStates.find(state => state.abilityId === 'HEAL');
    const convert = abilityStates.find(state => state.abilityId === 'CONVERT');

    expect(heal?.status).toBe('ready');
    expect(convert?.status).toBe('ready');
  });

  it('locks missionary heal without spirituality tech', () => {
    const missionary = createUnit();
    const player = createPlayer({
      stats: { faith: 30, pride: 10, internalDissent: 5 },
      researchedTechs: [],
    });
    const state = createState([player], [missionary]);

    const abilityStates = getUnitAbilityStates(missionary, player, state);
    const heal = abilityStates.find(state => state.abilityId === 'HEAL');

    expect(heal?.status).toBe('locked');
    expect(heal?.reason).toMatch(/Requires Spirituality/i);
  });

  it('locks convert when no adjacent enemy is present', () => {
    const missionary = createUnit();
    const player = createPlayer({
      stats: { faith: 50, pride: 10, internalDissent: 5 },
      researchedTechs: ['spirituality'],
    });
    const state = createState([player], [missionary]);

    const abilityStates = getUnitAbilityStates(missionary, player, state);
    const convert = abilityStates.find(state => state.abilityId === 'CONVERT');

    expect(convert?.status).toBe('locked');
    expect(convert?.reason).toMatch(/No adjacent enemy/i);
  });

  it('shows catapult bombardment locked until siege mode is active', () => {
    const catapult = createUnit({
      id: 'catapult',
      type: 'catapult',
      abilities: ['bombardment'],
      status: 'active',
    });
    const player = createPlayer({ id: 'player1' });
    const state = createState([player], [catapult]);

    const abilityStates = getUnitAbilityStates(catapult, player, state);
    const bombardment = abilityStates.find(state => state.abilityId === 'BOMBARDMENT');

    expect(bombardment?.status).toBe('locked');
    expect(bombardment?.reason).toMatch(/Deploy siege mode/i);
  });

  it('marks catapult bombardment ready when deployed and stationary', () => {
    const catapult = createUnit({
      id: 'catapult',
      type: 'catapult',
      status: 'siege_mode',
      remainingMovement: 3,
      movement: 3,
      abilities: ['bombardment'],
    });
    const player = createPlayer({ id: 'player1' });
    const state = createState([player], [catapult]);

    const abilityStates = getUnitAbilityStates(catapult, player, state);
    const bombardment = abilityStates.find(state => state.abilityId === 'BOMBARDMENT');

    expect(bombardment?.status).toBe('ready');
  });

  it('classifies non-active abilities as passive', () => {
    const warrior = createUnit({
      id: 'warrior',
      type: 'warrior',
      abilities: ['FOREST_STEALTH'],
    });
    const player = createPlayer({ id: 'player1' });
    const state = createState([player], [warrior]);

    const abilityStates = getUnitAbilityStates(warrior, player, state);
    const passive = abilityStates.find(state => state.abilityId === 'FOREST_STEALTH');

    expect(passive?.status).toBe('passive');
  });
});
