import type { GameState } from '../types/game';
import type { HexCoordinate } from '../types/coordinates';
import { hexDistance, hexNeighbors } from '../utils/hex';

export function areCitiesConnectedByRoad(
  state: GameState,
  playerId: string,
  fromCityId: string,
  toCityId: string
): boolean {
  if (fromCityId === toCityId) return false;

  const fromCity = (state.cities || []).find(c => c.id === fromCityId && c.ownerId === playerId);
  const toCity = (state.cities || []).find(c => c.id === toCityId && c.ownerId === playerId);
  if (!fromCity || !toCity) return false;

  const roadKeys = new Set(
    (state.improvements || [])
      .filter(imp => imp.ownerId === playerId)
      .filter(imp => imp.type === 'road')
      .filter(imp => imp.constructionTurns === 0)
      .map(imp => `${imp.coordinate.q},${imp.coordinate.r}`)
  );
  if (roadKeys.size === 0) return false;

  const fromKey = `${fromCity.coordinate.q},${fromCity.coordinate.r}`;
  const toKey = `${toCity.coordinate.q},${toCity.coordinate.r}`;
  const cityKeys = new Set([fromKey, toKey]);

  // Both endpoints must touch the road network.
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
}

export function calculateTradeRouteStarsPerTurn(
  state: GameState,
  playerId: string,
  fromCityId: string,
  toCityId: string
): number {
  const fromCity = (state.cities || []).find(c => c.id === fromCityId && c.ownerId === playerId);
  const toCity = (state.cities || []).find(c => c.id === toCityId && c.ownerId === playerId);
  if (!fromCity || !toCity) return 0;

  const base = 1 + Math.floor((fromCity.level + toCity.level) / 2); // lvl1+lvl1 => 2
  const distance = hexDistance(fromCity.coordinate, toCity.coordinate);
  const proximity = Math.max(0, 2 - Math.floor(distance / 4)); // 0..2 small bump for shorter routes
  const connected = areCitiesConnectedByRoad(state, playerId, fromCityId, toCityId);
  const connectivityBonus = connected ? 1 : 0;
  return Math.max(1, Math.min(6, base + proximity + connectivityBonus));
}

export function calculateTradeRouteEstablishCostStars(starsPerTurn: number): number {
  return Math.max(8, starsPerTurn * 5);
}
