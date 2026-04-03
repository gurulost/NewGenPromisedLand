import { describe, it, expect } from 'vitest';
import { resolveActionState } from '../../shared/logic/resolveAction';
import { GameState, PlayerState, GameAction } from '../../shared/types/game';
import { Unit } from '../../shared/types/unit';

// Helper for cubic coords
const coord = (q: number, r: number) => ({ q, r, s: -q - r });

// Helper to create a minimal valid game state for testing
function createMockGameState(): GameState {
    const p1: PlayerState = {
        id: 'p1',
        name: 'Nephites',
        factionId: 'NEPHITES',
        isAI: false,
        isEliminated: false,
        stats: {
            faith: 100, // Starting high for testing
            pride: 0,
            internalDissent: 0,
            // population/techProgress/wealth removed as they are not likely in minimal PlayerStats type or optional
        },
        stars: 10, // Starting stars
        modifiers: [],
        researchedTechs: [], // No techs
        researchProgress: 0,
        citiesOwned: ['city1'],
        constructionQueue: [],
        visibilityMask: [],
        exploredTiles: [],
        abilityCooldowns: {},
        turnOrder: 0,
        atWarWith: [],
        alliedWith: [],
        tradeRoutes: [],
        diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
    };

    const p2: PlayerState = {
        ...p1,
        id: 'p2',
        name: 'Lamanites',
        factionId: 'LAMANITES',
        citiesOwned: [],
        turnOrder: 1,
    };

    // minimal map
    const tiles = [];
    for (let q = -5; q <= 5; q++) {
        for (let r = -5; r <= 5; r++) {
            tiles.push({
                coordinate: coord(q, r),
                terrain: 'plains', // Default
                resources: []
            });
        }
    }
    // Add a forest tile at (-1, 0)
    const forestTile = tiles.find(t => t.coordinate.q === -1 && t.coordinate.r === 0);
    if (forestTile) forestTile.terrain = 'forest';

    return {
        id: 'golden-sim',
        rngSeed: 12345,
        players: [p1, p2],
        currentPlayerIndex: 0,
        turn: 1,
        phase: 'playing',
        map: { tiles, width: 11, height: 11 },
        units: [],
        cities: [{
            id: 'city1',
            name: 'Zarahemla',
            coordinate: coord(0, 0),
            ownerId: 'p1',
            population: 1,
            maxPopulation: 4,
            level: 1,
            starProduction: 0,
            improvements: [],
            structures: [],
            harvestedResources: [],
        }],
        improvements: [],
        structures: [],
    } as unknown as GameState; // Cast to GameState (simpler mock)
}

