import { GameState, PlayerState } from "../../types/game";
import { Unit, UnitType } from "../../types/unit";
import { HexCoordinate } from "../../types/coordinates";
import { coerceFactionId } from "../../types/factionId";
import { hexDistance, hexNeighbors } from "../../utils/hex";
import { getUnitDefinition } from "../../data/units";
import { getActiveModifiers, getUnitModifiers, GameModifier } from "../../data/modifiers";
import { TECHNOLOGIES } from "../../data/technologies";
import { GAME_RULES, GameRuleHelpers } from "../../data/gameRules";
import { IMPROVEMENT_DEFINITIONS, STRUCTURE_DEFINITIONS } from "../../types/city";
import { areCitiesConnectedByRoad } from "../tradeRoutes";
import { applyPopulationGain } from "../cityGrowth";
import { computeUnitPassiveEffectsForPlayer } from "../unitPassiveEffects";
import { nextId } from "../rng";
import { clamp01 } from "../../utils/math";
import { applyMoralDelta, clampStat, pickWeightedIndex } from "./helpers";
import { applyYieldModifiers, getPlayerYieldModifiers, tickActiveEffectsForPlayer } from "../activeEffects";
import { getUnitSpawnCoordinate } from "./spawnUtils";
import { applyStatusEffect } from "../statusEffects";
import { applyTestimonyPressureToTargets, getTestimonyPressureSelection } from "../testimonyPressure";
import { onTurnStartUnit } from "../effects";
import { getUnitAttackRangeFromDefinition, resetUnitActions, spendUnitActions } from "../unitLogic";
import { findNextTurnPlayerIndex, normalizeTurnPlayerIndex } from "../turnOrder";
import { resolveFaithProjectOnEndTurn } from "../faithProject";


export type VictoryType = "faith" | "territorial" | "elimination" | "economic" | "cultural" | "domination";
export type VictoryResult = { winnerId: string; victoryType: VictoryType };
type TradeRoute = NonNullable<PlayerState["tradeRoutes"]>[number];
type UnitPassiveEffects = ReturnType<typeof computeUnitPassiveEffectsForPlayer>;

function calculateRoadConnectedCityStarBonus(state: GameState, playerId: string): number {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return 0;

  const ownedCities = (state.cities || []).filter(city => city.ownerId === playerId);
  if (ownedCities.length < 2) return 0;

  const roadKeys = new Set(
    (state.improvements || [])
      .filter(imp => imp.ownerId === playerId)
      .filter(imp => imp.type === 'road')
      .filter(imp => imp.constructionTurns === 0)
      .map(imp => `${imp.coordinate.q},${imp.coordinate.r}`)
  );

  if (roadKeys.size === 0) return 0;

  const cityKeys = new Set(ownedCities.map(city => `${city.coordinate.q},${city.coordinate.r}`));
  const visited = new Set<string>();
  let bonus = 0;

  for (const city of ownedCities) {
    const startKey = `${city.coordinate.q},${city.coordinate.r}`;
    if (visited.has(startKey)) continue;

    // Cities only connect if they have at least one adjacent road
    const hasAdjacentRoad = hexNeighbors(city.coordinate).some(n => roadKeys.has(`${n.q},${n.r}`));
    if (!hasAdjacentRoad) {
      visited.add(startKey);
      continue;
    }

    const queue: HexCoordinate[] = [city.coordinate];
    const componentCities = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentKey = `${current.q},${current.r}`;
      if (visited.has(currentKey)) continue;
      visited.add(currentKey);

      const isCity = cityKeys.has(currentKey);
      const isRoad = roadKeys.has(currentKey);

      if (isCity) componentCities.add(currentKey);

      for (const neighbor of hexNeighbors(current)) {
        const neighborKey = `${neighbor.q},${neighbor.r}`;

        // Travel rules:
        // - From city: can only step onto adjacent road tiles
        // - From road: can step onto road tiles and city tiles
        const canTraverse =
          (isCity && roadKeys.has(neighborKey)) ||
          (isRoad && (roadKeys.has(neighborKey) || cityKeys.has(neighborKey)));

        if (canTraverse && !visited.has(neighborKey)) {
          queue.push(neighbor);
        }
      }
    }

    // Each connected component grants +1★/turn per additional city beyond the first.
    bonus += Math.max(0, componentCities.size - 1);
  }

  // Trade amplifies connected-city commerce.
  const multiplier = player.researchedTechs?.includes('trade') ? 2 : 1;
  return bonus * multiplier;
}

function getValidTradeRoutes(state: GameState, player: PlayerState): TradeRoute[] {
  const rawRoutes = player.tradeRoutes || [];
  if (rawRoutes.length === 0) return [];
  return rawRoutes.filter(route => {
    if (!player.citiesOwned.includes(route.fromCityId)) return false;
    if (!player.citiesOwned.includes(route.toCityId)) return false;
    return areCitiesConnectedByRoad(state, player.id, route.fromCityId, route.toCityId);
  });
}

