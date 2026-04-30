import { describe, it, expect } from 'vitest';

import { GAME_RULES } from '../../shared/data/gameRules';
import { computeEffectiveStats } from '../../shared/logic/computeEffectiveStats';
import { computeUnitConversionChance } from '../../shared/logic/conversion';
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

const createCulturalReclamationState = (): GameState => {
  const mulekitePlayer: PlayerState = {
    id: 'player1',
    name: 'Mulekite Steward',
    factionId: 'MULEKITES',
    isAI: false,
    aiDifficulty: undefined,
    stars: 15,
    stats: { faith: 50, pride: 20, internalDissent: 5 },
    modifiers: [],
    abilityCooldowns: {},
    researchedTechs: [],
    researchInspiration: 0,
    citiesOwned: ['city1'],
    constructionQueue: [],
    visibilityMask: ['0,0', '1,0'],
    exploredTiles: ['0,0', '1,0'],
    isEliminated: false,
    turnOrder: 0,
  };

  const enemyPlayer: PlayerState = {
    id: 'player2',
    name: 'Raider',
    factionId: 'LAMANITES',
    isAI: false,
    aiDifficulty: undefined,
    stars: 10,
    stats: { faith: 50, pride: 45, internalDissent: 20 },
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

  const enemy: Unit = {
    id: 'enemy1',
    type: 'warrior',
    playerId: 'player2',
    coordinate: { q: 1, r: 0, s: -1 },
    hp: 20,
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
    id: 'cultural-game',
    players: [mulekitePlayer, enemyPlayer],
    units: [enemy],
    currentPlayerIndex: 0,
    turn: 1,
    phase: 'playing',
    map: {
      width: 3,
      height: 3,
      tiles: [
        { coordinate: { q: 0, r: 0, s: 0 }, terrain: 'plains', resources: [], hasCity: true, cityOwner: 'player1', exploredBy: ['player1'] },
        { coordinate: { q: 1, r: 0, s: -1 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: ['player1'] },
      ],
    },
    cities: [
      {
        id: 'city1',
        name: 'Zarahemla',
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

const createJarediteState = (): GameState => {
  const jareditePlayer: PlayerState = {
    id: 'player1',
    name: 'Jaredite Ruler',
    factionId: 'JAREDITES',
    isAI: false,
    aiDifficulty: undefined,
    stars: 10,
    stats: { faith: 20, pride: 65, internalDissent: 10 },
    modifiers: [],
    abilityCooldowns: {},
    researchedTechs: [],
    researchInspiration: 0,
    citiesOwned: [],
    constructionQueue: [],
    visibilityMask: ['0,0'],
    exploredTiles: ['0,0'],
    isEliminated: false,
    turnOrder: 0,
  };

  const warrior: Unit = {
    id: 'jaredite1',
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
  };

  return {
    id: 'jaredite-game',
    rngSeed: 0,
    players: [jareditePlayer],
    units: [warrior],
    currentPlayerIndex: 0,
    turn: 1,
    phase: 'playing',
    map: {
      width: 2,
      height: 2,
      tiles: [
        { coordinate: { q: 0, r: 0, s: 0 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: ['player1'] },
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

  it('applies Warrior Rage through active effects and starts cooldown', () => {
    const state = createBaseState();
    state.players[0] = {
      ...state.players[0],
      factionId: 'LAMANITES',
      stats: { faith: 30, pride: 70, internalDissent: 40 },
    };

    const result = resolveActionState(state, {
      type: 'USE_ABILITY',
      payload: { playerId: 'player1', abilityId: 'WARRIOR_RAGE' },
    });

    const player = result.players[0];
    expect(player.abilityCooldowns?.WARRIOR_RAGE).toBe(6);
    expect(result.activeEffects?.some(effect => effect.source.abilityId === 'WARRIOR_RAGE')).toBe(true);
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

  it('does not convert allied units with Covenant of Peace', () => {
    const state = createAntiNephiState();
    state.players[0].alliedWith = ['player2'];
    state.players[1].alliedWith = ['player1'];

    const result = resolveActionState(state, {
      type: 'USE_ABILITY',
      payload: { playerId: 'player1', abilityId: 'COVENANT_OF_PEACE' },
    });

    const alliedUnit = result.units.find(unit => unit.id === 'enemy1');
    expect(alliedUnit?.playerId).toBe('player2');
    expect(result.players[0].abilityCooldowns?.COVENANT_OF_PEACE).toBeUndefined();
  });

  it('applies Cultural Reclamation pressure for Mulekites', () => {
    const state = createCulturalReclamationState();
    const beforeChance = computeUnitConversionChance(state.players[0], state.players[1], state.units[0]);
    const beforeDefense = computeEffectiveStats(state.units[0], state, { role: 'defender' });

    const result = resolveActionState(state, {
      type: 'USE_ABILITY',
      payload: { playerId: 'player1', abilityId: 'CULTURAL_RECLAMATION' },
    });

    const pressuredUnit = result.units.find(unit => unit.id === 'enemy1')!;
    const culturalPressure = pressuredUnit.statusEffects?.find(effect => effect.type === 'CULTURAL_PRESSURE');
    const effectiveDefense = computeEffectiveStats(pressuredUnit, result, { role: 'defender' });
    const afterChance = computeUnitConversionChance(state.players[0], state.players[1], pressuredUnit);

    expect(culturalPressure).toMatchObject({
      defensePenalty: GAME_RULES.abilities.factionActive.culturalReclamation.defensePenalty,
      conversionChanceBonus: GAME_RULES.abilities.factionActive.culturalReclamation.conversionChanceBonus,
      sourcePlayerId: 'player1',
    });
    expect(effectiveDefense.defense).toBeLessThan(beforeDefense.defense);
    expect(afterChance).toBeGreaterThan(beforeChance);
    expect(result.players[0].stats.faith).toBe(
      state.players[0].stats.faith - GAME_RULES.abilities.factionActive.culturalReclamation.faithCost
    );
    expect(result.players[0].abilityCooldowns?.CULTURAL_RECLAMATION).toBe(
      GAME_RULES.abilities.factionActive.culturalReclamation.cooldown
    );
  });

  it('applies Ancient Might as a timed combat buff with pride momentum', () => {
    const state = createJarediteState();
    const result = resolveActionState(state, {
      type: 'USE_ABILITY',
      payload: { playerId: 'player1', abilityId: 'ANCIENT_MIGHT' },
    });

    const buffedUnit = result.units.find(unit => unit.id === 'jaredite1')!;
    const effectiveAttack = computeEffectiveStats(buffedUnit, result, { role: 'attacker' });
    const effectiveDefense = computeEffectiveStats(buffedUnit, result, { role: 'defender' });

    expect(result.activeEffects?.some(effect => effect.source.abilityId === 'ANCIENT_MIGHT')).toBe(true);
    expect(effectiveAttack.attack).toBe(state.units[0].attack + GAME_RULES.abilities.factionActive.ancientMight.attackBonus);
    expect(effectiveDefense.defense).toBe(state.units[0].defense + GAME_RULES.abilities.factionActive.ancientMight.defenseBonus);
    expect(result.players[0].stats.pride).toBe(
      state.players[0].stats.pride + GAME_RULES.abilities.factionActive.ancientMight.immediatePride
    );
    expect(result.players[0].abilityCooldowns?.ANCIENT_MIGHT).toBe(
      GAME_RULES.abilities.factionActive.ancientMight.cooldown
    );

    const afterEndTurn = resolveActionState(result, {
      type: 'END_TURN',
      payload: { playerId: 'player1' },
    });
    expect(afterEndTurn.players[0].stats.pride).toBeGreaterThan(result.players[0].stats.pride);
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
