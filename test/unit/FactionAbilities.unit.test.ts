import { describe, it, expect } from 'vitest';

import { computeEffectiveStats } from '../../shared/logic/computeEffectiveStats';
import { resolveActionState } from '../../shared/logic/resolveAction';
import { subscribeTelemetry } from '../../shared/logic/telemetry';
import type { TelemetryEvent } from '../../shared/logic/telemetry';
import type { GameState, PlayerState } from '../../shared/types/game';
import type { Unit } from '../../shared/types/unit';

const createBaseState = (): GameState => {
  const player: PlayerState = {
    id: 'player1',
    name: 'Captain Moroni',
    factionId: 'NEPHITES',
    isAI: false,
    aiDifficulty: undefined,
    stars: 20,
    stats: { faith: 90, pride: 20, internalDissent: 10 },
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
  };

  const unit: Unit = {
    id: 'unit1',
    type: 'warrior',
    playerId: 'player1',
    coordinate: { q: 1, r: 0, s: -1 },
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

  return {
    id: 'test-game',
    players: [player],
    units: [unit],
    currentPlayerIndex: 0,
    turn: 1,
    phase: 'playing',
    map: {
      width: 3,
      height: 3,
      tiles: [
        { coordinate: { q: 0, r: 0, s: 0 }, terrain: 'plains', resources: [], hasCity: true, cityOwner: 'player1', exploredBy: ['player1'] },
        { coordinate: { q: 1, r: 0, s: -1 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: ['player1'] },
        { coordinate: { q: -1, r: 0, s: 1 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: ['player1'] },
      ],
    },
    cities: [
      {
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
      },
    ],
    improvements: [],
    structures: [],
    lastAction: undefined,
    winner: undefined,
  };
};

const createAntiNephiState = (): GameState => {
  const covenantPlayer: PlayerState = {
    id: 'player1',
    name: 'Pacifist Leader',
    factionId: 'ANTI_NEPHI_LEHIES',
    isAI: false,
    aiDifficulty: undefined,
    stars: 15,
    stats: { faith: 85, pride: 15, internalDissent: 5 },
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

  const opposingPlayer: PlayerState = {
    id: 'player2',
    name: 'Aggressor',
    factionId: 'LAMANITES',
    isAI: false,
    aiDifficulty: undefined,
    stars: 10,
    stats: { faith: 40, pride: 40, internalDissent: 20 },
    modifiers: [],
    abilityCooldowns: {},
    researchedTechs: [],
    researchInspiration: 0,
    citiesOwned: [],
    constructionQueue: [],
    visibilityMask: [],
    exploredTiles: [],
    isEliminated: false,
    turnOrder: 1,
  };

  const missionary: Unit = {
    id: 'missionary1',
    type: 'missionary',
    playerId: 'player1',
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

  const enemy: Unit = {
    id: 'enemy1',
    type: 'warrior',
    playerId: 'player2',
    coordinate: { q: 1, r: 0, s: -1 },
    hp: 20,
    maxHp: 20,
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

  return {
    id: 'covenant-game',
    players: [covenantPlayer, opposingPlayer],
    units: [missionary, enemy],
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
  };
};

describe('Faction ability cooldowns', () => {
  it('applies cooldown after using Title of Liberty', () => {
    const initialState = createBaseState();
    const result = resolveActionState(initialState, {
      type: 'USE_ABILITY',
      payload: { playerId: 'player1', abilityId: 'TITLE_OF_LIBERTY' },
    });

    const player = result.players[0];
    expect(player.abilityCooldowns?.TITLE_OF_LIBERTY).toBe(8);
    expect(player.stats.faith).toBeLessThan(initialState.players[0].stats.faith);

    const buffedUnit = result.units.find(unit => unit.id === 'unit1');
    const effectiveAttack = computeEffectiveStats(buffedUnit!, result, { role: 'attacker' });
    const effectiveDefense = computeEffectiveStats(buffedUnit!, result, { role: 'defender' });
    expect(result.activeEffects?.some(effect => effect.source.abilityId === 'TITLE_OF_LIBERTY')).toBe(true);
    expect(buffedUnit?.attack).toBe(initialState.units[0].attack);
    expect(buffedUnit?.defense).toBe(initialState.units[0].defense);
    expect(effectiveAttack.attack).toBeGreaterThan(initialState.units[0].attack);
    expect(effectiveDefense.defense).toBeGreaterThan(initialState.units[0].defense);
  });

  it('decrements cooldowns at end of turn', () => {
    const state = createBaseState();
    state.players[0].abilityCooldowns = { TITLE_OF_LIBERTY: 3 };

    const result = resolveActionState(state, {
      type: 'END_TURN',
      payload: { playerId: 'player1' },
    });

    expect(result.players[0].abilityCooldowns?.TITLE_OF_LIBERTY).toBe(2);
  });

  it('blocks ability use while on cooldown', () => {
    const state = createBaseState();
    state.players[0].abilityCooldowns = { TITLE_OF_LIBERTY: 2 };
    const priorFaith = state.players[0].stats.faith;

    const result = resolveActionState(state, {
      type: 'USE_ABILITY',
      payload: { playerId: 'player1', abilityId: 'TITLE_OF_LIBERTY' },
    });

    expect(result.players[0].stats.faith).toBe(priorFaith);
    expect(result.players[0].abilityCooldowns?.TITLE_OF_LIBERTY).toBe(2);
  });

  it('converts nearby enemy with Covenant of Peace', () => {
    const state = createAntiNephiState();
    const result = resolveActionState(state, {
      type: 'USE_ABILITY',
      payload: { playerId: 'player1', abilityId: 'COVENANT_OF_PEACE' },
    });

    const convertedUnit = result.units.find(unit => unit.id === 'enemy1');
    expect(convertedUnit?.playerId).toBe('player1');

    const player = result.players.find(p => p.id === 'player1');
    expect(player?.abilityCooldowns?.COVENANT_OF_PEACE).toBe(6);
    expect(player?.stats.faith).toBeLessThan(state.players[0].stats.faith);
  });

  it('emits telemetry when ability is blocked by cooldown', () => {
    const state = createBaseState();
    state.players[0].abilityCooldowns = { TITLE_OF_LIBERTY: 2 } as Record<string, number>;

    const events: TelemetryEvent[] = [];
    const unsubscribe = subscribeTelemetry(event => events.push(event));

    const result = resolveActionState(state, {
      type: 'USE_ABILITY',
      payload: { playerId: 'player1', abilityId: 'TITLE_OF_LIBERTY' },
    });

    unsubscribe();

    expect(result).toBe(state);
    expect(events.some(event => event.channel === 'ability' && event.status === 'blocked' && event.reason === 'cooldown')).toBe(true);
  });
});
