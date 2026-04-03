import { describe, expect, it } from 'vitest';

import { resolveActionState } from '../../shared/logic/resolveAction';
import type { GameState } from '../../shared/types/game';

function makeState(options?: {
  p1Cooldowns?: Partial<GameState['players'][number]['diplomaticCooldowns']>;
  p1AlliedWith?: string[];
  p2AlliedWith?: string[];
  p1AtWarWith?: string[];
  p2AtWarWith?: string[];
}): GameState {
  return {
    id: 'diplomacy-test',
    currentPlayerIndex: 0,
    turn: 1,
    phase: 'playing',
    map: {
      width: 3,
      height: 3,
      tiles: [],
    },
    players: [
      {
        id: 'p1',
        name: 'Player One',
        factionId: 'NEPHITES',
        isEliminated: false,
        stars: 10,
        stats: { faith: 20, pride: 20, internalDissent: 10 },
        modifiers: [],
        researchedTechs: [],
        researchProgress: 0,
        turnOrder: 0,
        citiesOwned: [],
        constructionQueue: [],
        visibilityMask: [],
        exploredTiles: [],
        atWarWith: options?.p1AtWarWith ?? [],
        alliedWith: options?.p1AlliedWith ?? [],
        tradeRoutes: [],
        diplomaticCooldowns: {
          declareWar: options?.p1Cooldowns?.declareWar ?? 0,
          formAlliance: options?.p1Cooldowns?.formAlliance ?? 0,
          breakAlliance: options?.p1Cooldowns?.breakAlliance ?? 0,
          requestTrade: options?.p1Cooldowns?.requestTrade ?? 0,
        },
      },
      {
        id: 'p2',
        name: 'Player Two',
        factionId: 'LAMANITES',
        isEliminated: false,
        stars: 10,
        stats: { faith: 25, pride: 15, internalDissent: 5 },
        modifiers: [],
        researchedTechs: [],
        researchProgress: 0,
        turnOrder: 1,
        citiesOwned: [],
        constructionQueue: [],
        visibilityMask: [],
        exploredTiles: [],
        atWarWith: options?.p2AtWarWith ?? [],
        alliedWith: options?.p2AlliedWith ?? [],
        tradeRoutes: [],
        diplomaticCooldowns: {
          declareWar: 0,
          formAlliance: 0,
          breakAlliance: 0,
          requestTrade: 0,
        },
      },
    ],
    units: [],
    cities: [],
    improvements: [],
    structures: [],
  };
}

describe('Diplomacy actions', () => {
  it('enforces declare-war and form-alliance cooldowns in the shared resolver', () => {
    const state = makeState({
      p1Cooldowns: { declareWar: 2, formAlliance: 1 },
    });

    const afterWarAttempt = resolveActionState(state, {
      type: 'DECLARE_WAR',
      payload: { playerId: 'p1', targetPlayerId: 'p2' },
    });

    const afterAllianceAttempt = resolveActionState(state, {
      type: 'FORM_ALLIANCE',
      payload: { playerId: 'p1', targetPlayerId: 'p2' },
    });

    expect(afterWarAttempt).toBe(state);
    expect(afterAllianceAttempt).toBe(state);
  });

  it('breaks alliances symmetrically and sets a break-alliance cooldown', () => {
    const state = makeState({
      p1AlliedWith: ['p2'],
      p2AlliedWith: ['p1'],
    });

    const broken = resolveActionState(state, {
      type: 'BREAK_ALLIANCE',
      payload: { playerId: 'p1', targetPlayerId: 'p2' },
    });

    expect(broken.players[0].alliedWith).toEqual([]);
    expect(broken.players[1].alliedWith).toEqual([]);
    expect(broken.players[0].diplomaticCooldowns.breakAlliance).toBe(3);

    const repeatAttempt = resolveActionState(broken, {
      type: 'BREAK_ALLIANCE',
      payload: { playerId: 'p1', targetPlayerId: 'p2' },
    });

    expect(repeatAttempt).toBe(broken);
  });

  it('allows declaring war from an alliance and blocks alliance formation while already at war', () => {
    const alliedState = makeState({
      p1AlliedWith: ['p2'],
      p2AlliedWith: ['p1'],
    });

    const warState = resolveActionState(alliedState, {
      type: 'DECLARE_WAR',
      payload: { playerId: 'p1', targetPlayerId: 'p2' },
    });

    expect(warState.players[0].alliedWith).toEqual([]);
    expect(warState.players[1].alliedWith).toEqual([]);
    expect(warState.players[0].atWarWith).toEqual(['p2']);
    expect(warState.players[1].atWarWith).toEqual(['p1']);
    expect(warState.players[0].diplomaticCooldowns.declareWar).toBe(5);

    const allianceAttempt = resolveActionState(warState, {
      type: 'FORM_ALLIANCE',
      payload: { playerId: 'p1', targetPlayerId: 'p2' },
    });

    expect(allianceAttempt).toBe(warState);
  });
});