export function calculatePlayerStarIncome(
  state: GameState,
  player: PlayerState,
  options?: {
    unitPassive?: UnitPassiveEffects;
    validTradeRoutes?: TradeRoute[];
    statsOverride?: PlayerState['stats'];
  }
): number {
  const stats = options?.statsOverride ?? player.stats;
  const unitPassive = options?.unitPassive ?? computeUnitPassiveEffectsForPlayer(state, player.id, stats);
  const validTradeRoutes = options?.validTradeRoutes ?? getValidTradeRoutes(state, player);

  let starIncome = 0;
  const playerCityObjects = state.cities?.filter(city => city.ownerId === player.id) || [];
  playerCityObjects.forEach(city => {
    const unrestTurns = city.unrestTurns || 0;
    const unrestPenalty = unrestTurns > 0 ? GAME_RULES.morale.unrestIncomePenaltyPerCity : 0;
    starIncome += Math.max(0, city.starProduction - unrestPenalty);
  });

  if (playerCityObjects.length === 0) {
    starIncome = GameRuleHelpers.calculateStarIncome(player.citiesOwned.length);
  }

  const playerImprovements = state.improvements?.filter(imp => imp.ownerId === player.id) || [];
  const factionId = coerceFactionId(player.factionId);
  playerImprovements.forEach(improvement => {
    const improvementDef = IMPROVEMENT_DEFINITIONS[improvement.type as keyof typeof IMPROVEMENT_DEFINITIONS];
    if (improvementDef && improvement.constructionTurns === 0) {
      let production = improvement.starProduction;
      const hasHagothPortBonus = factionId === 'HAGOTHS_MARINERS';
      if (improvement.type === 'port' && (hasHagothPortBonus || player.researchedTechs?.includes('seafaring'))) {
        production += 1;
      }
      starIncome += production;
    }
  });

  const playerStructures = state.structures?.filter(struct => struct.ownerId === player.id) || [];
  playerStructures.forEach(structure => {
    const structureDef = STRUCTURE_DEFINITIONS[structure.type as keyof typeof STRUCTURE_DEFINITIONS];
    if (structureDef && structure.constructionTurns === 0) {
      starIncome += structure.effects.starProduction;
    }
  });

  const convertedVillages = state.map.tiles.filter(tile =>
    tile.feature === 'village' &&
    tile.cityOwner === player.id &&
    tile.captureType === 'converted' &&
    tile.starBonus
  );
  const villageBonus = convertedVillages.reduce((sum, tile) => sum + (tile.starBonus || 0), 0);
  starIncome += villageBonus;

  const roadBonus = calculateRoadConnectedCityStarBonus(state, player.id);
  starIncome += roadBonus;

  const tradeIncome = validTradeRoutes.reduce((sum, r) => sum + (r.starsPerTurn || 0), 0);
  starIncome += tradeIncome;

  starIncome += unitPassive.perTurn.stars || 0;

  return applyYieldModifiers(starIncome, getPlayerYieldModifiers(state, player.id, 'stars'));
}

export function calculatePlayerFaithGeneration(
  state: GameState,
  player: PlayerState,
  options?: {
    unitPassive?: UnitPassiveEffects;
    statsOverride?: PlayerState['stats'];
  }
): number {
  const stats = options?.statsOverride ?? player.stats;
  const unitPassive = options?.unitPassive ?? computeUnitPassiveEffectsForPlayer(state, player.id, stats);
  const playerCities = player.citiesOwned.length;

  const baseFaith = GameRuleHelpers.calculateFaithGeneration(playerCities);

  const faithFromStructures = (state.structures || [])
    .filter(s => s.ownerId === player.id && s.constructionTurns === 0)
    .reduce((sum, s) => {
      const def = STRUCTURE_DEFINITIONS[s.type as keyof typeof STRUCTURE_DEFINITIONS];
      return sum + (s.effects?.faithProduction ?? def?.effects?.faithProduction ?? 0);
    }, 0);

  const faithFromImprovements = (state.improvements || [])
    .filter(imp => imp.ownerId === player.id && imp.constructionTurns === 0)
    .reduce((sum, imp) => {
      const def = IMPROVEMENT_DEFINITIONS[imp.type as keyof typeof IMPROVEMENT_DEFINITIONS];
      return sum + (def?.effects?.faithProduction ?? 0);
    }, 0);

  const missionaries = state.units.filter(u =>
    u.playerId === player.id &&
    u.type === 'missionary'
  ).length;
  const missionaryFaith = Math.min(
    missionaries * GAME_RULES.resources.faithPerMissionary,
    GAME_RULES.resources.maxMissionaryFaithBonus
  );

  const faithGeneration =
    baseFaith +
    faithFromStructures +
    faithFromImprovements +
    missionaryFaith +
    (unitPassive.perTurn.faith || 0);

  return applyYieldModifiers(faithGeneration, getPlayerYieldModifiers(state, player.id, 'faith'));
}

function getPlayerPopulation(state: GameState, playerId: string): number {
  const cities = (state.cities || []).filter(c => c.ownerId === playerId);
  return cities.reduce((sum, city) => sum + (city.population || 0), 0);
}

function getCulturalStructureCount(state: GameState, playerId: string): number {
  const targets = GameRuleHelpers.getCulturalVictoryThresholds(state.players.length);
  const structureCount = (state.structures || []).filter(
    s => s.ownerId === playerId && s.constructionTurns === 0 && targets.structureTypes.includes(s.type)
  ).length;
  const improvementCount = (state.improvements || []).filter(
    i => i.ownerId === playerId && i.constructionTurns === 0 && targets.improvementTypes.includes(i.type)
  ).length;
  return structureCount + improvementCount;
}

