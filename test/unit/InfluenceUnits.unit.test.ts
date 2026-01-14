import { describe, it, expect } from 'vitest';
import { resolveActionState } from '../../shared/logic/resolveAction';
import type { GameState } from '../../shared/types/game';
import type { Unit } from '../../shared/types/unit';

function makeState(opts: {
  factionId: string;
  stats?: { faith?: number; pride?: number; internalDissent?: number };
  stars?: number;
  diplomaticCooldowns?: Partial<{ declareWar: number; formAlliance: number; breakAlliance: number; requestTrade: number }>;
  units?: Unit[];
}): GameState {
  const playerId = 'p1';
  const cityId = 'c1';

  return {
    id: 'g1',
    currentPlayerIndex: 0,
    turn: 1,
    phase: 'playing',
    winner: undefined,
    visibility: undefined,
    rngSeed: 0, // deterministic: avoids morale events in assertions
    map: {
      width: 3,
      height: 3,
      tiles: [
        { coordinate: { q: 0, r: 0, s: 0 }, terrain: 'plains', resources: [], hasCity: true, cityOwner: playerId, exploredBy: [playerId] },
      ],
    },
    players: [
      {
        id: playerId,
        name: 'Player',
        factionId: opts.factionId,
        isEliminated: false,
        stats: {
          faith: opts.stats?.faith ?? 0,
          pride: opts.stats?.pride ?? 0,
          internalDissent: opts.stats?.internalDissent ?? 0,
        },
        stars: opts.stars ?? 0,
        researchedTechs: [],
        turnOrder: 0,
        visibilityMask: [],
        exploredTiles: [],
        researchProgress: 0,
        citiesOwned: [cityId],
        constructionQueue: [],
        atWarWith: [],
        alliedWith: [],
        tradeRoutes: [],
        diplomaticCooldowns: {
          declareWar: opts.diplomaticCooldowns?.declareWar ?? 0,
          formAlliance: opts.diplomaticCooldowns?.formAlliance ?? 0,
          breakAlliance: opts.diplomaticCooldowns?.breakAlliance ?? 0,
          requestTrade: opts.diplomaticCooldowns?.requestTrade ?? 0,
        },
      },
    ],
    cities: [
      {
        id: cityId,
        name: 'City',
        coordinate: { q: 0, r: 0, s: 0 },
        ownerId: playerId,
        population: 1,
        maxPopulation: 4,
        level: 1,
        starProduction: 0,
        improvements: [],
        structures: [],
        harvestedResources: [],
      },
    ],
    units: opts.units ?? [],
    improvements: [],
    structures: [],
  };
}

