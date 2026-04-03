import { GameState } from '../types/game';
import { Unit } from '../types/unit';
import { getUnitDefinition } from '../data/units';
import { hexDistance } from '../utils/hex';
import { getUnitActionsRemaining, spendUnitActions } from './unitLogic';
import { nextId } from './rng';
import { clampStat } from '../utils/math';
import { GAME_RULES } from '../data/gameRules';
import { applyStatusEffect, cleanseMoraleDebuffs } from './statusEffects';

const normalizeAbility = (abilityId: string) => abilityId.toUpperCase();
const hasAbility = (abilities: string[] | undefined, abilityId: string) =>
    (abilities || []).some(ability => normalizeAbility(String(ability)) === normalizeAbility(abilityId));

// Clear Forest Handler
export function handleClearForest(
    state: GameState,
    payload: { unitId: string; targetCoordinate: any; playerId: string }
): GameState {
    const { unitId, targetCoordinate, playerId } = payload;

    const unit = state.units.find(u => u.id === unitId);
    if (!unit || unit.playerId !== playerId) return state;

    const player = state.players.find(p => p.id === playerId);
    if (!player) return state;
    if (!player.researchedTechs?.includes('forestry')) return state;
    if (getUnitActionsRemaining(unit) <= 0) return state;

    // Find the target tile
    const targetTile = state.map.tiles.find(tile =>
        tile.coordinate.q === targetCoordinate.q &&
        tile.coordinate.r === targetCoordinate.r
    );

    if (!targetTile || targetTile.terrain !== 'forest') return state;
    if (targetTile.hasCity) return state;

    // Check if unit can perform this action
    const unitDef = getUnitDefinition(unit.type);
    if (!hasAbility(unitDef?.abilities, 'CLEAR_FOREST')) return state;

    // Check if unit is adjacent or on the tile
    const distance = hexDistance(unit.coordinate, targetCoordinate);
    if (distance > 1) return state;

    // Canonical behavior: +2 Stars, +1 Pride, +1 Dissent
    return {
        ...state,
        players: state.players.map(p =>
            p.id === playerId
                ? {
                    ...p,
                    stars: p.stars + 2,
                    stats: {
                        ...p.stats,
                        pride: clampStat(p.stats.pride + 1),
                        internalDissent: clampStat(p.stats.internalDissent + 1)
                    }
                }
                : p
        ),
        map: {
            ...state.map,
            tiles: state.map.tiles.map(tile =>
                tile.coordinate.q === targetCoordinate.q && tile.coordinate.r === targetCoordinate.r
                    ? { ...tile, terrain: 'plains' }
                    : tile
            )
        },
        units: state.units.map(u =>
            u.id === unitId
                ? spendUnitActions(u)
                : u
        )
    };
}

// Build Road Handler
export function handleBuildRoad(
    state: GameState,
    payload: { unitId: string; targetCoordinate: any; playerId: string }
): GameState {
    const { unitId, targetCoordinate, playerId } = payload;

    const unit = state.units.find(u => u.id === unitId);
    if (!unit || unit.playerId !== playerId) return state;

    const player = state.players.find(p => p.id === playerId);
    if (!player || player.stars < 3) return state;
    if (!player.researchedTechs.includes('organization')) return state;
    if (getUnitActionsRemaining(unit) <= 0) return state;

    // Find the target tile
    const targetTile = state.map.tiles.find(tile =>
        tile.coordinate.q === targetCoordinate.q &&
        tile.coordinate.r === targetCoordinate.r
    );

    if (!targetTile || targetTile.terrain === 'water' || targetTile.terrain === 'mountain') return state;

    // Check if unit can perform this action
    const unitDef = getUnitDefinition(unit.type);
    if (!hasAbility(unitDef?.abilities, 'BUILD_ROAD')) return state;

    // Check if unit is adjacent or on the tile
    const distance = hexDistance(unit.coordinate, targetCoordinate);
    if (distance > 1) return state;

    // Check if road already exists
    const existingRoad = state.improvements?.find(imp =>
        imp.coordinate.q === targetCoordinate.q &&
        imp.coordinate.r === targetCoordinate.r &&
        imp.type === 'road'
    );

    if (existingRoad) return state;

    let rngSeed = state.rngSeed ?? 0;
    const roadIdResult = nextId(rngSeed, `road_${targetCoordinate.q}_${targetCoordinate.r}`);
    rngSeed = roadIdResult.seed;
    const roadImprovement = {
        id: roadIdResult.id,
        type: 'road' as const,
        coordinate: targetCoordinate,
        ownerId: playerId,
        cityId: '',
        starProduction: 0,
        constructionTurns: 0
    };

    return {
        ...state,
        players: state.players.map(p =>
            p.id === playerId
                ? { ...p, stars: p.stars - 3 }
                : p
        ),
        improvements: [...(state.improvements || []), roadImprovement],
        units: state.units.map(u =>
            u.id === unitId
                ? spendUnitActions(u)
                : u
        ),
        rngSeed,
    };
}