function getVictoryTiebreakStats(state: GameState, player: PlayerState) {
  return {
    cities: player.citiesOwned.length,
    techs: player.researchedTechs.length,
    units: state.units.filter(u => u.playerId === player.id).length,
  };
}

function pickWinnerByTiebreaker(state: GameState, candidates: PlayerState[]): PlayerState | undefined {
  if (candidates.length === 0) return undefined;
  return [...candidates].sort((a, b) => {
    const aStats = getVictoryTiebreakStats(state, a);
    const bStats = getVictoryTiebreakStats(state, b);
    if (aStats.cities !== bStats.cities) return bStats.cities - aStats.cities;
    if (aStats.techs !== bStats.techs) return bStats.techs - aStats.techs;
    return bStats.units - aStats.units;
  })[0];
}

function getActiveEffectSourceTurnMoralDelta(state: GameState, playerId: string) {
  return (state.activeEffects || []).reduce(
    (delta, effect) => {
      if (effect.turnsRemaining <= 0) return delta;
      if (effect.tickOn !== "source_turn_end" || effect.source.playerId !== playerId) return delta;

      const sourceTurnStatDeltas = effect.metadata?.sourceTurnStatDeltas;
      if (!sourceTurnStatDeltas || typeof sourceTurnStatDeltas !== "object") return delta;

      const values = sourceTurnStatDeltas as Record<string, unknown>;
      return {
        faith: delta.faith + (typeof values.faith === "number" ? values.faith : 0),
        pride: delta.pride + (typeof values.pride === "number" ? values.pride : 0),
        dissent: delta.dissent + (typeof values.dissent === "number" ? values.dissent : 0),
      };
    },
    { faith: 0, pride: 0, dissent: 0 }
  );
}


