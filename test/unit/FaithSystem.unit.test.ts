import { describe, it, expect, beforeEach } from 'vitest';
import { resolveActionState } from '../../shared/logic/resolveAction';
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
            const newState = resolveActionState(mockState, endTurnAction);
            const player = newState.players.find(p => p.id === 'nephite1');

            // Should have gained at least 3 faith from missionaries (plus city base)
            expect(player!.stats.faith).toBeGreaterThan(50);
        });
    });

    describe('Faith generation data-driven (effects.faithProduction)', () => {
        it('counts completed temple faithProduction and excludes in-progress construction', () => {
            const baseState: GameState = {
                ...mockState,
                rngSeed: 0,
                players: [
                    { ...nephitePlayer, stats: { ...nephitePlayer.stats, faith: 50, pride: 0, internalDissent: 0 } },
                    { ...lamanitePlayer }
                ],
            } as any;

            const withCompletedTemple: GameState = {
                ...baseState,
                structures: [{
                    id: 't1',
                    type: 'temple',
                    cityId: 'city1',
                    ownerId: 'nephite1',
                    constructionTurns: 0,
                    effects: { starProduction: 0, unitProduction: 0, defenseBonus: 0, populationGrowth: 0, faithProduction: 5 }
                }] as any
            } as any;

            const endTurnAction = { type: 'END_TURN' as const, payload: { playerId: 'nephite1' } };
            const afterCompleted = resolveActionState(withCompletedTemple, endTurnAction as any);
            const playerCompleted = afterCompleted.players.find(p => p.id === 'nephite1');
            // +2 from city, +5 from temple
            expect(playerCompleted!.stats.faith).toBe(57);

            const withInProgressTemple: GameState = {
                ...baseState,
                structures: [{
                    id: 't1',
                    type: 'temple',
                    cityId: 'city1',
                    ownerId: 'nephite1',
                    constructionTurns: 1,
                    effects: { starProduction: 0, unitProduction: 0, defenseBonus: 0, populationGrowth: 0, faithProduction: 5 }
                }] as any
            } as any;

            const afterInProgress = resolveActionState(withInProgressTemple, endTurnAction as any);
            const playerInProgress = afterInProgress.players.find(p => p.id === 'nephite1');
            // Only +2 from city
            expect(playerInProgress!.stats.faith).toBe(52);
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
            expect(GAME_RULES.conversion.costs.unit).toBe(20);
        });
    });

    describe('Testimony pressure (missionaries)', () => {
        it('applies a temporary attack penalty to adjacent enemy military units (no faith drain)', () => {
            mockState.units = [
                createMissionary('m1', 'nephite1', { q: 0, r: 0, s: 0 }),
                createWarrior('e1', 'lamanite1', { q: 1, r: 0, s: -1 }),
            ];

            const endTurnAction = { type: 'END_TURN' as const, payload: { playerId: 'nephite1' } };
            const newState = resolveActionState({ ...mockState, rngSeed: 1 } as any, endTurnAction as any);
            const enemyPlayer = newState.players.find((p: any) => p.id === 'lamanite1');
            const enemyUnit: any = newState.units.find((u: any) => u.id === 'e1');

            expect(enemyPlayer.stats.faith).toBe(30); // no drain
            expect(Array.isArray(enemyUnit.statusEffects)).toBe(true);
            expect(enemyUnit.statusEffects.some((e: any) => e?.type === 'TESTIMONY_PRESSURE')).toBe(true);
        });

	        it('does not apply to adjacent civilians (worker/missionary/envoy)', () => {
	            mockState.units = [
	                createMissionary('m1', 'nephite1', { q: 0, r: 0, s: 0 }),
	                createWorker('w1', 'lamanite1', { q: 1, r: 0, s: -1 }),
	                createMissionary('m2', 'lamanite1', { q: 0, r: 1, s: -1 }),
	                createEnvoy('e1', 'lamanite1', { q: 1, r: -1, s: 0 }),
	                createScribeTeacher('s1', 'lamanite1', { q: 0, r: -1, s: 1 }),
	            ];

            const endTurnAction = { type: 'END_TURN' as const, payload: { playerId: 'nephite1' } };
            const newState = resolveActionState({ ...mockState, rngSeed: 1 } as any, endTurnAction as any);

            const worker: any = newState.units.find((u: any) => u.id === 'w1');
            const enemyMissionary: any = newState.units.find((u: any) => u.id === 'm2');
	            const envoy: any = newState.units.find((u: any) => u.id === 'e1');
	            const scribe: any = newState.units.find((u: any) => u.id === 's1');

	            expect(worker?.statusEffects?.some((e: any) => e?.type === 'TESTIMONY_PRESSURE') || false).toBe(false);
	            expect(enemyMissionary?.statusEffects?.some((e: any) => e?.type === 'TESTIMONY_PRESSURE') || false).toBe(false);
		            expect(envoy?.statusEffects?.some((e: any) => e?.type === 'TESTIMONY_PRESSURE') || false).toBe(false);
		            expect(scribe?.statusEffects?.some((e: any) => e?.type === 'TESTIMONY_PRESSURE') || false).toBe(false);
		        });

	        it('does not stack when multiple missionaries are adjacent (refresh/replace only)', () => {
	            mockState.units = [
	                createMissionary('m1', 'nephite1', { q: 0, r: 0, s: 0 }),
	                createMissionary('m2', 'nephite1', { q: 0, r: 1, s: -1 }),
	                createWarrior('e1', 'lamanite1', { q: 1, r: 0, s: -1 }),
	            ];

	            const newState = resolveActionState({ ...mockState, rngSeed: 1 } as any, { type: 'END_TURN', payload: { playerId: 'nephite1' } } as any);
	            const enemyUnit: any = newState.units.find((u: any) => u.id === 'e1');
	            const effects = (enemyUnit.statusEffects || []).filter((e: any) => e?.type === 'TESTIMONY_PRESSURE');
	            expect(effects.length).toBe(1);
	            expect(effects[0].attackPenalty).toBeGreaterThan(0);
	        });

	        it('clears temporary command buffs on affected units', () => {
	            mockState.units = [
	                createMissionary('m1', 'nephite1', { q: 0, r: 0, s: 0 }),
	                {
	                    ...createWarrior('e1', 'lamanite1', { q: 1, r: 0, s: -1 }),
	                    status: 'rallied',
	                    rallyBuff: true,
	                    tacticalCommand: true,
	                } as any,
	            ];

	            const newState = resolveActionState({ ...mockState, rngSeed: 1 } as any, { type: 'END_TURN', payload: { playerId: 'nephite1' } } as any);
	            const enemyUnit: any = newState.units.find((u: any) => u.id === 'e1');
	            expect(enemyUnit.status).toBe('active');
	            expect(enemyUnit.rallyBuff).toBe(false);
	            expect(enemyUnit.tacticalCommand).toBe(false);
	        });

	        it('does not clear unrelated statuses (e.g., siege_mode); only rally-related status is cleared', () => {
	            mockState.units = [
	                createMissionary('m1', 'nephite1', { q: 0, r: 0, s: 0 }),
	                {
	                    ...createWarrior('e1', 'lamanite1', { q: 1, r: 0, s: -1 }),
	                    status: 'siege_mode',
	                    rallyBuff: true,
	                    tacticalCommand: true,
	                } as any,
	            ];

	            const newState = resolveActionState({ ...mockState, rngSeed: 1 } as any, { type: 'END_TURN', payload: { playerId: 'nephite1' } } as any);
	            const enemyUnit: any = newState.units.find((u: any) => u.id === 'e1');
	            expect(enemyUnit.status).toBe('siege_mode');
	            expect(enemyUnit.rallyBuff).toBe(false);
	            expect(enemyUnit.tacticalCommand).toBe(false);
	            expect(enemyUnit.statusEffects?.some((e: any) => e?.type === 'TESTIMONY_PRESSURE') || false).toBe(true);
	        });

	        it('only applies when the acting player is Nephite/Anti-Nephi-Lehi', () => {
	            mockState.players = [
	                { ...nephitePlayer, factionId: 'ZORAMITES' as any },
	                { ...lamanitePlayer },
	            ] as any;
	            mockState.currentPlayerIndex = 0;
	            mockState.units = [
	                createMissionary('m1', 'nephite1', { q: 0, r: 0, s: 0 }),
	                createWarrior('e1', 'lamanite1', { q: 1, r: 0, s: -1 }),
	            ];

	            const newState = resolveActionState({ ...mockState, rngSeed: 1 } as any, { type: 'END_TURN', payload: { playerId: 'nephite1' } } as any);
	            const enemyUnit: any = newState.units.find((u: any) => u.id === 'e1');
	            expect(enemyUnit.statusEffects?.some((e: any) => e?.type === 'TESTIMONY_PRESSURE') || false).toBe(false);
	        });

	        it('expires after the affected player finishes their turn', () => {
	            const state: GameState = {
	                ...mockState,
	                rngSeed: 1,
                units: [
                    createMissionary('m1', 'nephite1', { q: 0, r: 0, s: 0 }),
                    createWarrior('e1', 'lamanite1', { q: 1, r: 0, s: -1 }),
                ]
            } as any;

            const afterNephite = resolveActionState(state as any, { type: 'END_TURN', payload: { playerId: 'nephite1' } } as any);
            const pressuredUnit: any = afterNephite.units.find((u: any) => u.id === 'e1');
            expect(pressuredUnit.statusEffects.some((e: any) => e?.type === 'TESTIMONY_PRESSURE')).toBe(true);

            const afterLamanite = resolveActionState(afterNephite as any, { type: 'END_TURN', payload: { playerId: 'lamanite1' } } as any);
            const clearedUnit: any = afterLamanite.units.find((u: any) => u.id === 'e1');
            expect(clearedUnit.statusEffects?.some((e: any) => e?.type === 'TESTIMONY_PRESSURE') || false).toBe(false);
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

function createWorker(id: string, playerId: string, coordinate: { q: number; r: number; s: number }): Unit {
    return {
        id,
        type: 'worker',
        playerId,
        coordinate,
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
        level: 1
    };
}

	function createEnvoy(id: string, playerId: string, coordinate: { q: number; r: number; s: number }): Unit {
	    return {
        id,
        type: 'royal_envoy',
        playerId,
        coordinate,
        hp: 15,
        maxHp: 15,
        attack: 2,
        defense: 3,
        movement: 4,
        remainingMovement: 4,
        visionRadius: 3,
        attackRange: 1,
        status: 'active',
        experience: 0,
        abilities: ['DIPLOMACY'],
        level: 1
	    };
	}

	function createScribeTeacher(id: string, playerId: string, coordinate: { q: number; r: number; s: number }): Unit {
	    return {
	        id,
	        type: 'scribe_teacher',
	        playerId,
	        coordinate,
	        hp: 16,
	        maxHp: 16,
	        attack: 2,
	        defense: 2,
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