describe('Golden Simulation', () => {
    it('runs a deterministic game sequence correctly', () => {
        let state = createMockGameState();
        const p1Id = state.players[0].id;

        // Helper to dispatch
        const dispatch = (action: GameAction) => {
            state = resolveActionState(state, action);
        };

        // 1. CLEAR_FOREST Scenario with WORKER
        const worker: Unit = {
            id: 'worker1',
            type: 'worker',
            playerId: p1Id,
            coordinate: coord(-1, 0),
            hp: 10, maxHp: 10, movement: 2, remainingMovement: 2,
            attack: 0, defense: 0, // range removed
            abilities: ['CLEAR_FOREST'], status: 'active',
            experience: 0, level: 1
        };
        state.units = [worker];

        // Try without tech -> Should fail
        const stateBefore = state;
        dispatch({
            type: 'CLEAR_FOREST',
            payload: { unitId: worker.id, targetCoordinate: worker.coordinate, playerId: p1Id }
        });
        expect(state).toBe(stateBefore);

        // Research Tech
        dispatch({ type: 'RESEARCH_TECH', payload: { playerId: p1Id, techId: 'forestry' } });
        expect(state.players[0].researchedTechs).toContain('forestry');

        // Clear Forest Again
        dispatch({
            type: 'CLEAR_FOREST',
            payload: { unitId: worker.id, targetCoordinate: worker.coordinate, playerId: p1Id }
        });

        // Verify changes
        const tile = state.map.tiles.find(t => t.coordinate.q === -1 && t.coordinate.r === 0);
        expect(tile?.terrain).toBe('plains');
        expect(state.players[0].stats.pride).toBe(1);


        // 2. HEAL Scenario
        // Add Missionary and injured Warrior
        const missionary: Unit = {
            id: 'm1',
            type: 'missionary',
            playerId: p1Id,
            coordinate: coord(0, 0),
            hp: 10, maxHp: 10, movement: 2, remainingMovement: 2,
            attack: 0, defense: 0, // range removed
            abilities: ['heal'], // Lowercase
            status: 'active',
            experience: 0, level: 1
        };
        const warrior: Unit = {
            id: 'w2',
            type: 'warrior',
            playerId: p1Id,
            coordinate: coord(0, 1),
            hp: 5, maxHp: 10, movement: 2, remainingMovement: 2,
            attack: 2, defense: 2, // range removed
            abilities: [], status: 'active',
            experience: 0, level: 1
        };

        state.units = [...state.units.filter(u => u.id !== worker.id), missionary, warrior];
        state.players[0].stats.faith = 100;

        // Dispatch HEAL
        dispatch({
            type: 'HEAL_UNIT',
            payload: { unitId: missionary.id, playerId: p1Id }
        });

        const healedUnit = state.units.find(u => u.id === 'w2');
        expect(healedUnit?.hp).toBe(8); // +3
        expect(state.players[0].stats.faith).toBe(95); // -5

        // 3. RALLY Scenario
        const commander: Unit = {
            id: 'c1',
            type: 'commander',
            playerId: p1Id,
            coordinate: coord(2, 2),
            hp: 10, maxHp: 10, movement: 2, remainingMovement: 2,
            attack: 3, defense: 2, // range removed
            abilities: ['rally_troops'], // Lowercase
            status: 'active',
            experience: 0, level: 1
        };
        const soldier: Unit = { ...warrior, id: 's1', coordinate: coord(2, 3), hp: 10 };
        state.units = [...state.units, commander, soldier];

        dispatch({
            type: 'RALLY_TROOPS',
            payload: { unitId: commander.id, playerId: p1Id }
        });

        // Check soldier status
        const ralliedSoldier = state.units.find(u => u.id === soldier.id);
        expect(ralliedSoldier?.status).toBe('rallied');

        // Check cooldown set using ID-scoped key
        const p1 = state.players[0];
        expect(p1.abilityCooldowns?.[`${commander.id}_rally_troops`]).toBeGreaterThan(0);
        expect(state.players[0].stats.pride).toBeGreaterThanOrEqual(1);

        // 4. STEALTH Scenario
        const scout: Unit = {
            id: 'sc1',
            type: 'scout',
            playerId: p1Id,
            coordinate: coord(3, 3),
            hp: 10, maxHp: 10, movement: 3, remainingMovement: 3,
            attack: 1, defense: 1, // range removed
            abilities: ['stealth'], // Lowercase
            status: 'active',
            experience: 0, level: 1
        };
        state.units = [...state.units, scout];

        dispatch({
            type: 'APPLY_STEALTH',
            payload: { unitId: scout.id, playerId: p1Id }
        });

        const stealthedScout = state.units.find(u => u.id === scout.id);
        expect(stealthedScout?.status).toBe('stealthed');

        // 5. FORMATION Scenario
        const spearman: Unit = {
            id: 'sp1',
            type: 'spearman',
            playerId: p1Id,
            coordinate: coord(4, 4),
            hp: 10, maxHp: 10, movement: 2, remainingMovement: 2,
            attack: 2, defense: 2, // range removed
            abilities: ['formation_fighting'], // Lowercase
            status: 'active',
            experience: 0, level: 1
        };
        state.units = [...state.units, spearman];

        dispatch({
            type: 'FORMATION_FIGHTING',
            payload: { unitId: spearman.id, playerId: p1Id }
        });

        const formationSpearman = state.units.find(u => u.id === spearman.id);
        expect(formationSpearman?.status).toBe('formation');
    });
});
