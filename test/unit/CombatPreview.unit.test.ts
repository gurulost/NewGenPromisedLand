import { describe, it, expect } from 'vitest';
import { getCombatPreview } from '../../shared/logic/combatPreview';

describe('combatPreview', () => {
  const mkPlayer = (id: string, overrides: any = {}) => ({
    id,
    name: id,
    factionId: 'NEPHITES',
    stars: 0,
    stats: { faith: 0, pride: 0, internalDissent: 0 },
    researchedTechs: [],
    citiesOwned: [],
    constructionQueue: [],
    visibilityMask: [],
    exploredTiles: [],
    isEliminated: false,
    turnOrder: 0,
    ...overrides,
  });

  const mkUnit = (overrides: any = {}) => ({
    id: 'u',
    type: 'warrior',
    playerId: 'p1',
    coordinate: { q: 0, r: 0, s: 0 },
    hp: 10,
    maxHp: 10,
    attack: 5,
    defense: 2,
    movement: 2,
    remainingMovement: 2,
    visionRadius: 2,
    attackRange: 1,
    abilities: [],
    status: 'active',
    hasAttacked: false,
    level: 1,
    experience: 0,
    ...overrides,
  });

  const mkState = (overrides: any = {}) =>
    ({
      id: 'g',
      rngSeed: 1,
      players: [mkPlayer('p1'), mkPlayer('p2')],
      currentPlayerIndex: 0,
      turn: 1,
      phase: 'playing',
      map: {
        tiles: [
          { coordinate: { q: 0, r: 0, s: 0 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: ['p1', 'p2'] },
          { coordinate: { q: 1, r: 0, s: -1 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: ['p1', 'p2'] },
          { coordinate: { q: 2, r: 0, s: -2 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: ['p1', 'p2'] },
          { coordinate: { q: 3, r: 0, s: -3 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: ['p1', 'p2'] },
          { coordinate: { q: 1, r: 1, s: -2 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: ['p1', 'p2'] },
        ],
        width: 4,
        height: 4,
      },
      units: [],
      cities: [],
      improvements: [],
      structures: [],
      ...overrides,
    }) as any;

  it('blocks attacking stealthed units unless adjacent', () => {
    const attacker = mkUnit({ id: 'a', playerId: 'p1', attackRange: 2, coordinate: { q: 0, r: 0, s: 0 } });
    const defenderFar = mkUnit({ id: 'd', playerId: 'p2', status: 'stealthed', coordinate: { q: 2, r: 0, s: -2 } });
    const stateFar = mkState({ units: [attacker, defenderFar] });
    const previewFar = getCombatPreview(attacker as any, defenderFar as any, stateFar);
    expect(previewFar?.canAttack).toBe(false);
    expect(previewFar?.reason).toMatch(/stealth|hidden/i);

    const defenderNear = { ...defenderFar, coordinate: { q: 1, r: 0, s: -1 } };
    const stateNear = mkState({ units: [attacker, defenderNear] });
    const previewNear = getCombatPreview(attacker as any, defenderNear as any, stateNear);
    expect(previewNear?.canAttack).toBe(true);
  });

  it('enforces siege mode + stationary gating for artillery at range', () => {
    const attacker = mkUnit({
      id: 'cat',
      type: 'catapult',
      playerId: 'p1',
      attackRange: 3,
      movement: 1,
      remainingMovement: 1,
      status: 'active',
      abilities: ['siege'],
      coordinate: { q: 0, r: 0, s: 0 },
    });
    const defender = mkUnit({ id: 'd', playerId: 'p2', coordinate: { q: 3, r: 0, s: -3 } });
    const spotter = mkUnit({ id: 's', type: 'scout', playerId: 'p1', coordinate: { q: 1, r: 0, s: -1 } });

    const state = mkState({ units: [attacker, defender, spotter] });
    const notDeployed = getCombatPreview(attacker as any, defender as any, state);
    expect(notDeployed?.canAttack).toBe(false);
    expect(notDeployed?.reason).toMatch(/deploy|siege mode/i);

    const movedThisTurn = { ...attacker, status: 'siege_mode', remainingMovement: 0 };
    const movedState = mkState({ units: [movedThisTurn, defender, spotter] });
    const notStationary = getCombatPreview(movedThisTurn as any, defender as any, movedState);
    expect(notStationary?.canAttack).toBe(false);
    expect(notStationary?.reason).toMatch(/stationary/i);

    const deployedStationary = { ...attacker, status: 'siege_mode', remainingMovement: 1 };
    const deployedState = mkState({ units: [deployedStationary, defender, spotter] });
    const ok = getCombatPreview(deployedStationary as any, defender as any, deployedState);
    expect(ok?.canAttack).toBe(true);
  });

  it('reduces incoming damage when defender has adjacent protective aura', () => {
    const attacker = mkUnit({ id: 'a', playerId: 'p1', attack: 10 });
    const defender = mkUnit({ id: 'd', playerId: 'p2', defense: 2, coordinate: { q: 1, r: 0, s: -1 } });
    const guardian = mkUnit({
      id: 'g',
      playerId: 'p2',
      type: 'peacekeeping_guard',
      abilities: ['PROTECTIVE_AURA'],
      coordinate: { q: 1, r: 1, s: -2 },
    });

    const stateNoAura = mkState({ units: [attacker, defender] });
    const previewNoAura = getCombatPreview(attacker as any, defender as any, stateNoAura);
    expect(previewNoAura?.canAttack).toBe(true);

    const stateAura = mkState({ units: [attacker, defender, guardian] });
    const previewAura = getCombatPreview(attacker as any, defender as any, stateAura);
    expect(previewAura?.canAttack).toBe(true);
    expect(previewAura!.attackerDamage).toBeLessThan(previewNoAura!.attackerDamage);
    expect(previewAura!.modifiers.defender.join(' ')).toMatch(/Protective Aura/i);
  });

  it('blocks combat against DIPLOMACY units when defender faith is high', () => {
    const attacker = mkUnit({ id: 'a', playerId: 'p1' });
    const defender = mkUnit({ id: 'd', playerId: 'p2', abilities: ['DIPLOMACY'], coordinate: { q: 1, r: 0, s: -1 } });
    const state = mkState({
      players: [mkPlayer('p1'), mkPlayer('p2', { stats: { faith: 80, pride: 0, internalDissent: 0 } })],
      units: [attacker, defender],
    });
    const preview = getCombatPreview(attacker as any, defender as any, state);
    expect(preview?.canAttack).toBe(false);
    expect(preview?.reason).toMatch(/diplomacy/i);
  });

  it('shows and applies testimony pressure attack penalty on the attacker', () => {
    const baseAttacker = mkUnit({ id: 'a', playerId: 'p1', attack: 6, coordinate: { q: 0, r: 0, s: 0 } });
    const pressuredAttacker = mkUnit({
      ...baseAttacker,
      statusEffects: [{ type: 'TESTIMONY_PRESSURE', turnsRemaining: 1, attackPenalty: 2, sourcePlayerId: 'p2' }],
    });
    const defender = mkUnit({ id: 'd', playerId: 'p2', defense: 2, coordinate: { q: 1, r: 0, s: -1 } });

    const state = mkState({ units: [pressuredAttacker, defender] });
    const preview = getCombatPreview(pressuredAttacker as any, defender as any, state);
    expect(preview?.canAttack).toBe(true);
    expect(preview?.modifiers.attacker.join(' ')).toMatch(/Testimony Pressure/i);

    const stateNoPressure = mkState({ units: [baseAttacker, defender] });
    const previewNoPressure = getCombatPreview(baseAttacker as any, defender as any, stateNoPressure);
    expect(preview!.attackerDamage).toBeLessThan(previewNoPressure!.attackerDamage);
  });

  it('applies forest cover reduction to ranged attacks', () => {
    const attacker = mkUnit({ id: 'a', playerId: 'p1', attack: 7, attackRange: 3 });
    const defender = mkUnit({ id: 'd', playerId: 'p2', defense: 2, coordinate: { q: 2, r: 0, s: -2 } });
    const baseMap = mkState().map;

    const plainsState = mkState({ units: [attacker, defender], map: baseMap });
    const previewPlains = getCombatPreview(attacker as any, defender as any, plainsState);
    expect(previewPlains?.canAttack).toBe(true);

    const forestState = mkState({
      units: [attacker, defender],
      map: {
        ...baseMap,
        tiles: baseMap.tiles.map(tile =>
          tile.coordinate.q === 2 && tile.coordinate.r === 0
            ? { ...tile, terrain: 'forest' }
            : tile
        ),
      },
    });
    const previewForest = getCombatPreview(attacker as any, defender as any, forestState);
    expect(previewForest?.canAttack).toBe(true);
    expect(previewForest!.attackerDamage).toBeLessThan(previewPlains!.attackerDamage);
    expect(previewForest!.modifiers.defender.join(' ')).toMatch(/Forest Cover/i);
  });

  it('applies forest ambush bonus for ranged attacks from forest', () => {
    const attacker = mkUnit({
      id: 'a',
      type: 'wilderness_hunter',
      playerId: 'p1',
      attack: 6,
      attackRange: 2,
      abilities: ['AMBUSH'],
      coordinate: { q: 0, r: 0, s: 0 },
    });
    const defender = mkUnit({ id: 'd', playerId: 'p2', defense: 2, coordinate: { q: 2, r: 0, s: -2 } });
    const baseMap = mkState().map;

    const plainsState = mkState({ units: [attacker, defender], map: baseMap });
    const previewPlains = getCombatPreview(attacker as any, defender as any, plainsState);

    const forestState = mkState({
      units: [attacker, defender],
      map: {
        ...baseMap,
        tiles: baseMap.tiles.map(tile =>
          tile.coordinate.q === 0 && tile.coordinate.r === 0
            ? { ...tile, terrain: 'forest' }
            : tile
        ),
      },
    });
    const previewForest = getCombatPreview(attacker as any, defender as any, forestState);
    expect(previewForest?.canAttack).toBe(true);
    expect(previewForest!.attackerDamage).toBeGreaterThan(previewPlains!.attackerDamage);
    expect(previewForest!.modifiers.attacker.join(' ')).toMatch(/Forest Ambush/i);
  });
});
