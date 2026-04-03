import { describe, it, expect } from 'vitest';

import { resolveActionState } from '../../shared/logic/resolveAction';
import { computeEffectiveStats } from '../../shared/logic/computeEffectiveStats';
import { getUnitDefinition } from '../../shared/data/units';
import { subscribeTelemetry, TelemetryEvent } from '../../shared/logic/telemetry';
import type { GameState, PlayerState } from '../../shared/types/game';
import type { Unit } from '../../shared/types/unit';

const createPlayer = (overrides: Partial<PlayerState>): PlayerState => ({
  id: 'player1',
  name: 'Player One',
  factionId: 'NEPHITES',
  isAI: false,
  aiDifficulty: undefined,
  stars: 20,
  stats: { faith: 70, pride: 30, internalDissent: 10 },
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
  ...overrides,
});

const createUnit = (overrides: Partial<Unit>): Unit => ({
  id: 'unit1',
  type: 'warrior',
  playerId: 'player1',
  coordinate: { q: 0, r: 0, s: 0 },
  hp: 20,
  maxHp: 20,
  attack: 6,
  defense: 3,
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
  temporaryEffects: [],
  hasAttacked: false,
  ...overrides,
});

const baseState = (players: PlayerState[], units: Unit[]): GameState => ({
  id: 'combat-test',
  players,
  units,
  currentPlayerIndex: 0,
  turn: 1,
  phase: 'playing',
  map: {
    width: 5,
    height: 5,
    tiles: [
      { coordinate: { q: 0, r: 0, s: 0 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: ['player1'] },
      { coordinate: { q: 1, r: 0, s: -1 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: ['player1'] },
      { coordinate: { q: 0, r: 1, s: -1 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: ['player1'] },
    ],
  },
  cities: [],
  improvements: [],
  structures: [],
  lastAction: undefined,
  winner: undefined,
});

describe('Combat ability interactions', () => {
  it('reduces attacker damage when the attacker is under testimony pressure', () => {
    const attacker = createUnit({
      id: 'attacker',
      attack: 6,
      statusEffects: [{ type: 'TESTIMONY_PRESSURE', turnsRemaining: 1, attackPenalty: 2, sourcePlayerId: 'player2' }] as any,
    } as any);
    const defender = createUnit({ id: 'defender', playerId: 'player2', defense: 4, coordinate: { q: 1, r: 0, s: -1 } });

    // Keep both players faith below thresholds so this test isolates testimony pressure.
    const player1 = createPlayer({ stats: { faith: 40, pride: 30, internalDissent: 10 } });
    const player2 = createPlayer({
      id: 'player2',
      name: 'Defender',
      factionId: 'LAMANITES',
      stats: { faith: 40, pride: 30, internalDissent: 15 },
      turnOrder: 1,
    });

    const state = baseState([player1, player2], [attacker, defender]);
    const result = resolveActionState(state, {
      type: 'ATTACK_UNIT',
      payload: { attackerId: 'attacker', targetId: 'defender' },
    });

    const updatedDefender = result.units.find(unit => unit.id === 'defender');
    expect(updatedDefender?.hp).toBe(19); // (6-2) - 4 = 0 => min damage 1
  });

  it('reduces damage when protective aura is present', () => {
    const attacker = createUnit({ id: 'attacker' });
    const defender = createUnit({ id: 'defender', playerId: 'player2', defense: 4 });
    const guardian = createUnit({
      id: 'guardian',
      playerId: 'player2',
      coordinate: { q: 0, r: 1, s: -1 },
      abilities: ['PROTECTIVE_AURA'],
      attack: 0,
    });

    // Keep attacker faith below thresholds so this test isolates the aura effect.
    const player1 = createPlayer({ stats: { faith: 40, pride: 30, internalDissent: 10 } });
    const player2 = createPlayer({
      id: 'player2',
      name: 'Defender',
      factionId: 'LAMANITES',
      stats: { faith: 40, pride: 30, internalDissent: 15 },
      turnOrder: 1,
    });

    const state = baseState([player1, player2], [attacker, defender, guardian]);
    const result = resolveActionState(state, {
      type: 'ATTACK_UNIT',
      payload: { attackerId: 'attacker', targetId: 'defender' },
    });

    const updatedDefender = result.units.find(unit => unit.id === 'defender');
    expect(updatedDefender?.hp).toBe(19); // Damage reduced from 2 to 1
    const updatedAttacker = result.units.find(unit => unit.id === 'attacker');
    expect(updatedAttacker?.hp).toBe(17);
  });

  it('applies counter damage when the defender survives a melee strike', () => {
    const attacker = createUnit({ id: 'attacker', attack: 8, defense: 3 });
    const defender = createUnit({
      id: 'defender',
      playerId: 'player2',
      defense: 5,
      attack: 7,
      hp: 18,
    });
    const player1 = createPlayer({});
    const player2 = createPlayer({
      id: 'player2',
      name: 'Shield Bearer',
      factionId: 'NEPHITES',
      stats: { faith: 40, pride: 30, internalDissent: 10 },
      turnOrder: 1,
    });

    const state = baseState([player1, player2], [attacker, defender]);
    const result = resolveActionState(state, {
      type: 'ATTACK_UNIT',
      payload: { attackerId: 'attacker', targetId: 'defender' },
    });

    const updatedDefender = result.units.find(unit => unit.id === 'defender');
    const updatedAttacker = result.units.find(unit => unit.id === 'attacker');

    expect(updatedDefender?.hp).toBeLessThan(defender.hp);
    expect(updatedAttacker?.hp).toBeLessThan(attacker.hp);
  });

  it('skips counter damage when the defender cannot retaliate at range', () => {
    const catapult = createUnit({
      id: 'catapult',
      type: 'catapult',
      attackRange: 3,
      attack: 10,
      status: 'siege_mode',
      remainingMovement: 3,
    });
    const defender = createUnit({
      id: 'keeper',
      playerId: 'player2',
      coordinate: { q: 2, r: -1, s: -1 },
      defense: 4,
      hp: 15,
    });

    const player1 = createPlayer({});
    const player2 = createPlayer({
      id: 'player2',
      name: 'Distant Guardian',
      factionId: 'NEPHITES',
      stats: { faith: 40, pride: 30, internalDissent: 10 },
      turnOrder: 1,
    });

    const state = baseState([player1, player2], [catapult, defender]);
    state.map.tiles.push({
      coordinate: { q: 2, r: -1, s: -1 },
      terrain: 'plains',
      resources: [],
      hasCity: false,
      exploredBy: ['player1'],
    });

    const result = resolveActionState(state, {
      type: 'ATTACK_UNIT',
      payload: { attackerId: 'catapult', targetId: 'keeper' },
    });

    const updatedCatapult = result.units.find(unit => unit.id === 'catapult');
    const updatedDefender = result.units.find(unit => unit.id === 'keeper');

    expect(updatedDefender?.hp).toBeLessThan(defender.hp);
    expect(updatedCatapult?.hp).toBe(catapult.hp);
  });

  it('applies splash damage to nearby units during catapult bombardment', () => {
    const catapult = createUnit({
      id: 'catapult',
      type: 'catapult',
      attack: 10,
      attackRange: 3,
      status: 'siege_mode',
      movement: 3,
      remainingMovement: 3,
      coordinate: { q: 0, r: 0, s: 0 },
      abilities: ['bombardment'],
    });
    const primary = createUnit({
      id: 'primary',
      playerId: 'player2',
      coordinate: { q: 2, r: -1, s: -1 },
      defense: 4,
      hp: 15,
    });
    const splash = createUnit({
      id: 'splash',
      playerId: 'player2',
      coordinate: { q: 2, r: 0, s: -2 },
      defense: 2,
      hp: 12,
    });
    const far = createUnit({
      id: 'far',
      playerId: 'player2',
      coordinate: { q: 4, r: -2, s: -2 },
      defense: 2,
      hp: 12,
    });

    const player1 = createPlayer({});
    const player2 = createPlayer({
      id: 'player2',
      name: 'Defender',
      factionId: 'LAMANITES',
      stats: { faith: 40, pride: 30, internalDissent: 15 },
      turnOrder: 1,
    });

    const state = baseState([player1, player2], [catapult, primary, splash, far]);
    state.map.tiles.push(
      { coordinate: primary.coordinate, terrain: 'plains', resources: [], hasCity: false, exploredBy: ['player1'] },
      { coordinate: splash.coordinate, terrain: 'plains', resources: [], hasCity: false, exploredBy: ['player1'] },
      { coordinate: far.coordinate, terrain: 'plains', resources: [], hasCity: false, exploredBy: ['player1'] },
    );

    const result = resolveActionState(state, {
      type: 'ATTACK_UNIT',
      payload: { attackerId: 'catapult', targetId: 'primary' },
    });

    const primaryAfter = result.units.find(unit => unit.id === 'primary');
    const splashAfter = result.units.find(unit => unit.id === 'splash');
    const farAfter = result.units.find(unit => unit.id === 'far');
    const catapultAfter = result.units.find(unit => unit.id === 'catapult');

    expect(primaryAfter?.hp).toBeLessThan(primary.hp);
    expect(splashAfter?.hp).toBeLessThan(splash.hp);
    expect(farAfter?.hp).toBe(far.hp);
    expect(catapultAfter?.hasAttacked).toBe(true);
    expect(catapultAfter?.actionsRemaining).toBe(0);
  });

  it('blocks bombardment when the catapult is not in siege mode', () => {
    const events: TelemetryEvent[] = [];
    const unsubscribe = subscribeTelemetry(event => events.push(event));

    const catapult = createUnit({
      id: 'catapult',
      type: 'catapult',
      attackRange: 3,
      coordinate: { q: 0, r: 0, s: 0 },
      status: 'active',
      abilities: ['bombardment'],
    });
    const target = createUnit({
      id: 'victim',
      playerId: 'player2',
      coordinate: { q: 2, r: -1, s: -1 },
      defense: 4,
      hp: 14,
    });

    const player1 = createPlayer({});
    const player2 = createPlayer({
      id: 'player2',
      name: 'Defender',
      factionId: 'LAMANITES',
      stats: { faith: 40, pride: 30, internalDissent: 15 },
      turnOrder: 1,
    });

    const state = baseState([player1, player2], [catapult, target]);
    state.map.tiles.push({
      coordinate: target.coordinate,
      terrain: 'plains',
      resources: [],
      hasCity: false,
      exploredBy: ['player1'],
    });

    const result = resolveActionState(state, {
      type: 'ATTACK_UNIT',
      payload: { attackerId: 'catapult', targetId: 'victim' },
    });
    unsubscribe();

    const targetAfter = result.units.find(unit => unit.id === 'victim');
    expect(targetAfter?.hp).toBe(target.hp);
    expect(events.some(event => event.reason === 'catapult_not_deployed')).toBe(true);
  });
  it('negotiates combat through diplomacy when resistance threshold met', () => {
    const attacker = createUnit({ id: 'attacker' });
    const envoy = createUnit({
      id: 'envoy',
      playerId: 'player2',
      coordinate: { q: 1, r: 0, s: -1 },
      abilities: ['DIPLOMACY'],
    });

    const player1 = createPlayer({});
    const player2 = createPlayer({
      id: 'player2',
      name: 'Envoy Leader',
      factionId: 'MULEKITES',
      stats: { faith: 85, pride: 20, internalDissent: 5 },
      turnOrder: 1,
    });

    const state = baseState([player1, player2], [attacker, envoy]);
    const result = resolveActionState(state, {
      type: 'ATTACK_UNIT',
      payload: { attackerId: 'attacker', targetId: 'envoy' },
    });

    const updatedEnvoy = result.units.find(unit => unit.id === 'envoy');
    expect(updatedEnvoy?.hp).toBe(envoy.hp);

    const updatedAttackerPlayer = result.players.find(player => player.id === 'player1');
    expect(updatedAttackerPlayer?.stats.pride).toBeLessThan(player1.stats.pride);
  });

  it('triggers Blood Feud attack buff when allied unit falls', () => {
    const events: TelemetryEvent[] = [];
    const unsubscribe = subscribeTelemetry(event => events.push(event));
    const attacker = createUnit({ id: 'attacker', attack: 12 });
    const doomed = createUnit({
      id: 'doomed',
      playerId: 'player2',
      coordinate: { q: 1, r: 0, s: -1 },
      defense: 1,
      hp: 3,
    });
    const ally = createUnit({
      id: 'ally',
      playerId: 'player2',
      coordinate: { q: 0, r: 1, s: -1 },
      attack: 4,
    });

    const player1 = createPlayer({});
    const player2 = createPlayer({
      id: 'player2',
      name: 'War Chief',
      factionId: 'LAMANITES',
      stats: { faith: 30, pride: 60, internalDissent: 25 },
      turnOrder: 1,
    });

    const state = baseState([player1, player2], [attacker, doomed, ally]);
    const result = resolveActionState(state, {
      type: 'ATTACK_UNIT',
      payload: { attackerId: 'attacker', targetId: 'doomed' },
    });
    unsubscribe();

    const buffedAlly = result.units.find(unit => unit.id === 'ally');
    expect(result.activeEffects?.some(effect => effect.source.abilityId === 'BLOOD_FEUD')).toBe(true);
    expect(computeEffectiveStats(buffedAlly!, result, { role: 'attacker' }).attack).toBeGreaterThan(ally.attack);
    expect(events.some(event => event.channel === 'combat' && event.status === 'success')).toBe(true);
  });

  it('clears protective stance bonus when guardian is defeated', () => {
    const attacker = createUnit({ id: 'attacker', attack: 12 });
    const guard = createUnit({
      id: 'guard',
      playerId: 'player2',
      coordinate: { q: 1, r: 0, s: -1 },
      abilities: ['PROTECTIVE_STANCE'],
      defense: 2,
      hp: 4,
    });
    const worker = createUnit({
      id: 'worker',
      playerId: 'player2',
      coordinate: { q: 0, r: 1, s: -1 },
      type: 'worker',
      defense: 3, // simulate protective buff applied
    });

    const player1 = createPlayer({});
    const player2 = createPlayer({
      id: 'player2',
      name: 'Guardian Leader',
      factionId: 'NEPHITES',
      stats: { faith: 50, pride: 25, internalDissent: 5 },
      turnOrder: 1,
    });

    const state = baseState([player1, player2], [attacker, guard, worker]);
    const result = resolveActionState(state, {
      type: 'ATTACK_UNIT',
      payload: { attackerId: 'attacker', targetId: 'guard' },
    });

    const remainingWorker = result.units.find(unit => unit.id === 'worker');
    expect(remainingWorker?.defense).toBe(getUnitDefinition('worker').baseStats.defense);
  });

  it('resists missionary zeal conversions with Faithful Resistance', () => {
    const missionary = createUnit({
      id: 'missionary',
      type: 'missionary',
      playerId: 'player1',
      coordinate: { q: 0, r: 0, s: 0 },
      abilities: ['heal', 'convert'],
    });
    const enemy = createUnit({
      id: 'enemy',
      playerId: 'player2',
      coordinate: { q: 1, r: 0, s: -1 },
    });

    const player1 = createPlayer({
      stats: { faith: 70, pride: 25, internalDissent: 10 },
    });
    const player2 = createPlayer({
      id: 'player2',
      name: 'Resistant Leader',
      factionId: 'NEPHITES',
      stats: { faith: 65, pride: 20, internalDissent: 5 },
      turnOrder: 1,
    });

    const state = baseState([player1, player2], [missionary, enemy]);
    const abilityState = resolveActionState(state, {
      type: 'USE_ABILITY',
      payload: { playerId: 'player1', abilityId: 'MISSIONARY_ZEAL' },
    });

    const survivingEnemy = abilityState.units.find(unit => unit.id === 'enemy');
    expect(survivingEnemy?.playerId).toBe('player2');
  });

  it('removes guerrilla bonus after leaving forest', () => {
    const lamaPlayer = createPlayer({
      stats: { faith: 40, pride: 40, internalDissent: 20 },
      factionId: 'LAMANITES',
    });
    const enemyPlayer = createPlayer({
      id: 'player2',
      name: 'Opponent',
      factionId: 'NEPHITES',
      stats: { faith: 60, pride: 20, internalDissent: 10 },
      turnOrder: 1,
    });

    const unit = createUnit({
      id: 'hunter',
      playerId: 'player1',
      type: 'wilderness_hunter',
      abilities: ['FOREST_STEALTH', 'AMBUSH'],
      coordinate: { q: 0, r: 0, s: 0 },
      defense: getUnitDefinition('wilderness_hunter').baseStats.defense,
    });

    const state: GameState = {
      id: 'guerrilla-test',
      players: [lamaPlayer, enemyPlayer],
      units: [unit],
      currentPlayerIndex: 0,
      turn: 1,
      phase: 'playing',
      map: {
        width: 4,
        height: 4,
        tiles: [
          { coordinate: { q: 0, r: 0, s: 0 }, terrain: 'forest', resources: [], hasCity: false, exploredBy: ['player1'] },
          { coordinate: { q: 1, r: 0, s: -1 }, terrain: 'plains', resources: [], hasCity: false, exploredBy: ['player1'] },
        ],
      },
      cities: [],
      improvements: [],
      structures: [],
      lastAction: undefined,
      winner: undefined,
    };

    const buffedState = resolveActionState(state, {
      type: 'USE_ABILITY',
      payload: { playerId: 'player1', abilityId: 'lamanite_guerrilla_tactics' },
    });

    const buffedUnit = buffedState.units.find(u => u.id === 'hunter');
    expect(buffedUnit?.defense).toBeGreaterThan(unit.defense);

    const movedState = resolveActionState(buffedState, {
      type: 'MOVE_UNIT',
      payload: { unitId: 'hunter', targetCoordinate: { q: 1, r: 0, s: -1 } },
    });

    const movedUnit = movedState.units.find(u => u.id === 'hunter');
    expect(movedUnit?.defense).toBe(getUnitDefinition('wilderness_hunter').baseStats.defense);
  });

  it('applies anti-cavalry bonus against fast units', () => {
    const attacker = createUnit({
      id: 'spearman',
      type: 'spearman',
      attack: 7,
      abilities: ['ANTI_CAVALRY'],
    });
    const defender = createUnit({
      id: 'scout',
      type: 'scout',
      playerId: 'player2',
      defense: 4,
      movement: 5,
      coordinate: { q: 1, r: 0, s: -1 },
    });

    const player1 = createPlayer({ stats: { faith: 20, pride: 20, internalDissent: 10 } });
    const player2 = createPlayer({
      id: 'player2',
      name: 'Fast Defender',
      factionId: 'NEPHITES',
      stats: { faith: 20, pride: 20, internalDissent: 10 },
      turnOrder: 1,
    });

    const withBonus = resolveActionState(baseState([player1, player2], [attacker, defender]), {
      type: 'ATTACK_UNIT',
      payload: { attackerId: 'spearman', targetId: 'scout' },
    });
    const defenderAfterBonus = withBonus.units.find(unit => unit.id === 'scout');

    const noBonusAttacker = { ...attacker, abilities: [] };
    const withoutBonus = resolveActionState(baseState([player1, player2], [noBonusAttacker, defender]), {
      type: 'ATTACK_UNIT',
      payload: { attackerId: 'spearman', targetId: 'scout' },
    });
    const defenderAfterNoBonus = withoutBonus.units.find(unit => unit.id === 'scout');

    expect(defenderAfterBonus?.hp).toBeLessThan(defenderAfterNoBonus?.hp);
  });

  it('applies leadership aura to adjacent allies for attack and defense', () => {
    const attacker = createUnit({ id: 'attacker', attack: 6, defense: 3 });
    const defender = createUnit({
      id: 'defender',
      playerId: 'player2',
      attack: 6,
      defense: 3,
      coordinate: { q: 1, r: 0, s: -1 },
    });
    const commander = createUnit({
      id: 'commander',
      type: 'commander',
      abilities: ['LEADERSHIP'],
      coordinate: { q: 0, r: 1, s: -1 },
    });

    const player1 = createPlayer({ stats: { faith: 20, pride: 20, internalDissent: 10 } });
    const player2 = createPlayer({
      id: 'player2',
      name: 'Defender',
      factionId: 'NEPHITES',
      stats: { faith: 20, pride: 20, internalDissent: 10 },
      turnOrder: 1,
    });

    const withoutLeader = resolveActionState(baseState([player1, player2], [attacker, defender]), {
      type: 'ATTACK_UNIT',
      payload: { attackerId: 'attacker', targetId: 'defender' },
    });
    const withoutLeaderDefender = withoutLeader.units.find(unit => unit.id === 'defender');
    const withoutLeaderAttacker = withoutLeader.units.find(unit => unit.id === 'attacker');

    const withLeader = resolveActionState(baseState([player1, player2], [attacker, defender, commander]), {
      type: 'ATTACK_UNIT',
      payload: { attackerId: 'attacker', targetId: 'defender' },
    });
    const withLeaderDefender = withLeader.units.find(unit => unit.id === 'defender');
    const withLeaderAttacker = withLeader.units.find(unit => unit.id === 'attacker');

    expect(withLeaderDefender?.hp).toBeLessThan(withoutLeaderDefender?.hp);
    expect(withLeaderAttacker?.hp).toBeGreaterThan(withoutLeaderAttacker?.hp);
  });

  it('applies fortify defense bonus when a fortified unit defends', () => {
    const attacker = createUnit({ id: 'attacker', attack: 12 });
    const defender = createUnit({
      id: 'defender',
      playerId: 'player2',
      type: 'guard',
      defense: 4,
      abilities: ['FORTIFY'],
      status: 'defending',
      coordinate: { q: 1, r: 0, s: -1 },
    });

    const player1 = createPlayer({ stats: { faith: 20, pride: 20, internalDissent: 10 } });
    const player2 = createPlayer({
      id: 'player2',
      name: 'Fortified Defender',
      factionId: 'NEPHITES',
      stats: { faith: 20, pride: 20, internalDissent: 10 },
      turnOrder: 1,
    });

    const fortifiedResult = resolveActionState(baseState([player1, player2], [attacker, defender]), {
      type: 'ATTACK_UNIT',
      payload: { attackerId: 'attacker', targetId: 'defender' },
    });
    const fortifiedDefender = fortifiedResult.units.find(unit => unit.id === 'defender');

    const unfortifiedDefender = { ...defender, status: 'active' as const };
    const unfortifiedResult = resolveActionState(baseState([player1, player2], [attacker, unfortifiedDefender]), {
      type: 'ATTACK_UNIT',
      payload: { attackerId: 'attacker', targetId: 'defender' },
    });
    const unfortifiedDefenderAfter = unfortifiedResult.units.find(unit => unit.id === 'defender');

    expect(fortifiedDefender?.hp).toBeGreaterThan(unfortifiedDefenderAfter?.hp);
  });

  it('applies terrain defense bonus based on defender tile', () => {
    const attacker = createUnit({ id: 'attacker', attack: 10 });
    const defender = createUnit({
      id: 'defender',
      playerId: 'player2',
      defense: 2,
      coordinate: { q: 1, r: 0, s: -1 },
    });

    const player1 = createPlayer({ stats: { faith: 20, pride: 20, internalDissent: 10 } });
    const player2 = createPlayer({
      id: 'player2',
      name: 'Terrain Defender',
      factionId: 'NEPHITES',
      stats: { faith: 20, pride: 20, internalDissent: 10 },
      turnOrder: 1,
    });

    const mountainState = baseState([player1, player2], [attacker, defender]);
    const mountainTile = mountainState.map.tiles.find(tile => tile.coordinate.q === 1 && tile.coordinate.r === 0);
    if (mountainTile) {
      mountainTile.terrain = 'mountain';
    } else {
      mountainState.map.tiles.push({
        coordinate: { q: 1, r: 0, s: -1 },
        terrain: 'mountain',
        resources: [],
        hasCity: false,
        exploredBy: ['player1'],
      });
    }
    const mountainResult = resolveActionState(mountainState, {
      type: 'ATTACK_UNIT',
      payload: { attackerId: 'attacker', targetId: 'defender' },
    });
    const mountainDefender = mountainResult.units.find(unit => unit.id === 'defender');

    const plainsState = baseState([player1, player2], [attacker, defender]);
    const plainsResult = resolveActionState(plainsState, {
      type: 'ATTACK_UNIT',
      payload: { attackerId: 'attacker', targetId: 'defender' },
    });
    const plainsDefender = plainsResult.units.find(unit => unit.id === 'defender');

    expect(mountainDefender?.hp).toBeGreaterThan(plainsDefender?.hp);
  });

  it('triggers blood feud when the attacker dies in combat', () => {
    const attacker = createUnit({
      id: 'attacker',
      playerId: 'player1',
      attack: 4,
      defense: 2,
      hp: 6,
      maxHp: 6,
    });
    const defender = createUnit({
      id: 'defender',
      playerId: 'player2',
      attack: 10,
      defense: 6,
      hp: 20,
      coordinate: { q: 1, r: 0, s: -1 },
    });
    const ally = createUnit({
      id: 'ally',
      playerId: 'player1',
      attack: 3,
      coordinate: { q: 0, r: 1, s: -1 },
    });

    const player1 = createPlayer({
      factionId: 'LAMANITES',
      stats: { faith: 20, pride: 20, internalDissent: 10 },
    });
    const player2 = createPlayer({
      id: 'player2',
      name: 'Defender',
      factionId: 'NEPHITES',
      stats: { faith: 20, pride: 20, internalDissent: 10 },
      turnOrder: 1,
    });

    const state = baseState([player1, player2], [attacker, defender, ally]);
    const result = resolveActionState(state, {
      type: 'ATTACK_UNIT',
      payload: { attackerId: 'attacker', targetId: 'defender' },
    });

    const attackerAfter = result.units.find(unit => unit.id === 'attacker');
    const allyAfter = result.units.find(unit => unit.id === 'ally');

    expect(attackerAfter).toBeUndefined();
    expect(result.activeEffects?.some(effect => effect.source.abilityId === 'BLOOD_FEUD')).toBe(true);
    expect(computeEffectiveStats(allyAfter!, result, { role: 'attacker' }).attack).toBe(5);
  });
});