// Start Construction Handler - adds to construction queue
// Build Improvement Handler
// Build Structure Handler
// Capture City Handler
// Conquer Village Handler - Military takeover
// Convert Village Handler - Peaceful integration
// Explore Ruins Handler
// World Element Action Handlers
// Recruit Unit Handler
// Rename City Handler
export function handleEndTurn(
  state: GameState,
  payload: { playerId: string }
): GameState {
  if (state.phase === 'ended') return state;

  const currentPlayerIndex = normalizeTurnPlayerIndex(state.players, state.currentPlayerIndex);
  const currentPlayer = currentPlayerIndex >= 0 ? state.players[currentPlayerIndex] : undefined;
  if (!currentPlayer) return state;
  if (currentPlayer.id !== payload.playerId) return state;

  let updatedCities = [...(state.cities || [])];
  let pendingDesertedUnitId: string | null = null;
  const endTurnEvents: Array<{ type: string; payload: any }> = [];
  let rngSeed = state.rngSeed ?? 0;
  const rand = () => {
    // Deterministic PRNG (LCG). Keeps tests stable and makes runs replayable per seed.
    rngSeed = (Math.imul(rngSeed, 1664525) + 1013904223) >>> 0;
    return rngSeed / 4294967296;
  };

  // Apply end-of-turn effects for current player
  let updatedPlayers = state.players.map(player => {
    if (player.id === currentPlayer.id) {
      const endTurnModifiers = getActiveModifiers(player, 'on_turn_end');
      let updatedStats = { ...player.stats };

      endTurnModifiers.forEach(modifier => {
        modifier.effect.forEach(effect => {
          if (effect.stat === 'pride' || effect.stat === 'faith' || effect.stat === 'internalDissent') {
            updatedStats = {
              ...updatedStats,
              [effect.stat]: Math.max(0, Math.min(100, updatedStats[effect.stat as keyof typeof updatedStats] + effect.value))
            };
          }
        });
      });

      const activeEffectMoralDelta = getActiveEffectSourceTurnMoralDelta(state, player.id);
      if (activeEffectMoralDelta.faith || activeEffectMoralDelta.pride || activeEffectMoralDelta.dissent) {
        updatedStats = applyMoralDelta(updatedStats, activeEffectMoralDelta);
      }

      // Resource generation from cities and improvements using centralized rules
      const unitPassive = computeUnitPassiveEffectsForPlayer(state, player.id, updatedStats);
      const faithGeneration = calculatePlayerFaithGeneration(state, player, {
        unitPassive,
        statsOverride: updatedStats,
      });

      // Trade route income: persistent per-turn income, and validated (routes can disappear if the network breaks).
      const validTradeRoutes = getValidTradeRoutes(state, player);

      const starIncome = calculatePlayerStarIncome(state, player, {
        unitPassive,
        validTradeRoutes,
        statsOverride: updatedStats
      });

      // Passive per-turn moral shifts from units should influence this turn's morale outcomes.
      if (unitPassive.perTurn.pride || unitPassive.perTurn.dissent) {
        updatedStats = applyMoralDelta(updatedStats, {
          pride: unitPassive.perTurn.pride || 0,
          dissent: unitPassive.perTurn.dissent || 0,
        });
      }

      // === Morale System (Pride Cycle + Dissent Events) ===
      // Book of Mormon-inspired pattern:
      // prosperity → pride → contention → loss → humility → deliverance.
      const temples = (state.structures || []).filter(s =>
        s.ownerId === player.id &&
        s.constructionTurns === 0 &&
        s.type === 'temple'
      ).length;
      const wars = player.atWarWith?.length || 0;
      const alliances = player.alliedWith?.length || 0;

      // Drift: prosperity tends to inflate pride; pride tends to breed contention (dissent).
      const prosperityScore = starIncome + Math.floor(Math.max(0, player.stars - 10) / 15); // avoids early-game runaway pride
      const prideFromProsperity = Math.min(2, Math.floor(prosperityScore / 12));
      const dissentFromPride = Math.min(3, Math.floor(updatedStats.pride / 35));
      const dissentFromWar = wars > 0 ? Math.min(4, wars * 1) : 0;
      const dissentRelief = Math.min(4, alliances + temples);

      updatedStats = applyMoralDelta(updatedStats, {
        pride: prideFromProsperity,
        dissent: dissentFromPride + dissentFromWar - dissentRelief,
      });

      // Humility pressure: sustained faith and worship tends to humble pride over time.
      const prideHumble =
        (updatedStats.faith >= 70 ? 1 : 0) +
        (temples >= 1 ? 1 : 0);
      if (prideHumble > 0) {
        updatedStats = applyMoralDelta(updatedStats, { pride: -prideHumble });
      }

      // Random-feeling events (scaled by Pride + Dissent). Moderate severity.
      const prideN = updatedStats.pride / 100;
      const dissentN = updatedStats.internalDissent / 100;
      const badPressure = clamp01(0.65 * prideN + 0.35 * dissentN);
      const goodPressure = clamp01(1 - Math.max(prideN, dissentN));

      const badChance = GAME_RULES.morale.badChanceBase + GAME_RULES.morale.badChanceScale * Math.pow(badPressure, 2);
      const goodChance = GAME_RULES.morale.goodChanceMax * Math.pow(goodPressure, 1.35);

      let starsDeltaFromEvent = 0;
      let moraleCityIdToRebel: string | null = null;

      const rollBad = rand();
      if (rollBad < badChance) {
        const canDesert = updatedStats.internalDissent >= GAME_RULES.morale.desertionFloorDissent;

        const rebellionWeight = 2 + updatedStats.internalDissent / 15;     // more likely with dissent
        const desertionWeight = canDesert ? (0.5 + updatedStats.internalDissent / 30) : 0;
        const contentionWeight = 2 + updatedStats.pride / 20;              // more likely with pride (riches lost)

        const eventIndex = pickWeightedIndex(
          [rebellionWeight, desertionWeight, contentionWeight],
          rand()
        );

        if (eventIndex === 0) {
          // Rebellion: city unrest + small immediate loss
          const ownedCities = (state.cities || []).filter(c => c.ownerId === player.id);
          if (ownedCities.length > 0) {
            moraleCityIdToRebel = ownedCities[pickWeightedIndex(new Array(ownedCities.length).fill(1), rand())].id;
            starsDeltaFromEvent -= GAME_RULES.morale.rebellionStarsLoss;
            updatedStats = applyMoralDelta(updatedStats, { dissent: 5, pride: -2 });
            endTurnEvents.push({ type: 'MORALE_EVENT', payload: { playerId: player.id, kind: 'rebellion', cityId: moraleCityIdToRebel, starsDelta: -GAME_RULES.morale.rebellionStarsLoss } });
          } else {
            // fallback to contention
            starsDeltaFromEvent -= GAME_RULES.morale.contentionStarsLoss;
            updatedStats = applyMoralDelta(updatedStats, { dissent: 3, pride: -2 });
            endTurnEvents.push({ type: 'MORALE_EVENT', payload: { playerId: player.id, kind: 'contention', starsDelta: -GAME_RULES.morale.contentionStarsLoss } });
          }
        } else if (eventIndex === 1) {
          // Desertion: lose a unit (only possible at high dissent) + small immediate loss
          const deserters = state.units
            .filter(u => u.playerId === player.id)
            .filter(u => u.type !== 'worker'); // workers are less "army desertion"
          if (deserters.length > 0) {
            const deserter = deserters[pickWeightedIndex(new Array(deserters.length).fill(1), rand())];
            pendingDesertedUnitId = deserter.id;
            starsDeltaFromEvent -= GAME_RULES.morale.desertionStarsLoss;
            updatedStats = applyMoralDelta(updatedStats, { dissent: 2, pride: -3 });
            endTurnEvents.push({ type: 'MORALE_EVENT', payload: { playerId: player.id, kind: 'desertion', unitId: deserter.id, starsDelta: -GAME_RULES.morale.desertionStarsLoss } });
          } else {
            // fallback to contention
            starsDeltaFromEvent -= GAME_RULES.morale.contentionStarsLoss;
            updatedStats = applyMoralDelta(updatedStats, { dissent: 3, pride: -2 });
            endTurnEvents.push({ type: 'MORALE_EVENT', payload: { playerId: player.id, kind: 'contention', starsDelta: -GAME_RULES.morale.contentionStarsLoss } });
          }
        } else {
          // Contention: small loss of riches, dissent rises, pride is humbled.
          starsDeltaFromEvent -= GAME_RULES.morale.contentionStarsLoss;
          updatedStats = applyMoralDelta(updatedStats, { dissent: 4, pride: -3 });
          endTurnEvents.push({ type: 'MORALE_EVENT', payload: { playerId: player.id, kind: 'contention', starsDelta: -GAME_RULES.morale.contentionStarsLoss } });
        }
      } else {
        const rollGood = rand();
        if (rollGood < goodChance) {
          // Blessings of humility/peace: modest gains, stability, and strengthened faith.
          const starsGain = 4 + Math.floor(6 * rand()); // 4..9
          starsDeltaFromEvent += starsGain;
          updatedStats = applyMoralDelta(updatedStats, { faith: 3, dissent: -4, pride: -2 });
          endTurnEvents.push({ type: 'MORALE_EVENT', payload: { playerId: player.id, kind: 'blessing', starsDelta: starsGain } });
        }
      }

      updatedStats.faith = clampStat(updatedStats.faith + faithGeneration);

      // Process construction queue
      const updatedConstructionQueue = (player.constructionQueue || []).map(item => ({
        ...item,
        turnsRemaining: item.turnsRemaining - 1
      }));

      // Complete finished constructions
      const completedConstructions = updatedConstructionQueue.filter(item => item.turnsRemaining <= 0);
      const ongoingConstructions = updatedConstructionQueue.filter(item => item.turnsRemaining > 0);

      // Decrement diplomatic cooldowns
      const currentCooldowns = player.diplomaticCooldowns || { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 };
      const updatedCooldowns = {
        declareWar: Math.max(0, currentCooldowns.declareWar - 1),
        formAlliance: Math.max(0, currentCooldowns.formAlliance - 1),
        breakAlliance: Math.max(0, currentCooldowns.breakAlliance - 1),
        requestTrade: Math.max(0, currentCooldowns.requestTrade - 1),
      };

      // Additional cooldown adjustments from passive units (e.g., Scribe-Teacher).
      const cd = unitPassive.cooldownDelta || {};
      if (cd.declareWar || cd.formAlliance || cd.breakAlliance || cd.requestTrade) {
        updatedCooldowns.declareWar = Math.max(0, updatedCooldowns.declareWar + (cd.declareWar || 0));
        updatedCooldowns.formAlliance = Math.max(0, updatedCooldowns.formAlliance + (cd.formAlliance || 0));
        updatedCooldowns.breakAlliance = Math.max(0, updatedCooldowns.breakAlliance + (cd.breakAlliance || 0));
        updatedCooldowns.requestTrade = Math.max(0, updatedCooldowns.requestTrade + (cd.requestTrade || 0));
      }

      // Decrement ability cooldowns
      const abilityCooldowns = player.abilityCooldowns || {};
      const updatedAbilityCooldowns = Object.fromEntries(
        Object.entries(abilityCooldowns).map(([key, value]) => [key, Math.max(0, value - 1)])
      );

      // Tick down existing unrest AFTER it affected this turn's income
      updatedCities = updatedCities.map(city => {
        if (city.ownerId !== player.id) return city;
        const unrestTurns = city.unrestTurns || 0;
        if (unrestTurns <= 0) return city;
        return { ...city, unrestTurns: Math.max(0, unrestTurns - 1) };
      });

      // Apply new rebellion (starts next turn at full duration)
      if (moraleCityIdToRebel) {
        updatedCities = updatedCities.map(city =>
          city.id === moraleCityIdToRebel
            ? { ...city, unrestTurns: Math.max(city.unrestTurns || 0, GAME_RULES.morale.unrestDurationTurns) }
            : city
        );
      }

      return {
        ...player,
        stats: updatedStats,
        stars: Math.max(0, player.stars + starIncome + starsDeltaFromEvent),
        tradeRoutes: validTradeRoutes,
        constructionQueue: ongoingConstructions,
        completedConstructions, // We'll handle this below
        diplomaticCooldowns: updatedCooldowns,
        abilityCooldowns: updatedAbilityCooldowns
      };
    }
    return player;
  });

  // Process completed constructions and add to game state
  let updatedUnits = [...state.units];
  let updatedImprovements = [...(state.improvements || [])];
  let updatedStructures = [...(state.structures || [])];
  let updatedActiveEffects = [...(state.activeEffects || [])];

  updatedPlayers.forEach(player => {
    if ((player as any).completedConstructions) {
      (player as any).completedConstructions.forEach((construction: any) => {
        if (construction.category === 'units') {
          // Create new unit within 2 tiles of city
          const city = state.cities?.find(c => c.id === construction.cityId);
          if (city) {
            const unitDef = getUnitDefinition(construction.type as any);
            const spawnState: GameState = {
              ...state,
              players: updatedPlayers,
              units: updatedUnits,
              improvements: updatedImprovements,
              structures: updatedStructures,
              cities: updatedCities
            };
            const spawnCoordinate = getUnitSpawnCoordinate(
              spawnState,
              construction.type as UnitType,
              city.coordinate,
              construction.coordinate
            );
            if (!spawnCoordinate) return;
            const unitIdResult = nextId(rngSeed, "unit");
            rngSeed = unitIdResult.seed;
            const newUnit = {
              id: unitIdResult.id,
              status: 'active' as const,
              type: construction.type,
              playerId: construction.playerId,
              coordinate: spawnCoordinate,
              remainingMovement: unitDef.baseStats.movement,
              maxActions: unitDef.baseStats.actions,
              actionsRemaining: unitDef.baseStats.actions,
              hasAttacked: false,
              hp: unitDef.baseStats.hp,
              maxHp: unitDef.baseStats.hp,
              attack: unitDef.baseStats.attack,
              defense: unitDef.baseStats.defense,
              movement: unitDef.baseStats.movement,
              visionRadius: unitDef.baseStats.visionRadius,
              attackRange: getUnitAttackRangeFromDefinition(unitDef),
              abilities: unitDef.abilities || [],
              level: 1,
              experience: 0,
            };
            updatedUnits.push(newUnit);
          }
        } else if (construction.category === 'improvements') {
          // Create new improvement
          const improvementDef = IMPROVEMENT_DEFINITIONS[construction.type as keyof typeof IMPROVEMENT_DEFINITIONS];
          const newImprovement = {
            id: construction.id,
            type: construction.type,
            coordinate: construction.coordinate,
            ownerId: construction.playerId,
            starProduction: improvementDef?.starProduction || 0,
            cityId: construction.cityId,
            constructionTurns: 0,
          };
          updatedImprovements.push(newImprovement);
          const populationGain = improvementDef?.effects?.populationGrowth ?? 0;
          if (populationGain > 0) {
            updatedCities = updatedCities.map(city =>
              city.id === construction.cityId ? applyPopulationGain(city, populationGain) : city
            );
          }
        } else if (construction.category === 'structures') {
          // Create new structure
          const structureDef = STRUCTURE_DEFINITIONS[construction.type as keyof typeof STRUCTURE_DEFINITIONS];
          const newStructure = {
            id: construction.id,
            type: construction.type,
            coordinate: construction.coordinate,
            ownerId: construction.playerId,
            effects: {
              starProduction: structureDef?.effects?.starProduction ?? 0,
              unitProduction: structureDef?.effects?.unitProduction ?? 0,
              defenseBonus: structureDef?.effects?.defenseBonus ?? 0,
              populationGrowth: structureDef?.effects?.populationGrowth ?? 0,
              faithProduction: structureDef?.effects?.faithProduction ?? 0,
            },
            cityId: construction.cityId,
            constructionTurns: 0,
          };
          updatedStructures.push(newStructure);
          // Structure populationGrowth is a one-time completion grant, not an end-turn yield.
          const populationGain = structureDef?.effects?.populationGrowth ?? 0;
          if (populationGain > 0) {
            updatedCities = updatedCities.map(city =>
              city.id === construction.cityId ? applyPopulationGain(city, populationGain) : city
            );
          }
        }
      });

      // Remove completedConstructions from player (temporary property)
      delete (player as any).completedConstructions;
    }
  });

  // Tick down end-of-turn unit effects for the player who just ended their turn.
  // Effects should last *through* a player turn and expire after they finish acting.
  updatedUnits = updatedUnits.map((u: Unit) => {
    if (u.playerId !== currentPlayer.id) return u;
    const effects = Array.isArray(u.statusEffects) ? u.statusEffects : [];
    if (effects.length === 0) return u;

    const nextEffects = effects
      .map(effect => {
        if (effect && typeof effect.turnsRemaining === 'number') {
          return { ...effect, turnsRemaining: effect.turnsRemaining - 1 };
        }
        return effect;
      })
      .filter(effect => {
        if (!effect) return false;
        if (typeof effect.turnsRemaining === 'number') {
          return effect.turnsRemaining > 0;
        }
        return true;
      });

    const hasRallied = nextEffects.some(effect => effect?.type === 'RALLIED');
    const nextStatus = !hasRallied && u.status === 'rallied' ? 'active' : u.status;

    return {
      ...u,
      status: nextStatus,
      statusEffects: nextEffects
    };
  });

  updatedActiveEffects = tickActiveEffectsForPlayer({
    ...state,
    players: updatedPlayers,
    units: updatedUnits,
    improvements: updatedImprovements,
    structures: updatedStructures,
    cities: updatedCities,
    activeEffects: updatedActiveEffects,
  }, currentPlayer.id).activeEffects || [];

  // Calculate next player and turn
  const nextPlayerIndex = findNextTurnPlayerIndex(updatedPlayers, currentPlayerIndex);
  const nextPlayer = nextPlayerIndex >= 0 ? updatedPlayers[nextPlayerIndex] : undefined;
  if (!nextPlayer) return state;
  const firstActivePlayerIndex = normalizeTurnPlayerIndex(updatedPlayers, 0);
  const isNewTurn = firstActivePlayerIndex >= 0 && nextPlayerIndex === firstActivePlayerIndex;

  // Apply desertion removal after end-of-turn effects resolve
  if (pendingDesertedUnitId) {
    updatedUnits = updatedUnits.filter(u => u.id !== pendingDesertedUnitId);
  }

  // Apply start-of-turn effects for next player
  updatedPlayers = updatedPlayers.map(player => {
    if (player.id === nextPlayer.id) {
      const startTurnModifiers = getActiveModifiers(player, 'on_turn_start');
      let updatedStats = { ...player.stats };

      startTurnModifiers.forEach(modifier => {
        modifier.effect.forEach(effect => {
          if (effect.stat === 'pride' || effect.stat === 'faith' || effect.stat === 'internalDissent') {
            updatedStats = {
              ...updatedStats,
              [effect.stat]: Math.max(0, Math.min(100, updatedStats[effect.stat as keyof typeof updatedStats] + effect.value))
            };
          }
        });
      });

      return { ...player, stats: updatedStats };
    }
    return player;
  });

  // Reset movement and attack status for next player's units at start of their turn
  updatedUnits = updatedUnits.map((u: Unit) => {
    if (u.playerId === nextPlayer.id) {
      // Reset movement and attack state for next player
      let resetUnit: Unit = {
        ...resetUnitActions(u),
        remainingMovement: u.movement
      };

      // Do not tick status durations here; durations are decremented at end-of-turn
      // so effects last for the full player turn.

      resetUnit = onTurnStartUnit(resetUnit, state);

      return resetUnit;
    }
    return u;
  });

  const getEffectEvaluationState = (): GameState => ({
    ...state,
    units: updatedUnits,
    players: updatedPlayers,
    improvements: updatedImprovements,
    structures: updatedStructures,
    cities: updatedCities,
    activeEffects: updatedActiveEffects,
  });

  // === Testimony Pressure (Missionaries) ===
  // Nephite / Anti-Nephi-Lehi missionaries can weaken adjacent enemy *military* units:
  // - temporary attack penalty
  // - clears temporary command buffs (rallied / rallyBuff / tacticalCommand)
  const currentPlayerData = updatedPlayers.find(p => p.id === currentPlayer.id);
  const actingFactionId = coerceFactionId(currentPlayerData?.factionId);
  const isTestimonyFaction = actingFactionId === 'NEPHITES' || actingFactionId === 'ANTI_NEPHI_LEHIES';
  const isAmuloniteFaction = actingFactionId === 'AMULONITES';
  const isEligibleEnemyMilitaryUnit = (u: Unit): boolean => {
    // Exclude civilian/influence units (prevents weird non-combat clumps and future drift).
    const def = getUnitDefinition(u.type as any);
    const tags = def?.tags ?? [];
    return !tags.includes('civilian') && !tags.includes('influence') && !tags.includes('diplomat');
  };

  if (isTestimonyFaction) {
    const pressureSelection = getTestimonyPressureSelection(getEffectEvaluationState(), currentPlayer.id, 1);

    if (pressureSelection.targetUnits.length > 0) {
      const penalty = GAME_RULES.influence.testimonyPressure.attackPenalty;
      const durationTurns = GAME_RULES.influence.testimonyPressure.durationTurns;
      const pressureResult = applyTestimonyPressureToTargets(
        getEffectEvaluationState(),
        currentPlayer.id,
        pressureSelection.targetUnits.map(unit => unit.id),
        { attackPenalty: penalty, durationTurns }
      );

      updatedUnits = pressureResult.units;

      if (pressureResult.appliedCount > 0) {
        endTurnEvents.push({
          type: 'TESTIMONY_PRESSURE',
          payload: {
            sourcePlayerId: currentPlayer.id,
            attackPenalty: penalty,
            durationTurns,
            affected: Object.entries(pressureResult.appliedByOwner).map(([playerId, unitIds]) => ({
              playerId,
              unitIds,
            })),
          }
        });
      }
    }
  }

  // === Intimidation Aura (Taskmasters) ===
  // Amulonite taskmasters apply an intimidation debuff to adjacent enemy military units.
  if (isAmuloniteFaction) {
    const myTaskmasters = updatedUnits.filter(u => u.playerId === currentPlayer.id && u.type === 'taskmaster');
    const affectedUnitIds = new Set<string>();

    myTaskmasters.forEach(taskmaster => {
      const adjacentEnemyUnits = updatedUnits.filter(u =>
        u.playerId !== currentPlayer.id &&
        isEligibleEnemyMilitaryUnit(u) &&
        hexDistance(u.coordinate, taskmaster.coordinate) <= 1
      );

      adjacentEnemyUnits.forEach(enemyUnit => {
        affectedUnitIds.add(enemyUnit.id);
      });
    });

    if (affectedUnitIds.size > 0) {
      const durationTurns = 1;
      const attackPenalty = 1;
      const appliedByOwner: Record<string, Set<string>> = {};

      updatedUnits = updatedUnits.map((u: any) => {
        if (!affectedUnitIds.has(u.id)) return u;

        const withEffect = applyStatusEffect(u, {
          type: 'INTIMIDATED',
          turnsRemaining: durationTurns,
          sourcePlayerId: currentPlayer.id,
        }, getEffectEvaluationState());

        if (!withEffect) return u;

        if (!appliedByOwner[u.playerId]) appliedByOwner[u.playerId] = new Set();
        appliedByOwner[u.playerId].add(u.id);
        return withEffect;
      });

      endTurnEvents.push({
        type: 'INTIMIDATION_AURA',
        payload: {
          sourcePlayerId: currentPlayer.id,
          attackPenalty,
          durationTurns,
          affected: Object.entries(appliedByOwner).map(([playerId, unitIds]) => ({
            playerId,
            unitIds: Array.from(unitIds),
          })),
        }
      });
    }
  }

  const faithProjectState: GameState = {
    ...state,
    units: updatedUnits,
    players: updatedPlayers,
    improvements: updatedImprovements,
    structures: updatedStructures,
    cities: updatedCities,
    activeEffects: updatedActiveEffects,
  };
  const faithProjectResolution = resolveFaithProjectOnEndTurn(faithProjectState, currentPlayer.id);
  if (faithProjectResolution.events.length > 0) {
    endTurnEvents.push(...faithProjectResolution.events);
  }
  updatedPlayers = faithProjectResolution.state.players;
  updatedUnits = faithProjectResolution.state.units;
  updatedImprovements = faithProjectResolution.state.improvements || [];
  updatedStructures = faithProjectResolution.state.structures || [];
  updatedCities = faithProjectResolution.state.cities || [];
  updatedActiveEffects = faithProjectResolution.state.activeEffects || [];

  const nextTurnValue = isNewTurn ? state.turn + 1 : state.turn;
  const victoryState: GameState = {
    ...state,
    units: updatedUnits,
    players: updatedPlayers,
    improvements: updatedImprovements,
    structures: updatedStructures,
    cities: updatedCities,
    activeEffects: updatedActiveEffects,
  };
  const victory = faithProjectResolution.completed
    ? { winnerId: currentPlayer.id, victoryType: "faith" as const }
    : checkVictoryConditions(victoryState, updatedPlayers, { turnOverride: nextTurnValue });

  return {
    ...state,
    units: updatedUnits,
    players: updatedPlayers,
    improvements: updatedImprovements,
    structures: updatedStructures,
    cities: updatedCities,
    activeEffects: updatedActiveEffects,
    currentPlayerIndex: nextPlayerIndex,
    turn: nextTurnValue,
    phase: victory ? 'ended' : state.phase,
    winner: victory?.winnerId,
    victoryType: victory?.victoryType,
    rngSeed,
    lastAction: endTurnEvents.length > 0
      ? { type: 'END_TURN_RESOLUTION', payload: { endingPlayerId: payload.playerId, nextPlayerId: nextPlayer.id, events: endTurnEvents } }
      : { type: 'END_TURN', payload }
  };
}

