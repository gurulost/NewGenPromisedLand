import { describe, it, expect, beforeEach } from 'vitest';
import { gameReducer } from '../../shared/logic/gameReducer';
import { getCombatPreview } from '../../shared/logic/combatPreview';
import { GAME_RULES } from '../../shared/data/gameRules';
import { IMPROVEMENT_DEFINITIONS, STRUCTURE_DEFINITIONS } from '../../shared/types/city';
import type { GameState, PlayerState } from '../../shared/types/game';
import type { Unit } from '../../shared/types/unit';

describe('Faith System', () => {
    let mockState: GameState;
    let nephitePlayer: PlayerState;
    let lamanitePlayer: PlayerState;

    beforeEach(() => {
        nephitePlayer = {
            id: 'nephite1',
            name: 'Nephite Player',
            factionId: 'NEPHITES',
            isEliminated: false,
            stats: { faith: 50, pride: 30, internalDissent: 10 },
            stars: 100,
            researchedTechs: ['spirituality', 'priesthood'],
            turnOrder: 0,
            visibilityMask: [],
            exploredTiles: [],
            researchProgress: 0,
            citiesOwned: ['city1']
        };

        lamanitePlayer = {
            id: 'lamanite1',
            name: 'Lamanite Player',
            factionId: 'LAMANITES',
            isEliminated: false,
            stats: { faith: 30, pride: 70, internalDissent: 40 },
            stars: 50,
            researchedTechs: [],
            turnOrder: 1,
            visibilityMask: [],
            exploredTiles: [],
            researchProgress: 0,
            citiesOwned: []
        };

        mockState = {
            id: 'faith-test',
            map: {
                tiles: [
                    { coordinate: { q: 0, r: 0, s: 0 }, terrain: 'plains', resources: [], hasCity: true, exploredBy: ['nephite1'] },
                    { coordinate: { q: 1, r: 0, s: -1 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: [] }
                ],
                width: 10,
                height: 10
            },
            players: [nephitePlayer, lamanitePlayer],
            units: [],
            currentPlayerIndex: 0,
            turn: 1,
            phase: 'playing',
            winner: undefined,
            cities: [{
                id: 'city1',
                name: 'Zarahemla',
                coordinate: { q: 0, r: 0, s: 0 },
                ownerId: 'nephite1',
                population: 1,
                maxPopulation: 4,
                level: 1,
                starProduction: 2,
                improvements: [],
                structures: [],
                harvestedResources: []
            }],
            improvements: [],
            structures: []
        };
    });

    describe('Shrine improvement', () => {
        it('should be defined with faithProduction of 2', () => {
            expect(IMPROVEMENT_DEFINITIONS.shrine).toBeDefined();
            expect(IMPROVEMENT_DEFINITIONS.shrine.effects?.faithProduction).toBe(2);
            expect(IMPROVEMENT_DEFINITIONS.shrine.requiredTech).toBe('spirituality');
            expect(IMPROVEMENT_DEFINITIONS.shrine.cost).toBe(6);
        });
    });

    describe('Cathedral structure', () => {
        it('should have faithProduction of 4', () => {
            expect(STRUCTURE_DEFINITIONS.cathedral.effects.faithProduction).toBe(4);
        });
    });

    describe('Missionary faith bonus', () => {
        it('should add +1 faith per missionary up to max 5', () => {
            // Add 3 missionaries
            mockState.units = [
                createMissionary('m1', 'nephite1', { q: 0, r: 0, s: 0 }),
                createMissionary('m2', 'nephite1', { q: 1, r: 0, s: -1 }),
                createMissionary('m3', 'nephite1', { q: 0, r: 1, s: -1 })
            ];

            const endTurnAction = { type: 'END_TURN' as const, payload: { playerId: 'nephite1' } };
            const newState = gameReducer(mockState, endTurnAction);
            const player = newState.players.find(p => p.id === 'nephite1');

            // Should have gained at least 3 faith from missionaries (plus city base)
            expect(player!.stats.faith).toBeGreaterThan(50);
        });
    });

    describe('Faith synergy combat bonuses', () => {
        it('should give +1 defense to defender with 50+ faith', () => {
            const attacker: Unit = createWarrior('a1', 'lamanite1', { q: 0, r: 0, s: 0 });
            const defender: Unit = createWarrior('d1', 'nephite1', { q: 1, r: 0, s: -1 });

            // Nephite has 50 faith, should get +1 defense in preview
            const preview = getCombatPreview(attacker as any, defender as any, {
              ...mockState,
              units: [attacker, defender]
            } as any);

            expect(preview?.canAttack).toBe(true);
            expect(preview?.modifiers.defender.join(' ')).toMatch(/Faith/i);
        });

        it('should give +2 attack to attacker with 70+ faith', () => {
            mockState.players[0].stats.faith = 75;

            const attacker: Unit = createWarrior('a1', 'nephite1', { q: 0, r: 0, s: 0 });
            const defender: Unit = createWarrior('d1', 'lamanite1', { q: 1, r: 0, s: -1 });

            const preview = getCombatPreview(attacker as any, defender as any, {
              ...mockState,
              units: [attacker, defender]
            } as any);

            expect(preview?.canAttack).toBe(true);
            expect(preview?.modifiers.attacker.join(' ')).toMatch(/High Faith/i);
        });
    });

    describe('Conversion cost', () => {
        it('should use GAME_RULES conversion cost of 20', () => {
            expect(GAME_RULES.abilities.resourceCosts.conversion).toBe(20);
        });
    });

    describe('Faith drain config', () => {
        it('should have faith drain settings in GAME_RULES', () => {
            expect(GAME_RULES.faithBonuses.faithDrainPerMissionary).toBe(1);
            expect(GAME_RULES.faithBonuses.maxFaithDrainPerTurn).toBe(3);
        });
    });

    describe('Faith drain mechanic', () => {
        it('drains at most 1 per missionary per enemy player (not per adjacent unit)', () => {
            // One missionary adjacent to multiple Lamanite units should only drain 1 total (before cap).
            mockState.units = [
                createMissionary('m1', 'nephite1', { q: 0, r: 0, s: 0 }),
                createWarrior('e1', 'lamanite1', { q: 1, r: 0, s: -1 }),
                createWarrior('e2', 'lamanite1', { q: 0, r: 1, s: -1 }),
                createWarrior('e3', 'lamanite1', { q: 1, r: -1, s: 0 }),
            ];

            const endTurnAction = { type: 'END_TURN' as const, payload: { playerId: 'nephite1' } };
            const newState = gameReducer({ ...mockState, rngSeed: 1 } as any, endTurnAction as any);
            const enemy = newState.players.find((p: any) => p.id === 'lamanite1');
            expect(enemy.stats.faith).toBe(29); // 30 - 1
        });

        it('caps faith drain at 3 per enemy player per turn', () => {
            // 5 missionaries adjacent should drain 5, but cap to 3.
            mockState.units = [
                createWarrior('e1', 'lamanite1', { q: 0, r: 0, s: 0 }),
                createMissionary('m1', 'nephite1', { q: 1, r: 0, s: -1 }),
                createMissionary('m2', 'nephite1', { q: 0, r: 1, s: -1 }),
                createMissionary('m3', 'nephite1', { q: -1, r: 1, s: 0 }),
                createMissionary('m4', 'nephite1', { q: -1, r: 0, s: 1 }),
                createMissionary('m5', 'nephite1', { q: 0, r: -1, s: 1 }),
            ];

            const endTurnAction = { type: 'END_TURN' as const, payload: { playerId: 'nephite1' } };
            const newState = gameReducer({ ...mockState, rngSeed: 1 } as any, endTurnAction as any);
            const enemy = newState.players.find((p: any) => p.id === 'lamanite1');
            expect(enemy.stats.faith).toBe(27); // 30 - 3
        });
    });
});

// Helper functions
function createWarrior(id: string, playerId: string, coordinate: { q: number; r: number; s: number }): Unit {
    return {
        id,
        type: 'warrior',
        playerId,
        coordinate,
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
        level: 1
    };
}

function createMissionary(id: string, playerId: string, coordinate: { q: number; r: number; s: number }): Unit {
    return {
        id,
        type: 'missionary',
        playerId,
        coordinate,
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
        level: 1
    };
}