// Unit Ability Handlers
export function handleHealUnit(
    state: GameState,
    payload: { unitId: string; playerId: string }
): GameState {
    const { unitId, playerId } = payload;

    const unit = state.units.find(u => u.id === unitId);
    if (!unit || unit.playerId !== playerId) return state;

    // Check if unit has heal ability and hasn't acted
    // Use lowercase 'heal' to match data
    if (!hasAbility(unit.abilities, 'HEAL') || getUnitActionsRemaining(unit) <= 0) return state;

    // Check faith cost requirement
    const player = state.players.find(p => p.id === playerId);
    const faithCost = GAME_RULES.abilities.resourceCosts.missionaryHeal;
    if (!player || player.stats.faith < faithCost) return state;

    // Find nearby friendly units to heal (within 2 tiles)
    const healRadius = GAME_RULES.abilities.healRadius;
    let unitsHealed = 0;

    const updatedUnits = state.units.map(u => {
        if (u.playerId === playerId && u.id !== unitId) {
            const distance = hexDistance(unit.coordinate, u.coordinate);
            if (distance <= healRadius && u.hp < u.maxHp) {
                unitsHealed++;
                // Canonical: heal up to the configured amount per target, also cleanse morale debuffs
                return {
                    ...u,
                    hp: Math.min(u.maxHp, u.hp + GAME_RULES.units.healingAmount),
                    statusEffects: cleanseMoraleDebuffs(u).statusEffects
                } as Unit;
            }
        }
        return u;
    });

    // If no units were healed, don't consume action or Faith.
    if (unitsHealed === 0) return state;

    // Mark the healing unit as having acted and consume faith
    const updatedHealingUnits = updatedUnits.map(u =>
        u.id === unitId ? spendUnitActions(u) : u
    );

    // Only charge Faith if at least one unit was healed
    const updatedPlayers = state.players.map(p =>
        p.id === playerId
            ? { ...p, stats: { ...p.stats, faith: p.stats.faith - faithCost } }
            : p
    );

    return {
        ...state,
        units: updatedHealingUnits,
        players: updatedPlayers
    };
}

export function handleApplyStealth(
    state: GameState,
    payload: { unitId: string; playerId: string }
): GameState {
    const { unitId, playerId } = payload;

    const unit = state.units.find(u => u.id === unitId);
    if (!unit || unit.playerId !== playerId) return state;

    // Check if unit has stealth ability and hasn't acted
    if (!hasAbility(unit.abilities, 'STEALTH') || getUnitActionsRemaining(unit) <= 0) return state;
    if (unit.status === 'stealthed') return state;

    // Canonical: entering stealth clears formation/fortified status
    const updatedUnits = state.units.map(u =>
        u.id === unitId
            ? {
                ...spendUnitActions(u),
                status: 'stealthed' as const,
                // Clear formation flag if present (cannot be both hidden and shield-walled)
            }
            : u
    );

    return {
        ...state,
        units: updatedUnits
    };
}

