import { describe, it, expect } from 'vitest';
import { gameReducer } from '../../shared/logic/gameReducer';
import type { GameState } from '../../shared/types/game';

describe('Catapult siege/bombardment gating', () => {
  it('cannot attack at range unless in siege_mode and stationary', () => {
    const p1 = 'p1';
    const p2 = 'p2';

    const base: GameState = {
      id: 'g1',
      currentPlayerIndex: 0,
      turn: 1,
      phase: 'playing',
      map: {
        width: 5,
        height: 5,
        tiles: [
          { coordinate: { q: 0, r: 0, s: 0 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [p1, p2] },
          { coordinate: { q: 1, r: 0, s: -1 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [p1, p2] },
          { coordinate: { q: 2, r: 0, s: -2 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [p1, p2] },
        ],
      },
      players: [
        {
          id: p1,
          name: 'P1',
          factionId: 'NEPHITES',
          isEliminated: false,
          stats: { faith: 50, pride: 10, internalDissent: 0 },
          stars: 0,
          researchedTechs: [],
          turnOrder: 0,
          visibilityMask: [],
          exploredTiles: [],
          researchProgress: 0,
          citiesOwned: [],
          constructionQueue: [],
          atWarWith: [],
          alliedWith: [],
          tradeRoutes: [],
          diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
        },
        {
          id: p2,
          name: 'P2',
          factionId: 'LAMANITES',
          isEliminated: false,
          stats: { faith: 50, pride: 10, internalDissent: 0 },
          stars: 0,
          researchedTechs: [],
          turnOrder: 1,
          visibilityMask: [],
          exploredTiles: [],
          researchProgress: 0,
          citiesOwned: [],
          constructionQueue: [],
          atWarWith: [],
          alliedWith: [],
          tradeRoutes: [],
          diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
        }
      ],
      cities: [],
      units: [
        {
          id: 'c1',
          type: 'catapult',
          playerId: p1,
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
          hasAttacked: false,
        } as any,
        {
          id: 'e1',
          type: 'warrior',
          playerId: p2,
          coordinate: { q: 2, r: 0, s: -2 },
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
          hasAttacked: false,
        } as any,
      ],
      improvements: [],
      structures: [],
      winner: undefined,
      visibility: undefined,
    };

    // Not deployed => blocked.
    const blocked = gameReducer(base, { type: 'ATTACK_UNIT', payload: { attackerId: 'c1', targetId: 'e1' } } as any);
    expect(blocked).toBe(base);

    // Deploy siege mode (must be stationary). This should consume the unit's action.
    const deployed = gameReducer(base, { type: 'SIEGE_MODE', payload: { playerId: p1, unitId: 'c1' } } as any);
    expect(deployed.units.find(u => u.id === 'c1')?.status).toBe('siege_mode');
    expect(deployed.units.find(u => u.id === 'c1')?.actionsRemaining).toBe(0);

    // "Moved this turn" => blocked even when deployed.
    const movedThisTurn: GameState = {
      ...deployed,
      units: deployed.units.map(u =>
        u.id === 'c1'
          ? { ...u, remainingMovement: 0, movement: 1, maxActions: 1, actionsRemaining: 1 }
          : u
      ),
    };
    const stillBlocked = gameReducer(movedThisTurn, { type: 'ATTACK_UNIT', payload: { attackerId: 'c1', targetId: 'e1' } } as any);
    expect(stillBlocked).toBe(movedThisTurn);

    // Stationary and deployed => allowed.
    const stationaryDeployed: GameState = {
      ...deployed,
      units: deployed.units.map(u =>
        u.id === 'c1'
          ? { ...u, remainingMovement: 1, movement: 1, maxActions: 1, actionsRemaining: 1, hasAttacked: false }
          : u
      ),
    };
    const attacked = gameReducer(stationaryDeployed, { type: 'ATTACK_UNIT', payload: { attackerId: 'c1', targetId: 'e1' } } as any);
    expect(attacked).not.toBe(stationaryDeployed);
    expect(attacked.units.find(u => u.id === 'c1')?.hasAttacked).toBe(true);
  });
});