// Polytopia-style resource harvesting
// Clear Forest Handler



export function checkVictoryConditions(
  state: GameState,
  players: PlayerState[],
  context?: { turnOverride?: number }
): VictoryResult | undefined {
  const playerCount = players.length;
  const totalTechs = Object.keys(TECHNOLOGIES).length || 1;
  const economicTargets = GameRuleHelpers.getEconomicVictoryThresholds(playerCount);
  const culturalTargets = GameRuleHelpers.getCulturalVictoryThresholds(playerCount);
  const activePlayers = players.filter(p => p.citiesOwned.length > 0);
  const totalOwnedCities = players.reduce((sum, p) => sum + p.citiesOwned.length, 0);
  const turn = context?.turnOverride ?? state.turn;

  const economicCandidates = activePlayers.filter(player => {
    const income = calculatePlayerStarIncome(state, player);
    return GameRuleHelpers.hasEconomicVictory(player, income, totalTechs, economicTargets);
  });
  const economicWinner = pickWinnerByTiebreaker(state, economicCandidates);
  if (economicWinner) {
    return { winnerId: economicWinner.id, victoryType: "economic" };
  }

  const culturalCandidates = activePlayers.filter(player => {
    const population = getPlayerPopulation(state, player.id);
    const structures = getCulturalStructureCount(state, player.id);
    return GameRuleHelpers.hasCulturalVictory(player, population, structures, culturalTargets);
  });
  const culturalWinner = pickWinnerByTiebreaker(state, culturalCandidates);
  if (culturalWinner) {
    return { winnerId: culturalWinner.id, victoryType: "cultural" };
  }

  if (GAME_RULES.victory.eliminationRequired) {
    const playersWithCities = players.filter(p => p.citiesOwned.length > 0);
    if (playersWithCities.length === 1) {
      return { winnerId: playersWithCities[0].id, victoryType: "elimination" };
    }
  }

  const territorialCandidates = activePlayers.filter(player => {
    if (totalOwnedCities <= 0) return false;
    return GameRuleHelpers.hasTerritorialVictory(player.citiesOwned.length, totalOwnedCities);
  });
  const territorialWinner = pickWinnerByTiebreaker(state, territorialCandidates);
  if (territorialWinner) {
    return { winnerId: territorialWinner.id, victoryType: "territorial" };
  }

  const maxTurns = GAME_RULES.turns.maxTurnsPerGame;
  if (maxTurns > 0 && turn >= maxTurns) {
    const eligible = players.filter(p => p.citiesOwned.length > 0);
    const winner = pickWinnerByTiebreaker(state, eligible.length > 0 ? eligible : players);
    if (winner) {
      return { winnerId: winner.id, victoryType: "domination" };
    }
  }

  return undefined;
}