export function handleReconnaissance(
    state: GameState,
    payload: { unitId: string; playerId: string }
): GameState {
    const { unitId, playerId } = payload;

    const unit = state.units.find(u => u.id === unitId);
    if (!unit || unit.playerId !== playerId) return state;

    // Check if unit has reconnaissance ability and hasn't acted
    if (!hasAbility(unit.abilities, 'RECONNAISSANCE') || getUnitActionsRemaining(unit) <= 0) return state;

    // Reveal large area around unit (use canonical rules)
    const reconRadius = GAME_RULES.abilities.visionRevealRadius;
    const player = state.players.find(p => p.id === playerId);
    if (!player) return state;

    const tileKeys = new Set(state.map.tiles.map(tile => `${tile.coordinate.q},${tile.coordinate.r}`));
    const newVisibleTiles: string[] = [];
    for (let q = unit.coordinate.q - reconRadius; q <= unit.coordinate.q + reconRadius; q++) {
        for (let r = unit.coordinate.r - reconRadius; r <= unit.coordinate.r + reconRadius; r++) {
            const s = -q - r;
            const distance = Math.max(Math.abs(q - unit.coordinate.q), Math.abs(r - unit.coordinate.r), Math.abs(s - (-unit.coordinate.q - unit.coordinate.r)));
            if (distance <= reconRadius) {
                const tileKey = `${q},${r}`;
                if (tileKeys.has(tileKey)) {
                    newVisibleTiles.push(tileKey);
                }
            }
        }
    }

    const updatedPlayers = state.players.map(p =>
        p.id === playerId
            ? {
                ...p,
                visibilityMask: Array.from(new Set([...p.visibilityMask, ...newVisibleTiles])),
                exploredTiles: Array.from(new Set([...p.exploredTiles, ...newVisibleTiles]))
            }
            : p
    );

    const updatedUnits = state.units.map(u =>
        u.id === unitId ? spendUnitActions(u) : u
    );

    const revealSet = new Set(newVisibleTiles);
    const updatedTiles = state.map.tiles.map(tile => {
        const tileKey = `${tile.coordinate.q},${tile.coordinate.r}`;
        if (revealSet.has(tileKey) && !tile.exploredBy.includes(playerId)) {
            return { ...tile, exploredBy: [...tile.exploredBy, playerId] };
        }
        return tile;
    });

    return {
        ...state,
        units: updatedUnits,
        players: updatedPlayers,
        map: { ...state.map, tiles: updatedTiles }
    };
}

// Coastal Exploration Handler - Boats reveal coastal tiles and gain stars for discoveries
export function handleCoastalExplore(
    state: GameState,
    payload: { unitId: string; playerId: string }
): GameState {
    const { unitId, playerId } = payload;

    const unit = state.units.find(u => u.id === unitId);
    if (!unit || unit.playerId !== playerId) return state;

    // Check if unit has coastal exploration ability and hasn't acted
    const unitDef = getUnitDefinition(unit.type);
    const hasCoastalExplore = unitDef.abilities?.some(
        a => String(a).toUpperCase() === 'COASTAL_EXPLORATION'
    );
    if (!hasCoastalExplore || getUnitActionsRemaining(unit) <= 0) return state;

    const player = state.players.find(p => p.id === playerId);
    if (!player) return state;

    // Navigation tech extends exploration radius from 2 to 3
    const hasNavigation = player.researchedTechs?.includes('navigation');
    const exploreRadius = hasNavigation ? 3 : 2;

    // Collect tiles to reveal
    const tileKeys = new Set(state.map.tiles.map(tile => `${tile.coordinate.q},${tile.coordinate.r}`));
    const newVisibleTiles: string[] = [];
    const existingExplored = new Set(player.exploredTiles);
    let newTileCount = 0;

    for (let q = unit.coordinate.q - exploreRadius; q <= unit.coordinate.q + exploreRadius; q++) {
        for (let r = unit.coordinate.r - exploreRadius; r <= unit.coordinate.r + exploreRadius; r++) {
            const s = -q - r;
            const distance = Math.max(
                Math.abs(q - unit.coordinate.q),
                Math.abs(r - unit.coordinate.r),
                Math.abs(s - (-unit.coordinate.q - unit.coordinate.r))
            );
            if (distance <= exploreRadius) {
                const tileKey = `${q},${r}`;
                if (tileKeys.has(tileKey)) {
                    newVisibleTiles.push(tileKey);
                    if (!existingExplored.has(tileKey)) {
                        newTileCount++;
                    }
                }
            }
        }
    }

    // Deterministic reward: +1 Star per 4 new tiles (max 2), +1 Faith per 6 new tiles (max 1)
    const starReward = Math.min(2, Math.floor(newTileCount / 4));
    const faithReward = Math.min(1, Math.floor(newTileCount / 6));

    const updatedPlayers = state.players.map(p =>
        p.id === playerId
            ? {
                ...p,
                stars: p.stars + starReward,
                stats: {
                    ...p.stats,
                    faith: clampStat(p.stats.faith + faithReward)
                },
                visibilityMask: Array.from(new Set([...p.visibilityMask, ...newVisibleTiles])),
                exploredTiles: Array.from(new Set([...p.exploredTiles, ...newVisibleTiles]))
            }
            : p
    );

    const updatedUnits = state.units.map(u =>
        u.id === unitId ? spendUnitActions(u) : u
    );

    const revealSet = new Set(newVisibleTiles);
    const updatedTiles = state.map.tiles.map(tile => {
        const tileKey = `${tile.coordinate.q},${tile.coordinate.r}`;
        if (revealSet.has(tileKey) && !tile.exploredBy.includes(playerId)) {
            return { ...tile, exploredBy: [...tile.exploredBy, playerId] };
        }
        return tile;
    });

    return {
        ...state,
        units: updatedUnits,
        players: updatedPlayers,
        map: { ...state.map, tiles: updatedTiles }
    };
}

