import { GameState, PlayerState } from '@shared/types/game';
import { GameRuleHelpers, GAME_RULES } from '@shared/data/gameRules';
import { hexNeighbors } from '@shared/utils/hex';
import type { HexCoordinate } from '@shared/types/coordinates';
import { computeUnitPassiveEffectsForPlayer } from '@shared/logic/unitPassiveEffects';
import { getUnitDefinition } from '@shared/data/units';

export interface PlayerStats {
  faithPercentage: number;
  pridePercentage: number;
  dissentPercentage: number;
  cityCount: number;
  techCount: number;
  starProduction: number;
  starProductionBreakdown: Array<{ source: string; amount: number }>;
}

export function getPlayerStats(player: PlayerState, gameState?: GameState | null): PlayerStats {
  const cityIds = (player as any).citiesOwned ?? (player as any).cities ?? [];
  const techs = player.researchedTechs ?? [];
  const dissentValue = (player.stats as any)?.internalDissent ?? (player.stats as any)?.dissent ?? 0;
  if (!gameState) {
    const fallback = GameRuleHelpers.calculateStarIncome(cityIds.length);
    return {
      faithPercentage: player.stats?.faith ?? 0,
      pridePercentage: player.stats?.pride ?? 0,
      dissentPercentage: dissentValue,
      cityCount: cityIds.length,
      techCount: techs.length,
      starProduction: fallback,
      starProductionBreakdown: [{ source: 'Base', amount: fallback }],
    };
  }
  const breakdown: Array<{ source: string; amount: number }> = [];
  let totalStarProduction = 0;

  const ownedCities = (gameState.cities || []).filter(c => c.ownerId === player.id);
  const ownedCityIds = new Set(ownedCities.map(c => c.id));

  const roadKeys = new Set(
    (gameState.improvements || [])
      .filter(imp => imp.ownerId === player.id)
      .filter(imp => imp.type === 'road')
      .filter(imp => imp.constructionTurns === 0)
      .map(imp => `${imp.coordinate.q},${imp.coordinate.r}`)
  );

  const areCitiesConnectedByRoad = (fromCityId: string, toCityId: string): boolean => {
    if (fromCityId === toCityId) return false;
    const fromCity = ownedCities.find(c => c.id === fromCityId);
    const toCity = ownedCities.find(c => c.id === toCityId);
    if (!fromCity || !toCity) return false;
    if (roadKeys.size === 0) return false;

    const fromKey = `${fromCity.coordinate.q},${fromCity.coordinate.r}`;
    const toKey = `${toCity.coordinate.q},${toCity.coordinate.r}`;
    const cityKeys = new Set([fromKey, toKey]);

    const fromHasAdjacentRoad = hexNeighbors(fromCity.coordinate).some(n => roadKeys.has(`${n.q},${n.r}`));
    const toHasAdjacentRoad = hexNeighbors(toCity.coordinate).some(n => roadKeys.has(`${n.q},${n.r}`));
    if (!fromHasAdjacentRoad || !toHasAdjacentRoad) return false;

    const visited = new Set<string>();
    const queue: HexCoordinate[] = [fromCity.coordinate];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentKey = `${current.q},${current.r}`;
      if (visited.has(currentKey)) continue;
      visited.add(currentKey);

      if (currentKey === toKey) return true;

      const isCity = cityKeys.has(currentKey);
      const isRoad = roadKeys.has(currentKey);

      for (const neighbor of hexNeighbors(current)) {
        const neighborKey = `${neighbor.q},${neighbor.r}`;
        const canTraverse =
          (isCity && roadKeys.has(neighborKey)) ||
          (isRoad && (roadKeys.has(neighborKey) || cityKeys.has(neighborKey)));
        if (canTraverse && !visited.has(neighborKey)) queue.push(neighbor);
      }
    }

    return false;
  };

  // City income (matches reducer: sums city.starProduction for owned cities)
  if (ownedCities.length > 0) {
    const rawCityIncome = ownedCities.reduce((sum, c) => sum + (c.starProduction || 0), 0);
    const unrestPenalty = ownedCities.reduce(
      (sum, c) => sum + ((c.unrestTurns || 0) > 0 ? GAME_RULES.morale.unrestIncomePenaltyPerCity : 0),
      0
    );
    const cityIncome = Math.max(0, rawCityIncome - unrestPenalty);
    if (rawCityIncome > 0) breakdown.push({ source: `Cities (${ownedCities.length})`, amount: rawCityIncome });
    if (unrestPenalty > 0) breakdown.push({ source: `Unrest`, amount: -unrestPenalty });
    totalStarProduction += cityIncome;
  } else {
    const fallback = GameRuleHelpers.calculateStarIncome(cityIds.length);
    breakdown.push({ source: 'Base', amount: fallback });
    totalStarProduction += fallback;
  }

  // Improvements income (includes seafaring port bonus to match reducer)
  const playerImprovements = gameState.improvements?.filter(imp => imp.ownerId === player.id) || [];
  const improvementIncome = playerImprovements.reduce((sum, imp) => {
    if (imp.constructionTurns !== 0) return sum;
    let stars = imp.starProduction ?? 0;
    if (imp.type === 'port' && player.researchedTechs?.includes('seafaring')) stars += 1;
    return sum + stars;
  }, 0);
  if (improvementIncome > 0) breakdown.push({ source: `Improvements (${playerImprovements.length})`, amount: improvementIncome });
  totalStarProduction += improvementIncome;

  // Structures income
  const playerStructures = gameState.structures?.filter(s => s.ownerId === player.id) || [];
  const structureIncome = playerStructures.reduce((sum, s) => {
    if (s.constructionTurns !== 0) return sum;
    return sum + (s.effects?.starProduction || 0);
  }, 0);
  if (structureIncome > 0) breakdown.push({ source: `Structures (${playerStructures.length})`, amount: structureIncome });
  totalStarProduction += structureIncome;

  // Converted villages income (+1★/turn each by design)
  const convertedVillages = (gameState.map?.tiles || []).filter(tile =>
    tile.feature === 'village' &&
    tile.cityOwner === player.id &&
    tile.captureType === 'converted' &&
    tile.starBonus
  );
  const villageIncome = convertedVillages.reduce((sum, tile) => sum + (tile.starBonus || 0), 0);
  if (villageIncome > 0) breakdown.push({ source: `Converted Villages (${convertedVillages.length})`, amount: villageIncome });
  totalStarProduction += villageIncome;

  // Road-connected city bonus (+1 per extra city in each connected component; doubled with Trade tech)
  const roadBonusIncome = (() => {
    if (ownedCities.length < 2) return 0;
    if (roadKeys.size === 0) return 0;

    const cityKeys = new Set(ownedCities.map(city => `${city.coordinate.q},${city.coordinate.r}`));
    const visited = new Set<string>();
    let bonus = 0;

    for (const city of ownedCities) {
      const startKey = `${city.coordinate.q},${city.coordinate.r}`;
      if (visited.has(startKey)) continue;

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
          const canTraverse =
            (isCity && roadKeys.has(neighborKey)) ||
            (isRoad && (roadKeys.has(neighborKey) || cityKeys.has(neighborKey)));
          if (canTraverse && !visited.has(neighborKey)) queue.push(neighbor);
        }
      }

      bonus += Math.max(0, componentCities.size - 1);
    }

    return (player.researchedTechs?.includes('trade') ? 2 : 1) * bonus;
  })();
  if (roadBonusIncome > 0) breakdown.push({ source: 'Road Network', amount: roadBonusIncome });
  totalStarProduction += roadBonusIncome;

  // Trade routes income (valid routes only, matching reducer validation)
  const tradeRoutes = player.tradeRoutes || [];
  const tradeIncome = tradeRoutes.reduce((sum, route) => {
    if (!ownedCityIds.has(route.fromCityId) || !ownedCityIds.has(route.toCityId)) return sum;
    if (!areCitiesConnectedByRoad(route.fromCityId, route.toCityId)) return sum;
    return sum + (route.starsPerTurn || 0);
  }, 0);
  if (tradeIncome > 0) breakdown.push({ source: `Trade Routes (${tradeRoutes.length})`, amount: tradeIncome });
  totalStarProduction += tradeIncome;

  // Passive unit income (e.g., Priestcraft Preachers). Matches reducer end-turn logic.
  const unitPassive = computeUnitPassiveEffectsForPlayer(gameState, player.id, player.stats);
  unitPassive.breakdown.forEach(entry => {
    const perUnit = entry.perTurn.stars || 0;
    if (!perUnit) return;
    const amount = perUnit * entry.count;
    const def = getUnitDefinition(entry.unitType);
    breakdown.push({ source: `${def.name} (${entry.count})`, amount });
    totalStarProduction += amount;
  });

  return {
    faithPercentage: player.stats?.faith ?? 0,
    pridePercentage: player.stats?.pride ?? 0,
    dissentPercentage: dissentValue,
    cityCount: ownedCities.length,
    techCount: techs.length,
    starProduction: totalStarProduction,
    starProductionBreakdown: breakdown
  };
}