describe('Influence units (passive per-turn effects)', () => {
  it('Priestcraft Preacher grants per-turn stars/pride/dissent', () => {
    const baseline = makeState({
      factionId: 'ZORAMITES',
      units: [],
    });
    const baselineAfter = resolveActionState(baseline, { type: 'END_TURN', payload: { playerId: 'p1' } } as any);

    const state = makeState({
      factionId: 'ZORAMITES',
      units: [
        {
          id: 'u1',
          type: 'priestcraft_preacher',
          playerId: 'p1',
          coordinate: { q: 0, r: 0, s: 0 },
          hp: 15,
          maxHp: 15,
          attack: 2,
          defense: 1,
          movement: 3,
          remainingMovement: 3,
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
          type: 'priestcraft_preacher',
          playerId: 'p1',
          coordinate: { q: 0, r: 0, s: 0 },
          hp: 15,
          maxHp: 15,
          attack: 2,
          defense: 1,
          movement: 3,
          remainingMovement: 3,
          status: 'active',
          abilities: [],
          level: 1,
          experience: 0,
          visionRadius: 2,
          attackRange: 1,
          hasAttacked: false,
        },
      ],
    });

    const after = resolveActionState(state, { type: 'END_TURN', payload: { playerId: 'p1' } } as any);
    expect(after.players[0].stars - baselineAfter.players[0].stars).toBe(2);
    expect(after.players[0].stats.pride - baselineAfter.players[0].stats.pride).toBe(4);
    expect(after.players[0].stats.internalDissent - baselineAfter.players[0].stats.internalDissent).toBe(2);
  });

  it('Scribe-Teacher reduces Request Trade cooldown by an extra 1 per turn (non-stacking)', () => {
    const baseUnit = (id: string): Unit => ({
      id,
      type: 'scribe_teacher',
      playerId: 'p1',
      coordinate: { q: 0, r: 0, s: 0 },
      hp: 16,
      maxHp: 16,
      attack: 2,
      defense: 2,
      movement: 3,
      remainingMovement: 3,
      status: 'active',
      abilities: [],
      level: 1,
      experience: 0,
      visionRadius: 2,
      attackRange: 1,
      hasAttacked: false,
    });

    const state = makeState({
      factionId: 'MULEKITES',
      diplomaticCooldowns: { requestTrade: 3 },
      units: [baseUnit('u1'), baseUnit('u2')], // "any" stacking => still only -1 extra
    });

    const after = resolveActionState(state, { type: 'END_TURN', payload: { playerId: 'p1' } } as any);
    expect(after.players[0].diplomaticCooldowns?.requestTrade).toBe(1); // 3 - 1 (base tick) - 1 (scribe)
  });

  it('Converted Missionary grants faith and reduces pride/dissent per turn', () => {
    const baseline = makeState({
      factionId: 'LAMANITES',
      stats: { faith: 10, pride: 10, internalDissent: 10 },
      units: [],
    });
    const baselineAfter = resolveActionState(baseline, { type: 'END_TURN', payload: { playerId: 'p1' } } as any);

    const state = makeState({
      factionId: 'LAMANITES',
      stats: { faith: 10, pride: 10, internalDissent: 10 },
      units: [
        {
          id: 'u1',
          type: 'converted_missionary',
          playerId: 'p1',
          coordinate: { q: 0, r: 0, s: 0 },
          hp: 18,
          maxHp: 18,
          attack: 1,
          defense: 2,
          movement: 3,
          remainingMovement: 3,
          status: 'active',
          abilities: [],
          level: 1,
          experience: 0,
          visionRadius: 2,
          attackRange: 1,
          hasAttacked: false,
        } as any,
      ],
    });

    const after = resolveActionState(state, { type: 'END_TURN', payload: { playerId: 'p1' } } as any);
    expect(after.players[0].stats.faith - baselineAfter.players[0].stats.faith).toBe(1);
    expect(after.players[0].stats.pride - baselineAfter.players[0].stats.pride).toBe(-1);
    expect(after.players[0].stats.internalDissent - baselineAfter.players[0].stats.internalDissent).toBe(-1);
  });

  it('clamps pride/dissent within 0..100 for negative/positive passive deltas', () => {
    const state = makeState({
      factionId: 'ZORAMITES',
      stats: { pride: 99, internalDissent: 0, faith: 0 },
      units: [
        {
          id: 'p',
          type: 'priestcraft_preacher',
          playerId: 'p1',
          coordinate: { q: 0, r: 0, s: 0 },
          hp: 15,
          maxHp: 15,
          attack: 2,
          defense: 1,
          movement: 3,
          remainingMovement: 3,
          status: 'active',
          abilities: [],
          level: 1,
          experience: 0,
          visionRadius: 2,
          attackRange: 1,
          hasAttacked: false,
        } as any,
        {
          id: 'prop',
          type: 'prophet',
          playerId: 'p1',
          coordinate: { q: 0, r: 0, s: 0 },
          hp: 16,
          maxHp: 16,
          attack: 1,
          defense: 2,
          movement: 3,
          remainingMovement: 3,
          status: 'active',
          abilities: [],
          level: 1,
          experience: 0,
          visionRadius: 2,
          attackRange: 1,
          hasAttacked: false,
        } as any,
      ],
    });

    const after = resolveActionState(state, { type: 'END_TURN', payload: { playerId: 'p1' } } as any);
    expect(after.players[0].stats.pride).toBeGreaterThanOrEqual(0);
    expect(after.players[0].stats.pride).toBeLessThanOrEqual(100);
    expect(after.players[0].stats.internalDissent).toBeGreaterThanOrEqual(0);
    expect(after.players[0].stats.internalDissent).toBeLessThanOrEqual(100);
  });

  it('Prophet reduces dissent every turn', () => {
    const state = makeState({
      factionId: 'JAREDITES',
      stats: { pride: 10, internalDissent: 10 },
      units: [
        {
          id: 'u1',
          type: 'prophet',
          playerId: 'p1',
          coordinate: { q: 0, r: 0, s: 0 },
          hp: 16,
          maxHp: 16,
          attack: 1,
          defense: 2,
          movement: 3,
          remainingMovement: 3,
          status: 'active',
          abilities: [],
          level: 1,
          experience: 0,
          visionRadius: 2,
          attackRange: 1,
          hasAttacked: false,
        },
      ],
    });

    const after = resolveActionState(state, { type: 'END_TURN', payload: { playerId: 'p1' } } as any);
    expect(after.players[0].stats.internalDissent).toBe(9);
  });

  it('Prophet reduces pride only when pride is high', () => {
    const makeProphet = (): Unit => ({
      id: 'u1',
      type: 'prophet',
      playerId: 'p1',
      coordinate: { q: 0, r: 0, s: 0 },
      hp: 16,
      maxHp: 16,
      attack: 1,
      defense: 2,
      movement: 3,
      remainingMovement: 3,
      status: 'active',
      abilities: [],
      level: 1,
      experience: 0,
      visionRadius: 2,
      attackRange: 1,
      hasAttacked: false,
    });

    const low = makeState({
      factionId: 'JAREDITES',
      stats: { pride: 59 },
      units: [makeProphet()],
    });
    const lowAfter = resolveActionState(low, { type: 'END_TURN', payload: { playerId: 'p1' } } as any);
    expect(lowAfter.players[0].stats.pride).toBe(59);

    const high = makeState({
      factionId: 'JAREDITES',
      stats: { pride: 60 },
      units: [makeProphet()],
    });
    const highAfter = resolveActionState(high, { type: 'END_TURN', payload: { playerId: 'p1' } } as any);
    expect(highAfter.players[0].stats.pride).toBe(58);
  });
});

describe('Unit requirements are prerequisites, not costs (construction)', () => {
  it('START_CONSTRUCTION does not deduct pride/faith for unit requirements', () => {
    const playerId = 'p1';
    const state = makeState({
      factionId: 'NEPHITES',
      stats: { pride: 60, faith: 60 },
      stars: 30,
    });
    state.players[0].researchedTechs = ['leadership'];

    const after = resolveActionState(
      state,
      {
        type: 'START_CONSTRUCTION',
        payload: { playerId, buildingType: 'commander', category: 'units', cityId: 'c1', coordinate: { q: 0, r: 0, s: 0 } },
      } as any
    );

    const p = after.players[0];
    expect(p.stars).toBe(5); // 30 - commander cost 25
    expect(p.stats.pride).toBe(60);
    expect(p.stats.faith).toBe(60);
  });
});