export function handleFormationFighting(
    state: GameState,
    payload: { unitId: string; playerId: string }
): GameState {
    const { unitId, playerId } = payload;

    const unit = state.units.find(u => u.id === unitId);
    if (!unit || unit.playerId !== playerId) return state;
    if (getUnitActionsRemaining(unit) <= 0) return state;

    // Check if unit has formation fighting ability
    if (!hasAbility(unit.abilities, 'FORMATION_FIGHTING')) return state;

    // Apply formation bonus - this is passive, just mark the unit as having used the action
    const updatedUnits = state.units.map(u =>
        u.id === unitId
            ? { ...spendUnitActions(u), status: 'formation' as const }
            : u
    );

    return {
        ...state,
        units: updatedUnits
    };
}

export function handleSiegeMode(
    state: GameState,
    payload: { unitId: string; playerId: string }
): GameState {
    const { unitId, playerId } = payload;

    const unit = state.units.find(u => u.id === unitId);
    if (!unit || unit.playerId !== playerId) return state;

    // Check if unit has siege ability and is stationary
    if (!hasAbility(unit.abilities, 'SIEGE') || unit.remainingMovement !== unit.movement) return state;
    if (getUnitActionsRemaining(unit) <= 0) return state;

    const updatedUnits = state.units.map(u =>
        u.id === unitId
            ? { ...spendUnitActions(u), status: 'siege_mode' as const }
            : u
    );

    return {
        ...state,
        units: updatedUnits
    };
}

export function handleRallyTroops(
    state: GameState,
    payload: { unitId: string; playerId: string }
): GameState {
    const { unitId, playerId } = payload;

    const unit = state.units.find(u => u.id === unitId);
    if (!unit || unit.playerId !== playerId) return state;

    // Check if unit has rally ability and hasn't acted
    if (
        !(hasAbility(unit.abilities, 'RALLY') || hasAbility(unit.abilities, 'RALLY_TROOPS')) ||
        getUnitActionsRemaining(unit) <= 0
    ) return state;

    const player = state.players.find(p => p.id === playerId);
    if (!player) return state;

    // Canonical: 2-turn cooldown
    const cooldownKey = `${unitId}_rally_troops`;
    const currentCooldown = player.abilityCooldowns?.[cooldownKey] ?? 0;
    if (currentCooldown > 0) return state;

    // Rally nearby friendly MILITARY units only (within 2 tiles)
    // Exclude civilians and influence units
    const rallyRadius = 2;
    const updatedUnits = state.units.map(u => {
        if (u.playerId === playerId && u.id !== unitId) {
            const distance = hexDistance(unit.coordinate, u.coordinate);
            if (distance <= rallyRadius) {
                // Check if target is military (not civilian/influence)
                const targetDef = getUnitDefinition(u.type);
                const isCivilian = targetDef?.tags?.includes('civilian') ||
                    targetDef?.tags?.includes('influence') ||
                    targetDef?.tags?.includes('diplomat');
                if (!isCivilian) {
                    // Apply rallied status (+2 Attack until next attack or end of next turn)
                    const withEffect = applyStatusEffect(u, { type: 'RALLIED', turnsRemaining: 2 }, state);
                    if (!withEffect) return u;
                    return {
                        ...withEffect,
                        status: 'rallied' as const,
                    };
                }
            }
        }
        return u;
    });

    // Mark the rally unit as having acted
    const updatedRallyUnits = updatedUnits.map(u =>
        u.id === unitId ? spendUnitActions(u) : u
    );

    // Canonical: +1 Pride and set 2-turn cooldown
    const updatedPlayers = state.players.map(p =>
        p.id === playerId
            ? {
                ...p,
                stats: { ...p.stats, pride: clampStat(p.stats.pride + 1) },
                abilityCooldowns: {
                    ...p.abilityCooldowns,
                    [cooldownKey]: 2
                }
            }
            : p
    );

    return {
        ...state,
        units: updatedRallyUnits,
        players: updatedPlayers
    };
}
